import { ArrowLeft, Shield, TriangleAlert as AlertTriangle, CircleCheck as CheckCircle, Clock, User, FileImage, MessageSquare, ChartBar as BarChart3 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { scenarios, type Scenario } from "@/data/scenarios"
import { toast } from "sonner"

interface AgentWorkspaceProps {
  selectedScenario: string
  uploadedImageUrl?: string | null
  onBack: () => void
}

function RiskIcon({ level }: { level: string }) {
  if (level === "Low") return <CheckCircle className="h-5 w-5 text-green-600" />
  if (level === "High") return <AlertTriangle className="h-5 w-5 text-red-600" />
  return <Clock className="h-5 w-5 text-amber-600" />
}

function CustomerPanel({ scenario }: { scenario: Scenario }) {
  return (
    <Card className="border border-border">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <User className="h-4 w-4" />
          Customer Details
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3 text-xs">
        <div className="grid grid-cols-[100px_1fr] gap-y-2">
          <span className="text-muted-foreground">Name</span>
          <span>Alex Johnson</span>
          <span className="text-muted-foreground">Email</span>
          <span>alex.johnson@email.com</span>
          <span className="text-muted-foreground">Account</span>
          <span>Since Jan 2024</span>
          <span className="text-muted-foreground">Total Claims</span>
          <span className={scenario.warranty.priorClaims > 1 ? "text-sandisk-red font-semibold" : ""}>
            {scenario.warranty.priorClaims + 1}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

function WarrantyPanel({ scenario }: { scenario: Scenario }) {
  const w = scenario.warranty
  return (
    <Card className="border border-border">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Shield className="h-4 w-4" />
          Warranty Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-2 text-xs">
        <div className="font-medium text-sm">{w.product}</div>
        <Separator />
        <div className="grid grid-cols-[100px_1fr] gap-y-1.5">
          <span className="text-muted-foreground">Serial</span>
          <span className="font-mono">{w.serialNumber}</span>
          <span className="text-muted-foreground">Status</span>
          <Badge variant="outline" className="w-fit bg-green-50 text-green-700 border-green-200">
            {w.status}
          </Badge>
          <span className="text-muted-foreground">Purchase</span>
          <span>{w.purchaseDate}</span>
          <span className="text-muted-foreground">Prior Claims</span>
          <span>{w.priorClaims}</span>
        </div>
      </CardContent>
    </Card>
  )
}

function TranscriptPanel({ scenario }: { scenario: Scenario }) {
  const transcriptLines = [
    { from: "bot" as const, text: "Hello! Welcome to SanDisk Support." },
    { from: "user" as const, text: "Warranty & Replacement" },
    { from: "bot" as const, text: "What do you need help with?" },
    { from: "user" as const, text: "Return / Replacement Request" },
    { from: "user" as const, text: `Serial: ${scenario.serialEntered}` },
    { from: "bot" as const, text: "Warranty record found. Please upload a product image." },
    { from: "user" as const, text: "[Product image uploaded]" },
    { from: "bot" as const, text: "AI verification complete. Escalating to live agent." },
  ]

  return (
    <Card className="border border-border">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Chat Transcript
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <ScrollArea className="h-[260px]">
          <div className="space-y-2">
            {transcriptLines.map((line, i) => (
              <div key={i} className={`flex ${line.from === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] px-2.5 py-1.5 rounded-lg text-xs ${
                    line.from === "user"
                      ? "bg-foreground text-primary-foreground"
                      : "bg-secondary text-secondary-foreground"
                  }`}
                >
                  {line.text}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

function ImagePanel({ imageUrl }: { imageUrl?: string | null }) {
  return (
    <Card className="border border-border">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <FileImage className="h-4 w-4" />
          Uploaded Image
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt="Uploaded product"
            className="w-full h-auto max-h-48 object-contain rounded-lg bg-secondary"
          />
        ) : (
          <div className="bg-secondary rounded-lg h-32 flex items-center justify-center">
            <div className="text-center text-xs text-muted-foreground">
              <FileImage className="h-10 w-10 mx-auto mb-2 opacity-40" />
              product_label_front.jpg
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function OcrPanel({ scenario }: { scenario: Scenario }) {
  const { ocr } = scenario
  return (
    <Card className="border border-border">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          OCR Extracted Data
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 text-xs space-y-1.5">
        <div className="grid grid-cols-[100px_1fr] gap-y-1.5">
          <span className="text-muted-foreground">Brand</span>
          <span className={ocr.brandDetected === "SanDisk" ? "" : "text-sandisk-red font-semibold"}>
            {ocr.brandDetected}
          </span>
          <span className="text-muted-foreground">Product</span>
          <span>{ocr.productText}</span>
          <span className="text-muted-foreground">Capacity</span>
          <span className={ocr.capacityDetected !== "32GB" ? "text-sandisk-red font-semibold" : ""}>
            {ocr.capacityDetected}
          </span>
          <span className="text-muted-foreground">Serial (Image)</span>
          <span className={`font-mono ${ocr.serialDetected !== scenario.serialEntered ? "text-sandisk-red font-semibold" : ""}`}>
            {ocr.serialDetected}
          </span>
          <span className="text-muted-foreground">Image Quality</span>
          <span>{ocr.imageQuality}</span>
        </div>
      </CardContent>
    </Card>
  )
}

function RiskPanel({ scenario }: { scenario: Scenario }) {
  const { risk, recommendation } = scenario
  const riskColor =
    risk.level === "Low"
      ? "bg-green-50 text-green-700 border-green-200"
      : risk.level === "High"
        ? "bg-red-50 text-red-700 border-red-200"
        : "bg-amber-50 text-amber-700 border-amber-200"

  return (
    <Card className="border border-border">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <RiskIcon level={risk.level} />
          AI Risk Assessment
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Fraud Risk Score</span>
          <span className="text-lg font-bold">{risk.score}/100</span>
        </div>
        <Progress value={risk.score} className="h-2.5" />
        <Badge variant="outline" className={riskColor}>
          {risk.level} Risk
        </Badge>
        <Separator />
        <div className="space-y-1">
          <div className="text-muted-foreground font-medium">Findings</div>
          <ul className="space-y-1 pl-3">
            {risk.reasonCodes.map((r, i) => (
              <li key={i} className="list-disc">{r}</li>
            ))}
          </ul>
        </div>
        <Separator />
        <div>
          <div className="text-muted-foreground font-medium mb-1">Recommendation</div>
          <div className="font-medium">{recommendation}</div>
        </div>
        <Separator />
        <div className="text-muted-foreground font-medium mb-2">Actions</div>
        <div className="grid grid-cols-2 gap-2">
          {risk.level === "Low" ? (
            <Button
              size="sm"
              className="col-span-2 bg-green-600 hover:bg-green-700 text-white"
              onClick={() => toast("Replacement approved. Confirmation sent to customer.")}
            >
              Approve Replacement
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => toast("Request for additional proof sent to customer.")}
              >
                Request Proof
              </Button>
              <Button
                size="sm"
                className="bg-sandisk-red hover:bg-sandisk-red/90 text-white"
                onClick={() => toast("Claim held for fraud operations review.")}
              >
                Reject / Hold
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="col-span-2"
                onClick={() => toast("Case escalated to fraud operations team.")}
              >
                Escalate to Fraud Ops
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function AgentWorkspace({ selectedScenario, uploadedImageUrl, onBack }: AgentWorkspaceProps) {
  const scenario = scenarios[selectedScenario]

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
          <Badge variant="outline">Case #FR-2026-0417</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={
              scenario.risk.level === "Low"
                ? "bg-green-50 text-green-700 border-green-200"
                : scenario.risk.level === "High"
                  ? "bg-red-50 text-red-700 border-red-200"
                  : "bg-amber-50 text-amber-700 border-amber-200"
            }
          >
            <RiskIcon level={scenario.risk.level} />
            {scenario.risk.level} Risk
          </Badge>
        </div>
      </div>
      <div className="p-4 grid grid-cols-1 lg:grid-cols-[280px_1fr_320px] gap-4 max-w-[1440px] mx-auto">
        <div className="space-y-4">
          <CustomerPanel scenario={scenario} />
          <WarrantyPanel scenario={scenario} />
        </div>
        <div className="space-y-4">
          <TranscriptPanel scenario={scenario} />
          <ImagePanel imageUrl={uploadedImageUrl || scenario.productImage} />
        </div>
        <div className="space-y-4">
          <OcrPanel scenario={scenario} />
          <RiskPanel scenario={scenario} />
        </div>
      </div>
    </div>
  )
}
