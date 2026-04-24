import { useState, useRef, useCallback, useEffect } from "react"

export interface WsEvent {
  text: string
  agentName: string
  timestamp: string
  status: "pending" | "done"
}

export interface RawWsEvent {
  sessionId: string
  payload: Record<string, unknown>
  eventType: string
  level: string
  agentName: string
  receivedAt: string
}

const HIDDEN_EVENT_TYPES = new Set([
  "llm_generation",
  "thinking_log",
  "tool_call_prepare",
  "tool_called",
  "tool_calling_iteration",
  "tool_response",
  "tool_output",
  "message_role_converted",
  "artifact_create_success",
  "lyzr_memory_process_started",
  "lyzr_memory_process_completed",
  "lyzr_memory_save_completed",
])

const EVENT_LABELS: Record<string, string> = {
  agent_process_start: "Processing started",
  agent_process_end: "Processing complete",
  kb_documents_retrieved: "Knowledge base queried",
  human_intervention_triggered: "Human intervention triggered",
  process_complete: "Process complete",
}

function readableText(eventType: string, message: string): string {
  if (EVENT_LABELS[eventType]) return EVENT_LABELS[eventType]
  if (message && message !== "{}") return message
  return eventType.replace(/_/g, " ")
}

function ts() {
  return new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).toLowerCase()
}

export function useLyzrWebSocket(onRawEvent?: (event: RawWsEvent) => void) {
  const [events, setEvents] = useState<WsEvent[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const retryRef = useRef(0)
  const onRawEventRef = useRef(onRawEvent)
  onRawEventRef.current = onRawEvent

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    setIsConnected(false)
  }, [])

  const connect = useCallback((sessionId: string, apiKey: string) => {
    disconnect()
    setEvents([])
    retryRef.current = 0

    function open() {
      const url = `wss://metrics.studio.lyzr.ai/ws/${sessionId}?x-api-key=${apiKey}`
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        setIsConnected(true)
      }

      ws.onmessage = (e) => {
        let parsed: Record<string, unknown> | null = null
        let text = ""
        try {
          parsed = JSON.parse(e.data)
          text = (parsed!.message || parsed!.text || parsed!.status || JSON.stringify(parsed)) as string
        } catch {
          text = String(e.data)
        }

        if (!text || text === "ping") return

        const eventType = (parsed?.event_type as string) || ""
        const agentName = (parsed?.agent_name as string) || ""

        if (parsed && onRawEventRef.current) {
          onRawEventRef.current({
            sessionId,
            payload: parsed,
            eventType,
            level: (parsed.level as string) || "",
            agentName,
            receivedAt: new Date().toISOString(),
          })
        }

        if (text.toLowerCase().includes("in_progress")) return
        if (HIDDEN_EVENT_TYPES.has(eventType)) return

        const displayText = readableText(eventType, (parsed?.message as string) || "")

        setEvents((prev) => {
          const updated = prev.map((ev) =>
            ev.status === "pending" ? { ...ev, status: "done" as const } : ev
          )
          return [...updated, { text: displayText, agentName, timestamp: ts(), status: "pending" }]
        })
      }

      ws.onerror = () => {
        if (retryRef.current < 1) {
          retryRef.current++
          setTimeout(open, 2000)
        }
      }

      ws.onclose = () => {
        setIsConnected(false)
        setEvents((prev) =>
          prev.map((ev) => (ev.status === "pending" ? { ...ev, status: "done" as const } : ev))
        )
      }
    }

    open()
  }, [disconnect])

  const clearEvents = useCallback(() => {
    setEvents([])
  }, [])

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [])

  return { events, isConnected, connect, disconnect, clearEvents }
}
