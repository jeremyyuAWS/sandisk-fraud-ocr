import { useState, useEffect, useRef } from "react"
import { X, Minus, Paperclip, ArrowRight, Upload, Loader as Loader2, Maximize2, Minimize2, Bot, Image as ImageIcon, Headset, ShieldCheck, ShieldAlert, ShieldQuestionMark as ShieldQuestion, CircleCheck, TriangleAlert, RotateCcw, ScanSearch, Activity, ScrollText, ArrowDown, ArrowUp, Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import type { ChatStep } from "@/data/app-state"
import { scenarios, type Scenario } from "@/data/scenarios"
import type { LyzrAgentConfig } from "@/data/lyzr-config"
import { MarkdownMessage } from "./MarkdownMessage"
import { LyzrResponseCard, tryParseLyzrResponse } from "./LyzrResponseCard"
import { AgentActivityFeed } from "./AgentActivityFeed"
import { useLyzrWebSocket } from "@/hooks/useLyzrWebSocket"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatMessage {
  from: "bot" | "user"
  text?: string
  component?: React.ReactNode
  timestamp?: string
}

interface LogEntry {
  id: number
  timestamp: string
  direction: "request" | "response"
  sessionId: string
  data: Record<string, unknown>
}

interface ChatModalProps {
  open: boolean
  step: ChatStep
  selectedScenario: string
  onClose: () => void
  onStepChange: (step: ChatStep) => void
  onEscalate: () => void
  onImageUploaded?: (url: string) => void
  lyzrConfig: LyzrAgentConfig
  isLyzrConfigured: boolean
  onResetSession: () => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function now() {
  return new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).toLowerCase()
}

// ---------------------------------------------------------------------------
// Small UI pieces
// ---------------------------------------------------------------------------

function BotAvatar() {
  return (
    <div className="shrink-0 w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
      <Headset className="h-4 w-4 text-muted-foreground" />
    </div>
  )
}

function QuickChip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-full border border-border text-sm text-foreground hover:bg-secondary transition-colors cursor-pointer"
    >
      {label}
    </button>
  )
}

function RedChip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-5 py-2 rounded-lg border-2 border-sandisk-red text-sm font-semibold text-sandisk-red hover:bg-sandisk-red hover:text-white transition-colors cursor-pointer"
    >
      {label}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Message Bubble — matches the SanDisk screenshot style
// ---------------------------------------------------------------------------

