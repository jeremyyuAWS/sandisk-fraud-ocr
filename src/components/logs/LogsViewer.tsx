import { useState, useRef, useEffect, useMemo } from "react"
import { X, Search, Copy, Check, ChevronDown, ChevronUp, ScrollText, Trash2, ListFilter as Filter, ArrowUpRight, ArrowDownLeft, Radio } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import type { LogEntry } from "@/data/agent-logs"
import type { WsEventRow } from "@/data/agent-logs"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SessionGroup {
  sessionId: string
  logs: LogEntry[]
  firstTimestamp: string
  lastTimestamp: string
  requestCount: number
  responseCount: number
}

interface LogsViewerProps {
  open: boolean
  logs: LogEntry[]
  wsEvents: WsEventRow[]
  onClose: () => void
  onClear: () => void
  onDeleteSession: (sessionId: string) => void
}

type Tab = "api" | "websocket"

// ---------------------------------------------------------------------------
// Color helpers for WS events
// ---------------------------------------------------------------------------

const LEVEL_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  DEBUG: { bg: "bg-gray-100", text: "text-gray-700", border: "border-gray-300" },
  INFO: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  WARN: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  WARNING: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  ERROR: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
}

const EVENT_TYPE_COLORS: Record<string, string> = {
  agent_process_start: "text-blue-600",
  agent_process_end: "text-green-600",
  tool_call_start: "text-amber-600",
  tool_call_end: "text-amber-700",
  llm_call_start: "text-cyan-600",
  llm_call_end: "text-cyan-700",
  agent_start: "text-blue-500",
  agent_end: "text-green-500",
}

function getLevelStyle(level: string) {
  return LEVEL_COLORS[level.toUpperCase()] || LEVEL_COLORS.DEBUG
}

