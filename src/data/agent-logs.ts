import { supabase } from "@/lib/supabase"

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

export async function persistLog(entry: LogEntry): Promise<void> {
  await supabase.from("agent_logs").insert({
    session_id: entry.sessionId,
    direction: entry.direction,
    timestamp_label: entry.timestamp,
    payload: entry.data,
  })
}

export async function loadLogs(): Promise<LogEntry[]> {
  const { data, error } = await supabase
    .from("agent_logs")
    .select("id, session_id, direction, timestamp_label, payload, created_at")
    .order("created_at", { ascending: true })

  if (error || !data) return []

  counter = 0
  return data.map((row) => {
    const entry: LogEntry = {
      id: row.id,
      timestamp: row.timestamp_label,
      direction: row.direction as "request" | "response",
      sessionId: row.session_id,
      data: row.payload as Record<string, unknown>,
    }
    if (row.id > counter) counter = row.id
    return entry
  })
}

export async function deleteLogsBySession(sessionId: string): Promise<void> {
  await supabase.from("agent_logs").delete().eq("session_id", sessionId)
}

export async function deleteAllLogs(): Promise<void> {
  await supabase.from("agent_logs").delete().neq("session_id", "")
}