function MessageBubble({ msg, expanded }: { msg: ChatMessage; expanded: boolean }) {
  if (msg.from === "user") {
    return (
      <div className="flex flex-col items-end gap-1">
        <div
          className={`${expanded ? "max-w-[60%]" : "max-w-[85%]"} bg-sandisk-red text-white rounded-full px-5 py-2.5 text-sm`}
        >
          {msg.text || msg.component}
        </div>
        {msg.timestamp && (
          <span className="text-[11px] text-muted-foreground mr-1">{msg.timestamp}</span>
        )}
      </div>
    )
  }

  const isComponent = !!msg.component
  return (
    <div className="flex items-start gap-2">
      <BotAvatar />
      <div className="flex flex-col gap-1 min-w-0">
        <div
          className={`${expanded ? "max-w-[60%]" : "max-w-[85%]"} ${
            isComponent
              ? expanded ? "max-w-md w-full" : "w-full"
              : "bg-secondary text-secondary-foreground rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm"
          }`}
        >
          {msg.component ? msg.component : msg.text ? <MarkdownMessage content={msg.text} /> : null}
        </div>
        {msg.timestamp && (
          <span className="text-[11px] text-muted-foreground ml-1">{msg.timestamp}</span>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Warranty / OCR cards
// ---------------------------------------------------------------------------

function WarrantyCard({ scenario }: { scenario: Scenario }) {
  const w = scenario.warranty
  return (
    <Card className="border border-border">
      <CardContent className="p-3 space-y-2 text-xs">
        <div className="font-semibold text-sm">{w.product}</div>
        <Separator />
        <div className="grid grid-cols-2 gap-y-1.5">
          <span className="text-muted-foreground">Serial Number</span>
          <span className="font-mono">{w.serialNumber}</span>
          <span className="text-muted-foreground">Registration</span>
          <span>{w.registered ? "Registered" : "Not Registered"}</span>
          <span className="text-muted-foreground">Warranty Status</span>
          <Badge variant="outline" className="w-fit bg-green-50 text-green-700 border-green-200">
            {w.status}
          </Badge>
          <span className="text-muted-foreground">Purchase Date</span>
          <span>{w.purchaseDate}</span>
          <span className="text-muted-foreground">Prior Claims</span>
          <span className={w.priorClaims > 1 ? "text-sandisk-red font-semibold" : ""}>
            {w.priorClaims}
          </span>
          <span className="text-muted-foreground">Eligible</span>
          <span>{w.replacementEligible ? "Yes" : "No"}</span>
        </div>
      </CardContent>
    </Card>
  )
}

function OcrResultCard({ scenario }: { scenario: Scenario }) {
  const { ocr, risk } = scenario
  const riskColor =
    risk.level === "Low"
      ? "bg-green-50 text-green-700 border-green-200"
      : risk.level === "High"
        ? "bg-red-50 text-red-700 border-red-200"
        : "bg-amber-50 text-amber-700 border-amber-200"

  return (
    <Card className="border border-border">
      <CardContent className="p-3 space-y-3 text-xs">
        <div className="font-semibold text-sm">AI Verification Result</div>
        <Separator />
        <div>
          <div className="text-muted-foreground mb-1">OCR Extracted Fields</div>
          <div className="grid grid-cols-2 gap-y-1">
            <span className="text-muted-foreground">Brand</span>
            <span>{ocr.brandDetected}</span>
            <span className="text-muted-foreground">Product</span>
            <span>{ocr.productText}</span>
            <span className="text-muted-foreground">Capacity</span>
            <span>{ocr.capacityDetected}</span>
            <span className="text-muted-foreground">Serial (Image)</span>
            <span className="font-mono">{ocr.serialDetected}</span>
            <span className="text-muted-foreground">Image Quality</span>
            <span>{ocr.imageQuality}</span>
          </div>
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Fraud Risk Score</span>
          <div className="flex items-center gap-2">
            <Progress value={risk.score} className="w-20 h-2" />
            <span className="font-semibold">{risk.score}/100</span>
          </div>
        </div>
        <Badge variant="outline" className={`w-fit ${riskColor}`}>
          {risk.level} Risk
        </Badge>
        {risk.reasonCodes.length > 0 && (
          <div className="space-y-1">
            <div className="text-muted-foreground">Findings:</div>
            <ul className="space-y-0.5 pl-3">
              {risk.reasonCodes.map((r, i) => (
                <li key={i} className="list-disc text-foreground">{r}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Return fraud result card
// ---------------------------------------------------------------------------

interface ReturnFraudResult {
  riskLevel: "Low" | "Medium" | "High"
  score: number
  productMatch: boolean
  orderValid: boolean
  imageAuthentic: boolean
  findings: string[]
  recommendation: string
}

function ReturnFraudCard({ result }: { result: ReturnFraudResult }) {
  const Icon = result.riskLevel === "Low" ? ShieldCheck : result.riskLevel === "High" ? ShieldAlert : ShieldQuestion
  const iconColor = result.riskLevel === "Low" ? "text-green-600" : result.riskLevel === "High" ? "text-red-600" : "text-amber-600"
  const riskColor =
    result.riskLevel === "Low"
      ? "bg-green-50 text-green-700 border-green-200"
      : result.riskLevel === "High"
        ? "bg-red-50 text-red-700 border-red-200"
        : "bg-amber-50 text-amber-700 border-amber-200"

  return (
    <Card className="border border-border">
      <CardContent className="p-3 space-y-3 text-xs">
        <div className="flex items-center gap-2">
          <Icon className={`h-5 w-5 ${iconColor}`} />
          <span className="font-semibold text-sm">Return Fraud Analysis</span>
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Risk Score</span>
          <div className="flex items-center gap-2">
            <Progress value={result.score} className="w-20 h-2" />
            <span className="font-semibold">{result.score}/100</span>
          </div>
        </div>
        <Badge variant="outline" className={`w-fit ${riskColor}`}>
          {result.riskLevel} Risk
        </Badge>
        <Separator />
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            {result.productMatch ? <CircleCheck className="h-3.5 w-3.5 text-green-600" /> : <TriangleAlert className="h-3.5 w-3.5 text-red-600" />}
            <span>Product image {result.productMatch ? "matches" : "does NOT match"} order</span>
          </div>
          <div className="flex items-center gap-2">
            {result.orderValid ? <CircleCheck className="h-3.5 w-3.5 text-green-600" /> : <TriangleAlert className="h-3.5 w-3.5 text-red-600" />}
            <span>Order number {result.orderValid ? "verified" : "could not be verified"}</span>
          </div>
          <div className="flex items-center gap-2">
            {result.imageAuthentic ? <CircleCheck className="h-3.5 w-3.5 text-green-600" /> : <TriangleAlert className="h-3.5 w-3.5 text-red-600" />}
            <span>Image {result.imageAuthentic ? "appears authentic" : "flagged as suspicious"}</span>
          </div>
        </div>
        {result.findings.length > 0 && (
          <>
            <Separator />
            <div className="space-y-1">
              <div className="text-muted-foreground font-medium">Findings</div>
              <ul className="space-y-0.5 pl-3">
                {result.findings.map((f, i) => (
                  <li key={i} className="list-disc">{f}</li>
                ))}
              </ul>
            </div>
          </>
        )}
        <Separator />
        <div>
          <div className="text-muted-foreground font-medium mb-0.5">Recommendation</div>
          <div className="font-medium">{result.recommendation}</div>
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Welcome screen
// ---------------------------------------------------------------------------

function WelcomeScreen({
  useLive,
  onToggleMode,
  showModeToggle,
}: {
  useLive: boolean
  onToggleMode: (live: boolean) => void
  showModeToggle: boolean
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 gap-4">
      <img
        src="/sandisk-chat-image.png"
        alt="Welcome, We're here to help"
        className="w-72 h-auto"
      />
      {showModeToggle && (
        <div className="flex items-center gap-3 bg-muted/50 rounded-lg px-4 py-2.5">
          <button
            type="button"
            onClick={() => onToggleMode(false)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-colors ${!useLive ? "bg-background text-foreground shadow-sm border border-border" : "text-muted-foreground hover:text-foreground"}`}
          >
            Simulated
          </button>
          <button
            type="button"
            onClick={() => onToggleMode(true)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-colors ${useLive ? "bg-green-600 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            Live Agent
          </button>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Lyzr integration
// ---------------------------------------------------------------------------

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

async function sendToLyzr(
  config: LyzrAgentConfig,
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
  return res.json()
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function ImagePreview({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="rounded-lg overflow-hidden border border-border">
      <img src={src} alt={alt} className="w-full h-auto max-h-40 object-cover" />
    </div>
  )
}

function tryExtractJson(text: string): Record<string, unknown> | null {
  try {
    const obj = JSON.parse(text)
    if (obj && typeof obj === "object") return obj
  } catch { /* ignore */ }
  const match = text.match(/\{[\s\S]*\}/)
  if (match) {
    try {
      const obj = JSON.parse(match[0])
      if (obj && typeof obj === "object") return obj
    } catch { /* ignore */ }
  }
  return null
}

function JsonResponseCard({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 overflow-hidden">
      <div className="px-3 py-1.5 border-b border-border bg-muted/50">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Agent Response</span>
      </div>
      <pre className="px-3 py-2 text-xs font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap break-words">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  )
}

function formatAnalysisKey(key: string): string {
  return key
    .replace(/[_-]/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function ImageAnalysisCard({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data).filter(([, v]) => v != null && v !== "")

  const riskLevel = (data.riskLevel || data.risk_level || data.riskAssessment) as string | undefined
  const riskScore = (data.riskScore || data.risk_score || data.fraudScore || data.fraud_score) as number | undefined
  const riskColor = riskLevel
    ? riskLevel.toString().toLowerCase().includes("low")
      ? "bg-green-50 text-green-700 border-green-200"
      : riskLevel.toString().toLowerCase().includes("high")
        ? "bg-red-50 text-red-700 border-red-200"
        : "bg-amber-50 text-amber-700 border-amber-200"
    : null

  const regularEntries = entries.filter(([k]) =>
    !["riskLevel", "risk_level", "riskScore", "risk_score", "riskAssessment", "fraudScore", "fraud_score", "reasonCodes", "reason_codes", "flags", "findings"].includes(k)
  )
  const listField = (data.reasonCodes || data.reason_codes || data.flags || data.findings) as string[] | undefined

  return (
    <Card className="border border-border">
      <CardContent className="p-3 space-y-3 text-xs">
        <div className="flex items-center gap-2">
          <ScanSearch className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold text-sm">Image Analysis Result</span>
        </div>
        <Separator />
        <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
          {regularEntries.map(([key, val]) => {
            if (typeof val === "object") return null
            return (
              <div key={key} className="contents">
                <span className="text-muted-foreground">{formatAnalysisKey(key)}</span>
                <span className={key.toLowerCase().includes("serial") ? "font-mono" : ""}>{String(val)}</span>
              </div>
            )
          })}
        </div>
        {(riskLevel || riskScore != null) && (
          <>
            <Separator />
            <div className="flex items-center gap-2">
              {riskColor && (
                <Badge variant="outline" className={`text-[10px] ${riskColor}`}>
                  {String(riskLevel)} Risk
                </Badge>
              )}
              {riskScore != null && (
                <div className="flex items-center gap-1.5">
                  <Progress value={Number(riskScore)} className="w-16 h-2" />
                  <span className="font-semibold">{riskScore}/100</span>
                </div>
              )}
            </div>
          </>
        )}
        {listField && Array.isArray(listField) && listField.length > 0 && (
          <>
            <Separator />
            <div className="space-y-1">
              <div className="text-muted-foreground font-medium">Findings</div>
              {listField.map((item, i) => {
                const isGood = String(item).toUpperCase().includes("SUCCESS") || String(item).toUpperCase().includes("VALID")
                return (
                  <div key={i} className="flex items-center gap-1.5">
                    {isGood
                      ? <CircleCheck className="h-3 w-3 text-green-600 shrink-0" />
                      : <TriangleAlert className="h-3 w-3 text-amber-500 shrink-0" />}
                    <span>{String(item)}</span>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function ImageAnalysisTextCard({ text }: { text: string }) {
  const lines = text.split("\n").filter(Boolean)
  const hasStructure = lines.length > 1

  if (!hasStructure) {
    return (
      <Card className="border border-border">
        <CardContent className="p-3 space-y-2 text-xs">
          <div className="flex items-center gap-2">
            <ScanSearch className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold text-sm">Image Analysis Result</span>
          </div>
          <Separator />
          <div className="text-sm leading-relaxed">
            <MarkdownMessage content={text} />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border border-border">
      <CardContent className="p-3 space-y-2 text-xs">
        <div className="flex items-center gap-2">
          <ScanSearch className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold text-sm">Image Analysis Result</span>
        </div>
        <Separator />
        <div className="text-sm leading-relaxed space-y-1">
          <MarkdownMessage content={text} />
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Logs Panel
// ---------------------------------------------------------------------------

let logIdCounter = 0

function LogsPanel({ logs, onClear }: { logs: LogEntry[]; onClear: () => void }) {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const logsEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [logs.length])

  function toggleExpand(id: number) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function copyLog(log: LogEntry) {
    navigator.clipboard.writeText(JSON.stringify(log.data, null, 2))
    setCopiedId(log.id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  if (logs.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-2 text-muted-foreground">
        <ScrollText className="h-8 w-8" />
        <p className="text-sm font-medium">No logs yet</p>
        <p className="text-xs text-center">Interactions with the Movate agent will be recorded here.</p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted/30 shrink-0">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          {logs.length} log {logs.length === 1 ? "entry" : "entries"}
        </span>
        <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={onClear}>
          Clear
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1.5">
        {logs.map((log) => {
          const isExpanded = expandedIds.has(log.id)
          const isReq = log.direction === "request"
          return (
            <div key={log.id} className="rounded-md border border-border bg-background text-xs">
              <button
                type="button"
                onClick={() => toggleExpand(log.id)}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left cursor-pointer hover:bg-muted/50 transition-colors"
              >
                <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${isReq ? "bg-blue-500" : "bg-green-500"}`} />
                <span className="font-mono text-[10px] text-muted-foreground shrink-0">{log.timestamp}</span>
                <span className={`font-semibold text-[10px] uppercase shrink-0 ${isReq ? "text-blue-600" : "text-green-600"}`}>
                  {log.direction}
                </span>
                <span className="text-muted-foreground text-[10px] truncate flex-1 font-mono">
                  session: {log.sessionId.slice(-8)}
                </span>
                {isExpanded ? <ArrowUp className="h-3 w-3 text-muted-foreground shrink-0" /> : <ArrowDown className="h-3 w-3 text-muted-foreground shrink-0" />}
              </button>
              {isExpanded && (
                <div className="border-t border-border">
                  <div className="flex justify-end px-2 pt-1">
                    <button
                      type="button"
                      onClick={() => copyLog(log)}
                      className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                      {copiedId === log.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      {copiedId === log.id ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <pre className="px-2.5 py-1.5 overflow-x-auto whitespace-pre-wrap break-words font-mono text-[10px] leading-relaxed max-h-48 overflow-y-auto">
                    {JSON.stringify(log.data, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )
        })}
        <div ref={logsEndRef} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Return fraud scenario engine
// ---------------------------------------------------------------------------

function evaluateReturnFraud(
  scenarioId: string,
  orderOver30: boolean,
  _email: string,
  _orderNumber: string,
  reason: string,
  uploadedImageUrl: string | null
): ReturnFraudResult {
  const isSSD = uploadedImageUrl?.includes("sandisk-ssd")
  const isXtreme = uploadedImageUrl?.includes("xtreme")
  const lowerReason = reason.toLowerCase()
  const mentionsDefect = lowerReason.includes("defect") || lowerReason.includes("broken") || lowerReason.includes("not working") || lowerReason.includes("damage")

  if (scenarioId === "suspicious" || orderOver30) {
    return {
      riskLevel: "High",
      score: orderOver30 ? 82 : 91,
      productMatch: false,
      orderValid: !orderOver30,
      imageAuthentic: false,
      findings: [
        ...(orderOver30 ? ["Order is beyond the 30-day return window"] : []),
        "Uploaded product image does not match the product on the order",
        "Image metadata indicates the photo may not be of the actual product",
        ...(isSSD ? ["Product appears to be an SSD but order is for microSD card"] : []),
      ],
      recommendation: orderOver30
        ? "Deny return -- order exceeds 30-day return policy"
        : "Escalate to fraud operations for manual investigation",
    }
  }

  if (scenarioId === "unverifiable") {
    return {
      riskLevel: "Medium",
      score: 48,
      productMatch: true,
      orderValid: true,
      imageAuthentic: false,
      findings: [
        "Image quality is too low to conclusively verify product",
        "Product label partially obscured in uploaded image",
        ...(mentionsDefect ? ["Reason cites physical defect but damage not visible in image"] : []),
      ],
      recommendation: "Request a clearer product image or escalate to support agent",
    }
  }

  return {
    riskLevel: "Low",
    score: 9,
    productMatch: true,
    orderValid: true,
    imageAuthentic: true,
    findings: [
      "Product image matches order record",
      "Order is within 30-day return window",
      ...(isXtreme ? ["SanDisk Xtreme product verified via label match"] : ["SanDisk branding confirmed"]),
      ...(mentionsDefect ? ["Defect reason documented for quality tracking"] : []),
    ],
    recommendation: "Approve return -- all checks passed",
  }
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function ChatModal({
  open,
  step,
  selectedScenario,
  onClose,
  onStepChange,
  onEscalate,
  onImageUploaded,
  lyzrConfig,
  isLyzrConfigured: isLyzrConfiguredProp,
  onResetSession,
}: ChatModalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [serialInput, setSerialInput] = useState("")
  const [freeInput, setFreeInput] = useState("")
  const [ocrProgress, setOcrProgress] = useState(0)
  const [isExpanded, setIsExpanded] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [showWelcome, setShowWelcome] = useState(true)
  const [useLive, setUseLive] = useState(false)
  const [showWsActivity, setShowWsActivity] = useState(true)
  const [activeTab, setActiveTab] = useState<"chat" | "logs">("chat")
  const [agentLogs, setAgentLogs] = useState<LogEntry[]>([])

  const isLyzrConfigured = useLive && isLyzrConfiguredProp

  function addLog(direction: "request" | "response", sessionId: string, data: Record<string, unknown>) {
    setAgentLogs((prev) => [
      ...prev,
      {
        id: ++logIdCounter,
        timestamp: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" }).toLowerCase(),
        direction,
        sessionId,
        data,
      },
    ])
  }

  // Return flow state
  const [returnEmail, setReturnEmail] = useState("")
  const [returnOrder, setReturnOrder] = useState("")
  const [returnReason, setReturnReason] = useState("")
  const [returnOver30, setReturnOver30] = useState(false)
  const [returnImageUrl, setReturnImageUrl] = useState<string | null>(null)
  const [returnProgress, setReturnProgress] = useState(0)

  const scrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const returnFileRef = useRef<HTMLInputElement>(null)
  const chatInputRef = useRef<HTMLInputElement>(null)
  const ocrResultHandled = useRef(false)
  const returnResultHandled = useRef(false)
  const scenario = scenarios[selectedScenario]

  const ws = useLyzrWebSocket()

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, step])

  useEffect(() => {
    if (step === "welcome") {
      ocrResultHandled.current = false
      returnResultHandled.current = false
      setShowWelcome(true)
      setMessages([])
      setReturnEmail("")
      setReturnOrder("")
      setReturnReason("")
      setReturnImageUrl(null)
    }
  }, [step])

  // OCR processing animation
  useEffect(() => {
    if (step === "ocr-processing") {
      setOcrProgress(0)
      ocrResultHandled.current = false
      const interval = setInterval(() => {
        setOcrProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval)
            setTimeout(() => onStepChange("ocr-result"), 400)
            return 100
          }
          return prev + 5
        })
      }, 80)
      return () => clearInterval(interval)
    }
  }, [step, onStepChange])

  useEffect(() => {
    if (step === "ocr-result" && !ocrResultHandled.current) {
      ocrResultHandled.current = true
      const resultText =
        scenario.risk.level === "Low"
          ? "Your product has been verified as genuine. All product details match the information on file."
          : scenario.risk.level === "High"
            ? "We were unable to confidently verify this product. Some product details do not match the information provided. A support specialist can review this case with you."
            : "The uploaded image could not be fully analyzed. We recommend uploading a clearer image or speaking with a support specialist."
      setMessages((prev) => [
        ...prev,
        { from: "bot", component: <OcrResultCard scenario={scenario} />, timestamp: now() },
        { from: "bot", text: resultText, timestamp: now() },
      ])
      onStepChange("escalation")
    }
  }, [step, scenario, onStepChange])

  // Return processing animation
  useEffect(() => {
    if (step === "return-processing") {
      setReturnProgress(0)
      returnResultHandled.current = false
      const interval = setInterval(() => {
        setReturnProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval)
            setTimeout(() => onStepChange("return-result"), 400)
            return 100
          }
          return prev + 4
        })
      }, 60)
      return () => clearInterval(interval)
    }
  }, [step, onStepChange])

  useEffect(() => {
    if (step === "return-result" && !returnResultHandled.current) {
      returnResultHandled.current = true
      const result = evaluateReturnFraud(
        selectedScenario,
        returnOver30,
        returnEmail,
        returnOrder,
        returnReason,
        returnImageUrl
      )

      const summary =
        result.riskLevel === "Low"
          ? "Your return has been approved. You will receive a return shipping label via email shortly."
          : result.riskLevel === "High"
            ? "We were unable to process your return automatically. This case has been flagged for review by our support team."
            : "We need a bit more information before we can process your return. A support specialist may reach out."

      setMessages((prev) => [
        ...prev,
        { from: "bot", component: <ReturnFraudCard result={result} />, timestamp: now() },
        { from: "bot", text: summary, timestamp: now() },
      ])
      onStepChange("escalation")
    }
  }, [step, selectedScenario, returnOver30, returnEmail, returnOrder, returnReason, returnImageUrl, onStepChange])

  // Helpers
  function addMsg(from: "bot" | "user", text: string) {
    setMessages((prev) => [...prev, { from, text, timestamp: now() }])
  }

  function addComponent(from: "bot" | "user", component: React.ReactNode) {
    setMessages((prev) => [...prev, { from, component, timestamp: now() }])
  }

  function handleNewSession() {
    onResetSession()
    ws.disconnect()
    ws.clearEvents()
    setMessages([])
    setAgentLogs([])
    setShowWelcome(true)
    setFreeInput("")
    setIsSending(false)
    setActiveTab("chat")
    onStepChange("welcome")
  }

  // Welcome -> conversation
  function startConversation() {
    setShowWelcome(false)
    addMsg("bot", "Hello! Welcome to SanDisk Support. I can help with warranty, replacement status, product returns, and troubleshooting.")
  }

  function handleWelcomeSelect(issue: string) {
    setShowWelcome(false)
    if (issue === "Return a Product") {
      setMessages([
        { from: "user", text: "need to return a product", timestamp: now() },
      ])
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          { from: "bot", text: "Let us get started with your return request.", timestamp: now() },
          { from: "bot", text: "Is your order more than 30 days?", timestamp: now() },
        ])
        onStepChange("return-30day")
      }, 300)
      return
    }

    if (isLyzrConfigured) {
      setMessages([{ from: "bot", text: "Hello! Welcome to SanDisk Support. How can I help you today?", timestamp: now() }])
      setTimeout(() => handleLyzrMessage(issue), 100)
      return
    }

    setMessages([
      { from: "bot", text: "Hello! Welcome to SanDisk Support. I can help with warranty, replacement status, product registration, and troubleshooting.", timestamp: now() },
      { from: "user", text: issue, timestamp: now() },
      {
        from: "bot",
        text: issue === "Warranty & Replacement"
          ? "Sure, I can help with warranty and replacements. What do you need?"
          : `I'd be happy to help with ${issue}. For this demo, let's proceed with the warranty flow.`,
        timestamp: now(),
      },
    ])
    onStepChange("warranty-subtype")
  }

  // Lyzr
  async function handleLyzrMessage(userMessage: string) {
    addMsg("user", userMessage)
    setIsSending(true)
    ws.connect(lyzrConfig.sessionId, lyzrConfig.apiKey)
    addLog("request", lyzrConfig.sessionId, {
      agentId: lyzrConfig.agentId,
      userId: lyzrConfig.userId,
      sessionId: lyzrConfig.sessionId,
      message: userMessage,
    })
    try {
      const result = await sendToLyzr(lyzrConfig, userMessage)
      ws.disconnect()
      addLog("response", lyzrConfig.sessionId, result as Record<string, unknown>)
      const responseText = result.response || result.error || "No response received."
      const parsed = tryParseLyzrResponse(responseText)
      if (parsed) {
        addComponent("bot", <LyzrResponseCard data={parsed} />)
      } else {
        const jsonObj = tryExtractJson(responseText)
        if (jsonObj) {
          addComponent("bot", <JsonResponseCard data={jsonObj} />)
        } else {
          addMsg("bot", responseText)
        }
      }
    } catch (err) {
      ws.disconnect()
      addLog("response", lyzrConfig.sessionId, { error: err instanceof Error ? err.message : "Network error" })
      addMsg("bot", "Failed to reach the Movate agent. Please check your settings.")
    } finally {
      setIsSending(false)
    }
  }

  function handleBottomInputSubmit() {
    const msg = chatInputRef.current?.value?.trim() || freeInput.trim()
    if (!msg) return
    setFreeInput("")
    if (showWelcome) {
      startConversation()
      return
    }
    if (isLyzrConfigured) {
      handleLyzrMessage(msg)
      return
    }
    addMsg("user", msg)
    addMsg("bot", "Thank you for your message. For this demo, please select one of the support options above or switch to Live mode to chat with the AI agent.")
  }

  // Warranty flow handlers
  function handleIssueSelect(issue: string) {
    if (issue === "Return a Product") {
      handleWelcomeSelect(issue)
      return
    }
    if (isLyzrConfigured) { handleLyzrMessage(issue); return }
    addMsg("user", issue)
    addMsg("bot", issue === "Warranty & Replacement"
      ? "Sure, I can help with warranty and replacements. What do you need?"
      : `I'd be happy to help with ${issue}. For this demo, let's proceed with the warranty flow.`)
    onStepChange("warranty-subtype")
  }

  function handleWarrantySubtype(sub: string) {
    if (sub === "Return / Replacement Request") {
      addMsg("user", sub)
      addMsg("bot", "Let us get started with your return request.")
      addMsg("bot", "Is your order more than 30 days?")
      onStepChange("return-30day")
      return
    }
    if (isLyzrConfigured) { handleLyzrMessage(sub); return }
    addMsg("user", sub)
    addMsg("bot", "To look up your warranty, please enter your product serial number.")
    onStepChange("serial-entry")
  }

  function handleSerialSubmit() {
    const serial = serialInput || scenario.serialEntered
    if (isLyzrConfigured) { setSerialInput(""); handleLyzrMessage(`Serial: ${serial}`); return }
    addMsg("user", `Serial: ${serial}`)
    addMsg("bot", "Thank you. I found a matching warranty record:")
    addComponent("bot", <WarrantyCard scenario={scenario} />)
    addMsg("bot", "To continue your warranty verification, please upload a clear image of the product label.")
    setSerialInput("")
    onStepChange("image-request")
  }

  function handleDemoImageUpload() {
    onImageUploaded?.(scenario.productImage)
    addComponent("user", <ImagePreview src={scenario.productImage} alt="Product upload" />)
    addMsg("bot", "Thank you. Analyzing your product image now...")
    onStepChange("ocr-processing")
  }

  async function handleRealFileUpload(file: File) {
    const objectUrl = URL.createObjectURL(file)
    onImageUploaded?.(objectUrl)
    addComponent("user", <ImagePreview src={objectUrl} alt="Uploaded product" />)
    addMsg("bot", "Image received. Analyzing your product now...")
    setIsSending(true)
    ws.connect(lyzrConfig.sessionId, lyzrConfig.apiKey)
    addLog("request", lyzrConfig.sessionId, {
      agentId: lyzrConfig.agentId,
      userId: lyzrConfig.userId,
      sessionId: lyzrConfig.sessionId,
      message: "Here is the product image for verification.",
      hasImage: true,
      fileName: file.name,
      fileSize: file.size,
    })
    try {
      const base64 = await fileToBase64(file)
      const result = await sendToLyzr(
        lyzrConfig,
        "Here is the product image for verification.",
        base64
      )
      ws.disconnect()
      addLog("response", lyzrConfig.sessionId, result as Record<string, unknown>)
      const responseText = result.response || result.error || "No response received."
      const parsed = tryParseLyzrResponse(responseText)
      if (parsed) {
        addComponent("bot", <LyzrResponseCard data={parsed} />)
      } else {
        const jsonObj = tryExtractJson(responseText)
        if (jsonObj) {
          addComponent("bot", <ImageAnalysisCard data={jsonObj} />)
        } else {
          addComponent("bot", <ImageAnalysisTextCard text={responseText} />)
        }
      }
    } catch (err) {
      ws.disconnect()
      addLog("response", lyzrConfig.sessionId, { error: err instanceof Error ? err.message : "Network error" })
      addMsg("bot", "Failed to analyze the image. Please check your Movate agent settings.")
    } finally {
      setIsSending(false)
    }
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleRealFileUpload(file)
    e.target.value = ""
  }

  // --- Return flow handlers ---

  function handle30DayAnswer(over30: boolean) {
    setReturnOver30(over30)
    addMsg("user", over30 ? "Yes" : "No")
    if (over30) {
      addMsg("bot", "We're sorry, but our return policy only covers orders within 30 days. We'll still review your case. Please provide your email address.")
    } else {
      addMsg("bot", "Kindly enter your email address.")
    }
    onStepChange("return-email")
  }

  function handleReturnEmailSubmit() {
    const email = returnEmail.trim() || "customer@email.com"
    setReturnEmail(email)
    addMsg("user", email)
    addMsg("bot", "Thank you. Please enter your order number.")
    onStepChange("return-order")
  }

  function handleReturnOrderSubmit() {
    const order = returnOrder.trim() || "ORD-2026-7741"
    setReturnOrder(order)
    addMsg("user", order)
    addMsg("bot", "Got it. Now please upload a photo of the product you'd like to return.")
    onStepChange("return-image")
  }

  function handleReturnImageSelect() {
    const imgUrl = scenario.productImage
    setReturnImageUrl(imgUrl)
    onImageUploaded?.(imgUrl)
    addComponent("user", <ImagePreview src={imgUrl} alt="Return product" />)
    addMsg("bot", "Thank you for the image. Lastly, please describe your reason for returning this product.")
    onStepChange("return-reason")
  }

  function handleReturnFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setReturnImageUrl(url)
    onImageUploaded?.(url)
    addComponent("user", <ImagePreview src={url} alt="Return product" />)
    addMsg("bot", "Thank you for the image. Lastly, please describe your reason for returning this product.")
    onStepChange("return-reason")
    e.target.value = ""
  }

  function handleReturnReasonSubmit() {
    const reason = returnReason.trim() || "Product not as described"
    setReturnReason(reason)
    addMsg("user", reason)
    addMsg("bot", "Thank you. We're now processing your return request and verifying the details...")
    onStepChange("return-processing")
  }

  // ---

  const sizeClasses = isExpanded
    ? "fixed inset-4 z-50 w-auto h-auto"
    : "fixed bottom-6 right-6 z-50 w-[480px] h-[700px]"

  const showConversation = !showWelcome && messages.length > 0

  // Determine which input field value / handler to use in the bottom bar
  const isReturnTextStep = step === "return-email" || step === "return-order" || step === "return-reason"
  const bottomValue = isReturnTextStep
    ? (step === "return-email" ? returnEmail : step === "return-order" ? returnOrder : returnReason)
    : (step === "serial-entry" ? serialInput : freeInput)

  function handleBottomChange(val: string) {
    if (step === "return-email") setReturnEmail(val)
    else if (step === "return-order") setReturnOrder(val)
    else if (step === "return-reason") setReturnReason(val)
    else if (step === "serial-entry") setSerialInput(val)
    else setFreeInput(val)
  }

  function handleBottomSubmit() {
    const rawVal = chatInputRef.current?.value ?? ""
    if (step === "return-email") { setReturnEmail(rawVal); handleReturnEmailSubmit(); return }
    if (step === "return-order") { setReturnOrder(rawVal); handleReturnOrderSubmit(); return }
    if (step === "return-reason") { setReturnReason(rawVal); handleReturnReasonSubmit(); return }
    if (step === "serial-entry") { setSerialInput(rawVal); handleSerialSubmit(); return }
    handleBottomInputSubmit()
  }

  const bottomPlaceholder =
    step === "return-email" ? "Enter your email address"
    : step === "return-order" ? "Enter your order number"
    : step === "return-reason" ? "Describe your reason for return"
    : "Type here to begin"

  return (
    <div
      className={`${sizeClasses} bg-background border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-200 ${!open ? "hidden" : ""}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border bg-background shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <img src="/sandisk-logo.svg" alt="SanDisk" className="h-3.5 shrink-0" />
          <span className="text-xs font-bold tracking-wide text-foreground shrink-0">CHAT</span>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {isLyzrConfiguredProp && !showWelcome && (
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded mr-0.5 ${useLive ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
              {useLive ? "Live" : "Sim"}
            </span>
          )}
          {isLyzrConfigured && !showWelcome && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              title={showWsActivity ? "Hide agent activity" : "Show agent activity"}
              onClick={() => setShowWsActivity((v) => !v)}
            >
              <Activity className={`h-3.5 w-3.5 ${showWsActivity ? "text-green-600" : "text-muted-foreground"}`} />
            </Button>
          )}
          {isLyzrConfigured && !showWelcome && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              title={activeTab === "logs" ? "Show chat" : "Show logs"}
              onClick={() => setActiveTab((t) => t === "chat" ? "logs" : "chat")}
            >
              <ScrollText className={`h-3.5 w-3.5 ${activeTab === "logs" ? "text-blue-600" : "text-muted-foreground"}`} />
            </Button>
          )}
          {isLyzrConfigured && !showWelcome && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              title="New session"
              onClick={handleNewSession}
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          )}
          {isExpanded && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsExpanded(false)}>
              <Minimize2 className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <Minus className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Logs Panel */}
      {activeTab === "logs" && (
        <LogsPanel logs={agentLogs} onClear={() => setAgentLogs([])} />
      )}

      {/* Welcome Screen */}
      {activeTab === "chat" && showWelcome && step === "welcome" && (
        <WelcomeScreen
          useLive={useLive}
          onToggleMode={setUseLive}
          showModeToggle={isLyzrConfiguredProp}
        />
      )}

      {/* Conversation Messages */}
      {activeTab === "chat" && showConversation && (
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {messages.map((msg, i) => (
            <MessageBubble key={i} msg={msg} expanded={isExpanded} />
          ))}

          {isSending && (
            <div className="flex items-start gap-2">
              <BotAvatar />
              <div className="bg-secondary text-secondary-foreground rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm">
                {showWsActivity ? (
                  <AgentActivityFeed events={ws.events} isConnected={ws.isConnected} />
                ) : (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Thinking...</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* --- Warranty flow chips --- */}
          {!isLyzrConfigured && step === "warranty-subtype" && (
            <div className="flex flex-wrap gap-2 pt-1 pl-10">
              <QuickChip label="Warranty Status" onClick={() => handleWarrantySubtype("Warranty Status")} />
              <QuickChip label="Replacement Status" onClick={() => handleWarrantySubtype("Replacement Status")} />
              <QuickChip label="Return / Replacement Request" onClick={() => handleWarrantySubtype("Return / Replacement Request")} />
            </div>
          )}

          {!isLyzrConfigured && step === "serial-entry" && (
            <div className="flex gap-2 pt-1 pl-10">
              <Input
                placeholder={scenario.serialEntered}
                value={serialInput}
                onChange={(e) => setSerialInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSerialSubmit()}
                className="text-sm"
              />
              <Button size="sm" onClick={handleSerialSubmit}>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {!isLyzrConfigured && step === "image-request" && (
            <div className="pt-1 pl-10 space-y-2">
              <div className="rounded-lg overflow-hidden border border-border">
                <img src={scenario.productImage} alt="Product to upload" className="w-full h-auto max-h-36 object-cover" />
              </div>
              <button
                onClick={handleDemoImageUpload}
                className="w-full border-2 border-dashed border-border rounded-lg p-4 flex flex-col items-center gap-1.5 hover:border-sandisk-red hover:bg-secondary/50 transition-colors cursor-pointer"
              >
                <Upload className="h-6 w-6 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Click to upload this product image</span>
              </button>
            </div>
          )}

          {!isLyzrConfigured && step === "ocr-processing" && (
            <div className="pt-1 pl-10 space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                AI verification in progress...
              </div>
              <Progress value={ocrProgress} className="h-2" />
              <div className="text-xs text-muted-foreground text-right">{ocrProgress}%</div>
            </div>
          )}

          {/* --- Return flow steps --- */}
          {step === "return-30day" && (
            <div className="flex gap-3 pt-1 pl-10">
              <RedChip label="Yes" onClick={() => handle30DayAnswer(true)} />
              <RedChip label="No" onClick={() => handle30DayAnswer(false)} />
            </div>
          )}

          {step === "return-image" && (
            <div className="pt-1 pl-10 space-y-2">
              <input
                ref={returnFileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleReturnFileUpload}
              />
              <div className="rounded-lg overflow-hidden border border-border">
                <img src={scenario.productImage} alt="Product to return" className="w-full h-auto max-h-36 object-cover" />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleReturnImageSelect}
                  className="flex-1 border-2 border-dashed border-border rounded-lg p-3 flex flex-col items-center gap-1 hover:border-sandisk-red hover:bg-secondary/50 transition-colors cursor-pointer"
                >
                  <Upload className="h-5 w-5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Use demo image</span>
                </button>
                <button
                  onClick={() => returnFileRef.current?.click()}
                  className="flex-1 border-2 border-dashed border-border rounded-lg p-3 flex flex-col items-center gap-1 hover:border-sandisk-red hover:bg-secondary/50 transition-colors cursor-pointer"
                >
                  <ImageIcon className="h-5 w-5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Upload your own</span>
                </button>
              </div>
            </div>
          )}

          {step === "return-reason" && (
            <div className="pt-1 pl-10 space-y-2">
              <Textarea
                placeholder="e.g., Product not as described, defective, wrong item..."
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                className="text-sm min-h-[80px] resize-none"
              />
              <Button
                size="sm"
                className="bg-sandisk-red hover:bg-sandisk-red/90 text-white w-full"
                onClick={handleReturnReasonSubmit}
                disabled={!returnReason.trim()}
              >
                Submit Return Request
              </Button>
            </div>
          )}

          {step === "return-processing" && (
            <div className="pt-1 pl-10 space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing return and running fraud checks...
              </div>
              <div className="space-y-1.5 text-xs text-muted-foreground">
                {returnProgress > 15 && <div className="flex items-center gap-2"><CircleCheck className="h-3.5 w-3.5 text-green-600" /> Validating order number...</div>}
                {returnProgress > 35 && <div className="flex items-center gap-2"><CircleCheck className="h-3.5 w-3.5 text-green-600" /> Verifying email against account...</div>}
                {returnProgress > 55 && <div className="flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Analyzing product image with AI...</div>}
                {returnProgress > 75 && <div className="flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Cross-referencing order history...</div>}
                {returnProgress > 90 && <div className="flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating fraud risk assessment...</div>}
              </div>
              <Progress value={returnProgress} className="h-2" />
            </div>
          )}

          {/* --- Escalation (shared) --- */}
          {!isLyzrConfigured && step === "escalation" && (
            <div className="flex flex-wrap gap-2 pt-1 pl-10">
              {scenario.risk.level === "Low" && !returnResultHandled.current ? (
                <>
                  <QuickChip label="Continue Claim" onClick={() => {
                    addMsg("user", "Continue Claim")
                    addMsg("bot", "Your replacement has been approved. You will receive a confirmation email shortly. Thank you for choosing SanDisk!")
                    onStepChange("escalation")
                  }} />
                  <QuickChip label="Chat with Agent" onClick={onEscalate} />
                </>
              ) : (
                <>
                  <Button size="sm" className="bg-sandisk-red hover:bg-sandisk-red/90 text-white" onClick={onEscalate}>
                    Escalate to Live Agent
                  </Button>
                  <QuickChip label="Start Over" onClick={() => {
                    onStepChange("welcome")
                  }} />
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Bottom bar */}
      {activeTab === "chat" && <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileInputChange} />}
      {activeTab === "chat" && (
      <div className="mt-auto border-t border-border px-4 py-3 flex items-center gap-3 shrink-0">
        <button
          type="button"
          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          onClick={() => {
            if (isLyzrConfigured) fileInputRef.current?.click()
          }}
        >
          {isLyzrConfigured ? <ImageIcon className="h-5 w-5" /> : <Paperclip className="h-5 w-5" />}
        </button>
        <input
          ref={chatInputRef}
          type="text"
          placeholder={bottomPlaceholder}
          className="flex-1 text-sm h-9 border-0 shadow-none outline-none bg-transparent placeholder:text-muted-foreground"
          value={bottomValue}
          onChange={(e) => handleBottomChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !isSending) {
              e.preventDefault()
              e.stopPropagation()
              handleBottomSubmit()
            }
          }}
          disabled={isSending}
        />
        <button
          type="button"
          className="shrink-0 text-foreground hover:text-sandisk-red transition-colors cursor-pointer disabled:opacity-40"
          disabled={isSending}
          onMouseDown={(e) => {
            e.preventDefault()
            if (!isSending) handleBottomSubmit()
          }}
          onClick={(e) => {
            e.preventDefault()
            if (!isSending) handleBottomSubmit()
          }}
        >
          <ArrowRight className="h-5 w-5" />
        </button>
      </div>
      )}
    </div>
  )
}
