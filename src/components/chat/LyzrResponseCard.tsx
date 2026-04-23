import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { CircleCheck, TriangleAlert, Eye, Package, ShieldCheck, ListChecks } from "lucide-react"

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

export interface LyzrResponseData {
  return_request_analysis?: ReturnRequestAnalysis
  [key: string]: unknown
}

export function tryParseLyzrResponse(text: string): LyzrResponseData | null {
  try {
    const parsed = JSON.parse(text)
    if (parsed?.return_request_analysis) return parsed
  } catch {
    const jsonMatch = text.match(/\{[\s\S]*"return_request_analysis"[\s\S]*\}/)
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0])
        if (parsed?.return_request_analysis) return parsed
      } catch {
        // not valid JSON
      }
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

export function LyzrResponseCard({ data }: { data: LyzrResponseData }) {
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
