import type { RawWsEvent } from "@/hooks/useLyzrWebSocket"
import {
  type ValidationResultRow,
  type ValidationCheck,
  normalizeChecks,
  persistValidationResult,
} from "./validation-results"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ExtractedResultType = "ocr" | "validator" | "order_lookup"

export interface ExtractedAgentResult {
  type: ExtractedResultType
  sessionId: string
  agentId: string
  rawData: Record<string, unknown>
  inputPayload: Record<string, unknown> | null
  timestamp: string
}

export interface ExtractionContext {
  ocrAgentId: string
  validatorAgentId: string
  managerAgentId: string
  sessionId: string
  userId: string
}

// ---------------------------------------------------------------------------
// In-memory accumulator for pairing tool_call_prepare with tool_output
// ---------------------------------------------------------------------------

interface PendingToolCall {
  targetAgentId: string
  arguments: Record<string, unknown>
  timestamp: string
}

const pendingCalls = new Map<string, PendingToolCall>()

export function clearPendingCalls() {
  pendingCalls.clear()
}

// ---------------------------------------------------------------------------
// Python repr normalization
// ---------------------------------------------------------------------------

function normalizePythonRepr(raw: string): string {
  let s = raw
  s = s.replace(/\bTrue\b/g, "true")
  s = s.replace(/\bFalse\b/g, "false")
  s = s.replace(/\bNone\b/g, "null")
  s = s.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, '"$1"')
  return s
}

function tryParseToolOutput(raw: unknown): Record<string, unknown> | null {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>
  }

  if (typeof raw !== "string") return null

  const str = raw.trim()
  if (!str.startsWith("{") && !str.startsWith("[")) return null

  try {
    const parsed = JSON.parse(str)
    if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>
  } catch {
    // Fall through to Python repr normalization
  }

  try {
    const normalized = normalizePythonRepr(str)
    const parsed = JSON.parse(normalized)
    if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>
  } catch {
    // Unparseable
  }

  return null
}

// ---------------------------------------------------------------------------
// Agent ID matching from tool_name field
// ---------------------------------------------------------------------------

function extractAgentIdFromToolName(toolName: string): string | null {
  const match = toolName.match(/^agent_tool_(.+)$/)
  return match ? match[1] : null
}

// ---------------------------------------------------------------------------
// Core event processor
// ---------------------------------------------------------------------------

