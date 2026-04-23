import { useState, useRef, useCallback, useEffect } from "react"

export interface WsEvent {
  text: string
  timestamp: string
  status: "pending" | "done"
}

function ts() {
  return new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).toLowerCase()
}

export function useLyzrWebSocket() {
  const [events, setEvents] = useState<WsEvent[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const retryRef = useRef(0)

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
        let text = ""
        try {
          const parsed = JSON.parse(e.data)
          text = parsed.message || parsed.text || parsed.status || JSON.stringify(parsed)
        } catch {
          text = String(e.data)
        }
        if (!text || text === "ping") return

        setEvents((prev) => {
          const updated = prev.map((ev) =>
            ev.status === "pending" ? { ...ev, status: "done" as const } : ev
          )
          return [...updated, { text, timestamp: ts(), status: "pending" }]
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
