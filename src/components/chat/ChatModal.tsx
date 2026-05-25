import { useState, useEffect, useRef } from "react"
import { X, Minus, Paperclip, Loader as Loader2, Maximize2, Minimize2, Headset, ShieldCheck, ShieldAlert, ShieldQuestionMark as ShieldQuestion, CircleCheck, TriangleAlert, Clock, ScanSearch, FileText, Package, Receipt, ChevronDown, ChevronUp, ScrollText, ZoomIn, ZoomOut, RotateCcw, WifiOff, RefreshCw, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import { MarkdownMessage } from "./MarkdownMessage"
import {
  createCase,
  uploadImage,
  uploadImagesBulk,
  validateCase,
  escalateCase,
  sendMessage,
  getHealth,
  humanizeVerdictReason,
  type UploadNextStep,
  type ValidateResponse,
  type CustomerSummary,
  type ValidationCheck,
  type Classification,
  type V2Verdict,
  type Gap,
  type AuthenticReference,
  type RMADetails,
} from "@/lib/api"
import { getDemoUploadResponse, getDemoBulkUploadResponse, getDemoValidateResponse, resetDemoState } from "@/lib/demo-cache"

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
  | "capture-details"
  | "issue-select"
  | "image-upload"
  | "upload-product"
  | "upload-back"
  | "upload-invoice"
  | "upload-preview"
  | "validating"
  | "result"
  | "troubleshoot"
  | "issue-resolved-ask"
  | "educate-replacement"
  | "check-invoice"
  | "warranty-decision"
  | "process-rma"
  | "warranty-void"
  | "escalated"
  | "closed"

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
          className={`${expanded ? "max-w-full" : "max-w-[85%]"} ${
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
          className={`${expanded ? "max-w-full w-full" : "max-w-[85%]"} ${
            isComponent
              ? "w-full"
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

function ValidationResultCard({ summary, onGapAction }: { summary: CustomerSummary; onGapAction?: (gap: Gap) => void }) {
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
          {(() => {
            const isAuthentic = summary.decision === "auto_approve" && summary.v2?.verdict_reasons?.includes("matched_authentic_reference")
            return summary.checks.map((check: ValidationCheck, i: number) => {
              const effectiveResult = isAuthentic ? "Passed" : check.result
              const detail = (isAuthentic && check.result !== "Passed") ? "Verified — no issues found" : check.detail
              const color =
                effectiveResult === "Passed" ? "text-green-600"
                : effectiveResult === "Failed" ? "text-red-500"
                : "text-amber-500"
              const CheckIcon =
                effectiveResult === "Passed" ? CircleCheck
                : effectiveResult === "Failed" ? TriangleAlert
                : Clock
              return (
                <div key={i} className="flex items-start gap-2">
                  <CheckIcon className={`h-4 w-4 shrink-0 mt-0.5 ${color}`} />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-foreground">{check.name}</span>
                    {detail && (
                      <p className="text-xs text-muted-foreground mt-0.5">{detail}</p>
                    )}
                  </div>
                </div>
              )
            })
          })()}
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

        {summary.v2 && <V2VerdictSection v2={summary.v2} onGapAction={onGapAction} />}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// v2 Verdict section (rendered inside ValidationResultCard)
// ---------------------------------------------------------------------------

function V2VerdictSection({ v2, onGapAction }: { v2: V2Verdict; onGapAction?: (gap: Gap) => void }) {
  return (
    <>
      {v2.reason && (
        <>
          <Separator />
          <div className="text-sm text-foreground font-medium">{v2.reason}</div>
        </>
      )}

      {v2.damage_observed && v2.damage_description && (
        <>
          <Separator />
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800">
              <TriangleAlert className="h-3.5 w-3.5" />
              Physical Damage Detected
            </div>
            <p className="text-xs text-amber-700">{v2.damage_description}</p>
          </div>
        </>
      )}

      {v2.gaps.length > 0 && (
        <>
          <Separator />
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            Additional Info Needed
          </div>
          <div className="space-y-1.5">
            {v2.gaps.map((gap: Gap, i: number) => (
              <button
                key={i}
                onClick={() => onGapAction?.(gap)}
                className="flex items-center gap-2 text-xs w-full text-left px-2.5 py-1.5 rounded-md border border-amber-200 bg-amber-50/50 hover:bg-amber-100 transition-colors cursor-pointer"
              >
                <Paperclip className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                <span className="text-amber-800 font-medium">{formatGapAction(gap.follow_up_action)}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {v2.verdict_reasons.length > 0 && (
        <>
          <Separator />
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            Verdict Reasons
          </div>
          <div className="space-y-1">
            {v2.verdict_reasons.map((code, i) => (
              <div key={i} className="text-xs text-muted-foreground">
                {humanizeVerdictReason(code)}
              </div>
            ))}
          </div>
        </>
      )}
    </>
  )
}

function formatGapAction(action: string): string {
  const mapped: Record<string, string> = {
    request_sharper_back_of_drive_photo: "Add a clearer photo of the back",
    request_proof_of_purchase: "Upload proof of purchase",
    request_serial_number_photo: "Upload a photo showing the serial number",
    request_packaging_photo: "Upload packaging photo",
    request_front_photo: "Upload a front photo of the product",
  }
  return mapped[action] ?? action.replace(/_/g, " ").replace(/^request /, "Upload: ")
}

// ---------------------------------------------------------------------------
// Invoice Extraction Card (rich layout for invoices)
// ---------------------------------------------------------------------------

function InvoiceExtractionCard({ classification, onImageClick, previewUrl }: { classification: Classification; onImageClick?: (url: string, classification: Classification) => void; previewUrl?: string }) {
  const [rawOpen, setRawOpen] = useState(false)
  const fields = classification.fields ?? []
  const specs = classification.specifications ?? []

  const invoiceNo = fields.find(f => f.label.toLowerCase().includes("invoice"))?.value
  const invoiceDate = fields.find(f => f.label.toLowerCase().includes("date"))?.value
  const seller = fields.find(f => f.label.toLowerCase().includes("sold") || f.label.toLowerCase().includes("seller"))?.value
  const gstin = fields.find(f => f.label.toLowerCase().includes("gstin"))?.value
  const buyer = fields.find(f => f.label.toLowerCase().includes("buyer") || f.label.toLowerCase().includes("bill"))?.value
  const total = fields.find(f => f.label.toLowerCase().includes("total"))?.value
  const channel = fields.find(f => f.label.toLowerCase().includes("channel"))?.value
  const product = fields.find(f => f.label.toLowerCase().includes("product") || f.label.toLowerCase().includes("description"))?.value
  const hsn = fields.find(f => f.label.toLowerCase().includes("hsn"))?.value

  const keyFields = [invoiceNo, invoiceDate, seller, gstin, buyer, total, channel, product, hsn]
  const otherFields = fields.filter(f => !keyFields.includes(f.value))

  return (
    <Card className="border border-border">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">Invoice Verified</span>
          </div>
          {channel && (
            <Badge variant="outline" className="text-[10px] py-0.5 px-2">
              {channel}
            </Badge>
          )}
        </div>

        <div className="text-sm text-muted-foreground"><MarkdownMessage content={classification.chat_message} /></div>

        <Separator />

        <div className="grid grid-cols-2 gap-3">
          {invoiceNo && (
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Invoice No.</div>
              <div className="text-xs font-medium text-foreground mt-0.5 font-mono">{invoiceNo}</div>
            </div>
          )}
          {invoiceDate && (
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Date</div>
              <div className="text-xs font-medium text-foreground mt-0.5">{invoiceDate}</div>
            </div>
          )}
          {total && (
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Total</div>
              <div className="text-xs font-semibold text-foreground mt-0.5">{total}</div>
            </div>
          )}
          {hsn && (
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">HSN Code</div>
              <div className="text-xs font-medium text-foreground mt-0.5 font-mono">{hsn}</div>
            </div>
          )}
        </div>

        {(seller || gstin) && (
          <>
            <Separator />
            <div className="space-y-1">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Seller</div>
              {seller && <div className="text-xs font-medium text-foreground">{seller}</div>}
              {gstin && <div className="text-[11px] text-muted-foreground font-mono">GSTIN: {gstin}</div>}
            </div>
          </>
        )}

        {buyer && (
          <>
            <Separator />
            <div className="space-y-1">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Buyer</div>
              <div className="text-xs font-medium text-foreground">{buyer}</div>
            </div>
          </>
        )}

        {product && (
          <>
            <Separator />
            <div className="space-y-1">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Product</div>
              <div className="text-xs font-medium text-foreground">{product}</div>
            </div>
          </>
        )}

        {otherFields.length > 0 && (
          <>
            <Separator />
            <div className="grid grid-cols-[100px_1fr] gap-y-1">
              {otherFields.map((f, i) => (
                <div key={i} className="contents">
                  <span className="text-[11px] text-muted-foreground">{f.label}</span>
                  <span className="text-[11px] font-medium text-foreground">{f.value}</span>
                </div>
              ))}
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
              {rawOpen ? "Hide raw OCR text" : "Show raw OCR text"}
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
// Classification card (shown after upload)
// ---------------------------------------------------------------------------

function ClassificationCard({ classification, previewUrl, onImageClick }: { classification: Classification; previewUrl?: string; onImageClick?: (url: string, classification: Classification) => void }) {
  const [specsExpanded, setSpecsExpanded] = useState(false)
  const [rawOpen, setRawOpen] = useState(false)
  const isInvoice = classification.type === "invoice" || classification.type === "transcript"
  const TypeIcon = isInvoice ? Receipt : Package
  const specs = classification.specifications ?? []
  const SPEC_PREVIEW_COUNT = 4

  // Use the dedicated invoice card for invoices with rich data
  if (isInvoice && classification.fields.length > 0) {
    return <InvoiceExtractionCard classification={classification} onImageClick={onImageClick} previewUrl={previewUrl} />
  }

  // Default layout for product/label/packaging images
  return (
    <Card className="border border-border">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-2">
          <TypeIcon className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
          <div className="text-sm text-foreground leading-relaxed"><MarkdownMessage content={classification.chat_message} /></div>
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
// Shipping Label Card (simulated RMA shipping details)
// ---------------------------------------------------------------------------

function ShippingLabelCard({ customerName, rmaNumber, productName }: { customerName: string; rmaNumber: string; productName: string }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <Card className="border border-border">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-foreground" />
          <span className="text-sm font-semibold text-foreground">Shipping Label - RMA #{rmaNumber}</span>
        </div>
        <Separator />

        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Ship To</div>
          <div className="bg-muted/50 rounded-lg p-3 border border-border font-mono text-xs leading-relaxed">
            <div className="font-semibold text-foreground">SanDisk / Western Digital RMA Center</div>
            <div className="text-foreground">Attn: Warranty Returns - {rmaNumber}</div>
            <div className="text-foreground">Plot No. B-37, MIDC Industrial Area</div>
            <div className="text-foreground">Mahape, Navi Mumbai 400 710</div>
            <div className="text-foreground">Maharashtra, India</div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">From</div>
          <div className="bg-muted/50 rounded-lg p-3 border border-border font-mono text-xs leading-relaxed">
            <div className="font-semibold text-foreground">{customerName}</div>
            <div className="text-muted-foreground">(Your registered address)</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-muted/50 rounded p-2 border border-border">
            <div className="text-muted-foreground">Product</div>
            <div className="font-medium text-foreground">{productName}</div>
          </div>
          <div className="bg-muted/50 rounded p-2 border border-border">
            <div className="text-muted-foreground">Turnaround</div>
            <div className="font-medium text-foreground">7 business days</div>
          </div>
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          Packaging instructions
        </button>

        {expanded && (
          <div className="space-y-2 text-xs text-foreground border-t border-border pt-2">
            <div className="flex items-start gap-2">
              <span className="font-semibold text-muted-foreground shrink-0">1.</span>
              <span>Use a <strong>padded envelope</strong> with bubble wrap or internal cushioning material.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-semibold text-muted-foreground shrink-0">2.</span>
              <span>Print your warranty confirmation email and insert it with the product.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-semibold text-muted-foreground shrink-0">3.</span>
              <span><strong>Do NOT send accessories</strong> (cables, cases, adapters, headphones).</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-semibold text-muted-foreground shrink-0">4.</span>
              <span>Seal the envelope securely with tape.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-semibold text-muted-foreground shrink-0">5.</span>
              <span>Attach the prepaid shipping label (sent to your email) to the outside.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-semibold text-muted-foreground shrink-0">6.</span>
              <span>Drop off at your nearest courier pickup point or schedule a collection.</span>
            </div>
            <div className="mt-2 p-2 bg-muted rounded border border-border text-muted-foreground">
              <strong>Important:</strong> Returns without the product or with altered shipping labels will not be processed. Request a tracking number and receipt from the carrier.
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// RMA Panel Card (renders backend-driven RMADetails)
// ---------------------------------------------------------------------------

function RMAPanelCard({ rma }: { rma: RMADetails }) {
  const [stepsExpanded, setStepsExpanded] = useState(false)
  const addr = rma.return_address

  return (
    <Card className="border border-green-200 bg-green-50/50">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-green-700" />
          <span className="text-sm font-semibold text-green-800">RMA #{rma.rma_number}</span>
          <Badge variant="outline" className="ml-auto text-[10px] border-green-300 text-green-700">Approved</Badge>
        </div>
        <Separator className="bg-green-200" />

        <div className="text-xs text-green-700 font-medium">
          Ship within {rma.rma_valid_days} days of approval
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-white rounded p-2 border border-green-200">
            <div className="text-muted-foreground">Product</div>
            <div className="font-medium text-foreground">{rma.product}</div>
          </div>
          <div className="bg-white rounded p-2 border border-green-200">
            <div className="text-muted-foreground">Replacement ships in</div>
            <div className="font-medium text-foreground">{rma.replacement_lead_time}</div>
          </div>
        </div>

        <div className="space-y-1">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Return Address</div>
          <div className="bg-white rounded-lg p-3 border border-green-200 font-mono text-xs leading-relaxed">
            <div className="font-semibold text-foreground">{addr.company}</div>
            <div className="text-foreground">Attn: {addr.attn}</div>
            <div className="text-foreground">{addr.street}</div>
            <div className="text-foreground">{addr.city}, {addr.state} {addr.zip}</div>
            <div className="text-foreground">{addr.country}</div>
          </div>
        </div>

        <button
          onClick={() => setStepsExpanded(!stepsExpanded)}
          className="flex items-center gap-1 text-xs font-medium text-green-700 hover:text-green-900 transition-colors"
        >
          {stepsExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          Packaging instructions ({rma.packaging_steps.length} steps)
        </button>

        {stepsExpanded && (
          <div className="space-y-2 text-xs text-foreground border-t border-green-200 pt-2">
            {rma.packaging_steps.map((s) => (
              <div key={s.step} className="flex items-start gap-2">
                <span className="shrink-0">{s.icon}</span>
                <div>
                  <div className="font-medium">{s.title}</div>
                  <div className="text-muted-foreground">{s.detail}</div>
                </div>
              </div>
            ))}
          </div>
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

const OCR_STEPS_POP = [
  { label: "Scanning document...", pct: 5 },
  { label: "Detecting document type...", pct: 10 },
  { label: "Analyzing document layout...", pct: 16 },
  { label: "Extracting seller information...", pct: 24 },
  { label: "Reading invoice number and date...", pct: 32 },
  { label: "Extracting line items...", pct: 40 },
  { label: "Parsing product descriptions...", pct: 48 },
  { label: "Reading HSN codes and quantities...", pct: 54 },
  { label: "Extracting tax breakdown (IGST/CGST)...", pct: 60 },
  { label: "Verifying seller GSTIN...", pct: 66 },
  { label: "Checking authorized vendor registry...", pct: 72 },
  { label: "Matching invoice product to uploaded photos...", pct: 78 },
  { label: "Validating purchase date against warranty window...", pct: 84 },
  { label: "Cross-referencing serial numbers...", pct: 90 },
  { label: "Running warranty eligibility check...", pct: 95 },
  { label: "Generating verdict...", pct: 98 },
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

function getOcrSteps(filename: string, kind?: string): Array<{ label: string; pct: number }> {
  if (kind === "pop") return OCR_STEPS_POP
  const lower = filename.toLowerCase()
  if (lower.endsWith(".pdf")) return OCR_STEPS_PDF
  if (lower.includes("invoice") || lower.includes("receipt") || lower.includes("memo") || lower.includes("warranty_letter")) return OCR_STEPS_INVOICE
  if (lower.includes("label") || lower.includes("back") || lower.includes("serial")) return OCR_STEPS_LABEL
  return OCR_STEPS_PRODUCT
}

function OcrProcessingCard({ filename, kind }: { filename: string; kind?: string }) {
  const steps = getOcrSteps(filename, kind)
  const [stepIdx, setStepIdx] = useState(0)
  const [progress, setProgress] = useState(0)
  const [completedSteps, setCompletedSteps] = useState<number[]>([])

  const delaysRef = useRef<number[]>([])
  if (delaysRef.current.length === 0) {
    const totalTarget = kind === "pop" ? 18000 + Math.random() * 30000 : 10000 + Math.random() * 26000
    const weights = steps.map(() => 0.3 + Math.random() * 2.5)
    const wSum = weights.reduce((a, b) => a + b, 0)
    delaysRef.current = weights.map((w) => (w / wSum) * totalTarget)
  }

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>
    function scheduleNext(current: number) {
      const delay = delaysRef.current[current] ?? 2000
      timeout = setTimeout(() => {
        if (current < steps.length - 1) {
          setCompletedSteps((prev) => [...prev, current])
          setStepIdx(current + 1)
          scheduleNext(current + 1)
        }
      }, delay)
    }
    scheduleNext(stepIdx)
    return () => clearTimeout(timeout)
  }, [])

  useEffect(() => {
    const target = steps[stepIdx]?.pct ?? 0
    const stepDelay = delaysRef.current[stepIdx] ?? 2000
    const diff = target - progress
    const tickInterval = diff > 0 ? Math.max(40, stepDelay / diff) : 80
    const tick = setInterval(() => {
      setProgress((p) => {
        if (p >= target) { clearInterval(tick); return target }
        return p + 1
      })
    }, tickInterval)
    return () => clearInterval(tick)
  }, [stepIdx, steps])

  return (
    <Card className="border border-border">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {kind === "pop" ? <Receipt className="h-4 w-4 text-muted-foreground" /> : <ScanSearch className="h-4 w-4 text-muted-foreground" />}
            <span className="text-sm font-semibold text-foreground">{kind === "pop" ? "Verifying Invoice" : "Processing"}: {filename.length > 30 ? filename.slice(0, 28) + "..." : filename}</span>
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

  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef({ x: 0, y: 0 })
  const panStart = useRef({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  function handleZoomIn() { setZoom((z) => Math.min(z + 0.5, 5)) }
  function handleZoomOut() { setZoom((z) => Math.max(z - 0.5, 0.5)) }
  function handleReset() { setZoom(1); setPan({ x: 0, y: 0 }) }

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.2 : 0.2
    setZoom((z) => Math.min(Math.max(z + delta, 0.5), 5))
  }

  function handlePointerDown(e: React.PointerEvent) {
    if (zoom <= 1) return
    setDragging(true)
    dragStart.current = { x: e.clientX, y: e.clientY }
    panStart.current = { ...pan }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragging) return
    setPan({
      x: panStart.current.x + (e.clientX - dragStart.current.x),
      y: panStart.current.y + (e.clientY - dragStart.current.y),
    })
  }

  function handlePointerUp() { setDragging(false) }

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
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleZoomOut} title="Zoom out">
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs font-mono text-muted-foreground w-10 text-center">{Math.round(zoom * 100)}%</span>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleZoomIn} title="Zoom in">
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleReset} title="Reset zoom">
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
            <div className="w-px h-4 bg-border mx-1" />
            <button onClick={onClose} className="p-1 hover:opacity-70">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          <div className={`flex h-full ${hasData ? "" : "justify-center"}`}>
            {/* Left: Zoomable Image */}
            <div
              ref={containerRef}
              className={`flex-1 min-w-0 overflow-hidden flex items-center justify-center relative ${hasData ? "border-r border-border" : ""} ${zoom > 1 ? "cursor-grab" : ""} ${dragging ? "cursor-grabbing" : ""}`}
              onWheel={handleWheel}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
            >
              <img
                src={url}
                alt="Uploaded document"
                draggable={false}
                className="max-h-[70vh] max-w-full w-auto rounded-lg border border-border object-contain select-none transition-transform duration-100"
                style={{
                  transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                }}
              />
              {zoom > 1 && (
                <div className="absolute bottom-3 left-3 bg-background/80 backdrop-blur-sm rounded-md px-2 py-1 text-[10px] text-muted-foreground border border-border">
                  Scroll to zoom. Drag to pan.
                </div>
              )}
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
// Authentic Reference Badge
// ---------------------------------------------------------------------------

function AuthenticBadge({ reference }: { reference: AuthenticReference }) {
  return (
    <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 flex items-center gap-3">
      <ShieldCheck className="h-5 w-5 text-green-600 shrink-0" />
      <div>
        <div className="text-sm font-semibold text-green-800">Verified Authentic</div>
        <div className="text-xs text-green-700">{reference.product} ({reference.sku})</div>
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
  const [connectionStatus, setConnectionStatus] = useState<"online" | "offline" | "error">("online")
  const [lastError, setLastError] = useState<string | null>(null)
  const [textInput, setTextInput] = useState("")
  const [customerName, setCustomerName] = useState("")
  const [customerEmail, setCustomerEmail] = useState("")
  const [customerContact, setCustomerContact] = useState("")
  const [detailsStep, setDetailsStep] = useState<"name" | "email" | "contact" | "done">("name")
  const scrollRef = useRef<HTMLDivElement>(null)
  const logsRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function addLog(direction: "request" | "response", endpoint: string, data: unknown) {
    setLogs((prev) => [...prev, { timestamp: new Date().toISOString(), direction, endpoint, data }])
  }

  const userScrolledRef = useRef(false)

  function handleChatScroll() {
    if (!scrollRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    userScrolledRef.current = scrollHeight - scrollTop - clientHeight > 60
  }

  function scrollToBottom() {
    if (scrollRef.current) {
      userScrolledRef.current = false
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }

  useEffect(() => {
    if (scrollRef.current && !userScrolledRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Connection monitoring
  useEffect(() => {
    if (!open) return
    let mounted = true
    function checkHealth() {
      getHealth()
        .then(() => { if (mounted) { setConnectionStatus("online"); setLastError(null) } })
        .catch((err) => {
          if (!mounted) return
          if (err instanceof TypeError || err.name === "AbortError") {
            setConnectionStatus("offline")
          } else {
            setConnectionStatus("error")
            setLastError(String(err.message || err))
          }
        })
    }
    checkHealth()
    const interval = setInterval(checkHealth, 30000)
    return () => { mounted = false; clearInterval(interval) }
  }, [open])

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
      const result = await createCase(issueType, { customerId: customerEmail || undefined })
      const case_id = result.case_id
      addLog("response", "POST /api/cases", result)
      setCaseId(case_id)
      resetDemoState()
      addMsg("bot", "I've opened a case for you. Let's start by verifying your product.\n\nPlease upload a **photo of your product** (front or back showing the label/serial number).")
      setStep("upload-product")
    } catch (err) {
      addLog("response", "POST /api/cases", { error: String(err) })
      addMsg("bot", "I'm sorry, there was an error creating your case. Please try again.")
    }
  }

  function applyNextStep(nextStep: UploadNextStep | undefined, _unused: string | undefined, allFiles: Array<{ file: File; kind: string; imageId?: string; previewUrl?: string }>, validationResult?: ValidateResponse) {
    switch (nextStep) {
      case "upload_other_side":
        setStep("upload-back")
        break
      case "upload_invoice":
        setStep("upload-invoice")
        break
      case "validate":
        handleRunValidation(allFiles)
        break
      case "complete":
        if (validationResult) {
          setValidationResult(validationResult)
          const decision = validationResult.decision
          if (decision === "auto_approve") {
            addComponent("bot", <ValidationResultCard summary={validationResult.customer_summary} onGapAction={handleGapAction} />)
            const v2 = validationResult.customer_summary.v2
            if (v2?.authentic_reference?.matched) {
              addComponent("bot", <AuthenticBadge reference={v2.authentic_reference} />)
            }
            if (validationResult.rma) {
              addComponent("bot", <RMAPanelCard rma={validationResult.rma} />)
              setStep("process-rma")
            } else {
              setStep("issue-resolved-ask")
            }
          } else if (decision === "auto_reject") {
            addComponent("bot", <ValidationResultCard summary={validationResult.customer_summary} onGapAction={handleGapAction} />)
            setStep("warranty-void")
          } else {
            addComponent("bot", <ValidationResultCard summary={validationResult.customer_summary} onGapAction={handleGapAction} />)
            setStep("escalated")
          }
        } else {
          setStep("upload-preview")
        }
        break
      default:
        setStep("upload-preview")
        break
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || !caseId) return

    const fileList = Array.from(files)
    const kind = (step === "upload-invoice" || step === "check-invoice") ? "pop" : "product"
    const newFiles: Array<{ file: File; kind: string; imageId?: string; previewUrl?: string }> = []

    // Show previews for all files
    for (const file of fileList) {
      const isImage = file.type.startsWith("image/")
      const previewUrl = isImage ? URL.createObjectURL(file) : undefined
      if (isImage && previewUrl) {
        addComponent("user", (
          <ClickableImagePreview url={previewUrl} filename={file.name} onClick={(url) => setLightbox({ url })} />
        ))
      } else {
        addMsg("user", `[Uploaded: ${file.name}]`)
      }
    }
    setTimeout(scrollToBottom, 50)

    // Bulk upload path: multiple product files
    if (fileList.length > 1 && kind === "product") {
      const ocrMarker = `__ocr_processing_${Date.now()}`
      setMessages((prev) => [...prev, { from: "bot" as const, component: <OcrProcessingCard filename={`${fileList.length} files`} kind={kind} />, timestamp: ocrMarker }])
      setTimeout(scrollToBottom, 50)

      // Check demo bulk cache
      const demoBulk = getDemoBulkUploadResponse(fileList.map((f) => f.name), kind)
      if (demoBulk) {
        addLog("request", `POST /api/cases/${caseId}/images/bulk`, { kind, files: fileList.map((f) => f.name), demo: true })
        await new Promise((r) => setTimeout(r, 800))
        addLog("response", `POST /api/cases/${caseId}/images/bulk`, demoBulk)
        setMessages((prev) => prev.filter((msg) => msg.timestamp !== ocrMarker))
        for (let i = 0; i < demoBulk.uploads.length; i++) {
          const upload = demoBulk.uploads[i]
          const file = fileList[i]
          const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined
          newFiles.push({ file, kind, imageId: upload.image_id, previewUrl })
          if (upload.classification) {
            addMsg("bot", upload.classification.chat_message)
            addComponent("bot", <ClassificationCard classification={upload.classification} previewUrl={previewUrl} onImageClick={(url, cls) => setLightbox({ url, classification: cls })} />)
          }
        }
        const allFiles = [...uploadedFiles, ...newFiles]
        setUploadedFiles(allFiles)
        applyNextStep(demoBulk.next_step, undefined, allFiles)
        if (fileInputRef.current) fileInputRef.current.value = ""
        return
      }

      // Real bulk upload
      try {
        addLog("request", `POST /api/cases/${caseId}/images/bulk`, { kind, files: fileList.map((f) => f.name) })
        const minDelay = new Promise((r) => setTimeout(r, 10000 + Math.random() * 26000))
        const [result] = await Promise.all([uploadImagesBulk(caseId, kind, fileList), minDelay])
        addLog("response", `POST /api/cases/${caseId}/images/bulk`, result)
        setMessages((prev) => prev.filter((msg) => msg.timestamp !== ocrMarker))
        for (let i = 0; i < result.uploads.length; i++) {
          const upload = result.uploads[i]
          const file = fileList[i]
          const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined
          newFiles.push({ file, kind, imageId: upload.image_id, previewUrl })
          if (upload.classification?.chat_message) {
            addMsg("bot", upload.classification.chat_message)
            addComponent("bot", <ClassificationCard classification={upload.classification} previewUrl={previewUrl} onImageClick={(url, cls) => setLightbox({ url, classification: cls })} />)
          }
        }
        const allFiles = [...uploadedFiles, ...newFiles]
        setUploadedFiles(allFiles)
        applyNextStep(result.next_step, undefined, allFiles)
      } catch (err) {
        addLog("response", `POST /api/cases/${caseId}/images/bulk`, { error: String(err) })
        setMessages((prev) => prev.filter((msg) => msg.timestamp !== ocrMarker))
        addMsg("bot", "Failed to upload files. Please try again.")
        setStep("upload-product")
      }
      if (fileInputRef.current) fileInputRef.current.value = ""
      return
    }

    // Single file upload path
    for (const file of fileList) {
      const fileKind = (step === "upload-invoice" || step === "check-invoice") ? "pop" : inferImageKind(file.name)
      const isImage = file.type.startsWith("image/")
      const previewUrl = isImage ? URL.createObjectURL(file) : undefined

      // Check demo cache
      const demoResult = getDemoUploadResponse(file.name, fileKind)
      if (demoResult) {
        const ocrMarker = `__ocr_processing_${Date.now()}`
        setMessages((prev) => [...prev, { from: "bot" as const, component: <OcrProcessingCard filename={file.name} kind={fileKind} />, timestamp: ocrMarker }])
        setTimeout(scrollToBottom, 50)
        addLog("request", `POST /api/cases/${caseId}/images`, { kind: fileKind, filename: file.name, demo: true })
        await new Promise((r) => setTimeout(r, fileKind === "pop" ? 18000 + Math.random() * 12000 : 800))
        addLog("response", `POST /api/cases/${caseId}/images`, demoResult)
        newFiles.push({ file, kind: fileKind, imageId: demoResult.image_id, previewUrl })
        setMessages((prev) => prev.filter((msg) => msg.timestamp !== ocrMarker))
        if (demoResult.classification) {
          addMsg("bot", demoResult.classification.chat_message)
          addComponent("bot", <ClassificationCard classification={demoResult.classification} previewUrl={previewUrl} onImageClick={(url, cls) => setLightbox({ url, classification: cls })} />)
        }
        setTimeout(scrollToBottom, 100)
        const allFiles = [...uploadedFiles, ...newFiles]
        setUploadedFiles(allFiles)
        if (step === "check-invoice" && demoResult.next_step !== "complete") {
          addMsg("bot", "Thank you for the invoice. Let me check your warranty eligibility...")
          handleWarrantyCheck()
        } else {
          applyNextStep(demoResult.next_step, undefined, allFiles, demoResult.validation_result)
        }
        setTimeout(scrollToBottom, 150)
        if (fileInputRef.current) fileInputRef.current.value = ""
        return
      }

      // Real single upload
      const ocrMarker = `__ocr_processing_${Date.now()}`
      setMessages((prev) => [...prev, { from: "bot" as const, component: <OcrProcessingCard filename={file.name} kind={fileKind} />, timestamp: ocrMarker }])
      setTimeout(scrollToBottom, 50)

      try {
        addLog("request", `POST /api/cases/${caseId}/images`, { kind: fileKind, filename: file.name, mime_type: file.type, size: file.size })
        const minDelay = new Promise((r) => setTimeout(r, fileKind === "pop" ? 18000 + Math.random() * 30000 : 10000 + Math.random() * 26000))
        const [result] = await Promise.all([uploadImage(caseId, fileKind as "product" | "label" | "packaging" | "pop", file), minDelay])
        addLog("response", `POST /api/cases/${caseId}/images`, result)
        newFiles.push({ file, kind: fileKind, imageId: result.image_id, previewUrl })
        setMessages((prev) => prev.filter((msg) => msg.timestamp !== ocrMarker))
        if (result.classification) {
          addMsg("bot", result.classification.chat_message)
          addComponent("bot", <ClassificationCard classification={result.classification} previewUrl={previewUrl} onImageClick={(url, cls) => setLightbox({ url, classification: cls })} />)
        } else {
          addMsg("bot", `Received ${file.name} (${fileKind}).`)
        }
        setTimeout(scrollToBottom, 100)
        const allFiles = [...uploadedFiles, ...newFiles]
        setUploadedFiles(allFiles)
        if (step === "check-invoice" && result.next_step !== "complete") {
          addMsg("bot", "Thank you for the invoice. Let me check your warranty eligibility...")
          handleWarrantyCheck()
        } else if (result.next_step) {
          applyNextStep(result.next_step, undefined, allFiles, result.validation_result)
        } else {
          // Fallback for older backends without next_step
          if (step === "upload-product" || step === "upload-back") {
            addMsg("bot", "Thanks! Now please upload your **invoice or proof of purchase**.")
            setStep("upload-invoice")
          } else if (step === "upload-invoice") {
            handleRunValidation(allFiles)
          } else {
            setStep("upload-preview")
          }
        }
      } catch (err) {
        addLog("response", `POST /api/cases/${caseId}/images`, { error: String(err) })
        setMessages((prev) => prev.filter((msg) => msg.timestamp !== ocrMarker))
        addMsg("bot", `Failed to upload ${file.name}. Please try again.`)
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  function inferImageKind(filename: string): string {
    const lower = filename.toLowerCase()
    if (lower.includes("invoice") || lower.includes("receipt") || lower.includes("pop") || lower.endsWith(".pdf")) return "pop"
    if (lower.includes("label") || lower.includes("serial")) return "label"
    if (lower.includes("box") || lower.includes("pack")) return "packaging"
    return "product"
  }

  async function handleRunValidation(filesOverride?: Array<{ file: File; kind: string }>) {
    if (!caseId) return

    setStep("validating")
    const spinnerIdx = messages.length
    addComponent("bot", <ValidatingSpinner />)

    // Check for demo cache hit
    const demoValidation = getDemoValidateResponse(caseId, filesOverride || uploadedFiles)
    if (demoValidation) {
      addLog("request", `POST /api/cases/${caseId}/validate`, { case_id: caseId, demo: true })
      await new Promise((r) => setTimeout(r, 600))
      addLog("response", `POST /api/cases/${caseId}/validate`, demoValidation)
      const result = demoValidation
      setValidationResult(result)
      setMessages((prev) => {
        const without = prev.filter((_, i) => i !== spinnerIdx)
        return [...without, { from: "bot" as const, component: <ValidationResultCard summary={result.customer_summary} onGapAction={handleGapAction} />, timestamp: now() }]
      })
      const v2 = result.customer_summary.v2
      if (v2?.authentic_reference?.matched) {
        addComponent("bot", <AuthenticBadge reference={v2.authentic_reference} />)
        if (v2.pop_validation?.vendor_authorized && v2.pop_validation?.product_match) {
          addMsg("bot", "Your product is verified authentic and your invoice is confirmed. You're eligible for a warranty replacement.\n\nWould you like to proceed with a return?")
          setStep("issue-resolved-ask")
        } else {
          addMsg("bot", "Your product is verified authentic. Let's move on to troubleshooting.\n\nCan you describe the issue you're experiencing?")
          setStep("troubleshoot")
        }
      } else {
        addMsg("bot", "Your product passed authentication. Can you describe what's happening with your product?")
        setStep("troubleshoot")
      }
      return
    }

    try {
      addLog("request", `POST /api/cases/${caseId}/validate`, { case_id: caseId })
      const result = await validateCase(caseId)
      addLog("response", `POST /api/cases/${caseId}/validate`, result)
      setValidationResult(result)
      setMessages((prev) => {
        const without = prev.filter((_, i) => i !== spinnerIdx)
        return [...without, { from: "bot" as const, component: <ValidationResultCard summary={result.customer_summary} onGapAction={handleGapAction} />, timestamp: now() }]
      })

      // Follow the call-flow: after "Verify Product Authenticity"
      const v2 = result.customer_summary.v2
      const isAuthentic = result.customer_summary.decision === "auto_approve"
      const isCounterfeit = result.customer_summary.decision === "auto_reject"

      if (v2?.authentic_reference?.matched) {
        // Fast path: verified authentic
        addComponent("bot", <AuthenticBadge reference={v2.authentic_reference} />)
        addMsg("bot", "Your product is verified authentic. Let's move on to troubleshooting.\n\nCan you describe the issue you're experiencing?")
        setStep("troubleshoot")
      } else if (isAuthentic) {
        addMsg("bot", "Your product passed authentication. Let's troubleshoot your issue.\n\nCan you describe what's happening with your product?")
        setStep("troubleshoot")
      } else if (isCounterfeit) {
        addMsg("bot", "Based on our analysis, this product did not pass our authenticity checks. Unfortunately, we cannot process a warranty claim for this item.\n\nWould you like to speak to an agent for further assistance?")
        setStep("warranty-void")
      } else {
        // human_review — show result and offer next steps
        setStep("result")
      }
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

  function handleGapAction(gap: Gap) {
    addMsg("bot", `Please upload: **${formatGapAction(gap.follow_up_action)}**`)
    setStep("upload-preview")
    setTimeout(() => fileInputRef.current?.click(), 100)
  }

  function handleTextSend() {
    const text = textInput.trim()
    if (!text) return
    addMsg("user", text)
    setTextInput("")

    if (step === "capture-details") {
      handleDetailsCapture(text)
    } else if (step === "issue-select") {
      const lower = text.toLowerCase()
      if (lower.includes("warrant")) handleIssueSelect("warranty")
      else if (lower.includes("authent") || lower.includes("fake") || lower.includes("genuine")) handleIssueSelect("authentication")
      else if (lower.includes("return") || lower.includes("rma") || lower.includes("refund") || lower.includes("exchange")) handleIssueSelect("warranty")
      else if (lower.includes("replac") || lower.includes("status")) handleIssueSelect("replacement_status")
      else if (lower.includes("troubleshoot") || lower.includes("not working") || lower.includes("issue") || lower.includes("broken")) handleIssueSelect("troubleshooting")
      else {
        handleCreateCaseWithMessage(text)
      }
    } else if (step === "issue-resolved-ask") {
      const lower = text.toLowerCase()
      if (lower.includes("yes") || lower.includes("resolved") || lower.includes("fixed") || lower.includes("work")) {
        handleIssueResolved()
      } else {
        handleIssueNotResolved()
      }
    } else if (step === "troubleshoot") {
      if (caseId) sendMessage(caseId, text, "customer").catch(() => {})
    } else if (caseId) {
      sendMessage(caseId, text, "customer").catch(() => {})
    }
  }

  function handleDetailsCapture(text: string) {
    if (detailsStep === "name") {
      setCustomerName(text)
      setDetailsStep("email")
      addMsg("bot", `Thanks, **${text}**! What's your email address so we can send shipping details?`)
    } else if (detailsStep === "email") {
      setCustomerEmail(text)
      setDetailsStep("contact")
      addMsg("bot", "And a contact number? (or type 'skip')")
    } else if (detailsStep === "contact") {
      if (text.toLowerCase() !== "skip") setCustomerContact(text)
      setDetailsStep("done")
      const warrantyText = validationResult?.customer_summary?.warranty
      const v2 = validationResult?.customer_summary?.v2
      const productName = v2?.product_family || "SanDisk Product"
      const rmaNumber = `RMA-${Date.now().toString(36).toUpperCase().slice(-6)}-IN`
      addMsg("bot", `Perfect. I'm initiating the RMA process now.\n\n${warrantyText ? `**Coverage:** ${warrantyText}\n\n` : ""}Your replacement request **${rmaNumber}** has been created. A prepaid shipping label has been sent to **${customerEmail || text}**.`)
      addComponent("bot", <ShippingLabelCard customerName={customerName || "Customer"} rmaNumber={rmaNumber} productName={productName} />)
      addMsg("bot", "Once we receive and verify your product, a replacement will be shipped within **7 business days**.\n\nIs there anything else I can help with?")
      setStep("process-rma")
    }
  }

  async function handleCreateCaseWithMessage(text: string) {
    try {
      addLog("request", "POST /api/cases", { customer_message: text })
      const result = await createCase(undefined, { customerMessage: text, customerId: customerEmail || undefined })
      addLog("response", "POST /api/cases", result)
      setCaseId(result.case_id)
      const intent = result.classified_intent || result.issue_type || "general"
      const friendlyIntents: Record<string, string> = {
        warranty: "Got it, I can help with your warranty claim.",
        replacement: "Got it, I can help with your return.",
        return: "Got it, I can help with your return.",
        rma: "Got it, I can help with your return.",
        authentication: "Got it, I can help verify your product.",
        troubleshooting: "Got it, let me help you troubleshoot.",
        general: "Got it, let me help you with that.",
      }
      const greeting = friendlyIntents[intent] || `Got it, I can help with your **${intent.replace(/_/g, " ")}** issue.`
      addMsg("bot", `${greeting}\n\nLet's start by verifying your product. Please upload a **photo of your product** (front or back showing the label/serial number).`)
      setStep("upload-product")
    } catch (err) {
      addLog("response", "POST /api/cases", { error: String(err) })
      addMsg("bot", "Sorry, there was an error creating your case. Please try again.")
    }
  }

  function handleIssueResolved() {
    addMsg("bot", "That's great to hear! Here are some helpful tips to keep your SanDisk product in top shape:\n\n- Always safely eject before removing\n- Avoid extreme temperatures\n- Keep away from moisture and magnets\n\nIs there anything else I can help you with?")
    setStep("closed")
  }

  function handleIssueNotResolved() {
    const hasPop = uploadedFiles.some(f => f.kind === "pop")
    if (hasPop) {
      addMsg("bot", "I understand the issue isn't resolved. Based on your product verification, let me check your warranty eligibility.\n\nReviewing your invoice and warranty details...")
      handleWarrantyCheck()
    } else {
      addMsg("bot", "I understand the issue isn't resolved. To proceed with a replacement, I'll need to verify your warranty eligibility.\n\nPlease upload your **proof of purchase** (receipt or invoice) so I can check coverage.")
      setStep("check-invoice")
    }
  }

  function handleWarrantyCheck() {
    const summary = validationResult?.customer_summary
    const v2 = summary?.v2
    const popValid = v2?.pop_validation
    const warrantyText = summary?.warranty

    if (summary?.decision === "auto_approve" || (popValid?.product_match && popValid?.date_plausible)) {
      addMsg("bot", `Your product is eligible for warranty replacement.${warrantyText ? `\n\n**Coverage:** ${warrantyText}` : ""}\n\nTo process your return, I'll need a few details. What is your **name**?`)
      setStep("capture-details")
      setDetailsStep("name")
    } else if (summary?.decision === "auto_reject") {
      addMsg("bot", "Unfortunately, based on our verification, this product is **not eligible** for warranty coverage.\n\nReasons:\n" + (v2?.verdict_reasons.map(r => `- ${humanizeVerdictReason(r)}`).join("\n") || "- Verification checks did not pass") + "\n\nYou may purchase a replacement from an authorized SanDisk retailer. Would you like to speak to an agent for further assistance?")
      setStep("warranty-void")
    } else {
      addMsg("bot", "Your case requires further review to determine warranty eligibility. I'm escalating this to a specialist who will review your documentation and get back to you.\n\nIs there anything else I can help with?")
      handleEscalate()
    }
  }

  function getResultPrimaryLabel(): string {
    const action = validationResult?.customer_summary?.v2?.recommended_next_action
    if (!action) return "Speak to Agent"
    const labels: Record<string, string> = {
      proceed_with_rma: "Approve RMA",
      request_proof_of_purchase: "Upload Invoice",
      upload_correct_invoice: "Upload Correct Invoice",
      escalate_to_damage_policy_review: "Escalate to Damage Review",
      reject_rma_counterfeit: "Reject \u2014 Confirmed Counterfeit",
      escalate_for_review: "Flag for Agent Review",
      reject_rma: "Reject RMA",
      request_product_photos: "Request Product Photos",
      escalate_to_fraud_review: "Speak to Fraud Specialist",
      escalate_to_agent: "Speak to Agent",
      request_more_info: "Upload More Info",
      auto_close: "Done",
    }
    return labels[action] ?? "Speak to Agent"
  }

  function handleReset() {
    setMessages([])
    setStep("welcome")
    setCaseId(null)
    setUploadedFiles([])
    setValidationResult(null)
    setLogs([])
    setActiveTab("chat")
    setCustomerName("")
    setCustomerEmail("")
    setCustomerContact("")
    setDetailsStep("name")
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
    ? "fixed bottom-6 right-6 w-[55vw] h-[92vh] z-50 flex flex-col rounded-2xl shadow-2xl border border-border bg-background"
    : "fixed bottom-6 right-6 z-50 flex flex-col w-[480px] h-[85vh] max-h-[860px] rounded-2xl shadow-2xl border border-border bg-background"

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

      {/* Connection status banner */}
      {connectionStatus !== "online" && (
        <div className={`px-4 py-2 flex items-center gap-2 text-xs shrink-0 ${connectionStatus === "offline" ? "bg-gray-100 text-gray-700" : "bg-red-50 text-red-700"}`}>
          {connectionStatus === "offline" ? (
            <>
              <WifiOff className="h-3.5 w-3.5" />
              <span className="flex-1">Backend unreachable. Check your connection.</span>
              <button onClick={() => getHealth().then(() => { setConnectionStatus("online"); setLastError(null) }).catch(() => {})} className="flex items-center gap-1 px-2 py-0.5 rounded border border-current hover:bg-gray-200 transition-colors cursor-pointer">
                <RefreshCw className="h-3 w-3" /> Retry
              </button>
            </>
          ) : (
            <>
              <TriangleAlert className="h-3.5 w-3.5" />
              <span className="flex-1">{lastError || "Server error. You can retry your last action."}</span>
              <button onClick={() => getHealth().then(() => { setConnectionStatus("online"); setLastError(null) }).catch(() => {})} className="flex items-center gap-1 px-2 py-0.5 rounded border border-current hover:bg-red-100 transition-colors cursor-pointer">
                <RefreshCw className="h-3 w-3" /> Retry
              </button>
            </>
          )}
        </div>
      )}

      {/* Chat Messages */}
      <div ref={scrollRef} onScroll={handleChatScroll} className={`flex-1 overflow-y-auto px-4 py-4 space-y-4 ${activeTab !== "chat" ? "hidden" : ""}`}>
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
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <QuickChip label="Warranty Verification" onClick={() => handleIssueSelect("warranty")} />
              <QuickChip label="Product Authentication" onClick={() => handleIssueSelect("authentication")} />
              <QuickChip label="Replacement Status" onClick={() => handleIssueSelect("replacement_status")} />
              <QuickChip label="Troubleshooting" onClick={() => handleIssueSelect("troubleshooting")} />
            </div>
          </div>
        )}

        {(step === "upload-product" || step === "upload-back") && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="h-3.5 w-3.5 mr-1.5" />
                {step === "upload-back" ? "Upload back of device" : "Upload Product Photo"}
              </Button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png"
              multiple
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>
        )}

        {step === "upload-invoice" && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="h-3.5 w-3.5 mr-1.5" />
                Upload invoice / proof of purchase
              </Button>
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
              {getResultPrimaryLabel()}
            </Button>
            <Button variant="outline" size="sm" onClick={handleReset}>
              New Case
            </Button>
          </div>
        )}

        {step === "troubleshoot" && (
          <div className="flex flex-wrap gap-2">
            <QuickChip label="Issue is resolved" onClick={handleIssueResolved} />
            <QuickChip label="Still not working" onClick={handleIssueNotResolved} />
          </div>
        )}

        {step === "issue-resolved-ask" && (
          <div className="flex flex-wrap gap-2">
            <QuickChip label="Yes, resolved" onClick={handleIssueResolved} />
            <QuickChip label="No, need replacement" onClick={handleIssueNotResolved} />
          </div>
        )}

        {step === "check-invoice" && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip className="h-3.5 w-3.5 mr-1.5" />
              Upload invoice / proof of purchase
            </Button>
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

        {step === "warranty-void" && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={handleEscalate}>
              Speak to Agent
            </Button>
            <Button variant="outline" size="sm" onClick={handleReset}>
              New Case
            </Button>
          </div>
        )}

        {step === "process-rma" && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={handleReset}>
              Done
            </Button>
          </div>
        )}

        {(step === "escalated" || step === "closed") && (
          <div className="flex gap-2 items-center">
            <span className="text-xs text-muted-foreground flex-1">
              {step === "escalated" ? "Case escalated to specialist." : "Session complete."}
            </span>
            <Button variant="outline" size="sm" onClick={handleReset}>
              New Case
            </Button>
          </div>
        )}

        {step !== "validating" && step !== "escalated" && step !== "closed" && step !== "process-rma" && (
          <div className="flex items-center gap-2 pt-1">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleTextSend() }}
              placeholder="Type a message..."
              className="flex-1 min-w-0 rounded-md border border-border bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <button
              onClick={handleTextSend}
              disabled={!textInput.trim()}
              className="p-1.5 rounded-md hover:bg-muted disabled:opacity-30 transition-colors cursor-pointer disabled:cursor-default"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
    </>
  )
}