function getEventColor(eventType: string) {
  return EVENT_TYPE_COLORS[eventType] || "text-foreground/70"
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LogsViewer({ open, logs, wsEvents, onClose, onClear, onDeleteSession }: LogsViewerProps) {
  const [tab, setTab] = useState<Tab>("api")
  const [searchQuery, setSearchQuery] = useState("")
  const [sessionFilter, setSessionFilter] = useState<string | null>(null)
  const [directionFilter, setDirectionFilter] = useState<"all" | "request" | "response">("all")
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set())
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())
  const [expandedWsIds, setExpandedWsIds] = useState<Set<number>>(new Set())
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const [copiedSession, setCopiedSession] = useState<string | null>(null)
  const logsEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      const handleKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") onClose()
      }
      window.addEventListener("keydown", handleKey)
      return () => window.removeEventListener("keydown", handleKey)
    }
  }, [open, onClose])

  // --- API logs ---

  const uniqueSessions = useMemo(() => {
    const sessions = new Map<string, number>()
    const source = tab === "api" ? logs : wsEvents
    for (const item of source) {
      const sid = "sessionId" in item ? item.sessionId : ""
      sessions.set(sid, (sessions.get(sid) || 0) + 1)
    }
    return sessions
  }, [logs, wsEvents, tab])

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (sessionFilter && log.sessionId !== sessionFilter) return false
      if (directionFilter !== "all" && log.direction !== directionFilter) return false
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const dataStr = JSON.stringify(log.data).toLowerCase()
        const matchesData = dataStr.includes(q)
        const matchesSession = log.sessionId.toLowerCase().includes(q)
        const matchesTimestamp = log.timestamp.toLowerCase().includes(q)
        if (!matchesData && !matchesSession && !matchesTimestamp) return false
      }
      return true
    })
  }, [logs, sessionFilter, directionFilter, searchQuery])

  const sessionGroups = useMemo(() => {
    const map = new Map<string, LogEntry[]>()
    for (const log of filteredLogs) {
      const arr = map.get(log.sessionId)
      if (arr) arr.push(log)
      else map.set(log.sessionId, [log])
    }
    const groups: SessionGroup[] = []
    for (const [sessionId, sessionLogs] of map) {
      groups.push({
        sessionId,
        logs: sessionLogs,
        firstTimestamp: sessionLogs[0].timestamp,
        lastTimestamp: sessionLogs[sessionLogs.length - 1].timestamp,
        requestCount: sessionLogs.filter((l) => l.direction === "request").length,
        responseCount: sessionLogs.filter((l) => l.direction === "response").length,
      })
    }
    return groups
  }, [filteredLogs])

  // --- WebSocket events ---

  const filteredWsEvents = useMemo(() => {
    return wsEvents.filter((ev) => {
      if (sessionFilter && ev.sessionId !== sessionFilter) return false
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const payloadStr = JSON.stringify(ev.payload).toLowerCase()
        const matchesPayload = payloadStr.includes(q)
        const matchesSession = ev.sessionId.toLowerCase().includes(q)
        const matchesAgent = ev.agentName.toLowerCase().includes(q)
        const matchesType = ev.eventType.toLowerCase().includes(q)
        if (!matchesPayload && !matchesSession && !matchesAgent && !matchesType) return false
      }
      return true
    })
  }, [wsEvents, sessionFilter, searchQuery])

  const wsSessionGroups = useMemo(() => {
    const map = new Map<string, WsEventRow[]>()
    for (const ev of filteredWsEvents) {
      const arr = map.get(ev.sessionId)
      if (arr) arr.push(ev)
      else map.set(ev.sessionId, [ev])
    }
    return Array.from(map.entries()).map(([sessionId, events]) => ({ sessionId, events }))
  }, [filteredWsEvents])

  // --- Shared actions ---

  function toggleSession(sid: string) {
    setExpandedSessions((prev) => {
      const next = new Set(prev)
      if (next.has(sid)) next.delete(sid)
      else next.add(sid)
      return next
    })
  }

  function togglePayload(id: number) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleWsPayload(id: number) {
    setExpandedWsIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function expandAll() {
    if (tab === "api") {
      setExpandedSessions(new Set(sessionGroups.map((g) => g.sessionId)))
      setExpandedIds(new Set(filteredLogs.map((l) => l.id)))
    } else {
      setExpandedSessions(new Set(wsSessionGroups.map((g) => g.sessionId)))
      setExpandedWsIds(new Set(filteredWsEvents.map((e) => e.id)))
    }
  }

  function collapseAll() {
    setExpandedSessions(new Set())
    setExpandedIds(new Set())
    setExpandedWsIds(new Set())
  }

  function copyLog(log: LogEntry) {
    navigator.clipboard.writeText(JSON.stringify(log.data, null, 2))
    setCopiedId(log.id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  function copyWsEvent(ev: WsEventRow) {
    navigator.clipboard.writeText(JSON.stringify(ev.payload, null, 2))
    setCopiedId(ev.id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  function copySessionId(sid: string) {
    navigator.clipboard.writeText(sid)
    setCopiedSession(sid)
    setTimeout(() => setCopiedSession(null), 1500)
  }

  function copyAllFiltered() {
    if (tab === "api") {
      const payload = sessionGroups.map((g) => ({
        sessionId: g.sessionId,
        entries: g.logs.map((l) => ({ timestamp: l.timestamp, direction: l.direction, data: l.data })),
      }))
      navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
    } else {
      const payload = wsSessionGroups.map((g) => ({
        sessionId: g.sessionId,
        events: g.events.map((e) => e.payload),
      }))
      navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
    }
  }

  // --- JSON renderer ---

  function renderJsonValue(value: unknown, indent: number): React.ReactNode[] {
    const pad = "  ".repeat(indent)
    const nodes: React.ReactNode[] = []

    if (value === null) {
      nodes.push(<span className="text-orange-600">null</span>)
    } else if (typeof value === "boolean") {
      nodes.push(<span className="text-orange-600">{String(value)}</span>)
    } else if (typeof value === "number") {
      nodes.push(<span className="text-blue-600">{String(value)}</span>)
    } else if (typeof value === "string") {
      const truncated = value.length > 300 ? value.slice(0, 300) + "..." : value
      nodes.push(<span className="text-green-700">"{truncated}"</span>)
    } else if (Array.isArray(value)) {
      if (value.length === 0) {
        nodes.push(<span className="text-foreground/70">{"[]"}</span>)
      } else {
        nodes.push(<span className="text-foreground/70">{"[\n"}</span>)
        value.forEach((item, i) => {
          nodes.push(<span>{pad}{"  "}</span>)
          nodes.push(...renderJsonValue(item, indent + 1))
          if (i < value.length - 1) nodes.push(<span className="text-foreground/70">,</span>)
          nodes.push(<span>{"\n"}</span>)
        })
        nodes.push(<span>{pad}</span>)
        nodes.push(<span className="text-foreground/70">{"]"}</span>)
      }
    } else if (typeof value === "object") {
      const entries = Object.entries(value as Record<string, unknown>)
      if (entries.length === 0) {
        nodes.push(<span className="text-foreground/70">{"{}"}</span>)
      } else {
        nodes.push(<span className="text-foreground/70">{"{\n"}</span>)
        entries.forEach(([k, v], i) => {
          nodes.push(<span>{pad}{"  "}</span>)
          nodes.push(<span className="text-red-600">"{k}"</span>)
          nodes.push(<span className="text-foreground/70">: </span>)
          nodes.push(...renderJsonValue(v, indent + 1))
          if (i < entries.length - 1) nodes.push(<span className="text-foreground/70">,</span>)
          nodes.push(<span>{"\n"}</span>)
        })
        nodes.push(<span>{pad}</span>)
        nodes.push(<span className="text-foreground/70">{"}"}</span>)
      }
    }
    return nodes
  }

  function SyntaxJson({ data }: { data: Record<string, unknown> }) {
    return (
      <pre className="px-4 py-3 overflow-x-auto whitespace-pre-wrap break-words font-mono text-xs leading-relaxed max-h-96 overflow-y-auto">
        {renderJsonValue(data, 0)}
      </pre>
    )
  }

  if (!open) return null

  const totalEntries = tab === "api" ? filteredLogs.length : filteredWsEvents.length
  const totalSessions = tab === "api" ? sessionGroups.length : wsSessionGroups.length
  const totalRaw = tab === "api" ? logs.length : wsEvents.length

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <ScrollText className="h-5 w-5 text-foreground" />
          <h1 className="text-lg font-semibold tracking-tight">Agent Interaction Logs</h1>
          <Badge variant="outline" className="text-xs">
            {totalSessions} {totalSessions === 1 ? "session" : "sessions"}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {totalEntries} {totalEntries === 1 ? "entry" : "entries"}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={copyAllFiltered} disabled={totalEntries === 0}>
            <Copy className="h-3.5 w-3.5 mr-1.5" />
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={onClear} disabled={totalRaw === 0}>
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            Clear All
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-0 px-6 border-b border-border shrink-0">
        <button
          type="button"
          onClick={() => { setTab("api"); setSessionFilter(null); setSearchQuery("") }}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
            tab === "api" ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          API Requests / Responses
          <Badge variant="outline" className="ml-2 text-[10px]">{logs.length}</Badge>
        </button>
        <button
          type="button"
          onClick={() => { setTab("websocket"); setSessionFilter(null); setSearchQuery(""); setDirectionFilter("all") }}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
            tab === "websocket" ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Radio className="h-3.5 w-3.5" />
          WebSocket Activity
          <Badge variant="outline" className="ml-1 text-[10px]">{wsEvents.length}</Badge>
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border bg-muted/30 shrink-0 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={tab === "api" ? "Search by session, timestamp, or content..." : "Search by session, agent name, event type, or content..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>

        {/* Session filter */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground font-medium">Session:</span>
          <button
            type="button"
            onClick={() => setSessionFilter(null)}
            className={`text-xs px-2 py-1 rounded-md transition-colors cursor-pointer ${
              !sessionFilter ? "bg-foreground text-background font-semibold" : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            All
          </button>
          {Array.from(uniqueSessions.entries()).map(([sid, count]) => (
            <span key={sid} className="inline-flex items-center rounded-md overflow-hidden border border-border">
              <button
                type="button"
                onClick={() => setSessionFilter(sessionFilter === sid ? null : sid)}
                className={`text-xs px-2 py-1 font-mono transition-colors cursor-pointer ${
                  sessionFilter === sid ? "bg-foreground text-background font-semibold" : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                ...{sid.slice(-8)} ({count})
              </button>
              <button
                type="button"
                onClick={() => {
                  if (sessionFilter === sid) setSessionFilter(null)
                  onDeleteSession(sid)
                }}
                className="px-1.5 py-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer border-l border-border"
                title="Delete this session's logs"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>

        {/* Direction filter (API tab only) */}
        {tab === "api" && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground font-medium">Type:</span>
            {(["all", "request", "response"] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDirectionFilter(d)}
                className={`text-xs px-2 py-1 rounded-md capitalize transition-colors cursor-pointer ${
                  directionFilter === d ? "bg-foreground text-background font-semibold" : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        )}

        {/* Expand/Collapse */}
        <div className="flex items-center gap-1 ml-auto">
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={expandAll} disabled={totalEntries === 0}>
            <ChevronDown className="h-3.5 w-3.5 mr-1" />
            Expand All
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={collapseAll}>
            <ChevronUp className="h-3.5 w-3.5 mr-1" />
            Collapse
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {tab === "api" ? (
          <ApiLogsContent
            sessionGroups={sessionGroups}
            logs={logs}
            filteredLogs={filteredLogs}
            expandedSessions={expandedSessions}
            expandedIds={expandedIds}
            copiedId={copiedId}
            copiedSession={copiedSession}
            toggleSession={toggleSession}
            togglePayload={togglePayload}
            copyLog={copyLog}
            copySessionId={copySessionId}
            onDeleteSession={onDeleteSession}
            setSearchQuery={setSearchQuery}
            setSessionFilter={setSessionFilter}
            setDirectionFilter={setDirectionFilter}
            SyntaxJson={SyntaxJson}
            logsEndRef={logsEndRef}
          />
        ) : (
          <WsEventsContent
            wsSessionGroups={wsSessionGroups}
            wsEvents={wsEvents}
            filteredWsEvents={filteredWsEvents}
            expandedSessions={expandedSessions}
            expandedWsIds={expandedWsIds}
            copiedId={copiedId}
            copiedSession={copiedSession}
            toggleSession={toggleSession}
            toggleWsPayload={toggleWsPayload}
            copyWsEvent={copyWsEvent}
            copySessionId={copySessionId}
            onDeleteSession={onDeleteSession}
            setSearchQuery={setSearchQuery}
            setSessionFilter={setSessionFilter}
            SyntaxJson={SyntaxJson}
            logsEndRef={logsEndRef}
          />
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// API logs content (unchanged from before, extracted to sub-component)
// ---------------------------------------------------------------------------

function ApiLogsContent({
  sessionGroups, logs, filteredLogs, expandedSessions, expandedIds, copiedId, copiedSession,
  toggleSession, togglePayload, copyLog, copySessionId, onDeleteSession,
  setSearchQuery, setSessionFilter, setDirectionFilter, SyntaxJson, logsEndRef,
}: {
  sessionGroups: SessionGroup[]
  logs: LogEntry[]
  filteredLogs: LogEntry[]
  expandedSessions: Set<string>
  expandedIds: Set<number>
  copiedId: number | null
  copiedSession: string | null
  toggleSession: (sid: string) => void
  togglePayload: (id: number) => void
  copyLog: (log: LogEntry) => void
  copySessionId: (sid: string) => void
  onDeleteSession: (sid: string) => void
  setSearchQuery: (q: string) => void
  setSessionFilter: (s: string | null) => void
  setDirectionFilter: (d: "all" | "request" | "response") => void
  SyntaxJson: React.ComponentType<{ data: Record<string, unknown> }>
  logsEndRef: React.RefObject<HTMLDivElement | null>
}) {
  if (sessionGroups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
        <ScrollText className="h-12 w-12" />
        {logs.length === 0 ? (
          <>
            <p className="text-base font-medium">No logs yet</p>
            <p className="text-sm">Interactions with the Movate agent will be recorded here.</p>
          </>
        ) : (
          <>
            <p className="text-base font-medium">No matching logs</p>
            <p className="text-sm">Try adjusting your search or filters.</p>
            <Button variant="outline" size="sm" onClick={() => { setSearchQuery(""); setSessionFilter(null); setDirectionFilter("all") }}>
              Clear Filters
            </Button>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-4 space-y-4">
      {sessionGroups.map((group) => {
        const isSessionOpen = expandedSessions.has(group.sessionId)
        return (
          <div key={group.sessionId} className="rounded-xl border border-border bg-card overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSession(group.sessionId)}
              className="w-full flex items-center gap-3 px-5 py-3.5 text-left cursor-pointer hover:bg-muted/50 transition-colors"
            >
              {isSessionOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
              <div className="flex flex-col gap-1 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Session</span>
                  <code className="text-xs font-mono font-semibold text-foreground truncate">{group.sessionId}</code>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span>{group.firstTimestamp} &ndash; {group.lastTimestamp}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
                  <ArrowUpRight className="h-2.5 w-2.5 mr-0.5" />{group.requestCount} req
                </Badge>
                <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">
                  <ArrowDownLeft className="h-2.5 w-2.5 mr-0.5" />{group.responseCount} res
                </Badge>
              </div>
            </button>
            {isSessionOpen && (
              <div className="border-t border-border">
                <div className="flex items-center gap-2 px-5 py-2 bg-muted/30 border-b border-border">
                  <code className="text-[11px] font-mono text-muted-foreground select-all flex-1 truncate">{group.sessionId}</code>
                  <button type="button" onClick={() => copySessionId(group.sessionId)} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                    {copiedSession === group.sessionId ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {copiedSession === group.sessionId ? "Copied" : "Copy ID"}
                  </button>
                  <span className="w-px h-4 bg-border" />
                  <button type="button" onClick={() => onDeleteSession(group.sessionId)} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-destructive transition-colors cursor-pointer">
                    <Trash2 className="h-3 w-3" />Delete Session
                  </button>
                </div>
                <div className="divide-y divide-border">
                  {group.logs.map((log, idx) => {
                    const isReq = log.direction === "request"
                    const isPayloadOpen = expandedIds.has(log.id)
                    return (
                      <div key={log.id}>
                        <button type="button" onClick={() => togglePayload(log.id)} className="w-full flex items-center gap-3 px-5 py-2.5 text-left cursor-pointer hover:bg-muted/30 transition-colors">
                          <span className="text-[10px] font-mono text-muted-foreground w-5 text-right shrink-0">#{idx + 1}</span>
                          <span className={`shrink-0 w-2 h-2 rounded-full ${isReq ? "bg-blue-500" : "bg-green-500"}`} />
                          <Badge variant="outline" className={`text-[10px] uppercase font-semibold shrink-0 ${isReq ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-green-50 text-green-700 border-green-200"}`}>
                            {log.direction}
                          </Badge>
                          <span className="font-mono text-xs text-muted-foreground shrink-0">{log.timestamp}</span>
                          <span className="text-xs text-muted-foreground truncate flex-1">{Object.keys(log.data).length} fields</span>
                          {isPayloadOpen ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                        </button>
                        {isPayloadOpen && (
                          <div className="bg-muted/10 border-t border-border/50">
                            <div className="flex items-center justify-between px-5 pt-2">
                              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Payload</span>
                              <button type="button" onClick={() => copyLog(log)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                                {copiedId === log.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                                {copiedId === log.id ? "Copied" : "Copy JSON"}
                              </button>
                            </div>
                            <div className="px-1"><SyntaxJson data={log.data} /></div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )
      })}
      <div ref={logsEndRef} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// WebSocket events content
// ---------------------------------------------------------------------------

function WsEventsContent({
  wsSessionGroups, wsEvents, filteredWsEvents, expandedSessions, expandedWsIds, copiedId, copiedSession,
  toggleSession, toggleWsPayload, copyWsEvent, copySessionId, onDeleteSession,
  setSearchQuery, setSessionFilter, SyntaxJson, logsEndRef,
}: {
  wsSessionGroups: { sessionId: string; events: WsEventRow[] }[]
  wsEvents: WsEventRow[]
  filteredWsEvents: WsEventRow[]
  expandedSessions: Set<string>
  expandedWsIds: Set<number>
  copiedId: number | null
  copiedSession: string | null
  toggleSession: (sid: string) => void
  toggleWsPayload: (id: number) => void
  copyWsEvent: (ev: WsEventRow) => void
  copySessionId: (sid: string) => void
  onDeleteSession: (sid: string) => void
  setSearchQuery: (q: string) => void
  setSessionFilter: (s: string | null) => void
  SyntaxJson: React.ComponentType<{ data: Record<string, unknown> }>
  logsEndRef: React.RefObject<HTMLDivElement | null>
}) {
  if (wsSessionGroups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
        <Radio className="h-12 w-12" />
        {wsEvents.length === 0 ? (
          <>
            <p className="text-base font-medium">No WebSocket activity yet</p>
            <p className="text-sm">Raw WebSocket events from the Lyzr agent will appear here.</p>
          </>
        ) : (
          <>
            <p className="text-base font-medium">No matching events</p>
            <p className="text-sm">Try adjusting your search or filters.</p>
            <Button variant="outline" size="sm" onClick={() => { setSearchQuery(""); setSessionFilter(null) }}>
              Clear Filters
            </Button>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-4 space-y-4">
      {wsSessionGroups.map((group) => {
        const isSessionOpen = expandedSessions.has(group.sessionId)
        const agents = [...new Set(group.events.map((e) => e.agentName).filter(Boolean))]
        return (
          <div key={group.sessionId} className="rounded-xl border border-border bg-card overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSession(group.sessionId)}
              className="w-full flex items-center gap-3 px-5 py-3.5 text-left cursor-pointer hover:bg-muted/50 transition-colors"
            >
              {isSessionOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
              <div className="flex flex-col gap-1 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Session</span>
                  <code className="text-xs font-mono font-semibold text-foreground truncate">{group.sessionId}</code>
                </div>
                {agents.length > 0 && (
                  <div className="text-[11px] text-muted-foreground truncate">{agents.join(", ")}</div>
                )}
              </div>
              <Badge variant="outline" className="text-[10px] shrink-0">
                <Radio className="h-2.5 w-2.5 mr-1" />
                {group.events.length} events
              </Badge>
            </button>

            {isSessionOpen && (
              <div className="border-t border-border">
                <div className="flex items-center gap-2 px-5 py-2 bg-muted/30 border-b border-border">
                  <code className="text-[11px] font-mono text-muted-foreground select-all flex-1 truncate">{group.sessionId}</code>
                  <button type="button" onClick={() => copySessionId(group.sessionId)} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                    {copiedSession === group.sessionId ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {copiedSession === group.sessionId ? "Copied" : "Copy ID"}
                  </button>
                  <span className="w-px h-4 bg-border" />
                  <button type="button" onClick={() => onDeleteSession(group.sessionId)} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-destructive transition-colors cursor-pointer">
                    <Trash2 className="h-3 w-3" />Delete Session
                  </button>
                </div>
                <div className="divide-y divide-border">
                  {group.events.map((ev, idx) => {
                    const isOpen = expandedWsIds.has(ev.id)
                    const levelStyle = getLevelStyle(ev.level)
                    const eventColor = getEventColor(ev.eventType)
                    const ts = ev.payload.timestamp as string | undefined
                    const timeLabel = ts ? new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" }).toLowerCase() : ""
                    const status = ev.payload.status as string | undefined

                    return (
                      <div key={ev.id}>
                        <button
                          type="button"
                          onClick={() => toggleWsPayload(ev.id)}
                          className="w-full flex items-center gap-2.5 px-5 py-2 text-left cursor-pointer hover:bg-muted/30 transition-colors"
                        >
                          <span className="text-[10px] font-mono text-muted-foreground w-5 text-right shrink-0">#{idx + 1}</span>
                          {/* Level badge */}
                          <Badge variant="outline" className={`text-[9px] uppercase font-bold shrink-0 px-1.5 py-0 ${levelStyle.bg} ${levelStyle.text} ${levelStyle.border}`}>
                            {ev.level || "LOG"}
                          </Badge>
                          {/* Event type */}
                          <span className={`text-[11px] font-mono font-medium shrink-0 ${eventColor}`}>
                            {ev.eventType || "event"}
                          </span>
                          {/* Timestamp */}
                          {timeLabel && (
                            <span className="text-[11px] font-mono text-muted-foreground shrink-0">{timeLabel}</span>
                          )}
                          {/* Status pill */}
                          {status && (
                            <Badge variant="outline" className={`text-[9px] shrink-0 px-1.5 py-0 ${
                              status === "completed" ? "bg-green-50 text-green-700 border-green-200"
                              : status === "in_progress" ? "bg-blue-50 text-blue-700 border-blue-200"
                              : "bg-gray-100 text-gray-600 border-gray-300"
                            }`}>
                              {status}
                            </Badge>
                          )}
                          {/* Agent name */}
                          {ev.agentName && (
                            <span className="text-[10px] text-muted-foreground truncate flex-1">{ev.agentName}</span>
                          )}
                          {!ev.agentName && <span className="flex-1" />}
                          {isOpen ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                        </button>
                        {isOpen && (
                          <div className="bg-muted/10 border-t border-border/50">
                            <div className="flex items-center justify-between px-5 pt-2">
                              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Raw Payload</span>
                              <button type="button" onClick={() => copyWsEvent(ev)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                                {copiedId === ev.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                                {copiedId === ev.id ? "Copied" : "Copy JSON"}
                              </button>
                            </div>
                            <div className="px-1"><SyntaxJson data={ev.payload} /></div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )
      })}
      <div ref={logsEndRef} />
    </div>
  )
}
