import { supabase } from "@/lib/supabase"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ValidationCheck {
  name: string
  status: "pass" | "fail" | "warn"
  detail: string
}

export interface ValidationResultRow {
  id: number
  sessionId: string
  agentId: string
  userId: string
  inputSummary: string
  rawResult: Record<string, unknown>
  checks: ValidationCheck[]
  overallStatus: "approved" | "flagged" | "rejected"
  createdAt: string
}

// ---------------------------------------------------------------------------
// Parsing -- detect validation data inside a Manager agent response
// ---------------------------------------------------------------------------

const VALIDATION_KEYS = [
  "ocr_verification",
  "return_request_analysis",
  "validation_results",
  "validation_report",
]

export function parseValidationFromResponse(
  responseText: string
): { validationJson: Record<string, unknown>; chatText: string } | null {
  let json: Record<string, unknown> | null = null

  // Try direct JSON parse
  try {
    const parsed = JSON.parse(responseText)
    if (parsed && typeof parsed === "object" && hasValidationKeys(parsed)) {
      json = parsed
    }
  } catch {
    // Try extracting JSON block from markdown or mixed text
    const blockMatch = responseText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
    if (blockMatch) {
      try {
        const parsed = JSON.parse(blockMatch[1]) as Record<string, unknown>
        if (parsed && typeof parsed === "object" && hasValidationKeys(parsed)) {
          const chatText = responseText.replace(blockMatch[0], "").trim()
          return { validationJson: parsed, chatText: chatText || "" }
        }
      } catch { /* not valid JSON */ }
    }

    // Try finding a JSON object in the text
    const jsonMatch =
      responseText.match(/\{[\s\S]*?\}(?:\s*$)/) ||
      responseText.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>
        if (parsed && typeof parsed === "object" && hasValidationKeys(parsed)) {
          const chatText = responseText.replace(jsonMatch[0], "").trim()
          return { validationJson: parsed, chatText: chatText || "" }
        }
      } catch { /* not valid JSON */ }
    }
  }

  if (!json) return null

  return { validationJson: json, chatText: "" }
}

function hasValidationKeys(obj: Record<string, unknown>): boolean {
  for (const key of VALIDATION_KEYS) {
    if (key in obj) return true
  }
  if ("reasonCodes" in obj || "riskLevel" in obj || "riskScore" in obj) return true
  if ("fraud_and_policy_check" in obj || "recommended_action" in obj) return true
  return false
}

// ---------------------------------------------------------------------------
// Normalization -- convert freeform validation JSON to structured checks
// ---------------------------------------------------------------------------

