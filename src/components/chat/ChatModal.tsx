import { useState, useEffect, useRef } from "react"
import { X, Minus, Paperclip, ArrowRight, Upload, Loader as Loader2, Maximize2, Minimize2, Headset, ShieldCheck, ShieldAlert, ShieldQuestionMark as ShieldQuestion, CircleCheck, TriangleAlert, Clock, ScanSearch, FileText, Package, Receipt, ChevronDown, ChevronUp } from "lucide-react"
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

function ClassificationCard({ classification }: { classification: Classification }) {
  const [detailsOpen, setDetailsOpen] = useState(false)
  const TypeIcon = classification.type === "invoice" || classification.type === "transcript"
    ? Receipt
    : Package

  return (
    <Card className="border border-border">
      <CardContent className="p-4 space-y-2.5">
        <div className="flex items-start gap-2">
          <TypeIcon className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
          <p className="text-sm text-foreground leading-relaxed">{classification.chat_message}</p>
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

        {(classification.fields.length > 0 || classification.extracted_text.length > 0) && (
          <button
            onClick={() => setDetailsOpen(!detailsOpen)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            {detailsOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {detailsOpen ? "Hide details" : "Show details"}
          </button>
        )}

        {detailsOpen && (
          <div className="space-y-2 pt-1">
            {classification.fields.length > 0 && (
              <div className="grid grid-cols-[100px_1fr] gap-y-1 text-sm">
                {classification.fields.map((f, i) => (
                  <div key={i} className="contents">
                    <span className="text-muted-foreground">{f.label}</span>
                    <span className="font-medium text-foreground">{f.value}</span>
                  </div>
                ))}
              </div>
            )}
            {classification.extracted_text.length > 0 && (
              <>
                <Separator />
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Extracted Text
                  </div>
                  <div className="text-xs text-muted-foreground space-y-0.5 font-mono">
                    {classification.extracted_text.map((t, i) => (
                      <div key={i}>{t}</div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// OCR Processing Spinner (shown during image upload)
// ---------------------------------------------------------------------------

const OCR_STEPS = [
  "Detecting image content...",
  "Running optical character recognition...",
  "Extracting product details...",
  "Matching against catalog...",
  "Finalizing classification...",
]

function OcrProcessingCard() {
  const [progress, setProgress] = useState(0)
  const [stepIdx, setStepIdx] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 95) return 95
        return p + Math.random() * 12 + 3
      })
      setStepIdx((s) => (s < OCR_STEPS.length - 1 ? s + 1 : s))
    }, 600)
    return () => clearInterval(interval)
  }, [])

  return (
    <Card className="border border-border">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <ScanSearch className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Processing image</span>
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
            <span className="text-sm text-foreground">{OCR_STEPS[stepIdx]}</span>
          </div>
          <Progress value={Math.min(progress, 95)} className="h-2" />
          <div className="text-xs text-muted-foreground">
            {Math.round(Math.min(progress, 95))}% complete
          </div>
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
// Main ChatModal
// ---------------------------------------------------------------------------

export function ChatModal({ open, onClose, onEscalate }: ChatModalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [step, setStep] = useState<ChatStep>("welcome")
  const [expanded, setExpanded] = useState(false)
  const [caseId, setCaseId] = useState<string | null>(null)
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ file: File; kind: string; imageId?: string; previewUrl?: string }>>([])
  const [validationResult, setValidationResult] = useState<ValidateResponse | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
      const { case_id } = await createCase(issueType)
      setCaseId(case_id)
      addMsg("bot", "I've opened a case for you. Please upload photos of your product. You can include:\n\n- **Product photo** (front/back)\n- **Label photo** (serial number, model)\n- **Packaging** (if available)\n- **Proof of purchase** (receipt/invoice, PDF accepted)\n\nUpload at least one product or label photo, then click **Run Verification**.")
      setStep("image-upload")
    } catch {
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

      // Show image preview in chat
      if (isImage && previewUrl) {
        addComponent("user", (
          <div className="space-y-1">
            <img src={previewUrl} alt={file.name} className="max-w-[200px] max-h-[160px] rounded-lg object-cover" />
            <div className="text-xs opacity-80">{file.name}</div>
          </div>
        ))
      } else {
        addMsg("user", `[Uploaded: ${file.name}]`)
      }

      // Show OCR processing indicator
      const ocrMarker = `__ocr_processing_${Date.now()}`
      setMessages((prev) => [...prev, { from: "bot" as const, component: <OcrProcessingCard />, timestamp: ocrMarker }])

      try {
        const result = await uploadImage(caseId, kind as "product" | "label" | "packaging" | "pop", file)
        newFiles.push({ file, kind, imageId: result.image_id, previewUrl })
        // Remove processing card and show classification
        setMessages((prev) => prev.filter((msg) => msg.timestamp !== ocrMarker))
        if (result.classification) {
          addComponent("bot", <ClassificationCard classification={result.classification} />)
        } else {
          addMsg("bot", `Received ${file.name} (${kind}). You can upload more or click **Run Verification** when ready.`)
        }
      } catch {
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
      const result = await validateCase(caseId)
      setValidationResult(result)
      setMessages((prev) => {
        const without = prev.filter((_, i) => i !== spinnerIdx)
        return [...without, { from: "bot" as const, component: <ValidationResultCard summary={result.customer_summary} />, timestamp: now() }]
      })
      setStep("result")
    } catch {
      setMessages((prev) => prev.filter((_, i) => i !== spinnerIdx))
      addMsg("bot", "I'm sorry, the verification timed out or encountered an error. Please try again or contact us directly.")
      setStep("upload-preview")
    }
  }

  async function handleEscalate() {
    if (!caseId) return
    try {
      await escalateCase(caseId)
      addMsg("bot", "Your case has been escalated to a specialist for review. They will follow up with you shortly.")
      setStep("escalated")
      onEscalate()
    } catch {
      addMsg("bot", "We couldn't escalate right now. Please try again.")
    }
  }

  function handleReset() {
    setMessages([])
    setStep("welcome")
    setCaseId(null)
    setUploadedFiles([])
    setValidationResult(null)
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
    : "fixed bottom-6 right-6 z-50 flex flex-col w-[400px] h-[600px] rounded-2xl shadow-2xl border border-border bg-background"

  return (
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

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} expanded={expanded} />
        ))}
      </div>

      {/* Bottom action area */}
      <div className="px-4 py-3 border-t border-border shrink-0 space-y-2">
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
  )
}
