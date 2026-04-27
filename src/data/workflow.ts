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

export interface WorkflowResult {
  ocrOutput: OcrOutput | null
  validatorOutput: ValidatorOutput | null
  validationRow: ValidationResultRow | null
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
    result.ocrOutput = ocrResult.output

    if (!ocrResult.output) {
      onProgress({ phase: "error", detail: "OCR agent did not return structured output" })
      result.error = "OCR agent did not return structured output"
      return result
    }

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
    result.validatorOutput = valResult.output

    if (!valResult.output) {
      onProgress({ phase: "error", detail: "Validator agent did not return structured output" })
      result.error = "Validator agent did not return structured output"
      return result
    }

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

  const checks: ValidationCheck[] = []

  // Brand check
  const brandMatch = scenario.ocr.brandDetected.toLowerCase() === "sandisk"
  checks.push({
    name: "Brand Verification",
    status: brandMatch ? "pass" : scenario.ocr.brandDetected === "Partial" ? "warn" : "fail",
    detail: brandMatch ? "SanDisk branding confirmed" : `Detected: ${scenario.ocr.brandDetected}`,
  })

  // Serial check
  const serialMatch = scenario.ocr.serialDetected === scenario.warranty.serialNumber
  checks.push({
    name: "Serial Number Match",
    status: serialMatch ? "pass" : scenario.ocr.serialDetected === "---" ? "warn" : "fail",
    detail: serialMatch
      ? `Serial ${scenario.ocr.serialDetected} matches order`
      : scenario.ocr.serialDetected === "---"
        ? "Serial number unreadable in image"
        : `Image serial ${scenario.ocr.serialDetected} does not match order serial ${scenario.warranty.serialNumber}`,
  })

  // Capacity check
  const expectedCapacity = scenario.warranty.product.match(/(\d+GB)/)?.[1] || ""
  const capacityMatch = scenario.ocr.capacityDetected === expectedCapacity
  checks.push({
    name: "Capacity Match",
    status: capacityMatch ? "pass" : scenario.ocr.capacityDetected === "Unreadable" ? "warn" : "fail",
    detail: capacityMatch
      ? `${scenario.ocr.capacityDetected} matches order`
      : scenario.ocr.capacityDetected === "Unreadable"
        ? "Capacity unreadable in image"
        : `Image shows ${scenario.ocr.capacityDetected}, order is for ${expectedCapacity}`,
  })

  // Image quality check
  const qualityGood = scenario.ocr.imageQuality === "High"
  checks.push({
    name: "Image Quality",
    status: qualityGood ? "pass" : "warn",
    detail: `${scenario.ocr.imageQuality} quality`,
  })

  // Risk score check
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
    managerSummary: fallbackSummary(overallStatus),
    error: null,
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
