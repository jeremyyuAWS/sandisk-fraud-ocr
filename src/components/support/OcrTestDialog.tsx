import { useState, useRef, useCallback } from "react"
import { ScanSearch, Upload, Loader as Loader2, X, Copy, Check, RotateCcw, Code, Eye } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { createLogEntry, type LogEntry } from "@/data/agent-logs"

const OCR_AGENT_ID = "69ea4e96b6a1f25b871d5302"
const LYZR_API_KEY = "sk-default-D0plT8nq8DdRpw5LR956a7J4Df7Yo2QC"
const LYZR_USER_ID = "jeremy.yu@movate.com"

interface OcrTestDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddLog?: (log: LogEntry) => void
}

type TestState = "idle" | "uploading" | "analyzing" | "done" | "error"

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const base64 = result.split(",")[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function OcrTestDialog({ open, onOpenChange, onAddLog }: OcrTestDialogProps) {
  const [state, setState] = useState<TestState>("idle")
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [fileName, setFileName] = useState("")
  const [rawResponse, setRawResponse] = useState<string>("")
  const [parsedJson, setParsedJson] = useState<Record<string, unknown> | null>(null)
  const [errorMsg, setErrorMsg] = useState("")
  const [elapsed, setElapsed] = useState(0)
  const [copied, setCopied] = useState(false)
  const [viewMode, setViewMode] = useState<"formatted" | "raw">("formatted")
  const fileRef = useRef<HTMLInputElement>(null)
  const base64Ref = useRef("")

  const reset = useCallback(() => {
    setState("idle")
    setPreviewUrl(null)
    setFileName("")
    setRawResponse("")
    setParsedJson(null)
    setErrorMsg("")
    setElapsed(0)
    setCopied(false)
    setViewMode("formatted")
    base64Ref.current = ""
  }, [])

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) return
    setPreviewUrl(URL.createObjectURL(file))
    setFileName(file.name)
    setState("idle")
    setRawResponse("")
    setParsedJson(null)
    setErrorMsg("")
    base64Ref.current = await fileToBase64(file)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile]
  )

  const runAnalysis = useCallback(async () => {
    if (!base64Ref.current) return

    setState("uploading")
    setErrorMsg("")
    setRawResponse("")
    setParsedJson(null)
    setViewMode("formatted")
    const start = Date.now()

    const sessionId = `ocr-test-${Date.now()}`

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lyzr-image-test`

      onAddLog?.(createLogEntry("request", sessionId, {
        source: "ocr-test-dialog",
        agent_id: OCR_AGENT_ID,
        user_id: LYZR_USER_ID,
        image_file: fileName,
        endpoint: apiUrl,
      }))

      setState("analyzing")

      const res = await fetch(apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          apiKey: LYZR_API_KEY,
          agentId: OCR_AGENT_ID,
          userId: LYZR_USER_ID,
          imageBase64: base64Ref.current,
        }),
      })

      const data = await res.json()
      setElapsed(Math.round((Date.now() - start) / 1000))

      onAddLog?.(createLogEntry("response", sessionId, {
        source: "ocr-test-dialog",
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
          setParsedJson(JSON.parse(cleaned))
        } catch {
          setParsedJson(null)
        }
      }

      setState("done")
    } catch (err) {
      setElapsed(Math.round((Date.now() - start) / 1000))
      setState("error")
      setErrorMsg(err instanceof Error ? err.message : "Network error")
    }
  }, [fileName, onAddLog])

  const copyJson = useCallback(() => {
    const text = parsedJson
      ? JSON.stringify(parsedJson, null, 2)
      : rawResponse
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [parsedJson, rawResponse])

  const isAnalyzing = state === "uploading" || state === "analyzing"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanSearch className="h-5 w-5" />
            OCR Agent Test
          </DialogTitle>
          <DialogDescription>
            Upload a product image to test the vision agent directly and inspect the returned JSON.
          </DialogDescription>
        </DialogHeader>

        <Separator />

        <div className="flex-1 min-h-0 flex flex-col gap-4 overflow-hidden">
          {/* Upload zone */}
          <div
            className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-foreground/40 transition-colors"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleFile(f)
              }}
            />
            {previewUrl ? (
              <div className="flex items-center gap-4">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="h-20 w-20 object-cover rounded-md border border-border"
                />
                <div className="text-left flex-1">
                  <p className="text-sm font-medium">{fileName}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Click or drop to replace
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    runAnalysis()
                  }}
                  disabled={isAnalyzing}
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <ScanSearch className="h-4 w-4" />
                      Analyze
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="py-6 flex flex-col items-center gap-2">
                <Upload className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Drop an image here or click to browse
                </p>
              </div>
            )}
          </div>

          {/* Status bar */}
          {(isAnalyzing || state === "done" || state === "error") && (
            <div className="flex items-center gap-2 text-sm">
              {isAnalyzing && (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-foreground" />
                  <span className="text-muted-foreground">
                    {state === "uploading"
                      ? "Uploading image..."
                      : "Waiting for Lyzr agent response..."}
                  </span>
                </>
              )}
              {state === "done" && (
                <>
                  <Badge variant="outline" className="text-xs border-foreground/20">
                    {elapsed}s
                  </Badge>
                  <span className="text-muted-foreground">Analysis complete</span>
                  <div className="ml-auto flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={copyJson}>
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
                </>
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

          {/* JSON output */}
          {(parsedJson || rawResponse) && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Lyzr Agent Response
                </span>
                {parsedJson && (
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
                  {parsedJson && viewMode === "formatted" ? (
                    <JsonTree data={parsedJson} />
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
