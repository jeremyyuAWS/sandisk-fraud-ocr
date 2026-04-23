import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { CircleCheck, TriangleAlert, Eye, Package, ShieldCheck, ListChecks, ScanSearch } from "lucide-react"

interface VisualAttributes {
  color?: string
  form_factor?: string
  branding?: string
  condition?: string
}

interface ProductMatch {
  identified_model?: string
  user_provided_model?: string
  match_confidence?: number
  authenticity_indicators?: string
}

interface FraudCheck {
  customer_reason?: string
  condition_consistency?: string
  risk_level?: string
  fraud_score?: number
  flags?: string[]
}

interface RecommendedAction {
  workflow_status?: string
  escalation?: boolean
  resolution_steps?: string[]
}

interface ReturnRequestAnalysis {
  visual_attributes?: VisualAttributes
  product_match?: ProductMatch
  fraud_and_policy_check?: FraudCheck
  recommended_action?: RecommendedAction
}

interface OcrVerification {
  brandDetected?: string
  productText?: string
  serialDetected?: string
  capacityDetected?: string
  imageQuality?: string
  riskScore?: number
  riskLevel?: string
  reasonCodes?: string[]
  [key: string]: unknown
}

export interface LyzrResponseData {
  return_request_analysis?: ReturnRequestAnalysis
  ocr_verification?: OcrVerification
  [key: string]: unknown
}

export function tryParseLyzrResponse(text: string): LyzrResponseData | null {
  function check(obj: unknown): LyzrResponseData | null {
    if (!obj || typeof obj !== "object") return null
    const o = obj as Record<string, unknown>
    if (o.return_request_analysis) return o as LyzrResponseData
    if (o.brandDetected || o.riskScore !== undefined || o.riskLevel) return { ocr_verification: o } as LyzrResponseData
    return null
  }
  try {
    return check(JSON.parse(text))
  } catch {
    const jsonMatch = text.match(/\{[\s\S]*?\}(?:\s*$)/) || text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      try { return check(JSON.parse(jsonMatch[0])) } catch { /* not valid JSON */ }
    }
  }
  return null
}

function riskBadgeClass(level: string) {
  const l = level.toLowerCase()
  if (l === "low") return "bg-green-50 text-green-700 border-green-200"
  if (l === "high") return "bg-red-50 text-red-700 border-red-200"
  return "bg-amber-50 text-amber-700 border-amber-200"
}

function statusBadgeClass(status: string) {
  const s = status.toLowerCase()
  if (s.includes("approved") || s.includes("proceed")) return "bg-green-50 text-green-700 border-green-200"
  if (s.includes("denied") || s.includes("reject")) return "bg-red-50 text-red-700 border-red-200"
  return "bg-amber-50 text-amber-700 border-amber-200"
}

function LabelRow({ label, value }: { label: string; value: string | undefined }) {
  if (!value) return null
  return (
    <>
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </>
  )
}

function reasonCodeLabel(code: string): string {
  const map: Record<string, string> = {
    OCRMATCHBRAND_SUCCESS: "Brand verified successfully",
    OCRMATCHCAPACITY_SUCCESS: "Capacity matches product records",
    VALIDSERIALFORMAT: "Serial number format is valid",
    OCRMATCHBRAND_FAIL: "Brand could not be verified",
    OCRMATCHCAPACITY_FAIL: "Capacity mismatch detected",
    INVALIDSERIALFORMAT: "Serial number format is invalid",
    SERIAL_MISMATCH: "Serial number does not match records",
    IMAGE_QUALITY_LOW: "Image quality is too low",
    SUSPICIOUS_PATTERN: "Suspicious pattern detected",
  }
  return map[code] || code.replace(/_/g, " ").replace(/([A-Z])/g, " $1").trim()
}

