export interface LogEntry {
  id: number
  timestamp: string
  direction: "request" | "response"
  sessionId: string
  data: Record<string, unknown>
}

let counter = 0

export function createLogEntry(
  direction: "request" | "response",
  sessionId: string,
  data: Record<string, unknown>
): LogEntry {
  return {
    id: ++counter,
    timestamp: new Date()
      .toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })
      .toLowerCase(),
    direction,
    sessionId,
    data,
  }
}
