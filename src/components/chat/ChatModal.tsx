import { useState, useEffect, useRef } from "react"
import { X, Minus, Paperclip, ArrowRight, Upload, Loader as Loader2, Maximize2, Minimize2, Bot, Image as ImageIcon, Headset, ShieldCheck, ShieldAlert, ShieldQuestionMark as ShieldQuestion, CircleCheck, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
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

function WelcomeScreen({ onSelect: _ }: { onSelect: (issue: string) => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8">
      <img
        src="/sandisk-chat-image.png"
        alt="Welcome, We're here to help"
        className="w-72 h-auto"
      />
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
}: ChatModalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [serialInput, setSerialInput] = useState("")
  const [freeInput, setFreeInput] = useState("")
  const [ocrProgress, setOcrProgress] = useState(0)
  const [isExpanded, setIsExpanded] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [showWelcome, setShowWelcome] = useState(true)
  const [useLive, setUseLive] = useState(false)

  const isLyzrConfigured = useLive && isLyzrConfiguredProp

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
    try {
      const result = await sendToLyzr(lyzrConfig, userMessage)
      ws.disconnect()
      const responseText = result.response || result.error || "No response received."
      const parsed = tryParseLyzrResponse(responseText)
      if (parsed) {
        addComponent("bot", <LyzrResponseCard data={parsed} />)
      } else {
        addMsg("bot", responseText)
      }
    } catch {
      ws.disconnect()
      addMsg("bot", "Failed to reach the Lyzr agent. Please check your settings.")
    } finally {
      setIsSending(false)
    }
  }

  function handleBottomInputSubmit() {
    const msg = freeInput.trim()
    if (!msg) return
    setFreeInput("")
    if (showWelcome) { startConversation(); return }
    if (isLyzrConfigured) handleLyzrMessage(msg)
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
    setIsSending(true)
    ws.connect(lyzrConfig.sessionId, lyzrConfig.apiKey)
    try {
      const base64 = await fileToBase64(file)
      const result = await sendToLyzr(
        lyzrConfig,
        "Analyze this SanDisk product image for OCR fraud verification. Extract brand, product name, serial number, capacity. Return a JSON object with fields: brandDetected, productText, serialDetected, capacityDetected, imageQuality, riskScore (0-100), riskLevel (Low/Medium/High), and reasonCodes (array of strings).",
        base64
      )
      ws.disconnect()
      const responseText = result.response || result.error || "No response received."
      const parsed = tryParseLyzrResponse(responseText)
      if (parsed) {
        addComponent("bot", <LyzrResponseCard data={parsed} />)
      } else {
        addMsg("bot", responseText)
      }
    } catch {
      ws.disconnect()
      addMsg("bot", "Failed to analyze the image. Please check your Lyzr agent settings.")
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
    : "fixed bottom-6 right-6 z-50 w-[390px] h-[600px]"

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
    if (showWelcome) { handleBottomInputSubmit(); return }
    if (step === "return-email") { handleReturnEmailSubmit(); return }
    if (step === "return-order") { handleReturnOrderSubmit(); return }
    if (step === "return-reason") { handleReturnReasonSubmit(); return }
    if (step === "serial-entry") { handleSerialSubmit(); return }
    if (isLyzrConfigured) { handleBottomInputSubmit(); return }
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
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-background shrink-0">
        <div className="flex items-center gap-2">
          <img src="/sandisk-logo.svg" alt="SanDisk" className="h-4" />
          <span className="text-sm font-bold tracking-wide text-foreground">CHAT</span>
        </div>
        <div className="flex items-center gap-1">
          {isLyzrConfiguredProp && (
            <label htmlFor="live-toggle" className="flex items-center gap-1.5 cursor-pointer select-none mr-1">
              <span className={`text-[10px] font-semibold ${useLive ? "text-green-700" : "text-muted-foreground"}`}>
                {useLive ? "Live" : "Simulated"}
              </span>
              <Switch
                id="live-toggle"
                checked={useLive}
                onCheckedChange={setUseLive}
                className="scale-75 origin-right"
              />
            </label>
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

      {/* Welcome Screen */}
      {showWelcome && step === "welcome" && (
        <WelcomeScreen onSelect={handleWelcomeSelect} />
      )}

      {/* Conversation Messages */}
      {showConversation && (
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {messages.map((msg, i) => (
            <MessageBubble key={i} msg={msg} expanded={isExpanded} />
          ))}

          {isSending && (
            <div className="flex items-start gap-2">
              <BotAvatar />
              <div className="bg-secondary text-secondary-foreground rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm">
                <AgentActivityFeed events={ws.events} isConnected={ws.isConnected} />
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
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileInputChange} />
      <div className="mt-auto border-t border-border px-4 py-3 flex items-center gap-3 shrink-0">
        <button
          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          onClick={() => {
            if (isLyzrConfigured) fileInputRef.current?.click()
          }}
        >
          {isLyzrConfigured ? <ImageIcon className="h-5 w-5" /> : <Paperclip className="h-5 w-5" />}
        </button>
        <Input
          placeholder={bottomPlaceholder}
          className="text-sm h-9 border-0 shadow-none focus-visible:ring-0 px-0 bg-transparent"
          value={bottomValue}
          onChange={(e) => handleBottomChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !isSending) handleBottomSubmit()
          }}
          disabled={isSending}
        />
        <button
          className="shrink-0 text-foreground hover:text-sandisk-red transition-colors cursor-pointer disabled:opacity-40"
          disabled={isSending}
          onClick={() => { if (!isSending) handleBottomSubmit() }}
        >
          <ArrowRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}
