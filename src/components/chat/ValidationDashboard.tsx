import { CircleCheck, Circle as XCircle, TriangleAlert, ShieldCheck, ShieldAlert, ShieldQuestionMark as ShieldQuestionIcon, ChevronDown, ChevronUp, ScanSearch, BookOpen } from "lucide-react"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import type { OcrOutput, ValidatorOutput, WorkflowProgress } from "@/data/workflow"
import type { ValidationCheck } from "@/data/validation-results"
import type { WarrantyInfo } from "@/data/scenarios"

// ---------------------------------------------------------------------------
// Workflow progress indicator (used while agents are working)
// ---------------------------------------------------------------------------

const PHASE_LABELS: Record<string, string> = {
  "order-lookup": "Order Lookup",
  "ocr": "OCR Analysis",
  "validation": "Validation",
  "manager-summary": "Summary",
  "complete": "Complete",
  "error": "Error",
}

const PHASE_ORDER = ["order-lookup", "ocr", "validation", "manager-summary", "complete"]

export function WorkflowProgressBar({ progress }: { progress: WorkflowProgress }) {
  const currentIdx = PHASE_ORDER.indexOf(progress.phase)
  const pct = progress.phase === "complete" ? 100 : Math.max(5, Math.round(((currentIdx + 0.5) / (PHASE_ORDER.length - 1)) * 100))

  return (
    <Card className="border border-border">
      <CardContent className="p-3 space-y-3">
        <div className="flex items-center gap-2">
          <ScanSearch className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Verification in progress</span>
        </div>
        <Separator />

        <div className="space-y-2">
          {PHASE_ORDER.slice(0, -1).map((phase, i) => {
            const isDone = currentIdx > i
            const isActive = currentIdx === i
            const label = PHASE_LABELS[phase]
            return (
              <div key={phase} className="flex items-center gap-2 text-xs">
                {isDone ? (
                  <CircleCheck className="h-3.5 w-3.5 text-green-600 shrink-0" />
                ) : isActive ? (
                  <div className="h-3.5 w-3.5 rounded-full border-2 border-foreground border-t-transparent animate-spin shrink-0" />
                ) : (
                  <div className="h-3.5 w-3.5 rounded-full border border-border shrink-0" />
                )}
                <span className={isDone ? "text-muted-foreground" : isActive ? "text-foreground font-medium" : "text-muted-foreground/50"}>
                  {label}
                </span>
                {isActive && (
                  <span className="text-muted-foreground ml-1">{progress.detail}</span>
                )}
              </div>
            )
          })}
        </div>

        <Progress value={pct} className="h-2" />

        {progress.phase === "error" && (
          <div className="flex items-center gap-2 text-xs text-destructive">
            <XCircle className="h-3.5 w-3.5" />
            {progress.detail}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Validation Dashboard -- the client-facing result card
// ---------------------------------------------------------------------------

const CHECK_ICON: Record<string, { Icon: typeof CircleCheck; color: string }> = {
  pass: { Icon: CircleCheck, color: "text-green-600" },
  fail: { Icon: XCircle, color: "text-red-500" },
  warn: { Icon: TriangleAlert, color: "text-amber-500" },
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string; Icon: typeof ShieldCheck }> = {
  approved: { label: "APPROVED", bg: "bg-green-50", text: "text-green-700", border: "border-green-200", Icon: ShieldCheck },
  flagged: { label: "FLAGGED", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", Icon: ShieldQuestionIcon },
  rejected: { label: "REJECTED", bg: "bg-red-50", text: "text-red-700", border: "border-red-200", Icon: ShieldAlert },
}

interface ValidationDashboardProps {
  ocrOutput: OcrOutput | null
  validatorOutput: ValidatorOutput
  productName?: string
  orderSummary?: WarrantyInfo
}

export function ValidationDashboard({ ocrOutput, validatorOutput, productName, orderSummary }: ValidationDashboardProps) {
  const [showOcr, setShowOcr] = useState(false)
  const [showKb, setShowKb] = useState(true)
  const status = STATUS_CONFIG[validatorOutput.overallStatus] || STATUS_CONFIG.flagged
  const StatusIcon = status.Icon

  const passCount = validatorOutput.checks.filter((c) => c.status === "pass").length
  const failCount = validatorOutput.checks.filter((c) => c.status === "fail").length
  const warnCount = validatorOutput.checks.filter((c) => c.status === "warn").length
  const total = validatorOutput.checks.length

  return (
    <Card className="border border-border">
      <CardContent className="p-3 space-y-3">
        {/* Title */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StatusIcon className={`h-5 w-5 ${status.text}`} />
            <span className="text-sm font-semibold text-foreground">Validation Summary</span>
          </div>
          <Badge variant="outline" className={`text-xs font-bold ${status.bg} ${status.text} ${status.border}`}>
            {status.label}
          </Badge>
        </div>

        {productName && (
          <div className="text-xs text-muted-foreground">{productName}</div>
        )}

        <Separator />

        {/* Checks */}
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
          Checks Performed
        </div>
        <div className="space-y-1.5">
          {validatorOutput.checks.map((check: ValidationCheck, i: number) => {
            const style = CHECK_ICON[check.status] || CHECK_ICON.warn
            const CheckIcon = style.Icon
            return (
              <div key={i} className="flex items-start gap-2">
                <CheckIcon className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${style.color}`} />
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium text-foreground">{check.name}</span>
                  <span className="text-xs text-muted-foreground ml-1.5">{check.detail}</span>
                </div>
              </div>
            )
          })}
        </div>

        <Separator />

        {/* Score summary */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            {passCount > 0 && (
              <span className="flex items-center gap-1">
                <CircleCheck className="h-3 w-3 text-green-600" />
                <span className="text-green-700 font-medium">{passCount} passed</span>
              </span>
            )}
            {warnCount > 0 && (
              <span className="flex items-center gap-1">
                <TriangleAlert className="h-3 w-3 text-amber-500" />
                <span className="text-amber-700 font-medium">{warnCount} flagged</span>
              </span>
            )}
            {failCount > 0 && (
              <span className="flex items-center gap-1">
                <XCircle className="h-3 w-3 text-red-500" />
                <span className="text-red-700 font-medium">{failCount} failed</span>
              </span>
            )}
          </div>
          <span className="text-muted-foreground">{total} checks total</span>
        </div>

        {/* Recommended action */}
        {validatorOutput.overallStatus === "rejected" && (
          <>
            <Separator />
            <div className="flex items-center gap-2 text-xs">
              <ShieldAlert className="h-3.5 w-3.5 text-red-500 shrink-0" />
              <span className="font-medium text-red-700">Manual Review Required</span>
            </div>
          </>
        )}

        {validatorOutput.overallStatus === "approved" && (
          <>
            <Separator />
            <div className="flex items-center gap-2 text-xs">
              <ShieldCheck className="h-3.5 w-3.5 text-green-600 shrink-0" />
              <span className="font-medium text-green-700">Automated resolution -- claim can proceed</span>
            </div>
          </>
        )}

        {validatorOutput.overallStatus === "flagged" && (
          <>
            <Separator />
            <div className="flex items-center gap-2 text-xs">
              <ShieldQuestionIcon className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              <span className="font-medium text-amber-700">Additional review recommended</span>
            </div>
          </>
        )}

        {/* Product KB details */}
        {orderSummary && (
          <>
            <Separator />
            <button
              type="button"
              onClick={() => setShowKb((v) => !v)}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <BookOpen className="h-3 w-3" />
              {showKb ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {showKb ? "Hide Product KB data" : "View Product KB data"}
            </button>
            {showKb && (
              <div className="rounded-md border border-border bg-muted/30 p-3">
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Product Knowledge Base
                </div>
                <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs items-center">
                  <span className="text-muted-foreground">Product</span>
                  <span className="text-foreground">{orderSummary.product}</span>

                  <span className="text-muted-foreground">Serial Number</span>
                  <span className="font-mono text-foreground">{orderSummary.serialNumber}</span>

                  <span className="text-muted-foreground">Warranty Status</span>
                  <span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        orderSummary.status === "Active"
                          ? "bg-green-50 text-green-700 border-green-200"
                          : orderSummary.status === "Expired"
                            ? "bg-red-50 text-red-700 border-red-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                      }`}
                    >
                      {orderSummary.status}
                    </Badge>
                  </span>

                  <span className="text-muted-foreground">Purchase Date</span>
                  <span className="text-foreground">{orderSummary.purchaseDate}</span>

                  <span className="text-muted-foreground">Registered</span>
                  <span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        orderSummary.registered
                          ? "bg-green-50 text-green-700 border-green-200"
                          : "text-muted-foreground"
                      }`}
                    >
                      {orderSummary.registered ? "Yes" : "No"}
                    </Badge>
                  </span>

                  <span className="text-muted-foreground">Prior Claims</span>
                  <span
                    className={`font-medium ${
                      orderSummary.priorClaims === 0
                        ? "text-green-700"
                        : orderSummary.priorClaims === 1
                          ? "text-amber-700"
                          : "text-red-700"
                    }`}
                  >
                    {orderSummary.priorClaims}
                  </span>

                  <span className="text-muted-foreground">Replacement Eligible</span>
                  <span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        orderSummary.replacementEligible
                          ? "bg-green-50 text-green-700 border-green-200"
                          : "bg-red-50 text-red-700 border-red-200"
                      }`}
                    >
                      {orderSummary.replacementEligible ? "Yes" : "No"}
                    </Badge>
                  </span>
                </div>
              </div>
            )}
          </>
        )}

        {/* OCR details toggle */}
        {ocrOutput && (
          <>
            <Separator />
            <button
              type="button"
              onClick={() => setShowOcr((v) => !v)}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              {showOcr ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {showOcr ? "Hide OCR details" : "View OCR extracted data"}
            </button>
            {showOcr && (
              <div className="rounded-md border border-border bg-muted/30 p-3">
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  OCR Extracted Fields
                </div>
                <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                  <span className="text-muted-foreground">Brand</span>
                  <span>{ocrOutput.brandDetected}</span>
                  <span className="text-muted-foreground">Product</span>
                  <span>{ocrOutput.productText}</span>
                  <span className="text-muted-foreground">Capacity</span>
                  <span>{ocrOutput.capacityDetected}</span>
                  <span className="text-muted-foreground">Serial (Image)</span>
                  <span className="font-mono">{ocrOutput.serialDetected}</span>
                  <span className="text-muted-foreground">Image Quality</span>
                  <span>{ocrOutput.imageQuality}</span>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
