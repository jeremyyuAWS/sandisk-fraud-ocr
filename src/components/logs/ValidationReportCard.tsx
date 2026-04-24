import { useState } from "react"
import { ShieldCheck, CircleCheck, Circle as XCircle, TriangleAlert, ChevronDown, ChevronUp, Copy, Check } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import type { ValidationResultRow, ValidationCheck } from "@/data/validation-results"

interface ValidationReportCardProps {
  result: ValidationResultRow
  formatTime?: (iso: string) => string
}

const STATUS_CONFIG = {
  approved: {
    label: "Approved",
    bg: "bg-green-50",
    text: "text-green-700",
    border: "border-green-200",
    Icon: CircleCheck,
    iconColor: "text-green-600",
  },
  flagged: {
    label: "Flagged",
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    Icon: TriangleAlert,
    iconColor: "text-amber-500",
  },
  rejected: {
    label: "Rejected",
    bg: "bg-red-50",
    text: "text-red-700",
    border: "border-red-200",
    Icon: XCircle,
    iconColor: "text-red-500",
  },
}

const CHECK_ICON = {
  pass: { Icon: CircleCheck, color: "text-green-600" },
  fail: { Icon: XCircle, color: "text-red-500" },
  warn: { Icon: TriangleAlert, color: "text-amber-500" },
}

function summaryLine(checks: ValidationCheck[], overallStatus: string): string {
  const passCount = checks.filter((c) => c.status === "pass").length
  const failCount = checks.filter((c) => c.status === "fail").length
  const warnCount = checks.filter((c) => c.status === "warn").length
  const total = checks.length

  if (overallStatus === "approved" && failCount === 0 && warnCount === 0) {
    return `All ${total} checks passed`
  }
  if (overallStatus === "rejected") {
    return `${failCount} of ${total} checks failed -- manual review recommended`
  }
  const parts: string[] = []
  if (passCount > 0) parts.push(`${passCount} passed`)
  if (warnCount > 0) parts.push(`${warnCount} flagged`)
  if (failCount > 0) parts.push(`${failCount} failed`)
  return parts.join(", ")
}

export function ValidationReportCard({ result, formatTime }: ValidationReportCardProps) {
  const [showRaw, setShowRaw] = useState(false)
  const [copied, setCopied] = useState(false)
  const status = STATUS_CONFIG[result.overallStatus] || STATUS_CONFIG.flagged
  const StatusIcon = status.Icon
  const timeLabel = formatTime ? formatTime(result.createdAt) : new Date(result.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).toLowerCase()

  function copyRaw() {
    navigator.clipboard.writeText(JSON.stringify(result.rawResult, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Card className="border border-border">
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm font-semibold text-foreground flex-1">{result.inputSummary}</span>
          <span className="text-[11px] font-mono text-muted-foreground shrink-0">{timeLabel}</span>
          <Badge variant="outline" className={`text-[10px] shrink-0 ${status.bg} ${status.text} ${status.border}`}>
            <StatusIcon className="h-2.5 w-2.5 mr-1" />
            {status.label}
          </Badge>
        </div>

        <Separator />

        {/* Checks */}
        <div className="space-y-1.5">
          {result.checks.map((check, i) => {
            const checkStyle = CHECK_ICON[check.status]
            const CheckIcon = checkStyle.Icon
            return (
              <div key={i} className="flex items-start gap-2">
                <CheckIcon className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${checkStyle.color}`} />
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium text-foreground">{check.name}</span>
                  {check.detail && (
                    <span className="text-xs text-muted-foreground ml-1.5">{check.detail}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <Separator />

        {/* Summary */}
        <div className="flex items-center gap-1.5">
          <StatusIcon className={`h-3.5 w-3.5 ${status.iconColor}`} />
          <span className="text-xs font-medium text-foreground">
            {summaryLine(result.checks, result.overallStatus)}
          </span>
        </div>

        {/* Raw JSON toggle */}
        <div>
          <button
            type="button"
            onClick={() => setShowRaw((v) => !v)}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            {showRaw ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {showRaw ? "Hide raw JSON" : "View raw JSON"}
          </button>
          {showRaw && (
            <div className="mt-2 rounded-md border border-border bg-muted/40 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-border">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Full Audit Data
                </span>
                <button
                  type="button"
                  onClick={copyRaw}
                  className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <pre className="px-3 py-2 text-[11px] font-mono whitespace-pre-wrap break-words max-h-60 overflow-y-auto text-foreground">
                {JSON.stringify(result.rawResult, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
