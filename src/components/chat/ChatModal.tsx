import { useState, useEffect, useRef } from "react"
import { X, Minus, Bell, Paperclip, ArrowRight, Upload, Loader as Loader2, Maximize2, Minimize2, Bot, Image as ImageIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import type { ChatStep } from "@/data/app-state"
import { scenarios, type Scenario } from "@/data/scenarios"
import type { LyzrAgentConfig } from "@/data/lyzr-config"

interface ChatMessage {
  from: "bot" | "user"
  text?: string
  component?: React.ReactNode
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

export function ChatModal({
  open,
  step,
  selectedScenario,
  onClose,
  onStepChange,
  onEscalate,
  onImageUploaded,
  lyzrConfig,
  isLyzrConfigured,
}: ChatModalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [serialInput, setSerialInput] = useState("")
  const [freeInput, setFreeInput] = useState("")
  const [ocrProgress, setOcrProgress] = useState(0)
  const [isExpanded, setIsExpanded] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const ocrResultHandled = useRef(false)
  const scenario = scenarios[selectedScenario]

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, step])

  useEffect(() => {
    if (step === "welcome") {
      ocrResultHandled.current = false
      setMessages([
        {
          from: "bot",
          text: "Hello! Welcome to SanDisk Support. I can help with warranty, replacement status, product registration, and troubleshooting.",
        },
      ])
    }
  }, [step])

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
        { from: "bot", component: <OcrResultCard scenario={scenario} /> },
        { from: "bot", text: resultText },
      ])
      onStepChange("escalation")
    }
  }, [step, scenario, onStepChange])

  function addMessages(msgs: ChatMessage[]) {
    setMessages((prev) => [...prev, ...msgs])
  }

  async function handleLyzrMessage(userMessage: string) {
    addMessages([{ from: "user", text: userMessage }])
    setIsSending(true)
    try {
      const result = await sendToLyzr(lyzrConfig, userMessage)
      const botText = result.response || result.error || "No response received."
      addMessages([{ from: "bot", text: botText }])
    } catch {
      addMessages([{ from: "bot", text: "Failed to reach the Lyzr agent. Please check your settings." }])
    } finally {
      setIsSending(false)
    }
  }

  async function handleFreeInputSend() {
    const msg = freeInput.trim()
    if (!msg) return
    setFreeInput("")
    if (isLyzrConfigured) {
      await handleLyzrMessage(msg)
    }
  }

  function handleIssueSelect(issue: string) {
    if (isLyzrConfigured) {
      handleLyzrMessage(issue)
      return
    }
    addMessages([
      { from: "user", text: issue },
      {
        from: "bot",
        text:
          issue === "Warranty & Replacement"
            ? "Sure, I can help with warranty and replacements. What do you need?"
            : `I'd be happy to help with ${issue}. For this demo, let's proceed with the warranty flow.`,
      },
    ])
    onStepChange("warranty-subtype")
  }

  function handleWarrantySubtype(sub: string) {
    if (isLyzrConfigured) {
      handleLyzrMessage(sub)
      return
    }
    addMessages([
      { from: "user", text: sub },
      {
        from: "bot",
        text: "To look up your warranty, please enter your product serial number.",
      },
    ])
    onStepChange("serial-entry")
  }

  function handleSerialSubmit() {
    const serial = serialInput || scenario.serialEntered
    if (isLyzrConfigured) {
      setSerialInput("")
      handleLyzrMessage(`Serial: ${serial}`)
      return
    }
    addMessages([
      { from: "user", text: `Serial: ${serial}` },
      { from: "bot", text: "Thank you. I found a matching warranty record:" },
      { from: "bot", component: <WarrantyCard scenario={scenario} /> },
      {
        from: "bot",
        text: "To continue your warranty verification, please upload a clear image of the product label. This helps us confirm authenticity and speed up your request.",
      },
    ])
    setSerialInput("")
    onStepChange("image-request")
  }

  function handleDemoImageUpload() {
    onImageUploaded?.(scenario.productImage)
    addMessages([
      { from: "user", component: <ImagePreview src={scenario.productImage} alt="Product upload" /> },
      { from: "bot", text: "Thank you. Analyzing your product image now..." },
    ])
    onStepChange("ocr-processing")
  }

  async function handleRealFileUpload(file: File) {
    const objectUrl = URL.createObjectURL(file)
    onImageUploaded?.(objectUrl)
    addMessages([
      { from: "user", component: <ImagePreview src={objectUrl} alt="Uploaded product" /> },
    ])
    setIsSending(true)
    try {
      const base64 = await fileToBase64(file)
      const result = await sendToLyzr(
        lyzrConfig,
        "Analyze this SanDisk product image for OCR fraud verification. Extract brand, product name, serial number, capacity. Return a JSON object with fields: brandDetected, productText, serialDetected, capacityDetected, imageQuality, riskScore (0-100), riskLevel (Low/Medium/High), and reasonCodes (array of strings).",
        base64
      )
      const botText = result.response || result.error || "No response received."
      addMessages([{ from: "bot", text: botText }])
    } catch {
      addMessages([{ from: "bot", text: "Failed to analyze the image. Please check your Lyzr agent settings." }])
    } finally {
      setIsSending(false)
    }
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleRealFileUpload(file)
    e.target.value = ""
  }

  if (!open) return null

  const sizeClasses = isExpanded
    ? "fixed inset-4 z-50 w-auto h-auto"
    : "fixed bottom-6 right-6 z-50 w-[380px] h-[560px]"

  const canSendFreeText = isLyzrConfigured

  return (
    <div
      className={`${sizeClasses} bg-background border border-border rounded-xl shadow-xl flex flex-col overflow-hidden transition-all duration-200`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-background shrink-0">
        <div className="flex items-center gap-2">
          <img src="/sandisk-logo.svg" alt="SanDisk" className="h-3.5" />
          <span className="text-sm font-semibold text-foreground">CHAT</span>
          {isLyzrConfigured && (
            <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200 gap-1">
              <Bot className="h-3 w-3" />
              Lyzr
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <Bell className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? "Minimize chat" : "Expand chat"}
          >
            {isExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <Minus className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.from === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`${isExpanded ? "max-w-[60%]" : "max-w-[85%]"} ${
                msg.from === "user"
                  ? "bg-foreground text-primary-foreground rounded-2xl rounded-br-sm px-3 py-2 text-sm"
                  : msg.component
                    ? isExpanded ? "max-w-md w-full" : "w-full"
                    : "bg-secondary text-secondary-foreground rounded-2xl rounded-bl-sm px-3 py-2 text-sm"
              }`}
            >
              {msg.text || msg.component}
            </div>
          </div>
        ))}

        {isSending && (
          <div className="flex justify-start">
            <div className="bg-secondary text-secondary-foreground rounded-2xl rounded-bl-sm px-3 py-2 text-sm flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Thinking...
            </div>
          </div>
        )}

        {!isLyzrConfigured && step === "welcome" && (
          <div className="flex flex-wrap gap-2 pt-2">
            <QuickChip label="Warranty & Replacement" onClick={() => handleIssueSelect("Warranty & Replacement")} />
            <QuickChip label="Product Registration" onClick={() => handleIssueSelect("Product Registration")} />
            <QuickChip label="Troubleshooting" onClick={() => handleIssueSelect("Troubleshooting")} />
            <QuickChip label="Chat with Agent" onClick={() => handleIssueSelect("Chat with Agent")} />
          </div>
        )}

        {isLyzrConfigured && step === "welcome" && (
          <div className="flex flex-wrap gap-2 pt-2">
            <QuickChip label="Warranty & Replacement" onClick={() => handleLyzrMessage("I need help with warranty and replacement")} />
            <QuickChip label="Product Registration" onClick={() => handleLyzrMessage("I need to register a product")} />
            <QuickChip label="Troubleshooting" onClick={() => handleLyzrMessage("I need troubleshooting help")} />
          </div>
        )}

        {!isLyzrConfigured && step === "warranty-subtype" && (
          <div className="flex flex-wrap gap-2 pt-2">
            <QuickChip label="Product Registration" onClick={() => handleWarrantySubtype("Product Registration")} />
            <QuickChip label="Warranty Status" onClick={() => handleWarrantySubtype("Warranty Status")} />
            <QuickChip label="Replacement Status" onClick={() => handleWarrantySubtype("Replacement Status")} />
            <QuickChip label="Return / Replacement Request" onClick={() => handleWarrantySubtype("Return / Replacement Request")} />
          </div>
        )}

        {!isLyzrConfigured && step === "serial-entry" && (
          <div className="flex gap-2 pt-2">
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
          <div className="pt-2 space-y-2">
            <div className="rounded-lg overflow-hidden border border-border">
              <img
                src={scenario.productImage}
                alt="Product to upload"
                className="w-full h-auto max-h-36 object-cover"
              />
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
          <div className="pt-2 space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              AI verification in progress...
            </div>
            <Progress value={ocrProgress} className="h-2" />
            <div className="text-xs text-muted-foreground text-right">{ocrProgress}%</div>
          </div>
        )}

        {!isLyzrConfigured && step === "escalation" && (
          <div className="flex flex-wrap gap-2 pt-2">
            {scenario.risk.level === "Low" ? (
              <>
                <QuickChip
                  label="Continue Claim"
                  onClick={() => {
                    addMessages([
                      { from: "user", text: "Continue Claim" },
                      {
                        from: "bot",
                        text: "Your replacement has been approved. You will receive a confirmation email shortly. Thank you for choosing SanDisk!",
                      },
                    ])
                    onStepChange("closed")
                  }}
                />
                <QuickChip label="Chat with Agent" onClick={onEscalate} />
              </>
            ) : (
              <>
                <Button
                  size="sm"
                  className="bg-sandisk-red hover:bg-sandisk-red/90 text-white"
                  onClick={onEscalate}
                >
                  Escalate to Live Agent
                </Button>
                <QuickChip
                  label="Upload Another Image"
                  onClick={() => {
                    addMessages([
                      { from: "user", text: "I'll upload another image" },
                      { from: "bot", text: "Please upload a clearer image of the product label." },
                    ])
                    onStepChange("image-request")
                  }}
                />
              </>
            )}
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileInputChange}
      />
      <div className="border-t border-border px-3 py-2.5 flex items-center gap-2 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => {
            if (isLyzrConfigured) {
              fileInputRef.current?.click()
            }
          }}
          title={isLyzrConfigured ? "Upload product image" : "Upload not available in demo mode"}
        >
          {isLyzrConfigured ? <ImageIcon className="h-4 w-4" /> : <Paperclip className="h-4 w-4" />}
        </Button>
        {canSendFreeText ? (
          <Input
            placeholder="Type a message..."
            className="text-sm h-8"
            value={freeInput}
            onChange={(e) => setFreeInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !isSending && handleFreeInputSend()}
            disabled={isSending}
          />
        ) : (
          <Input
            placeholder="Type here to begin"
            className="text-sm h-8"
            disabled={step !== "serial-entry"}
            value={serialInput}
            onChange={(e) => setSerialInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && step === "serial-entry" && handleSerialSubmit()}
          />
        )}
        <Button
          size="icon"
          className="h-8 w-8 shrink-0 bg-sandisk-red hover:bg-sandisk-red/90 text-white"
          disabled={isSending}
          onClick={() => {
            if (canSendFreeText) handleFreeInputSend()
            else if (step === "serial-entry") handleSerialSubmit()
          }}
        >
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