export function processRawWsEvent(
  event: RawWsEvent,
  ctx: ExtractionContext
): ExtractedAgentResult | null {
  const { eventType, payload } = event

  // 1. Capture tool_call_prepare -- stash input arguments for later pairing
  if (eventType === "tool_call_prepare") {
    const toolName = (payload.tool_name as string) || ""
    const targetId = extractAgentIdFromToolName(toolName)
    if (targetId && (targetId === ctx.validatorAgentId || targetId === ctx.ocrAgentId)) {
      const args = tryParseToolOutput(payload.arguments || payload.tool_arguments || payload.args)
      pendingCalls.set(targetId, {
        targetAgentId: targetId,
        arguments: args || (payload as Record<string, unknown>),
        timestamp: event.receivedAt,
      })
    }
    return null
  }

  // 2. Extract structured data from tool_output events
  if (eventType === "tool_output" || eventType === "tool_response") {
    const toolName = (payload.tool_name as string) || ""
    const sourceAgentId = extractAgentIdFromToolName(toolName)

    if (!sourceAgentId) return null

    const outputRaw = payload.tool_output ?? payload.output ?? payload.response ?? payload.result
    const parsed = tryParseToolOutput(outputRaw)
    if (!parsed) return null

    if (sourceAgentId === ctx.ocrAgentId) {
      return {
        type: "ocr",
        sessionId: ctx.sessionId,
        agentId: sourceAgentId,
        rawData: parsed,
        inputPayload: null,
        timestamp: event.receivedAt,
      }
    }

    if (sourceAgentId === ctx.validatorAgentId) {
      const pending = pendingCalls.get(sourceAgentId)
      const inputPayload = pending?.arguments || null
      pendingCalls.delete(sourceAgentId)

      return {
        type: "validator",
        sessionId: ctx.sessionId,
        agentId: sourceAgentId,
        rawData: parsed,
        inputPayload,
        timestamp: event.receivedAt,
      }
    }

    return null
  }

  // 3. Extract KB/order lookup data
  if (eventType === "kb_documents_retrieved") {
    const docs = payload.documents || payload.results || payload.data
    const parsed = tryParseToolOutput(docs) || (payload as Record<string, unknown>)

    return {
      type: "order_lookup",
      sessionId: ctx.sessionId,
      agentId: ctx.managerAgentId,
      rawData: parsed,
      inputPayload: null,
      timestamp: event.receivedAt,
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// Convert extracted result to a ValidationResultRow and persist
// ---------------------------------------------------------------------------

const RESULT_TYPE_SUMMARIES: Record<ExtractedResultType, string> = {
  ocr: "OCR Agent -- Image Analysis",
  validator: "Validator Agent -- Fraud Assessment",
  order_lookup: "Order Lookup -- Warranty Data",
}

export function extractedResultToValidationRow(
  result: ExtractedAgentResult,
  userId: string
): ValidationResultRow {
  const rawForStorage: Record<string, unknown> = { ...result.rawData }
  if (result.inputPayload) {
    rawForStorage._validatorInput = result.inputPayload
  }
  rawForStorage._resultType = result.type
  rawForStorage._sourceAgentId = result.agentId

  let checks: ValidationCheck[]
  let overallStatus: "approved" | "flagged" | "rejected"
  let inputSummary: string

  if (result.type === "order_lookup") {
    const normalized = normalizeOrderLookup(result.rawData)
    checks = normalized.checks
    overallStatus = normalized.overallStatus
    inputSummary = RESULT_TYPE_SUMMARIES.order_lookup
  } else if (result.type === "ocr") {
    const normalized = normalizeOcrResult(result.rawData)
    checks = normalized.checks
    overallStatus = normalized.overallStatus
    inputSummary = RESULT_TYPE_SUMMARIES.ocr
  } else {
    const normalized = normalizeChecks(rawForStorage)
    checks = normalized.checks
    overallStatus = normalized.overallStatus
    inputSummary = RESULT_TYPE_SUMMARIES.validator
  }

  return {
    id: Date.now() + Math.random(),
    sessionId: result.sessionId,
    agentId: result.agentId,
    userId,
    inputSummary,
    rawResult: rawForStorage,
    checks,
    overallStatus,
    createdAt: result.timestamp,
  }
}

export async function persistExtractedResult(
  result: ExtractedAgentResult,
  userId: string,
  onValidationResult?: (row: ValidationResultRow) => void
): Promise<ValidationResultRow> {
  const row = extractedResultToValidationRow(result, userId)
  await persistValidationResult(row)
  onValidationResult?.(row)
  return row
}

// ---------------------------------------------------------------------------
// OCR-specific normalization
// ---------------------------------------------------------------------------

function normalizeOcrResult(raw: Record<string, unknown>): {
  checks: ValidationCheck[]
  overallStatus: "approved" | "flagged" | "rejected"
} {
  const checks: ValidationCheck[] = []

  const brand = findField(raw, ["brandDetected", "brand_detected", "brand"])
  if (brand) {
    const val = String(brand)
    const isGood = val.toLowerCase() !== "unknown" && val.toLowerCase() !== "unreadable" && val.toLowerCase() !== "partial"
    checks.push({ name: "Brand Detection", status: isGood ? "pass" : "warn", detail: val })
  }

  const serial = findField(raw, ["serialDetected", "serial_detected", "serial", "serial_number"])
  if (serial) {
    const val = String(serial)
    const isGood = val !== "---" && val.toLowerCase() !== "unreadable" && val.length > 3
    checks.push({ name: "Serial Extraction", status: isGood ? "pass" : "warn", detail: val })
  }

  const capacity = findField(raw, ["capacityDetected", "capacity_detected", "capacity"])
  if (capacity) {
    const val = String(capacity)
    const isGood = val.toLowerCase() !== "unreadable" && val.length > 0
    checks.push({ name: "Capacity Detection", status: isGood ? "pass" : "warn", detail: val })
  }

  const product = findField(raw, ["productText", "product_text", "product_name", "product"])
  if (product) {
    const val = String(product)
    const isGood = val.toLowerCase() !== "unreadable" && val.length > 2
    checks.push({ name: "Product Text", status: isGood ? "pass" : "warn", detail: val })
  }

  const quality = findField(raw, ["imageQuality", "image_quality", "quality"])
  if (quality) {
    const val = String(quality).toLowerCase()
    checks.push({
      name: "Image Quality",
      status: val === "low" || val === "poor" ? "warn" : "pass",
      detail: String(quality),
    })
  }

  const confidence = findField(raw, ["confidence", "match_confidence", "ocr_confidence"])
  if (confidence !== undefined && confidence !== null) {
    const num = Number(confidence)
    if (!isNaN(num)) {
      const pct = num <= 1 ? Math.round(num * 100) : Math.round(num)
      checks.push({
        name: "OCR Confidence",
        status: pct >= 80 ? "pass" : pct >= 50 ? "warn" : "fail",
        detail: `${pct}%`,
      })
    }
  }

  if (checks.length === 0) {
    checks.push({ name: "OCR Processing", status: "pass", detail: "Image analyzed" })
  }

  const failCount = checks.filter((c) => c.status === "fail").length
  const warnCount = checks.filter((c) => c.status === "warn").length
  const overallStatus: "approved" | "flagged" | "rejected" =
    failCount > 0 ? "rejected" : warnCount > 1 ? "flagged" : "approved"

  return { checks, overallStatus }
}

// ---------------------------------------------------------------------------
// Order/KB lookup normalization
// ---------------------------------------------------------------------------

function normalizeOrderLookup(raw: Record<string, unknown>): {
  checks: ValidationCheck[]
  overallStatus: "approved" | "flagged" | "rejected"
} {
  const checks: ValidationCheck[] = []

  const status = findField(raw, ["status", "warranty_status", "warrantyStatus"])
  if (status) {
    const val = String(status).toLowerCase()
    checks.push({
      name: "Warranty Status",
      status: val === "active" || val === "valid" ? "pass" : val === "expired" ? "fail" : "warn",
      detail: String(status),
    })
  }

  const product = findField(raw, ["product", "product_name", "productName"])
  if (product) {
    checks.push({ name: "Product", status: "pass", detail: String(product) })
  }

  const serial = findField(raw, ["serial_number", "serialNumber", "serial"])
  if (serial) {
    checks.push({ name: "Serial Number", status: "pass", detail: String(serial) })
  }

  const purchaseDate = findField(raw, ["purchase_date", "purchaseDate", "date_of_purchase"])
  if (purchaseDate) {
    checks.push({ name: "Purchase Date", status: "pass", detail: String(purchaseDate) })
  }

  const registered = findField(raw, ["registered", "is_registered"])
  if (registered !== undefined && registered !== null) {
    checks.push({
      name: "Registration",
      status: registered ? "pass" : "warn",
      detail: registered ? "Registered" : "Not registered",
    })
  }

  const priorClaims = findField(raw, ["prior_claims", "priorClaims", "claim_count"])
  if (priorClaims !== undefined && priorClaims !== null) {
    const num = Number(priorClaims)
    checks.push({
      name: "Prior Claims",
      status: num === 0 ? "pass" : num <= 1 ? "warn" : "fail",
      detail: `${num} previous claim${num !== 1 ? "s" : ""}`,
    })
  }

  const eligible = findField(raw, ["replacement_eligible", "replacementEligible", "eligible"])
  if (eligible !== undefined && eligible !== null) {
    checks.push({
      name: "Replacement Eligible",
      status: eligible ? "pass" : "fail",
      detail: eligible ? "Yes" : "No",
    })
  }

  if (checks.length === 0) {
    checks.push({ name: "Order Data Retrieved", status: "pass", detail: "Knowledge base queried" })
  }

  const failCount = checks.filter((c) => c.status === "fail").length
  const warnCount = checks.filter((c) => c.status === "warn").length
  const overallStatus: "approved" | "flagged" | "rejected" =
    failCount > 0 ? "rejected" : warnCount > 1 ? "flagged" : "approved"

  return { checks, overallStatus }
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function findField(obj: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (key in obj && obj[key] !== undefined) return obj[key]
  }
  for (const val of Object.values(obj)) {
    if (val && typeof val === "object" && !Array.isArray(val)) {
      for (const key of keys) {
        if (key in (val as Record<string, unknown>)) {
          return (val as Record<string, unknown>)[key]
        }
      }
    }
  }
  return undefined
}