export function normalizeChecks(raw: Record<string, unknown>): {
  checks: ValidationCheck[]
  overallStatus: "approved" | "flagged" | "rejected"
  inputSummary: string
} {
  const checks: ValidationCheck[] = []
  let overallStatus: "approved" | "flagged" | "rejected" = "approved"
  let inputSummary = "Validation report"

  // OCR verification shape
  const ocr =
    (raw.ocr_verification as Record<string, unknown>) ||
    (raw.riskLevel !== undefined ? raw : null)

  if (ocr && (ocr.riskLevel || ocr.reasonCodes)) {
    inputSummary = "OCR product verification"
    const reasonCodes = (ocr.reasonCodes as string[]) || []
    for (const code of reasonCodes) {
      const isPass = code.includes("SUCCESS") || code.includes("VALID")
      checks.push({
        name: reasonCodeToName(code),
        status: isPass ? "pass" : "fail",
        detail: reasonCodeToDetail(code),
      })
    }

    if (ocr.brandDetected) {
      const hasBrandCheck = checks.some((c) => c.name.toLowerCase().includes("brand"))
      if (!hasBrandCheck) {
        checks.push({ name: "Brand Detection", status: "pass", detail: String(ocr.brandDetected) })
      }
    }
    if (ocr.capacityDetected) {
      const hasCapCheck = checks.some((c) => c.name.toLowerCase().includes("capacity"))
      if (!hasCapCheck) {
        checks.push({ name: "Capacity Detection", status: "pass", detail: String(ocr.capacityDetected) })
      }
    }
    if (ocr.serialDetected) {
      const hasSerialCheck = checks.some((c) => c.name.toLowerCase().includes("serial"))
      if (!hasSerialCheck) {
        checks.push({ name: "Serial Number", status: "pass", detail: String(ocr.serialDetected) })
      }
    }
    if (ocr.imageQuality) {
      const quality = String(ocr.imageQuality).toLowerCase()
      checks.push({
        name: "Image Quality",
        status: quality === "low" || quality === "poor" ? "warn" : "pass",
        detail: String(ocr.imageQuality),
      })
    }
    if (ocr.riskScore !== undefined) {
      const score = Number(ocr.riskScore)
      checks.push({
        name: "Risk Score",
        status: score <= 30 ? "pass" : score <= 60 ? "warn" : "fail",
        detail: `${score}/100`,
      })
    }

    const riskLevel = String(ocr.riskLevel || "").toLowerCase()
    if (riskLevel === "high") overallStatus = "rejected"
    else if (riskLevel === "medium" || riskLevel === "moderate") overallStatus = "flagged"
    else overallStatus = "approved"

    return { checks, overallStatus, inputSummary }
  }

  // Return request analysis shape
  const rra = raw.return_request_analysis as Record<string, unknown> | undefined
  if (rra) {
    inputSummary = "Return request analysis"

    const pm = rra.product_match as Record<string, unknown> | undefined
    if (pm) {
      const conf = pm.match_confidence as number | undefined
      if (conf !== undefined) {
        const pct = Math.round(conf * 100)
        checks.push({
          name: "Product Match",
          status: pct >= 80 ? "pass" : pct >= 50 ? "warn" : "fail",
          detail: `${pct}% confidence${pm.identified_model ? ` - ${pm.identified_model}` : ""}`,
        })
      }
      if (pm.authenticity_indicators) {
        checks.push({
          name: "Authenticity Indicators",
          status: "pass",
          detail: String(pm.authenticity_indicators),
        })
      }
    }

    const va = rra.visual_attributes as Record<string, unknown> | undefined
    if (va) {
      if (va.condition) {
        const cond = String(va.condition).toLowerCase()
        checks.push({
          name: "Physical Condition",
          status: cond.includes("good") || cond.includes("new") || cond.includes("excellent") ? "pass" : "warn",
          detail: String(va.condition),
        })
      }
      if (va.branding) {
        checks.push({ name: "Branding Verified", status: "pass", detail: String(va.branding) })
      }
    }

    const fc = rra.fraud_and_policy_check as Record<string, unknown> | undefined
    if (fc) {
      if (fc.risk_level) {
        const rl = String(fc.risk_level).toLowerCase()
        checks.push({
          name: "Fraud Risk",
          status: rl === "low" ? "pass" : rl === "high" ? "fail" : "warn",
          detail: `${fc.risk_level} risk${fc.fraud_score !== undefined ? ` (score: ${Math.round(Number(fc.fraud_score) * 100)}/100)` : ""}`,
        })
      }
      if (fc.condition_consistency) {
        const cc = String(fc.condition_consistency).toLowerCase()
        checks.push({
          name: "Condition Consistency",
          status: cc.includes("consistent") || cc.includes("match") ? "pass" : "warn",
          detail: String(fc.condition_consistency),
        })
      }
      const flags = fc.flags as string[] | undefined
      if (flags && flags.length > 0) {
        for (const flag of flags) {
          checks.push({ name: "Policy Flag", status: "warn", detail: flag })
        }
      }
    }

    const ra = rra.recommended_action as Record<string, unknown> | undefined
    if (ra) {
      if (ra.workflow_status) {
        const ws = String(ra.workflow_status).toLowerCase()
        checks.push({
          name: "Workflow Decision",
          status: ws.includes("approved") || ws.includes("proceed") ? "pass" : ws.includes("denied") || ws.includes("reject") ? "fail" : "warn",
          detail: String(ra.workflow_status),
        })
      }
      if (ra.escalation !== undefined) {
        checks.push({
          name: "Escalation Required",
          status: ra.escalation ? "warn" : "pass",
          detail: ra.escalation ? "Yes - needs human review" : "No - automated resolution",
        })
      }
    }

    const failCount = checks.filter((c) => c.status === "fail").length
    const warnCount = checks.filter((c) => c.status === "warn").length
    if (failCount > 0) overallStatus = "rejected"
    else if (warnCount > 1) overallStatus = "flagged"
    else overallStatus = "approved"

    return { checks, overallStatus, inputSummary }
  }

  // Generic fallback -- scan for any recognizable validation keys
  inputSummary = "Agent validation"
  const vr =
    (raw.validation_results as Record<string, unknown>) ||
    (raw.validation_report as Record<string, unknown>) ||
    raw

  if (Array.isArray(vr.checks)) {
    for (const c of vr.checks as Record<string, unknown>[]) {
      checks.push({
        name: String(c.name || c.check || "Check"),
        status: normalizeStatus(String(c.status || c.result || "warn")),
        detail: String(c.detail || c.message || c.description || ""),
      })
    }
  }

  if (checks.length === 0) {
    checks.push({ name: "Validation Received", status: "pass", detail: "Agent returned validation data" })
  }

  const failCount = checks.filter((c) => c.status === "fail").length
  const warnCount = checks.filter((c) => c.status === "warn").length
  if (failCount > 0) overallStatus = "rejected"
  else if (warnCount > 0) overallStatus = "flagged"
  else overallStatus = "approved"

  return { checks, overallStatus, inputSummary }
}

