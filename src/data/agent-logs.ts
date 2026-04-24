import { supabase } from "@/lib/supabase"

export type AgentSource = "ocr" | "validator" | "managerial"

export interface LogEntry {
  id: number
  timestamp: string
  createdAt: string
  direction: "request" | "response"
  sessionId: string
  agentSource?: AgentSource
  data: Record<string, unknown>
}

let counter = 0

export function createLogEntry(
  direction: "request" | "response",
  sessionId: string,
  data: Record<string, unknown>,
  agentSource?: AgentSource
): LogEntry {
  const now = new Date()
  return {
    id: ++counter,
    timestamp: now
      .toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })
      .toLowerCase(),
    createdAt: now.toISOString(),
    direction,
    sessionId,
    agentSource,
    data,
  }
}

export async function persistLog(entry: LogEntry): Promise<void> {
  await supabase.from("agent_logs").insert({
    session_id: entry.sessionId,
    direction: entry.direction,
    timestamp_label: entry.timestamp,
    payload: entry.data,
    agent_source: entry.agentSource || null,
  })
}

export async function loadLogs(): Promise<LogEntry[]> {
  const { data, error } = await supabase
    .from("agent_logs")
    .select("id, session_id, direction, timestamp_label, payload, created_at, agent_source")
    .order("created_at", { ascending: true })

  if (error || !data) return []

  counter = 0
  return data.map((row) => {
    const entry: LogEntry = {
      id: row.id,
      timestamp: row.timestamp_label,
      createdAt: row.created_at,
      direction: row.direction as "request" | "response",
      sessionId: row.session_id,
      agentSource: (row.agent_source as AgentSource) || undefined,
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
  await supabase.from("ws_events").delete().neq("session_id", "")
}

// ---------------------------------------------------------------------------
// WebSocket raw events
// ---------------------------------------------------------------------------

export interface WsEventRow {
  id: number
  sessionId: string
  payload: Record<string, unknown>
  eventType: string
  level: string
  agentName: string
  createdAt: string
}

export async function persistWsEvent(event: {
  sessionId: string
  payload: Record<string, unknown>
  eventType: string
  level: string
  agentName: string
}): Promise<void> {
  await supabase.from("ws_events").insert({
    session_id: event.sessionId,
    payload: event.payload,
    event_type: event.eventType,
    level: event.level,
    agent_name: event.agentName,
  })
}

export async function loadWsEvents(): Promise<WsEventRow[]> {
  const { data, error } = await supabase
    .from("ws_events")
    .select("id, session_id, payload, event_type, level, agent_name, created_at")
    .order("created_at", { ascending: true })

  if (error || !data) return []

  return data.map((row) => ({
    id: row.id,
    sessionId: row.session_id,
    payload: row.payload as Record<string, unknown>,
    eventType: row.event_type,
    level: row.level,
    agentName: row.agent_name,
    createdAt: row.created_at,
  }))
}

export async function deleteWsEventsBySession(sessionId: string): Promise<void> {
  await supabase.from("ws_events").delete().eq("session_id", sessionId)
}