function OcrVerificationCard({ ocr }: { ocr: OcrVerification }) {
  const riskScore = ocr.riskScore ?? 0
  const riskLevel = ocr.riskLevel ?? "Unknown"
  const isLow = riskLevel.toLowerCase() === "low"
  const isHigh = riskLevel.toLowerCase() === "high"

  return (
    <Card className="border border-border">
      <CardContent className="p-3 space-y-3 text-xs">
        <div className="flex items-center gap-2">
          <ScanSearch className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold text-sm">OCR Verification Result</span>
        </div>
        <Separator />
        <div>
          <div className="text-muted-foreground mb-1.5 font-medium">Extracted Product Details</div>
          <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <LabelRow label="Brand" value={ocr.brandDetected} />
            <LabelRow label="Product" value={ocr.productText} />
            <LabelRow label="Capacity" value={ocr.capacityDetected} />
            {ocr.serialDetected && (
              <>
                <span className="text-muted-foreground">Serial</span>
                <span className="font-mono">{ocr.serialDetected}</span>
              </>
            )}
            <LabelRow label="Image Quality" value={ocr.imageQuality} />
          </div>
        </div>
        <Separator />
        <div>
          <div className="text-muted-foreground mb-1.5 font-medium">Risk Assessment</div>
          <div className="flex items-center gap-2 mb-1.5">
            <Badge variant="outline" className={`text-[10px] ${riskBadgeClass(riskLevel)}`}>
              {riskLevel} Risk
            </Badge>
            <div className="flex items-center gap-1.5">
              <Progress value={riskScore} className="w-16 h-2" />
              <span className="font-semibold">{riskScore}/100</span>
            </div>
          </div>
        </div>
        {ocr.reasonCodes && ocr.reasonCodes.length > 0 && (
          <>
            <Separator />
            <div>
              <div className="text-muted-foreground mb-1.5 font-medium">Verification Checks</div>
              <div className="space-y-1">
                {ocr.reasonCodes.map((code, i) => {
                  const isSuccess = code.includes("SUCCESS") || code.includes("VALID")
                  return (
                    <div key={i} className="flex items-center gap-1.5">
                      {isSuccess
                        ? <CircleCheck className="h-3 w-3 text-green-600 shrink-0" />
                        : <TriangleAlert className="h-3 w-3 text-amber-500 shrink-0" />}
                      <span>{reasonCodeLabel(code)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}
        <Separator />
        <div className="flex items-center gap-1.5">
          {isLow ? <CircleCheck className="h-3.5 w-3.5 text-green-600" /> : isHigh ? <TriangleAlert className="h-3.5 w-3.5 text-red-500" /> : <TriangleAlert className="h-3.5 w-3.5 text-amber-500" />}
          <span className="font-medium">
            {isLow ? "Product appears genuine" : isHigh ? "Product may not be authentic" : "Further review recommended"}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

export function LyzrResponseCard({ data }: { data: LyzrResponseData }) {
  if (data.ocr_verification) {
    return <OcrVerificationCard ocr={data.ocr_verification as OcrVerification} />
  }

  const a = data.return_request_analysis
  if (!a) return null

  const va = a.visual_attributes
  const pm = a.product_match
  const fc = a.fraud_and_policy_check
  const ra = a.recommended_action
  const confidencePct = pm?.match_confidence != null ? Math.round(pm.match_confidence * 100) : null
  const fraudPct = fc?.fraud_score != null ? Math.round(fc.fraud_score * 100) : null

  return (
    <Card className="border border-border">
      <CardContent className="p-3 space-y-3 text-xs">
        <div className="font-semibold text-sm">AI Return Analysis</div>

        {/* Visual Attributes */}
        {va && (
          <>
            <Separator />
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium text-xs">Visual Attributes</span>
              </div>
              <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                <LabelRow label="Color" value={va.color} />
                <LabelRow label="Form Factor" value={va.form_factor} />
                <LabelRow label="Branding" value={va.branding} />
                <LabelRow label="Condition" value={va.condition} />
              </div>
            </div>
          </>
        )}

        {/* Product Match */}
        {pm && (
          <>
            <Separator />
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Package className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium text-xs">Product Match</span>
              </div>
              <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                <LabelRow label="Identified" value={pm.identified_model} />
                <LabelRow label="User Provided" value={pm.user_provided_model} />
              </div>
              {confidencePct != null && (
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-muted-foreground">Confidence</span>
                  <Progress value={confidencePct} className="w-16 h-2" />
                  <span className="font-semibold">{confidencePct}%</span>
                </div>
              )}
              {pm.authenticity_indicators && (
                <div className="mt-1 text-muted-foreground italic">{pm.authenticity_indicators}</div>
              )}
            </div>
          </>
        )}

        {/* Fraud & Policy Check */}
        {fc && (
          <>
            <Separator />
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium text-xs">Fraud & Policy Check</span>
              </div>
              <div className="flex items-center gap-2 mb-1.5">
                {fc.risk_level && (
                  <Badge variant="outline" className={`text-[10px] ${riskBadgeClass(fc.risk_level)}`}>
                    {fc.risk_level} Risk
                  </Badge>
                )}
                {fraudPct != null && (
                  <div className="flex items-center gap-1.5">
                    <Progress value={fraudPct} className="w-14 h-2" />
                    <span className="font-semibold">{fraudPct}/100</span>
                  </div>
                )}
              </div>
              {fc.condition_consistency && (
                <div className="mb-1">
                  <span className="text-muted-foreground">Condition: </span>
                  {fc.condition_consistency}
                </div>
              )}
              {fc.customer_reason && (
                <div className="mb-1">
                  <span className="text-muted-foreground">Reason: </span>
                  {fc.customer_reason}
                </div>
              )}
              {fc.flags && fc.flags.length > 0 && (
                <div className="space-y-0.5 mt-1">
                  {fc.flags.map((f, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <TriangleAlert className="h-3 w-3 text-amber-500 shrink-0" />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Recommended Action */}
        {ra && (
          <>
            <Separator />
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <ListChecks className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium text-xs">Recommended Action</span>
              </div>
              <div className="flex items-center gap-2 mb-1.5">
                {ra.workflow_status && (
                  <Badge variant="outline" className={`text-[10px] ${statusBadgeClass(ra.workflow_status)}`}>
                    {ra.workflow_status}
                  </Badge>
                )}
                {ra.escalation != null && (
                  <div className="flex items-center gap-1">
                    {ra.escalation ? <TriangleAlert className="h-3 w-3 text-red-500" /> : <CircleCheck className="h-3 w-3 text-green-600" />}
                    <span>{ra.escalation ? "Escalation required" : "No escalation needed"}</span>
                  </div>
                )}
              </div>
              {ra.resolution_steps && ra.resolution_steps.length > 0 && (
                <ol className="list-decimal pl-4 space-y-0.5">
                  {ra.resolution_steps.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
