import type { LyzrAgentConfig } from "./lyzr-config"
import type { Scenario } from "./scenarios"
import { createLogEntry, type LogEntry } from "./agent-logs"
import {
  normalizeChecks,
  persistValidationResult,
  type ValidationResultRow,
  type ValidationCheck,
} from "./validation-results"
import {
  extractedResultToValidationRow,
  type ExtractedAgentResult,
} from "./ws-agent-extractor"

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OcrOutput {
  brandDetected: string
  productText: string
  serialDetected: string
  capacityDetected: string
  imageQuality: string
  raw: Record<string, unknown>
}

export interface ValidatorOutput {
  checks: ValidationCheck[]
  overallStatus: "approved" | "flagged" | "rejected"
  inputSummary: string
  raw: Record<string, unknown>
}

export interface ValidatorKbData {
  productName: string
  matchStatus: string
  purchaseDate?: string
  priorClaims?: number
  replacementEligible?: boolean
  detailsVerified: string[]
}

export interface WorkflowResult {
  ocrOutput: OcrOutput | null
  validatorOutput: ValidatorOutput | null
  validationRow: ValidationResultRow | null
  validatorKbData: ValidatorKbData | null
  managerSummary: string | null
  error: string | null
}

export type WorkflowProgress =
  | { phase: "order-lookup"; detail: string }
  | { phase: "ocr"; detail: string }
  | { phase: "validation"; detail: string }
  | { phase: "manager-summary"; detail: string }
  | { phase: "complete"; detail: string }
  | { phase: "error"; detail: string }

type AddLog = (log: LogEntry) => void
type OnProgress = (progress: WorkflowProgress) => void
type OnValidation = (row: ValidationResultRow) => void

// ---------------------------------------------------------------------------
// Lyzr API call (shared helper)
// ---------------------------------------------------------------------------

