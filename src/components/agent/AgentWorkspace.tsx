import { useState, useEffect, useRef } from "react"
import { ArrowLeft, Shield, TriangleAlert as AlertTriangle, CircleCheck as CheckCircle, Clock, FileImage, ChartBar as BarChart3, Eye, RefreshCw, Loader as Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import {
  getAgentQueue,
  getAgentCases,
  getAgentOverrideStats,
  getCase,
  getImageUrl,
  submitAgentDecision,
  humanizeVerdictReason,
  type QueueReview,
  type AgentCase,
  type CaseRecord,
  type ValidationCheck,
  type Indicator,
  type V2Verdict,
  type OverrideStats,
} from "@/lib/api"

interface AgentWorkspaceProps {
  onBack: () => void
}

function RiskBadge({ score }: { score: number }) {
  const band = score <= 0.3 ? "Low" : score <= 0.6 ? "Medium" : "High"
  const color =
    band === "Low"
      ? "bg-green-50 text-green-700 border-green-200"
      : band === "High"
        ? "bg-red-50 text-red-700 border-red-200"
        : "bg-amber-50 text-amber-700 border-amber-200"
  const Icon = band === "Low" ? CheckCircle : band === "High" ? AlertTriangle : Clock
  return (
    <Badge variant="outline" className={color}>
      <Icon className="h-3 w-3 mr-1" />
      {band} ({Math.round(score * 100)}%)
    </Badge>
  )
}

function CheckRow({ check }: { check: ValidationCheck }) {
  const color =
    check.result === "Passed"
      ? "text-green-600"
      : check.result === "Failed"
        ? "text-red-500"
        : "text-amber-500"
  const Icon = check.result === "Passed" ? CheckCircle : check.result === "Failed" ? AlertTriangle : Clock
  return (
    <div className="flex items-start gap-2">
      <Icon className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${color}`} />
      <div className="flex-1 min-w-0">
        <span className="text-xs font-medium text-foreground">{check.name}</span>
        {check.detail && (
          <span className="text-xs text-muted-foreground ml-1.5">{check.detail}</span>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Queue list
// ---------------------------------------------------------------------------

function QueueList({
  reviews,
  loading,
  onSelect,
}: {
  reviews: QueueReview[]
  loading: boolean
  onSelect: (caseId: string) => void
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }
  if (reviews.length === 0) {
    return <div className="text-sm text-muted-foreground text-center py-10">No cases in review queue.</div>
  }
  return (
    <div className="space-y-2">
      {reviews.map((r) => (
        <Card
          key={r.review_id}
          className="border border-border hover:border-foreground/20 transition-colors cursor-pointer"
          onClick={() => onSelect(r.case_id)}
        >
          <CardContent className="p-3 flex items-center justify-between">
            <div className="space-y-1">
              <div className="text-xs font-mono text-muted-foreground">{r.case_id}</div>
              <div className="text-sm font-medium capitalize">{r.issue_type}</div>
              {r.summary?.headline && (
                <div className="text-xs text-muted-foreground">{r.summary.headline}</div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <RiskBadge score={r.risk_score} />
              <Button variant="ghost" size="sm">
                <Eye className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// All cases list
// ---------------------------------------------------------------------------

function AllCasesList({
  cases,
  loading,
  onSelect,
}: {
  cases: AgentCase[]
  loading: boolean
  onSelect: (caseId: string) => void
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }
  if (cases.length === 0) {
    return <div className="text-sm text-muted-foreground text-center py-10">No cases found.</div>
  }

  const statusColor: Record<string, string> = {
    open: "bg-blue-50 text-blue-700 border-blue-200",
    validated: "bg-amber-50 text-amber-700 border-amber-200",
    approved: "bg-green-50 text-green-700 border-green-200",
    rejected: "bg-red-50 text-red-700 border-red-200",
    escalated: "bg-amber-50 text-amber-700 border-amber-200",
  }

  return (
    <div className="space-y-2">
      {cases.map((c) => (
        <Card
          key={c.case_id}
          className="border border-border hover:border-foreground/20 transition-colors cursor-pointer"
          onClick={() => onSelect(c.case_id)}
        >
          <CardContent className="p-3 flex items-center justify-between">
            <div className="space-y-1">
              <div className="text-xs font-mono text-muted-foreground">{c.case_id}</div>
              <div className="text-sm font-medium capitalize">{c.issue_type}</div>
              <div className="text-xs text-muted-foreground">
                {new Date(c.created_at).toLocaleDateString()}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={statusColor[c.status] || ""}>
                {c.status}
              </Badge>
              <RiskBadge score={c.risk_score} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Case detail view
// ---------------------------------------------------------------------------

function CaseDetailView({
  caseId,
  onBack,
  onDecisionMade,
}: {
  caseId: string
  onBack: () => void
  onDecisionMade: () => void
}) {
  const [caseData, setCaseData] = useState<CaseRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [deciding, setDeciding] = useState(false)
  const [notes, setNotes] = useState("")

  useEffect(() => {
    setLoading(true)
    getCase(caseId)
      .then(setCaseData)
      .catch((e) => toast.error(`Failed to load case: ${e.message}`))
      .finally(() => setLoading(false))
  }, [caseId])

  async function handleDecision(action: "approve" | "reject" | "request_info") {
    setDeciding(true)
    try {
      await submitAgentDecision(caseId, action, notes || undefined, "demo-agent")
      toast.success(`Case ${action === "approve" ? "approved" : action === "reject" ? "rejected" : "info requested"}.`)
      onDecisionMade()
    } catch (e: unknown) {
      toast.error(`Decision failed: ${(e as Error).message}`)
    } finally {
      setDeciding(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!caseData) {
    return <div className="text-center text-muted-foreground py-10">Case not found.</div>
  }

  const validation = caseData.validations?.[0]?.payload
  const indicators = validation?.indicators || []
  const checks = validation?.checks || caseData.summary?.checks || []
  const matchedSku = validation?.matched_sku

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to Queue
      </Button>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-mono text-muted-foreground">{caseData.case_id}</div>
          <div className="text-lg font-semibold capitalize">{caseData.issue_type} Case</div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="capitalize">{caseData.status}</Badge>
          <RiskBadge score={caseData.risk_score} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        {/* Left column: images + checks */}
        <div className="space-y-4">
          {/* Images */}
          {caseData.images.length > 0 && (
            <Card className="border border-border">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <FileImage className="h-4 w-4" /> Uploaded Evidence ({caseData.images.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="grid grid-cols-2 gap-2">
                  {caseData.images.map((img) => (
                    <div key={img.image_id} className="relative">
                      {img.mime_type === "application/pdf" ? (
                        <div className="bg-secondary rounded-lg h-32 flex flex-col items-center justify-center">
                          <Badge variant="outline" className="mb-1">PDF</Badge>
                          <span className="text-xs text-muted-foreground truncate max-w-full px-2">{img.filename}</span>
                        </div>
                      ) : (
                        <img
                          src={getImageUrl(caseData.case_id, img.image_id)}
                          alt={img.filename}
                          className="w-full h-32 object-cover rounded-lg bg-secondary"
                        />
                      )}
                      <Badge variant="outline" className="absolute top-1 left-1 text-[10px] capitalize">
                        {img.kind}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Validation Checks */}
          {checks.length > 0 && (
            <Card className="border border-border">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Shield className="h-4 w-4" /> Validation Checks
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-2">
                {checks.map((check, i) => (
                  <CheckRow key={i} check={check} />
                ))}
              </CardContent>
            </Card>
          )}

          {/* Matched SKU */}
          {matchedSku && (
            <Card className="border border-border">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" /> Product Match
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 text-xs">
                <div className="grid grid-cols-[100px_1fr] gap-y-1.5">
                  <span className="text-muted-foreground">Product</span>
                  <span className="font-medium">{matchedSku.product_name}</span>
                  <span className="text-muted-foreground">SKU Prefix</span>
                  <span className="font-mono">{matchedSku.prefix}</span>
                  <span className="text-muted-foreground">Warranty</span>
                  <span>{matchedSku.warranty}</span>
                  <span className="text-muted-foreground">Category</span>
                  <span>{matchedSku.category}</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column: indicators + actions */}
        <div className="space-y-4">
          {/* Indicators (agent-only) */}
          {indicators.length > 0 && (
            <Card className="border border-border">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" /> Risk Indicators
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-3">
                {indicators.map((ind: Indicator, i: number) => (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-foreground">{ind.code}</span>
                      <Badge
                        variant="outline"
                        className={
                          ind.severity >= 0.7
                            ? "bg-red-50 text-red-700 border-red-200"
                            : ind.severity >= 0.4
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-green-50 text-green-700 border-green-200"
                        }
                      >
                        {Math.round(ind.severity * 100)}%
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground italic">{ind.detail}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* v2 Verdict Details */}
          {caseData.summary?.v2 && (
            <V2DetailPanel v2={caseData.summary.v2} caseId={caseData.case_id} />
          )}

          {/* Decision actions */}
          {(caseData.status === "validated" || caseData.status === "escalated" || caseData.status === "open") && (
            <Card className="border border-border">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold">Agent Decision</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-3">
                <Textarea
                  placeholder="Optional notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="h-20 text-xs"
                />
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => handleDecision("approve")}
                    disabled={deciding}
                  >
                    {deciding ? <Loader2 className="h-3 w-3 animate-spin" /> : "Approve"}
                  </Button>
                  <Button
                    size="sm"
                    className="bg-red-600 hover:bg-red-700 text-white"
                    onClick={() => handleDecision("reject")}
                    disabled={deciding}
                  >
                    {deciding ? <Loader2 className="h-3 w-3 animate-spin" /> : "Reject"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="col-span-2"
                    onClick={() => handleDecision("request_info")}
                    disabled={deciding}
                  >
                    Request More Info
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Customer summary */}
          {caseData.summary && (
            <Card className="border border-border">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold">Customer Summary</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 text-xs space-y-2">
                <div className="font-medium">{caseData.summary.headline}</div>
                <p className="text-muted-foreground">{caseData.summary.body}</p>
                {caseData.summary.warranty && (
                  <div className="text-muted-foreground">Warranty: {caseData.summary.warranty}</div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// v2 Detail Panel (agent-facing)
// ---------------------------------------------------------------------------

function V2DetailPanel({ v2, caseId }: { v2: V2Verdict; caseId: string }) {
  return (
    <div className="space-y-4">
      {/* SKU identification */}
      {(v2.identified_sku.family_prefix || v2.identified_sku.full_sku) && (
        <Card className="border border-border">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold">Detected SKU</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 text-xs">
            <div className="grid grid-cols-[100px_1fr] gap-y-1.5">
              {v2.identified_sku.family_prefix && (
                <>
                  <span className="text-muted-foreground">Family</span>
                  <span className="font-mono font-medium">{v2.identified_sku.family_prefix}</span>
                </>
              )}
              {v2.identified_sku.full_sku && (
                <>
                  <span className="text-muted-foreground">Full SKU</span>
                  <span className="font-mono font-medium">{v2.identified_sku.full_sku}</span>
                </>
              )}
              <span className="text-muted-foreground">Family</span>
              <span className="capitalize">{v2.product_family.replace(/_/g, " ")}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Playbook */}
      {v2.playbook_used && (
        <Card className="border border-border">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold">Playbook Used</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <Badge variant="outline" className="text-xs font-mono">
              {v2.playbook_used}
            </Badge>
          </CardContent>
        </Card>
      )}

      {/* Verdict reasons */}
      {v2.verdict_reasons.length > 0 && (
        <Card className="border border-border">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold">Verdict Reasons</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-1.5">
            {v2.verdict_reasons.map((code, i) => (
              <div key={i} className="space-y-0.5">
                <div className="text-xs font-mono text-foreground">{code}</div>
                <div className="text-xs text-muted-foreground">{humanizeVerdictReason(code)}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Damage */}
      {v2.damage_observed && (
        <Card className="border border-amber-200 bg-amber-50/50">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-amber-800">
              <AlertTriangle className="h-4 w-4" /> Damage Detected
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-xs text-amber-700">{v2.damage_description ?? "Physical damage observed."}</p>
          </CardContent>
        </Card>
      )}

      {/* Counterfeit tells */}
      {v2.counterfeit_tells_matched.length > 0 && (
        <Card className="border border-red-200 bg-red-50/50">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold text-red-700 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Counterfeit Tells
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {v2.counterfeit_tells_matched.map((match, i) => (
              <div key={i} className="border border-red-200 rounded-md p-2 space-y-1">
                <div className="text-xs font-mono text-red-700">{match.counterfeit_id}</div>
                <div className="text-xs text-muted-foreground">
                  {match.tells_matched_count} tell(s) matched: {match.tells_matched.join(", ")}
                </div>
                {match.page_ref != null && (
                  <div className="text-xs text-muted-foreground">
                    Auth guide page: {Array.isArray(match.page_ref) ? match.page_ref.join(", ") : match.page_ref}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Fraud correlations */}
      {v2.fraud_correlations.length > 0 && (
        <Card className="border border-red-300 bg-red-50/70">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold text-red-800 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Fraud Ring Correlation
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {v2.fraud_correlations.map((fc, i) => (
              <div key={i} className="border border-red-200 rounded-md p-2 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-red-700">{fc.pattern.replace(/_/g, " ")}</span>
                  <Badge variant="outline" className="text-[10px] border-red-300 text-red-700 capitalize">{fc.severity.replace(/_/g, " ")}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{fc.detail}</p>
                <div className="text-xs text-muted-foreground">
                  Linked cases: {fc.matched_case_ids.join(", ")}
                </div>
                <div className="text-xs text-muted-foreground">
                  Values: {fc.matched_values.join(", ")}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* POP Validation */}
      {v2.pop_validation && Object.keys(v2.pop_validation).length > 0 && (
        <Card className="border border-border">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold">Proof of Purchase Validation</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 text-xs">
            <div className="grid grid-cols-[140px_1fr] gap-y-1.5">
              {v2.pop_validation.vendor_name != null && (
                <>
                  <span className="text-muted-foreground">Vendor</span>
                  <span className="font-medium">{v2.pop_validation.vendor_name}</span>
                </>
              )}
              {v2.pop_validation.vendor_gstin != null && (
                <>
                  <span className="text-muted-foreground">GSTIN</span>
                  <span className="font-mono">{v2.pop_validation.vendor_gstin}</span>
                </>
              )}
              {v2.pop_validation.vendor_authorized != null && (
                <>
                  <span className="text-muted-foreground">Authorized?</span>
                  <span className={v2.pop_validation.vendor_authorized ? "text-green-600 font-medium" : "text-red-500 font-medium"}>
                    {v2.pop_validation.vendor_authorized ? "Yes" : "No"}
                  </span>
                </>
              )}
              {v2.pop_validation.product_match != null && (
                <>
                  <span className="text-muted-foreground">Product match?</span>
                  <span className={v2.pop_validation.product_match ? "text-green-600 font-medium" : "text-red-500 font-medium"}>
                    {v2.pop_validation.product_match ? "Yes" : "No"}
                  </span>
                </>
              )}
              {v2.pop_validation.date_plausible != null && (
                <>
                  <span className="text-muted-foreground">Date plausible?</span>
                  <span className={v2.pop_validation.date_plausible ? "text-green-600 font-medium" : "text-red-500 font-medium"}>
                    {v2.pop_validation.date_plausible ? "Yes" : "No"}
                  </span>
                </>
              )}
              {v2.pop_validation.time_delta_days != null && (
                <>
                  <span className="text-muted-foreground">Purchase age</span>
                  <span>{v2.pop_validation.time_delta_days} days</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Refinement trace */}
      {v2.refinement.attempted && (
        <Card className="border border-border">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold">OCR Refinement</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 text-xs space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Status:</span>
              <span className={v2.refinement.succeeded ? "text-green-600 font-medium" : "text-amber-600 font-medium"}>
                {v2.refinement.succeeded ? "Succeeded" : "No new fields found"}
              </span>
            </div>
            {v2.refinement.fields_added.length > 0 && (
              <div className="text-muted-foreground">
                Fields added on 2nd pass: <span className="font-mono text-foreground">{v2.refinement.fields_added.join(", ")}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Gaps */}
      {v2.gaps.length > 0 && (
        <Card className="border border-border">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold">Data Gaps</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {v2.gaps.map((gap, i) => (
              <div key={i} className="text-xs space-y-0.5">
                <div className="font-medium text-foreground">{gap.missing_data_field.replace(/_/g, " ")}</div>
                <div className="text-muted-foreground">Action: {gap.follow_up_action.replace(/_/g, " ")}</div>
                {gap.affected_checks.length > 0 && (
                  <div className="text-muted-foreground">Affects: {gap.affected_checks.join(", ")}</div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Recommended next action */}
      {v2.recommended_next_action && (
        <div className="text-xs text-muted-foreground">
          Recommended action: <span className="font-mono text-foreground">{v2.recommended_next_action.replace(/_/g, " ")}</span>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Override stats card
// ---------------------------------------------------------------------------

function OverrideStatsCard({ stats }: { stats: OverrideStats | null }) {
  if (!stats || stats.total === 0) return null
  return (
    <Card className="border border-border">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-semibold">AI vs Operator Agreement</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 text-xs space-y-2">
        <div className="grid grid-cols-[140px_1fr] gap-y-1">
          <span className="text-muted-foreground">Total reviews</span>
          <span className="font-medium">{stats.total}</span>
          <span className="text-muted-foreground">Request-info agreement</span>
          <span className="font-medium">{Math.round(stats.agreement_rate_request_info * 100)}%</span>
        </div>
        {stats.top_v2_reasons_when_overridden.length > 0 && (
          <div className="space-y-1 mt-2">
            <div className="text-muted-foreground">Top reasons when overridden:</div>
            {stats.top_v2_reasons_when_overridden.slice(0, 5).map((r, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="font-mono">{r.reason.replace(/_/g, " ")}</span>
                <Badge variant="outline" className="text-[10px]">{r.count}</Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AgentWorkspace({ onBack }: AgentWorkspaceProps) {
  const [reviews, setReviews] = useState<QueueReview[]>([])
  const [allCases, setAllCases] = useState<AgentCase[]>([])
  const [loadingQueue, setLoadingQueue] = useState(true)
  const [loadingCases, setLoadingCases] = useState(true)
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null)
  const [overrideStats, setOverrideStats] = useState<OverrideStats | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function fetchQueue() {
    getAgentQueue()
      .then((data) => setReviews(data.reviews))
      .catch(() => {})
      .finally(() => setLoadingQueue(false))
  }

  function fetchCases() {
    getAgentCases()
      .then((data) => setAllCases(data.cases))
      .catch(() => {})
      .finally(() => setLoadingCases(false))
  }

  function fetchStats() {
    getAgentOverrideStats()
      .then(setOverrideStats)
      .catch(() => {})
  }

  useEffect(() => {
    fetchQueue()
    fetchCases()
    fetchStats()
    pollRef.current = setInterval(() => {
      fetchQueue()
      fetchCases()
    }, 15000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  function handleDecisionMade() {
    setSelectedCaseId(null)
    fetchQueue()
    fetchCases()
  }

  return (
    <div className="min-h-screen bg-secondary/50">
      <div className="bg-background border-b border-border px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Support
          </Button>
          <Separator orientation="vertical" className="h-5" />
          <span className="text-sm font-semibold">Agent Console</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{reviews.length} in queue</Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { fetchQueue(); fetchCases() }}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="p-4 max-w-[1200px] mx-auto">
        {selectedCaseId ? (
          <CaseDetailView
            caseId={selectedCaseId}
            onBack={() => setSelectedCaseId(null)}
            onDecisionMade={handleDecisionMade}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
            <Tabs defaultValue="queue">
              <TabsList>
                <TabsTrigger value="queue">Review Queue ({reviews.length})</TabsTrigger>
                <TabsTrigger value="all">All Cases ({allCases.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="queue" className="mt-4">
                <QueueList reviews={reviews} loading={loadingQueue} onSelect={setSelectedCaseId} />
              </TabsContent>
              <TabsContent value="all" className="mt-4">
                <AllCasesList cases={allCases} loading={loadingCases} onSelect={setSelectedCaseId} />
              </TabsContent>
            </Tabs>
            <div className="space-y-4">
              <OverrideStatsCard stats={overrideStats} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
