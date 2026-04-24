import { useState, useCallback } from "react"
import { ShieldCheck, Loader as Loader2, Copy, Check, RotateCcw, Code, Eye } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { createLogEntry, type LogEntry } from "@/data/agent-logs"

const VALIDATOR_AGENT_ID = "69ea4e968dccef41d94cc060"
const LYZR_API_KEY = "sk-default-D0plT8nq8DdRpw5LR956a7J4Df7Yo2QC"
const LYZR_USER_ID = "jeremy.yu@movate.com"

interface ValidatorTestDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddLog?: (log: LogEntry) => void
}

type TestState = "idle" | "validating" | "done" | "error"

export function ValidatorTestDialog({ open, onOpenChange, onAddLog }: ValidatorTestDialogProps) {
  const [state, setState] = useState<TestState>("idle")
  const [jsonInput, setJsonInput] = useState("")
  const [rawResponse, setRawResponse] = useState("")
  const [parsedResult, setParsedResult] = useState<Record<string, unknown> | null>(null)
  const [errorMsg, setErrorMsg] = useState("")
  const [elapsed, setElapsed] = useState(0)
  const [copied, setCopied] = useState(false)
  const [viewMode, setViewMode] = useState<"formatted" | "raw">("formatted")

  const reset = useCallback(() => {
    setState("idle")
    setJsonInput("")
    setRawResponse("")
    setParsedResult(null)
    setErrorMsg("")
    setElapsed(0)
    setCopied(false)
    setViewMode("formatted")
  }, [])

  const runValidation = useCallback(async () => {
    if (!jsonInput.trim()) return

    setState("validating")
    setErrorMsg("")
    setRawResponse("")
    setParsedResult(null)
    setViewMode("formatted")
    const start = Date.now()

    const sessionId = `validator-test-${Date.now()}`

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lyzr-validate`

      onAddLog?.(createLogEntry("request", sessionId, {
        source: "validator-test-dialog",
        agent_id: VALIDATOR_AGENT_ID,
        user_id: LYZR_USER_ID,
        payload_length: jsonInput.length,
        endpoint: apiUrl,
      }))

      const res = await fetch(apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          apiKey: LYZR_API_KEY,
          agentId: VALIDATOR_AGENT_ID,
          userId: LYZR_USER_ID,
          jsonPayload: jsonInput,
        }),
      })

      const data = await res.json()
      setElapsed(Math.round((Date.now() - start) / 1000))

      onAddLog?.(createLogEntry("response", sessionId, {
        source: "validator-test-dialog",
        http_status: res.status,
        ok: res.ok,
        body: data,
      }))

      if (!res.ok) {
        setState("error")
        setErrorMsg(data.error || `HTTP ${res.status}`)
        setRawResponse(JSON.stringify(data, null, 2))
        return
      }

      setRawResponse(JSON.stringify(data, null, 2))

      const lyzrRaw = data.lyzr_raw_response
      if (lyzrRaw?.response) {
        const cleaned = lyzrRaw.response
          .replace(/```json\n?/g, "")
          .replace(/```\n?/g, "")
          .trim()
        try {
          setParsedResult(JSON.parse(cleaned))
        } catch {
          setParsedResult(null)
        }
      }

      setState("done")
    } catch (err) {
      setElapsed(Math.round((Date.now() - start) / 1000))
      setState("error")
      setErrorMsg(err instanceof Error ? err.message : "Network error")
    }
  }, [jsonInput, onAddLog])

  const copyResult = useCallback(() => {
    const text = parsedResult
      ? JSON.stringify(parsedResult, null, 2)
      : rawResponse
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [parsedResult, rawResponse])

  const loadSampleJson = useCallback(() => {
    const sample = JSON.stringify({
      visual_attributes: {
        object_description: "A small, rectangular electronic card with a red upper section and grey lower section.",
        shape_and_size: "Small, flat, rectangular card with a notched corner.",
        form_factor: "Small, flat card.",
        connectors: "none_visible",
        material_appearance: "Matte plastic.",
        product_colors: ["red", "grey", "white"],
      },
      text_extractions: [
        { text_content: "SanDisk", font_style: "Printed, sans-serif, white", orientation: "horizontal", placement: "top-center" },
        { text_content: "Ultra", font_style: "Printed, sans-serif, white", orientation: "horizontal", placement: "top-center, below SanDisk" },
        { text_content: "128", font_style: "Printed, bold sans-serif, white", orientation: "horizontal", placement: "middle-left" },
      ],
      product_type: "MicroSD",
    }, null, 2)
    setJsonInput(sample)
  }, [])

  const isValidating = state === "validating"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Validator Agent Test
          </DialogTitle>
          <DialogDescription>
            Paste OCR JSON output to validate it against the Lyzr validation agent.
          </DialogDescription>
        </DialogHeader>

        <Separator />

        <div className="flex-1 min-h-0 flex flex-col gap-4 overflow-hidden">
          {/* JSON input */}
          {state === "idle" && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  OCR JSON to Validate
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs text-muted-foreground"
                  onClick={loadSampleJson}
                >
                  Load Sample
                </Button>
              </div>
              <Textarea
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                placeholder='{"visual_attributes": {...}, "text_extractions": [...]}'
                className="min-h-[160px] font-mono text-xs resize-none"
              />
              <Button
                size="sm"
                onClick={runValidation}
                disabled={!jsonInput.trim()}
                className="self-end"
              >
                <ShieldCheck className="h-4 w-4" />
                Validate
              </Button>
            </div>
          )}

          {/* Status bar */}
          {(isValidating || state === "done" || state === "error") && (
            <div className="flex items-center gap-2 text-sm">
              {isValidating && (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-foreground" />
                  <span className="text-muted-foreground">
                    Waiting for Validator agent response...
                  </span>
                </>
              )}
              {state === "done" && (
                <div className="flex items-center gap-2 w-full">
                  <Badge variant="outline" className="text-xs border-foreground/20">
                    {elapsed}s
                  </Badge>
                  <span className="text-muted-foreground">Validation complete</span>
                  <div className="ml-auto flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={copyResult}>
                      {copied ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={reset}>
                      <RotateCcw className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
              {state === "error" && (
                <>
                  <Badge variant="destructive" className="text-xs">
                    Error
                  </Badge>
                  <span className="text-sm text-destructive">{errorMsg}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 ml-auto"
                    onClick={reset}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
            </div>
          )}

          {/* Result output */}
          {(parsedResult || rawResponse) && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Validator Agent Response
                </span>
                {parsedResult && (
                  <div className="flex items-center gap-0.5 border border-border rounded-md p-0.5">
                    <button
                      onClick={() => setViewMode("formatted")}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs transition-colors ${
                        viewMode === "formatted"
                          ? "bg-foreground text-background"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Eye className="h-3 w-3" />
                      Formatted
                    </button>
                    <button
                      onClick={() => setViewMode("raw")}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs transition-colors ${
                        viewMode === "raw"
                          ? "bg-foreground text-background"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Code className="h-3 w-3" />
                      Raw
                    </button>
                  </div>
                )}
              </div>
              <ScrollArea className="flex-1 min-h-0 max-h-[45vh] rounded-md border border-border bg-muted/40">
                <div className="p-4">
                  {parsedResult && viewMode === "formatted" ? (
                    <JsonTree data={parsedResult} />
                  ) : (
                    <pre className="text-xs font-mono whitespace-pre-wrap text-foreground">
                      {rawResponse}
                    </pre>
                  )}
                </div>
              </ScrollArea>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function JsonTree({ data, depth = 0 }: { data: unknown; depth?: number }) {
  if (data === null || data === undefined) {
    return <span className="text-muted-foreground italic text-xs">null</span>
  }

  if (typeof data === "string") {
    return <span className="text-xs text-foreground">"{data}"</span>
  }

  if (typeof data === "number" || typeof data === "boolean") {
    return <span className="text-xs font-medium text-foreground">{String(data)}</span>
  }

  if (Array.isArray(data)) {
    if (data.length === 0) return <span className="text-xs text-muted-foreground">[]</span>
    if (data.every((v) => typeof v === "string" || typeof v === "number")) {
      return (
        <div className="flex flex-wrap gap-1">
          {data.map((v, i) => (
            <Badge key={i} variant="secondary" className="text-xs font-normal">
              {String(v)}
            </Badge>
          ))}
        </div>
      )
    }
    return (
      <div className="space-y-2">
        {data.map((item, i) => (
          <div key={i} className="border-l-2 border-border pl-3">
            <JsonTree data={item} depth={depth + 1} />
          </div>
        ))}
      </div>
    )
  }

  if (typeof data === "object") {
    const entries = Object.entries(data as Record<string, unknown>)
    return (
      <div className="space-y-2">
        {entries.map(([key, value]) => {
          const isNested =
            typeof value === "object" && value !== null && !Array.isArray(value)
          const isArray = Array.isArray(value)
          const isComplex = isNested || (isArray && value.length > 0)

          return (
            <div key={key}>
              <div className="flex items-start gap-2">
                <span className="text-xs font-semibold text-foreground shrink-0 mt-0.5">
                  {formatKey(key)}
                </span>
                {!isComplex && (
                  <JsonTree data={value} depth={depth + 1} />
                )}
              </div>
              {isComplex && (
                <div className="mt-1 ml-3 border-l-2 border-border pl-3">
                  <JsonTree data={value} depth={depth + 1} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  return <span className="text-xs">{String(data)}</span>
}

function formatKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}