async function callLyzrAgent(
  config: { apiKey: string; agentId: string; userId: string; sessionId: string },
  message: string,
  imageBase64?: string
): Promise<{ response?: string; error?: string; session_id?: string }> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/lyzr-chat`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      apiKey: config.apiKey,
      agentId: config.agentId,
      userId: config.userId,
      sessionId: config.sessionId,
      message,
      ...(imageBase64 ? { imageBase64 } : {}),
    }),
  })
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    return { error: text || `Request failed with status ${res.status}` }
  }
}

// ---------------------------------------------------------------------------
// Individual agent call wrappers (with full audit logging)
// ---------------------------------------------------------------------------

export async function callOcrAgent(
  config: LyzrAgentConfig,
  imageBase64: string,
  addLog: AddLog,
): Promise<{ output: OcrOutput | null; raw: Record<string, unknown> }> {
  const ocrSessionId = `${config.ocrAgentId}-${crypto.randomUUID().slice(0, 8)}`
  const ocrConfig = {
    apiKey: config.apiKey,
    agentId: config.ocrAgentId,
    userId: config.userId,
    sessionId: ocrSessionId,
  }

  addLog(createLogEntry("request", ocrSessionId, {
    agentId: config.ocrAgentId,
    userId: config.userId,
    sessionId: ocrSessionId,
    message: "Analyze this product image and extract all visible text, brand, serial, capacity.",
    hasImage: true,
  }, "ocr"))

  const result = await callLyzrAgent(
    ocrConfig,
    "Analyze this product image and extract all visible text, brand, serial number, capacity, and image quality. Return strict JSON.",
    imageBase64,
  )

  addLog(createLogEntry("response", ocrSessionId, result as Record<string, unknown>, "ocr"))

  const responseText = result.response || ""
  const parsed = tryParseJson(responseText)

  if (!parsed) {
    return { output: null, raw: result as Record<string, unknown> }
  }

  const output: OcrOutput = {
    brandDetected: String(parsed.brandDetected || parsed.brand_detected || parsed.brand || "Unknown"),
    productText: String(parsed.productText || parsed.product_text || parsed.product || "Unknown"),
    serialDetected: String(parsed.serialDetected || parsed.serial_detected || parsed.serial || "---"),
    capacityDetected: String(parsed.capacityDetected || parsed.capacity_detected || parsed.capacity || "Unknown"),
    imageQuality: String(parsed.imageQuality || parsed.image_quality || "Unknown"),
    raw: parsed,
  }

  return { output, raw: result as Record<string, unknown> }
}

export async function callValidatorAgent(
  config: LyzrAgentConfig,
  ocrJson: Record<string, unknown>,
  orderSummary: Record<string, unknown>,
  addLog: AddLog,
): Promise<{ output: ValidatorOutput | null; raw: Record<string, unknown> }> {
  const valSessionId = `${config.validatorAgentId}-${crypto.randomUUID().slice(0, 8)}`
  const valConfig = {
    apiKey: config.apiKey,
    agentId: config.validatorAgentId,
    userId: config.userId,
    sessionId: valSessionId,
  }

  const payload = JSON.stringify({ ocr_result: ocrJson, order_summary: orderSummary }, null, 2)

  addLog(createLogEntry("request", valSessionId, {
    agentId: config.validatorAgentId,
    userId: config.userId,
    sessionId: valSessionId,
    message: `Validate OCR output against order summary`,
    ocrJson,
    orderSummary,
  }, "validator"))

  const result = await callLyzrAgent(
    valConfig,
    `Validate the following OCR JSON output against the order summary and return your assessment:\n\n${payload}`,
  )

  addLog(createLogEntry("response", valSessionId, result as Record<string, unknown>, "validator"))

  const responseText = result.response || ""
  const parsed = tryParseJson(responseText)

  if (!parsed) {
    return { output: null, raw: result as Record<string, unknown> }
  }

  const { checks, overallStatus, inputSummary } = normalizeChecks(parsed)

  return {
    output: { checks, overallStatus, inputSummary, raw: parsed },
    raw: result as Record<string, unknown>,
  }
}

export async function callManagerForSummary(
  config: LyzrAgentConfig,
  validatorResult: ValidatorOutput,
  context: string,
  addLog: AddLog,
): Promise<string> {
  addLog(createLogEntry("request", config.sessionId, {
    agentId: config.agentId,
    userId: config.userId,
    sessionId: config.sessionId,
    message: "Generate customer-facing summary of validation outcome",
    validationStatus: validatorResult.overallStatus,
    checksCount: validatorResult.checks.length,
  }, "managerial"))

  const prompt = `The system has completed automated validation. Here are the results:

Status: ${validatorResult.overallStatus.toUpperCase()}
Checks performed:
${validatorResult.checks.map((c) => `- ${c.name}: ${c.status} (${c.detail})`).join("\n")}

Context: ${context}

