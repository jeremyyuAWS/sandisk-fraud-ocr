import { useState, useEffect, useRef } from "react"
import { X, Minus, Paperclip, Loader as Loader2, Maximize2, Minimize2, Headset, ShieldCheck, ShieldAlert, ShieldQuestionMark as ShieldQuestion, CircleCheck, TriangleAlert, Clock, ScanSearch, FileText, Package, Receipt, ChevronDown, ChevronUp, ScrollText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import { MarkdownMessage } from "./MarkdownMessage"
import {
  createCase,
  uploadImage,
  validateCase,
  escalateCase,
  type ValidateResponse,
  type CustomerSummary,
  type ValidationCheck,
  type Classification,
} from "@/lib/api"

// ---------------------------------------------------------------------------
// Session log entry type
// ---------------------------------------------------------------------------

interface LogEntry {
  timestamp: string
  direction: "request" | "response"
  endpoint: string
  data: unknown
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ChatStep =
  | "welcome"
  | "issue-select"
  | "image-upload"
  | "upload-preview"
  | "validating"
  | "result"
  | "escalated"

interface ChatMessage {
  from: "bot" | "user"
  text?: string
  component?: React.ReactNode
  timestamp?: string
}

interface ChatModalProps {
  open: boolean
  onClose: () => void
  onEscalate: () => void
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
// Message Bubble
// ---------------------------------------------------------------------------

function MessageBubble({ msg, expanded }: { msg: ChatMessage; expanded: boolean }) {
  const textSize = expanded ? "text-base" : "text-sm"
  if (msg.from === "user") {
    const isComponent = !!msg.component
    return (
      <div className="flex flex-col items-end gap-1">
        <div
          className={`${expanded ? "max-w-[60%]" : "max-w-[85%]"} ${
            isComponent
              ? textSize
              : `bg-sandisk-red text-white rounded-full px-5 py-2.5 ${textSize}`
          }`}
        >
          {msg.text || msg.component}
        </div>
        {msg.timestamp && (
          <span className={`${expanded ? "text-xs" : "text-[11px]"} text-muted-foreground mr-1`}>{msg.timestamp}</span>
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
              ? expanded ? "max-w-lg w-full" : "w-full"
              : `bg-secondary text-secondary-foreground rounded-2xl rounded-bl-sm px-4 py-2.5 ${textSize}`
          }`}
        >
          {msg.component ? msg.component : msg.text ? <MarkdownMessage content={msg.text} /> : null}
        </div>
        {msg.timestamp && (
          <span className={`${expanded ? "text-xs" : "text-[11px]"} text-muted-foreground ml-1`}>{msg.timestamp}</span>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Validation Result Card (renders customer_summary)
// ---------------------------------------------------------------------------

function ValidationResultCard({ summary }: { summary: CustomerSummary }) {
  const Icon =
    summary.decision === "auto_approve" ? ShieldCheck
    : summary.decision === "auto_reject" ? ShieldAlert
    : ShieldQuestion
  const iconColor =
    summary.decision === "auto_approve" ? "text-green-600"
    : summary.decision === "auto_reject" ? "text-red-500"
    : "text-amber-500"
  const bandColor =
    summary.risk_band === "Low"
      ? "bg-green-50 text-green-700 border-green-200"
      : summary.risk_band === "High"
        ? "bg-red-50 text-red-700 border-red-200"
        : "bg-amber-50 text-amber-700 border-amber-200"

  return (
    <Card className="border border-border">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className={`h-5 w-5 ${iconColor}`} />
            <span className="text-base font-semibold text-foreground">{summary.headline}</span>
          </div>
          <Badge variant="outline" className={`text-xs font-bold ${bandColor}`}>
            {summary.risk_band} Risk
          </Badge>
        </div>

        <Separator />

        <p className="text-sm text-muted-foreground">{summary.body}</p>

        <Separator />

        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
          Verification Checks
        </div>
        <div className="space-y-2">
          {summary.checks.map((check: ValidationCheck, i: number) => {
            const color =
              check.result === "Passed" ? "text-green-600"
              : check.result === "Failed" ? "text-red-500"
              : "text-amber-500"
            const CheckIcon =
              check.result === "Passed" ? CircleCheck
              : check.result === "Failed" ? TriangleAlert
              : Clock
            return (
              <div key={i} className="flex items-start gap-2">
                <CheckIcon className={`h-4 w-4 shrink-0 mt-0.5 ${color}`} />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-foreground">{check.name}</span>
                  {check.detail && (
                    <p className="text-xs text-muted-foreground mt-0.5">{check.detail}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {summary.warranty && (
          <>
            <Separator />
            <div className="text-sm">
              <span className="text-muted-foreground">Warranty: </span>
              <span className="font-medium text-foreground">{summary.warranty}</span>
            </div>
          </>
        )}

        {summary.extracted && summary.extracted.length > 0 && (
          <>
            <Separator />
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              What we read from your uploads
            </div>
            <div className="space-y-2">
              {summary.extracted.map((item, i) => (
                <div key={i} className="space-y-1">
                  <div className="text-xs text-muted-foreground capitalize">
                    {item.kind} — {item.filename}
                  </div>
                  <div className="grid grid-cols-[100px_1fr] gap-y-0.5 text-sm">
                    {item.fields.map((f, j) => (
                      <div key={j} className="contents">
                        <span className="text-muted-foreground">{f.label}</span>
                        <span className="font-medium text-foreground">{f.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {summary.next_steps && summary.next_steps.length > 0 && (
          <>
            <Separator />
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              Next Steps
            </div>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              {summary.next_steps.map((step, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="text-foreground font-medium">{i + 1}.</span>
                  {step}
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Classification card (shown after upload)
// ---------------------------------------------------------------------------

function ClassificationCard({ classification, previewUrl, onImageClick }: { classification: Classification; previewUrl?: string; onImageClick?: (url: string, classification: Classification) => void }) {
  const [specsExpanded, setSpecsExpanded] = useState(false)
  const [rawOpen, setRawOpen] = useState(false)
  const isInvoice = classification.type === "invoice" || classification.type === "transcript"
  const TypeIcon = isInvoice ? Receipt : Package
  const specs = classification.specifications ?? []
  const SPEC_PREVIEW_COUNT = 4

  // For invoices with fields, show image + fields side by side
  if (isInvoice && classification.fields.length > 0 && previewUrl) {
    return (
      <Card className="border border-border">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start gap-2">
            <TypeIcon className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
            <p className="text-sm text-foreground leading-relaxed">{classification.chat_message}</p>
          </div>

          <Separator />

          <div className="flex gap-3">
            <div className="shrink-0">
              <button
                onClick={() => onImageClick?.(previewUrl, classification)}
                className="cursor-pointer hover:opacity-80 transition-opacity"
              >
                <img
                  src={previewUrl}
                  alt="Invoice"
                  className="w-[100px] h-[130px] object-cover rounded-md border border-border"
                />
              </button>
            </div>
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Identifiers
              </div>
              <div className="grid grid-cols-[90px_1fr] gap-y-1 text-sm">
                {classification.fields.map((f, i) => (
                  <div key={i} className="contents">
                    <span className="text-muted-foreground text-xs">{f.label}</span>
                    <span className="font-medium text-foreground text-xs">{f.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {classification.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {classification.tags.map((tag, i) => (
                <Badge key={i} variant="outline" className="text-[10px] py-0.5 px-2 font-normal">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {classification.extracted_text.length > 0 && (
            <>
              <button
                onClick={() => setRawOpen(!rawOpen)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                {rawOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                {rawOpen ? "Hide raw text" : "Show raw text"}
              </button>
              {rawOpen && (
                <div className="text-xs text-muted-foreground space-y-0.5 font-mono bg-muted/50 rounded-md p-2 max-h-[120px] overflow-y-auto">
                  {classification.extracted_text.map((t, i) => (
                    <div key={i}>{t}</div>
                  ))}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    )
  }

  // Default layout for product/label/packaging images
  return (
    <Card className="border border-border">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-2">
          <TypeIcon className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
          <p className="text-sm text-foreground leading-relaxed">{classification.chat_message}</p>
        </div>

        {previewUrl && (
          <button
            onClick={() => onImageClick?.(previewUrl, classification)}
            className="cursor-pointer hover:opacity-80 transition-opacity"
          >
            <img src={previewUrl} alt="Product" className="max-w-[120px] max-h-[100px] rounded-md border border-border object-cover" />
          </button>
        )}

        {classification.fields.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Identifiers
            </div>
            <div className="grid grid-cols-[100px_1fr] gap-y-1">
              {classification.fields.map((f, i) => (
                <div key={i} className="contents">
                  <span className="text-xs text-muted-foreground">{f.label}</span>
                  <span className="text-xs font-medium text-foreground">{f.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {specs.length > 0 && (
          <>
            <Separator />
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Specifications
              </div>
              <div className="grid grid-cols-[120px_1fr] gap-y-1">
                {(specsExpanded ? specs : specs.slice(0, SPEC_PREVIEW_COUNT)).map((s, i) => (
                  <div key={i} className="contents">
                    <span className="text-xs text-muted-foreground">{s.label}</span>
                    <span className="text-xs font-medium text-foreground">{s.value}</span>
                  </div>
                ))}
              </div>
              {specs.length > SPEC_PREVIEW_COUNT && (
                <button
                  onClick={() => setSpecsExpanded(!specsExpanded)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  {specsExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  {specsExpanded ? "Show less" : `Show all ${specs.length} specs`}
                </button>
              )}
            </div>
          </>
        )}

        {classification.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {classification.tags.map((tag, i) => (
              <Badge key={i} variant="outline" className="text-[10px] py-0.5 px-2 font-normal">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {classification.extracted_text.length > 0 && (
          <>
            <button
              onClick={() => setRawOpen(!rawOpen)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              {rawOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              {rawOpen ? "Hide raw text" : "Show raw text"}
            </button>
            {rawOpen && (
              <div className="text-xs text-muted-foreground space-y-0.5 font-mono bg-muted/50 rounded-md p-2 max-h-[120px] overflow-y-auto">
                {classification.extracted_text.map((t, i) => (
                  <div key={i}>{t}</div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// OCR Processing Spinner (shown during image upload)
// ---------------------------------------------------------------------------

const OCR_STEPS_INVOICE = [
  { label: "Analyzing document layout...", pct: 12 },
  { label: "Detecting text regions...", pct: 25 },
  { label: "Reading invoice header fields...", pct: 40 },
  { label: "Extracting line items and totals...", pct: 58 },
  { label: "Identifying serial numbers...", pct: 72 },
  { label: "Verifying seller GSTIN...", pct: 85 },
  { label: "Matching product to catalog...", pct: 95 },
]

const OCR_STEPS_LABEL = [
  { label: "Detecting label region...", pct: 15 },
  { label: "Enhancing text contrast...", pct: 30 },
  { label: "Reading serial number...", pct: 50 },
  { label: "Extracting model and SKU...", pct: 70 },
  { label: "Verifying against product database...", pct: 88 },
  { label: "Completing classification...", pct: 95 },
]

const OCR_STEPS_PRODUCT = [
  { label: "Identifying product type...", pct: 18 },
  { label: "Analyzing visual features...", pct: 38 },
  { label: "Checking brand markings...", pct: 55 },
  { label: "Reading visible text...", pct: 72 },
  { label: "Matching to known product lines...", pct: 90 },
  { label: "Finalizing...", pct: 95 },
]

const OCR_STEPS_PDF = [
  { label: "Opening PDF document...", pct: 10 },
  { label: "Rendering pages for OCR...", pct: 25 },
  { label: "Extracting text content...", pct: 45 },
  { label: "Identifying document type...", pct: 60 },
  { label: "Parsing structured fields...", pct: 78 },
  { label: "Cross-referencing records...", pct: 90 },
  { label: "Completing analysis...", pct: 95 },
]

function getOcrSteps(filename: string): Array<{ label: string; pct: number }> {
  const lower = filename.toLowerCase()
  if (lower.endsWith(".pdf")) return OCR_STEPS_PDF
  if (lower.includes("invoice") || lower.includes("receipt") || lower.includes("memo") || lower.includes("warranty_letter")) return OCR_STEPS_INVOICE
  if (lower.includes("label") || lower.includes("back") || lower.includes("serial")) return OCR_STEPS_LABEL
  return OCR_STEPS_PRODUCT
}

function OcrProcessingCard({ filename }: { filename: string }) {
  const steps = getOcrSteps(filename)
  const [stepIdx, setStepIdx] = useState(0)
  const [progress, setProgress] = useState(0)
  const [completedSteps, setCompletedSteps] = useState<number[]>([])

  useEffect(() => {
    const interval = setInterval(() => {
      setStepIdx((s) => {
        if (s < steps.length - 1) {
          setCompletedSteps((prev) => [...prev, s])
          return s + 1
        }
        return s
      })
    }, 800 + Math.random() * 400)
    return () => clearInterval(interval)
  }, [steps.length])

  useEffect(() => {
    const target = steps[stepIdx]?.pct ?? 0
    const tick = setInterval(() => {
      setProgress((p) => {
        if (p >= target) { clearInterval(tick); return target }
        return p + 2
      })
    }, 50)
    return () => clearInterval(tick)
  }, [stepIdx, steps])

  return (
    <Card className="border border-border">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ScanSearch className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">Processing: {filename.length > 30 ? filename.slice(0, 28) + "..." : filename}</span>
          </div>
          <span className="text-xs font-mono text-muted-foreground">{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="h-2" />
        <div className="space-y-1">
          {steps.map((step, i) => {
            const isDone = completedSteps.includes(i)
            const isCurrent = i === stepIdx && !isDone
            if (i > stepIdx) return null
            return (
              <div key={i} className="flex items-center gap-2">
                {isDone ? (
                  <CircleCheck className="h-3.5 w-3.5 text-green-600 shrink-0" />
                ) : isCurrent ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />
                ) : null}
                <span className={`text-xs ${isDone ? "text-muted-foreground line-through" : "text-foreground"}`}>
                  {step.label}
                </span>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Validating spinner
// ---------------------------------------------------------------------------

function ValidatingSpinner() {
  return (
    <Card className="border border-border">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <ScanSearch className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Verification in progress</span>
        </div>
        <Separator />
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <div className="space-y-1">
            <div className="text-sm text-foreground">Running verification checks...</div>
            <div className="text-xs text-muted-foreground">This usually takes a few seconds.</div>
          </div>
        </div>
        <Progress value={50} className="h-2 animate-pulse" />
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Clickable image preview (user uploaded image thumbnail)
// ---------------------------------------------------------------------------

function ClickableImagePreview({ url, filename, onClick }: { url: string; filename: string; onClick: (url: string) => void }) {
  return (
    <div className="space-y-1">
      <button onClick={() => onClick(url)} className="cursor-pointer hover:opacity-80 transition-opacity">
        <img src={url} alt={filename} className="max-w-[200px] max-h-[160px] rounded-lg object-cover border border-border" />
      </button>
      <div className="text-xs opacity-80">{filename}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Image Lightbox (full-size image + OCR results side-by-side)
// ---------------------------------------------------------------------------

function ImageLightbox({ url, classification, onClose }: { url: string; classification?: Classification; onClose: () => void }) {
  const specs = classification?.specifications ?? []
  const hasData = classification && (classification.fields.length > 0 || specs.length > 0 || classification.extracted_text.length > 0)

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative bg-background rounded-2xl shadow-2xl border border-border max-w-[1000px] max-h-[85vh] w-[92vw] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <ScanSearch className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">Image & OCR Extraction</span>
            {classification && (
              <Badge variant="outline" className="text-[10px] ml-2">
                {classification.type.replace("_", " ")}
              </Badge>
            )}
          </div>
          <button onClick={onClose} className="p-1 hover:opacity-70">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-hidden">
          <div className={`flex h-full ${hasData ? "" : "justify-center"}`}>
            {/* Left: Image */}
            <div className={`flex-1 min-w-0 p-4 overflow-auto flex items-start justify-center ${hasData ? "border-r border-border" : ""}`}>
              <img
                src={url}
                alt="Uploaded document"
                className="max-h-[70vh] max-w-full w-auto rounded-lg border border-border object-contain"
              />
            </div>

            {/* Right: OCR output in monospace */}
            {hasData && (
              <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
                <div className="px-4 pt-3 pb-2 border-b border-border">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Extracted Data
                  </span>
                </div>
                <div className="flex-1 overflow-auto p-4 font-mono text-xs bg-muted/30">
                  {classification!.fields.length > 0 && (
                    <div className="space-y-1 mb-4">
                      <div className="text-muted-foreground mb-2">--- IDENTIFIERS ---</div>
                      {classification!.fields.map((f, i) => {
                        const padded = (f.label + ":").padEnd(18, " ")
                        return (
                          <div key={i} className="text-foreground whitespace-pre">
                            <span className="text-muted-foreground">{padded}</span>
                            <span className="font-medium">{f.value}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {specs.length > 0 && (
                    <div className="space-y-1 mb-4">
                      <div className="text-muted-foreground mb-2">--- SPECIFICATIONS ---</div>
                      {specs.map((s, i) => {
                        const padded = (s.label + ":").padEnd(30, " ")
                        return (
                          <div key={i} className="text-foreground whitespace-pre">
                            <span className="text-muted-foreground">{padded}</span>
                            <span className="font-medium">{s.value}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {classification!.tags.length > 0 && (
                    <div className="space-y-1 mb-4">
                      <div className="text-muted-foreground mb-1">--- TAGS ---</div>
                      <div className="text-foreground">{classification!.tags.join(", ")}</div>
                    </div>
                  )}

                  {classification!.extracted_text.length > 0 && (
                    <div className="space-y-0.5">
                      <div className="text-muted-foreground mb-1">--- RAW OCR ---</div>
                      {classification!.extracted_text.map((t, i) => (
                        <div key={i} className="text-foreground/80">{t}</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main ChatModal
// ---------------------------------------------------------------------------

export function ChatModal({ open, onClose, onEscalate }: ChatModalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [step, setStep] = useState<ChatStep>("welcome")
  const [expanded, setExpanded] = useState(false)
  const [caseId, setCaseId] = useState<string | null>(null)
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ file: File; kind: string; imageId?: string; previewUrl?: string }>>([])
  const [validationResult, setValidationResult] = useState<ValidateResponse | null>(null)
  const [lightbox, setLightbox] = useState<{ url: string; classification?: Classification } | null>(null)
  const [activeTab, setActiveTab] = useState<"chat" | "logs">("chat")
  const [logs, setLogs] = useState<LogEntry[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const logsRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function addLog(direction: "request" | "response", endpoint: string, data: unknown) {
    setLogs((prev) => [...prev, { timestamp: new Date().toISOString(), direction, endpoint, data }])
  }

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Initialize welcome message
  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([
        { from: "bot", text: "Hello! Welcome to SanDisk Support. How can I help you today?", timestamp: now() },
      ])
      setStep("issue-select")
    }
  }, [open])

  function addMsg(from: "bot" | "user", text: string) {
    setMessages((prev) => [...prev, { from, text, timestamp: now() }])
  }

  function addComponent(from: "bot" | "user", component: React.ReactNode) {
    setMessages((prev) => [...prev, { from, component, timestamp: now() }])
  }

  // ---------------------------------------------------------------------------
  // Step handlers
  // ---------------------------------------------------------------------------

  async function handleIssueSelect(issueType: "warranty" | "authentication" | "replacement_status" | "troubleshooting") {
    const labels: Record<string, string> = {
      warranty: "Warranty Verification",
      authentication: "Product Authentication",
      replacement_status: "Replacement Status",
      troubleshooting: "Troubleshooting",
    }
    addMsg("user", labels[issueType])

    try {
      addLog("request", "POST /api/cases", { issue_type: issueType })
      const { case_id } = await createCase(issueType)
      addLog("response", "POST /api/cases", { case_id })
      setCaseId(case_id)
      addMsg("bot", "I've opened a case for you. Please upload photos of your product. You can include:\n\n- **Product photo** (front/back)\n- **Label photo** (serial number, model)\n- **Packaging** (if available)\n- **Proof of purchase** (receipt/invoice, PDF accepted)\n\nUpload at least one product or label photo, then click **Run Verification**.")
      setStep("image-upload")
    } catch (err) {
      addLog("response", "POST /api/cases", { error: String(err) })
      addMsg("bot", "I'm sorry, there was an error creating your case. Please try again.")
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || !caseId) return

    const newFiles: Array<{ file: File; kind: string; imageId?: string; previewUrl?: string }> = []

    for (const file of Array.from(files)) {
      const kind = inferImageKind(file.name)
      const isImage = file.type.startsWith("image/")
      const previewUrl = isImage ? URL.createObjectURL(file) : undefined

      // Show image preview in chat (clickable to open lightbox)
      if (isImage && previewUrl) {
        const capturedUrl = previewUrl
        addComponent("user", (
          <ClickableImagePreview url={capturedUrl} filename={file.name} onClick={(url) => setLightbox({ url })} />
        ))
      } else {
        addMsg("user", `[Uploaded: ${file.name}]`)
      }

      // Show OCR processing indicator with file-specific steps
      const ocrMarker = `__ocr_processing_${Date.now()}`
      setMessages((prev) => [...prev, { from: "bot" as const, component: <OcrProcessingCard filename={file.name} />, timestamp: ocrMarker }])

      try {
        addLog("request", `POST /api/cases/${caseId}/images`, { kind, filename: file.name, mime_type: file.type, size: file.size })
        const result = await uploadImage(caseId, kind as "product" | "label" | "packaging" | "pop", file)
        addLog("response", `POST /api/cases/${caseId}/images`, result)
        newFiles.push({ file, kind, imageId: result.image_id, previewUrl })
        // Remove processing card and show classification
        setMessages((prev) => prev.filter((msg) => msg.timestamp !== ocrMarker))
        if (result.classification) {
          addComponent("bot", <ClassificationCard classification={result.classification} previewUrl={previewUrl} onImageClick={(url, cls) => setLightbox({ url, classification: cls })} />)
        } else {
          addMsg("bot", `Received ${file.name} (${kind}). You can upload more or click **Run Verification** when ready.`)
        }
      } catch (err) {
        addLog("response", `POST /api/cases/${caseId}/images`, { error: String(err) })
        setMessages((prev) => prev.filter((msg) => msg.timestamp !== ocrMarker))
        addMsg("bot", `Failed to upload ${file.name}. Please try again.`)
      }
    }

    setUploadedFiles((prev) => [...prev, ...newFiles])
    setStep("upload-preview")
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  function inferImageKind(filename: string): string {
    const lower = filename.toLowerCase()
    if (lower.includes("invoice") || lower.includes("receipt") || lower.includes("pop") || lower.endsWith(".pdf")) return "pop"
    if (lower.includes("label") || lower.includes("serial")) return "label"
    if (lower.includes("box") || lower.includes("pack")) return "packaging"
    return "product"
  }

  async function handleRunValidation() {
    if (!caseId) return

    setStep("validating")
    const spinnerIdx = messages.length
    addComponent("bot", <ValidatingSpinner />)

    try {
      addLog("request", `POST /api/cases/${caseId}/validate`, { case_id: caseId })
      const result = await validateCase(caseId)
      addLog("response", `POST /api/cases/${caseId}/validate`, result)
      setValidationResult(result)
      setMessages((prev) => {
        const without = prev.filter((_, i) => i !== spinnerIdx)
        return [...without, { from: "bot" as const, component: <ValidationResultCard summary={result.customer_summary} />, timestamp: now() }]
      })
      setStep("result")
    } catch (err) {
      addLog("response", `POST /api/cases/${caseId}/validate`, { error: String(err) })
      setMessages((prev) => prev.filter((_, i) => i !== spinnerIdx))
      addMsg("bot", "I'm sorry, the verification timed out or encountered an error. Please try again or contact us directly.")
      setStep("upload-preview")
    }
  }

  async function handleEscalate() {
    if (!caseId) return
    try {
      addLog("request", `POST /api/cases/${caseId}/escalate`, { case_id: caseId })
      const result = await escalateCase(caseId)
      addLog("response", `POST /api/cases/${caseId}/escalate`, result)
      addMsg("bot", "Your case has been escalated to a specialist for review. They will follow up with you shortly.")
      setStep("escalated")
      onEscalate()
    } catch (err) {
      addLog("response", `POST /api/cases/${caseId}/escalate`, { error: String(err) })
      addMsg("bot", "We couldn't escalate right now. Please try again.")
    }
  }

  function handleReset() {
    setMessages([])
    setStep("welcome")
    setCaseId(null)
    setUploadedFiles([])
    setValidationResult(null)
    setLogs([])
    setActiveTab("chat")
    setTimeout(() => {
      setMessages([{ from: "bot", text: "Hello! Welcome to SanDisk Support. How can I help you today?", timestamp: now() }])
      setStep("issue-select")
    }, 100)
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (!open) return null

  const modalClass = expanded
    ? "fixed inset-4 z-50 flex flex-col rounded-2xl shadow-2xl border border-border bg-background"
    : "fixed bottom-6 right-6 z-50 flex flex-col w-[480px] h-[700px] rounded-2xl shadow-2xl border border-border bg-background"

  return (
    <>
    {lightbox && (
      <ImageLightbox
        url={lightbox.url}
        classification={lightbox.classification}
        onClose={() => setLightbox(null)}
      />
    )}
    <div className={modalClass}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <img src="/sandisk-logo.svg" alt="SanDisk" className={expanded ? "h-7" : "h-5"} />
          <span className={`${expanded ? "text-lg" : "text-sm"} font-semibold`}>Support Chat</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setExpanded(!expanded)}>
            {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose}>
            <Minus className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="px-4 pt-2 pb-0 shrink-0 border-b border-border">
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab("chat")}
            className={`px-3 py-1.5 text-xs font-medium rounded-t-md border-b-2 transition-colors ${activeTab === "chat" ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            Chat
          </button>
          <button
            onClick={() => setActiveTab("logs")}
            className={`px-3 py-1.5 text-xs font-medium rounded-t-md border-b-2 transition-colors flex items-center gap-1.5 ${activeTab === "logs" ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            <ScrollText className="h-3 w-3" />
            Logs
            {logs.length > 0 && (
              <span className="bg-muted text-muted-foreground text-[9px] px-1.5 py-0.5 rounded-full">{logs.length}</span>
            )}
          </button>
        </div>
      </div>

      {/* Chat Messages */}
      <div ref={scrollRef} className={`flex-1 overflow-y-auto px-4 py-4 space-y-4 ${activeTab !== "chat" ? "hidden" : ""}`}>
        {messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} expanded={expanded} />
        ))}
      </div>

      {/* Logs Panel */}
      <div ref={logsRef} className={`flex-1 overflow-y-auto ${activeTab !== "logs" ? "hidden" : ""}`}>
        {logs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            No API calls recorded yet. Start a conversation to see logs.
          </div>
        ) : (
          <div className="p-3 space-y-2">
            {logs.map((entry, i) => (
              <div key={i} className="border border-border rounded-md overflow-hidden">
                <div className={`flex items-center gap-2 px-3 py-1.5 text-[10px] font-mono ${entry.direction === "request" ? "bg-muted/50" : "bg-muted/30"}`}>
                  <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${entry.direction === "request" ? "text-blue-600 border-blue-300" : "text-green-600 border-green-300"}`}>
                    {entry.direction === "request" ? "REQ" : "RES"}
                  </Badge>
                  <span className="text-muted-foreground">{entry.endpoint}</span>
                  <span className="ml-auto text-muted-foreground/60">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                </div>
                <pre className="px-3 py-2 text-[10px] font-mono text-foreground/80 overflow-x-auto bg-background max-h-[150px] overflow-y-auto">
                  {JSON.stringify(entry.data, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom action area (chat tab only) */}
      <div className={`px-4 py-3 border-t border-border shrink-0 space-y-2 ${activeTab !== "chat" ? "hidden" : ""}`}>
        {step === "issue-select" && (
          <div className="flex flex-wrap gap-2">
            <QuickChip label="Warranty Verification" onClick={() => handleIssueSelect("warranty")} />
            <QuickChip label="Product Authentication" onClick={() => handleIssueSelect("authentication")} />
            <QuickChip label="Replacement Status" onClick={() => handleIssueSelect("replacement_status")} />
            <QuickChip label="Troubleshooting" onClick={() => handleIssueSelect("troubleshooting")} />
          </div>
        )}

        {(step === "image-upload" || step === "upload-preview") && (
          <div className="space-y-2">
            {uploadedFiles.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {uploadedFiles.map((f, i) => (
                  <Badge key={i} variant="outline" className="text-[10px] flex items-center gap-1">
                    {f.file.type === "application/pdf" ? (
                      <FileText className="h-3 w-3" />
                    ) : f.previewUrl ? (
                      <div className="h-3 w-3 rounded-sm bg-secondary overflow-hidden">
                        <img src={f.previewUrl} alt="" className="h-full w-full object-cover" />
                      </div>
                    ) : (
                      <div className="h-3 w-3 rounded-sm bg-secondary" />
                    )}
                    {f.file.name.length > 20 ? f.file.name.slice(0, 18) + "..." : f.file.name}
                    <span className="text-muted-foreground capitalize">({f.kind})</span>
                  </Badge>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="h-3.5 w-3.5 mr-1.5" />
                Add Photo / PDF
              </Button>
              {uploadedFiles.length > 0 && (
                <RedChip label="Run Verification" onClick={handleRunValidation} />
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              multiple
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>
        )}

        {step === "validating" && (
          <div className="text-center text-xs text-muted-foreground py-2">
            <Loader2 className="h-4 w-4 animate-spin inline mr-1.5" />
            AI verification running...
          </div>
        )}

        {step === "result" && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={handleEscalate}>
              Speak to Agent
            </Button>
            <Button variant="outline" size="sm" onClick={handleReset}>
              New Case
            </Button>
          </div>
        )}

        {step === "escalated" && (
          <div className="text-center text-xs text-muted-foreground py-2">
            Case escalated to specialist. You can close this chat.
          </div>
        )}
      </div>
    </div>
    </>
  )
}