function normalizeStatus(s: string): "pass" | "fail" | "warn" {
  const l = s.toLowerCase()
  if (l === "pass" || l === "passed" || l === "ok" || l === "success" || l === "approved") return "pass"
  if (l === "fail" || l === "failed" || l === "error" || l === "rejected" || l === "denied") return "fail"
  return "warn"
}

function reasonCodeToName(code: string): string {
  if (code.includes("BRAND")) return "Brand Verification"
  if (code.includes("CAPACITY")) return "Capacity Match"
  if (code.includes("SERIAL")) return "Serial Number Format"
  if (code.includes("IMAGE_QUALITY")) return "Image Quality"
  if (code.includes("SUSPICIOUS")) return "Pattern Analysis"
  return code.replace(/_/g, " ").replace(/([A-Z])/g, " $1").trim()
}

function reasonCodeToDetail(code: string): string {
  const map: Record<string, string> = {
    OCRMATCHBRAND_SUCCESS: "Brand text matches known SanDisk branding",
    OCRMATCHCAPACITY_SUCCESS: "Storage capacity matches product records",
    VALIDSERIALFORMAT: "Serial number follows expected format",
    OCRMATCHBRAND_FAIL: "Brand text does not match expected branding",
    OCRMATCHCAPACITY_FAIL: "Capacity does not match product records",
    INVALIDSERIALFORMAT: "Serial number format is invalid",
    SERIAL_MISMATCH: "Serial number does not match any known product",
    IMAGE_QUALITY_LOW: "Image resolution too low for reliable analysis",
    SUSPICIOUS_PATTERN: "Unusual patterns detected in product image",
  }
  return map[code] || code.replace(/_/g, " ")
}

// ---------------------------------------------------------------------------
// Supabase persistence
// ---------------------------------------------------------------------------

export async function persistValidationResult(
  result: Omit<ValidationResultRow, "id">
): Promise<void> {
  await supabase.from("validation_results").insert({
    session_id: result.sessionId,
    agent_id: result.agentId,
    user_id: result.userId,
    input_summary: result.inputSummary,
    raw_result: result.rawResult,
    checks: result.checks,
    overall_status: result.overallStatus,
    created_at: result.createdAt,
  })
}

export async function loadValidationResults(): Promise<ValidationResultRow[]> {
  const { data } = await supabase
    .from("validation_results")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200)

  if (!data) return []
  return data.map((row) => ({
    id: row.id,
    sessionId: row.session_id,
    agentId: row.agent_id,
    userId: row.user_id,
    inputSummary: row.input_summary,
    rawResult: row.raw_result as Record<string, unknown>,
    checks: row.checks as ValidationCheck[],
    overallStatus: row.overall_status as "approved" | "flagged" | "rejected",
    createdAt: row.created_at,
  }))
}

export async function deleteValidationResultsBySession(
  sessionId: string
): Promise<void> {
  await supabase.from("validation_results").delete().eq("session_id", sessionId)
}

export async function deleteAllValidationResults(): Promise<void> {
  await supabase.from("validation_results").delete().neq("session_id", "")
}