Please communicate the outcome to the customer in a professional, empathetic manner. Do NOT repeat the raw checks. Provide a clear summary and recommended next steps. Keep it concise (2-3 sentences).`

  try {
    const result = await callLyzrAgent(
      { apiKey: config.apiKey, agentId: config.agentId, userId: config.userId, sessionId: config.sessionId },
      prompt,
    )

    addLog(createLogEntry("response", config.sessionId, result as Record<string, unknown>, "managerial"))
    return result.response || fallbackSummary(validatorResult.overallStatus)
  } catch {
    return fallbackSummary(validatorResult.overallStatus)
  }
}

function fallbackSummary(status: string): string {
  if (status === "approved") return "Your product has been verified successfully. All checks passed and your claim can proceed."
  if (status === "rejected") return "We were unable to verify your product. Some details did not match our records. A support specialist will review your case."
  return "Your submission requires additional review. A support specialist may reach out for more information."
}

// ---------------------------------------------------------------------------
// Full orchestrated workflow (app-driven)
// ---------------------------------------------------------------------------

export async function runVerificationWorkflow(opts: {
  config: LyzrAgentConfig
  imageBase64: string
  scenario: Scenario
  addLog: AddLog
  onProgress: OnProgress
  onValidation: OnValidation
}): Promise<WorkflowResult> {
  const { config, imageBase64, scenario, addLog, onProgress, onValidation } = opts
  const result: WorkflowResult = {
    ocrOutput: null,
    validatorOutput: null,
    validationRow: null,
    validatorKbData: null,
    managerSummary: null,
    error: null,
  }

  try {
    // Step 1: Order lookup (deterministic, app-driven)
    onProgress({ phase: "order-lookup", detail: "Looking up order in knowledge base..." })
    const orderSummary = {
      product: scenario.warranty.product,
      serialNumber: scenario.warranty.serialNumber,
      status: scenario.warranty.status,
      purchaseDate: scenario.warranty.purchaseDate,
      priorClaims: scenario.warranty.priorClaims,
      registered: scenario.warranty.registered,
      replacementEligible: scenario.warranty.replacementEligible,
    }
    addLog(createLogEntry("request", config.sessionId, {
      step: "order-lookup",
      serialNumber: scenario.warranty.serialNumber,
    }, "managerial"))
    addLog(createLogEntry("response", config.sessionId, {
      step: "order-lookup",
      result: "found",
      orderSummary,
    }, "managerial"))

    // Persist order lookup as a validation entry
    const orderResult: ExtractedAgentResult = {
      type: "order_lookup",
      sessionId: config.sessionId,
      agentId: config.agentId,
      rawData: orderSummary,
      inputPayload: null,
      timestamp: new Date().toISOString(),
    }
    const orderRow = extractedResultToValidationRow(orderResult, config.userId)
    persistValidationResult(orderRow)
    onValidation(orderRow)

    // Step 2: Call OCR agent directly
    onProgress({ phase: "ocr", detail: "Sending image to OCR agent for analysis..." })
    const ocrResult = await callOcrAgent(config, imageBase64, addLog)

    if (!ocrResult.output) {
      // Live agent didn't return parseable JSON -- use scenario OCR data
      ocrResult.output = {
        brandDetected: scenario.ocr.brandDetected,
        productText: scenario.ocr.productText,
        serialDetected: scenario.ocr.serialDetected,
        capacityDetected: scenario.ocr.capacityDetected,
        imageQuality: scenario.ocr.imageQuality,
        raw: { ...scenario.ocr, _fallback: true },
      }
      addLog(createLogEntry("response", config.sessionId, {
        step: "ocr-fallback",
        detail: "Agent response not parseable as JSON, using scenario data",
        scenarioOcr: scenario.ocr,
      }, "ocr"))
    }
    result.ocrOutput = ocrResult.output

    // Persist OCR result as a validation entry
    const ocrExtracted: ExtractedAgentResult = {
      type: "ocr",
      sessionId: config.sessionId,
      agentId: config.ocrAgentId,
      rawData: ocrResult.output.raw,
      inputPayload: null,
      timestamp: new Date().toISOString(),
    }
    const ocrRow = extractedResultToValidationRow(ocrExtracted, config.userId)
    persistValidationResult(ocrRow)
    onValidation(ocrRow)

    // Step 3: Call Validator agent with OCR output + order summary
    onProgress({ phase: "validation", detail: "Sending OCR result and order data to Validator agent..." })
    const valResult = await callValidatorAgent(config, ocrResult.output.raw, orderSummary, addLog)

    if (!valResult.output) {
      // Live agent didn't return parseable JSON -- compute validation from scenario data
      const offlineChecks = computeOfflineChecks(scenario, ocrResult.output)
      valResult.output = {
        checks: offlineChecks.checks,
        overallStatus: offlineChecks.overallStatus,
        inputSummary: "Validator Agent -- Fraud Assessment",
        raw: { ...offlineChecks, _fallback: true },
      }
      addLog(createLogEntry("response", config.sessionId, {
        step: "validator-fallback",
        detail: "Agent response not parseable as JSON, using computed validation",
      }, "validator"))
    }
    result.validatorOutput = valResult.output
    result.validatorKbData = extractValidatorKbData(valResult.output.raw)

    // Step 4: Persist validation result (with OCR input stored alongside)
    const valRawWithMeta: Record<string, unknown> = {
      ...valResult.output.raw,
      _resultType: "validator",
      _sourceAgentId: config.validatorAgentId,
      _validatorInput: { ocr_result: ocrResult.output.raw, order_summary: orderSummary },
    }
    const validationRow: ValidationResultRow = {
      id: Date.now() + Math.random(),
      sessionId: config.sessionId,
      agentId: config.validatorAgentId,
      userId: config.userId,
      inputSummary: "Validator Agent -- Fraud Assessment",
      rawResult: valRawWithMeta,
      checks: valResult.output.checks,
      overallStatus: valResult.output.overallStatus,
      createdAt: new Date().toISOString(),
    }
    persistValidationResult(validationRow)
    onValidation(validationRow)
    result.validationRow = validationRow

    // Step 5: Ask Manager to generate customer-facing summary
    onProgress({ phase: "manager-summary", detail: "Generating customer-facing summary..." })
    const context = `Product: ${scenario.warranty.product}, Serial: ${scenario.warranty.serialNumber}`
    result.managerSummary = await callManagerForSummary(config, valResult.output, context, addLog)

    onProgress({ phase: "complete", detail: "Verification complete" })
    return result
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Workflow error"
    onProgress({ phase: "error", detail: msg })
    result.error = msg
    return result
  }
}

// ---------------------------------------------------------------------------
// Shared check computation from scenario + OCR data
// ---------------------------------------------------------------------------

function computeOfflineChecks(
  scenario: Scenario,
  ocrOutput: OcrOutput
): { checks: ValidationCheck[]; overallStatus: "approved" | "flagged" | "rejected" } {
  const checks: ValidationCheck[] = []

  const brandMatch = ocrOutput.brandDetected.toLowerCase() === "sandisk"
  checks.push({
    name: "Brand Verification",
    status: brandMatch ? "pass" : ocrOutput.brandDetected === "Partial" ? "warn" : "fail",
    detail: brandMatch ? "SanDisk branding confirmed" : `Detected: ${ocrOutput.brandDetected}`,
  })

  const serialMatch = ocrOutput.serialDetected === scenario.warranty.serialNumber
  checks.push({
    name: "Serial Number Match",
    status: serialMatch ? "pass" : ocrOutput.serialDetected === "---" ? "warn" : "fail",
    detail: serialMatch
      ? `Serial ${ocrOutput.serialDetected} matches order`
      : ocrOutput.serialDetected === "---"
        ? "Serial number unreadable in image"
        : `Image serial ${ocrOutput.serialDetected} does not match order serial ${scenario.warranty.serialNumber}`,
  })

  const expectedCapacity = scenario.warranty.product.match(/(\d+GB)/)?.[1] || ""
  const capacityMatch = ocrOutput.capacityDetected === expectedCapacity
  checks.push({
    name: "Capacity Match",
    status: capacityMatch ? "pass" : ocrOutput.capacityDetected === "Unreadable" ? "warn" : "fail",
    detail: capacityMatch
      ? `${ocrOutput.capacityDetected} matches order`
      : ocrOutput.capacityDetected === "Unreadable"
        ? "Capacity unreadable in image"
        : `Image shows ${ocrOutput.capacityDetected}, order is for ${expectedCapacity}`,
  })

  const qualityGood = ocrOutput.imageQuality === "High"
  checks.push({
    name: "Image Quality",
    status: qualityGood ? "pass" : "warn",
    detail: `${ocrOutput.imageQuality} quality`,
  })

  checks.push({
    name: "Risk Score",
    status: scenario.risk.score <= 30 ? "pass" : scenario.risk.score <= 60 ? "warn" : "fail",
    detail: `${scenario.risk.score}/100`,
  })

  const failCount = checks.filter((c) => c.status === "fail").length
  const warnCount = checks.filter((c) => c.status === "warn").length
  let overallStatus: "approved" | "flagged" | "rejected" = "approved"
  if (failCount > 0) overallStatus = "rejected"
  else if (warnCount > 1) overallStatus = "flagged"

  return { checks, overallStatus }
}

// ---------------------------------------------------------------------------
// Offline (demo) workflow -- uses scenario data, no agent calls
// ---------------------------------------------------------------------------

export function runOfflineVerification(scenario: Scenario): WorkflowResult {
  const ocrOutput: OcrOutput = {
    brandDetected: scenario.ocr.brandDetected,
    productText: scenario.ocr.productText,
    serialDetected: scenario.ocr.serialDetected,
    capacityDetected: scenario.ocr.capacityDetected,
    imageQuality: scenario.ocr.imageQuality,
    raw: { ...scenario.ocr },
  }

  const { checks, overallStatus } = computeOfflineChecks(scenario, ocrOutput)

  const validatorOutput: ValidatorOutput = {
    checks,
    overallStatus,
    inputSummary: "Product verification",
    raw: { ocr: scenario.ocr, risk: scenario.risk, checks },
  }

  const validationRow: ValidationResultRow = {
    id: Date.now() + Math.random(),
    sessionId: "offline-demo",
    agentId: "offline",
    userId: "demo",
    inputSummary: "Product verification",
    rawResult: validatorOutput.raw,
    checks,
    overallStatus,
    createdAt: new Date().toISOString(),
  }

  return {
    ocrOutput,
    validatorOutput,
    validationRow,
    validatorKbData: null,
    managerSummary: fallbackSummary(overallStatus),
    error: null,
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractValidatorKbData(raw: Record<string, unknown>): ValidatorKbData | null {
  const vr = (raw.validation_result || raw.match_assessment) as Record<string, unknown> | string | null
  if (!vr || typeof vr === "string") {
    if (typeof vr === "string") {
      return {
        productName: String(raw.ocr_product_name || raw.product_name || ""),
        matchStatus: vr,
        detailsVerified: [],
      }
    }
    return null
  }

  const productName = String(
    vr.product_name || vr.productName || raw.ocr_product_name || ""
  )
  const matchStatus = String(vr.status || vr.match_status || "Unknown")
  const purchaseDate = vr.purchase_date ? String(vr.purchase_date) : undefined
  const priorClaims = typeof vr.prior_claims === "number" ? vr.prior_claims : undefined
  const replacementEligible = typeof vr.eligible_for_replacement === "boolean"
    ? vr.eligible_for_replacement
    : undefined
  const detailsVerified = Array.isArray(vr.details_verified)
    ? (vr.details_verified as string[])
    : []

  if (!productName && !matchStatus) return null

  return { productName, matchStatus, purchaseDate, priorClaims, replacementEligible, detailsVerified }
}

function tryParseJson(text: string): Record<string, unknown> | null {
  try {
    const obj = JSON.parse(text)
    if (obj && typeof obj === "object") return obj as Record<string, unknown>
  } catch { /* ignore */ }
  const match = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
  if (match) {
    try {
      const obj = JSON.parse(match[1])
      if (obj && typeof obj === "object") return obj as Record<string, unknown>
    } catch { /* ignore */ }
  }
  const braceMatch = text.match(/\{[\s\S]*\}/)
  if (braceMatch) {
    try {
      const obj = JSON.parse(braceMatch[0])
      if (obj && typeof obj === "object") return obj as Record<string, unknown>
    } catch { /* ignore */ }
  }
  return null
}
