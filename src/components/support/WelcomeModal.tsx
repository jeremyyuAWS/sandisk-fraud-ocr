import { useState } from "react"
import { MessageCircle, ListChecks, Upload, Image as ImageIcon, ScanSearch, Headset, Monitor } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

const STORAGE_KEY = "sandisk-ocr-welcome-dismissed"

const steps = [
  {
    number: 1,
    icon: MessageCircle,
    title: "Chat Initiation",
    tag: "Mock Screen",
    description:
      "A SanDisk Support mock screen displays the chat icon, allowing the customer to initiate a chat session for a warranty enquiry.",
  },
  {
    number: 2,
    icon: ListChecks,
    title: "Issue Selection & Warranty Details",
    tag: "Mock Screens",
    description:
      "The system prompts the customer to choose between warranty, troubleshooting, or chatting with an agent. The customer selects a warranty-related option and provides a serial number to view warranty details.",
  },
  {
    number: 3,
    icon: Upload,
    title: "Image Upload Request",
    tag: null,
    description:
      "When required, the system requests the customer to upload a product image for verification.",
  },
  {
    number: 4,
    icon: ImageIcon,
    title: "Product Image Upload",
    tag: null,
    description:
      "The customer uploads a product image for authenticity verification.",
  },
  {
    number: 5,
    icon: ScanSearch,
    title: "Image Validation (OCR Process)",
    tag: null,
    description:
      "The system validates the uploaded image and determines whether the product is genuine, displaying the validation outcome.",
  },
  {
    number: 6,
    icon: Headset,
    title: "Escalation Option",
    tag: null,
    description:
      "After image validation, the system provides the customer with an option to escalate the case to a live agent.",
  },
  {
    number: 7,
    icon: Monitor,
    title: "Agent View",
    tag: "Mock Screen",
    description:
      "A mock Service Cloud agent view is displayed, showing the chat window with chat history, customer details, and OCR validation outcomes.",
  },
]

export function WelcomeModal() {
  const [open, setOpen] = useState(() => {
    try {
      return !localStorage.getItem(STORAGE_KEY)
    } catch {
      return true
    }
  })

  function handleDismiss() {
    setOpen(false)
    try {
      localStorage.setItem(STORAGE_KEY, "1")
    } catch {
      // ignore
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleDismiss() }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <img src="/sandisk-logo.svg" alt="SanDisk" className="h-5" />
            <Badge variant="outline" className="text-[10px] bg-secondary text-secondary-foreground">
              Concept Demo
            </Badge>
          </div>
          <DialogTitle className="text-xl font-bold tracking-tight">
            OCR Warranty Verification Demo
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            This demo showcases an AI-powered warranty verification workflow for SanDisk products, featuring OCR-based image analysis, fraud detection, and seamless agent escalation.
          </DialogDescription>
        </DialogHeader>

        <Separator />

        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-foreground mb-3">Demo Flow &mdash; 7 Steps</h3>
          <div className="space-y-3">
            {steps.map((step) => (
              <div key={step.number} className="flex gap-3">
                <div className="shrink-0 flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                    <step.icon className="h-4 w-4 text-foreground" />
                  </div>
                  {step.number < 7 && (
                    <div className="w-px flex-1 bg-border mt-1" />
                  )}
                </div>
                <div className="pb-3">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-semibold text-muted-foreground">
                      Step {step.number}
                    </span>
                    {step.tag && (
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-secondary text-muted-foreground border-border">
                        {step.tag}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm font-medium text-foreground leading-snug">
                    {step.title}
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        <DialogFooter>
          <Button onClick={handleDismiss} className="w-full sm:w-auto">
            Start Demo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
