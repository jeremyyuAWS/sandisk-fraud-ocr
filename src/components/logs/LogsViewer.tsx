import { useState, useRef, useEffect, useMemo } from "react"
import { X, Search, Copy, Check, ChevronDown, ChevronUp, ScrollText, Trash2, ListFilter as Filter } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import type { LogEntry } from "@/data/agent-logs"

interface LogsViewerProps {
  open: boolean
  logs: LogEntry[]
  onClose: () => void
  onClear: () => void
}

export function LogsViewer({ open, logs, onClose, onClear }: LogsViewerProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [sessionFilter, setSessionFilter] = useState<string | null>(null)
  const [directionFilter, setDirectionFilter] = useState<"all" | "request" | "response">("all")
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())
  const [copiedId, setCopiedId] = useState<number | null>(null)
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

  const uniqueSessions = useMemo(() => {
    const sessions = new Map<string, number>()
    for (const log of logs) {
      sessions.set(log.sessionId, (sessions.get(log.sessionId) || 0) + 1)
    }
    return sessions
  }, [logs])

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

  function toggleExpand(id: number) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function expandAll() {
    setExpandedIds(new Set(filteredLogs.map((l) => l.id)))
  }

  function collapseAll() {
    setExpandedIds(new Set())
  }

  function copyLog(log: LogEntry) {
    navigator.clipboard.writeText(JSON.stringify(log.data, null, 2))
    setCopiedId(log.id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  function copyAllFiltered() {
    const payload = filteredLogs.map((l) => ({
      timestamp: l.timestamp,
      direction: l.direction,
      sessionId: l.sessionId,
      data: l.data,
    }))
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <ScrollText className="h-5 w-5 text-foreground" />
          <h1 className="text-lg font-semibold tracking-tight">Agent Interaction Logs</h1>
          <Badge variant="outline" className="text-xs">
            {filteredLogs.length} of {logs.length}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={copyAllFiltered} disabled={filteredLogs.length === 0}>
            <Copy className="h-3.5 w-3.5 mr-1.5" />
            Export Filtered
          </Button>
          <Button variant="outline" size="sm" onClick={onClear} disabled={logs.length === 0}>
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            Clear All
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border bg-muted/30 shrink-0 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by session, timestamp, or content..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>

        {/* Session filter */}
        <div className="flex items-center gap-1.5">
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
            <button
              key={sid}
              type="button"
              onClick={() => setSessionFilter(sessionFilter === sid ? null : sid)}
              className={`text-xs px-2 py-1 rounded-md font-mono transition-colors cursor-pointer ${
                sessionFilter === sid ? "bg-foreground text-background font-semibold" : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              ...{sid.slice(-8)} ({count})
            </button>
          ))}
        </div>

        {/* Direction filter */}
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

        {/* Expand/Collapse */}
        <div className="flex items-center gap-1 ml-auto">
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={expandAll} disabled={filteredLogs.length === 0}>
            <ChevronDown className="h-3.5 w-3.5 mr-1" />
            Expand All
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={collapseAll}>
            <ChevronUp className="h-3.5 w-3.5 mr-1" />
            Collapse
          </Button>
        </div>
      </div>

      {/* Logs list */}
      <div className="flex-1 overflow-y-auto">
        {filteredLogs.length === 0 ? (
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchQuery("")
                    setSessionFilter(null)
                    setDirectionFilter("all")
                  }}
                >
                  Clear Filters
                </Button>
              </>
            )}
          </div>
        ) : (
          <div className="max-w-5xl mx-auto px-6 py-4 space-y-2">
            {filteredLogs.map((log) => {
              const isExpanded = expandedIds.has(log.id)
              const isReq = log.direction === "request"
              return (
                <div key={log.id} className="rounded-lg border border-border bg-card text-sm">
                  <button
                    type="button"
                    onClick={() => toggleExpand(log.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <span className={`shrink-0 w-2 h-2 rounded-full ${isReq ? "bg-blue-500" : "bg-green-500"}`} />
                    <span className="font-mono text-xs text-muted-foreground shrink-0 w-24">{log.timestamp}</span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] uppercase font-semibold shrink-0 ${
                        isReq
                          ? "bg-blue-50 text-blue-700 border-blue-200"
                          : "bg-green-50 text-green-700 border-green-200"
                      }`}
                    >
                      {log.direction}
                    </Badge>
                    <span className="font-mono text-xs text-muted-foreground truncate flex-1">
                      session: {log.sessionId}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                  </button>
                  {isExpanded && (
                    <div className="border-t border-border bg-muted/20">
                      <div className="flex justify-end px-4 pt-2">
                        <button
                          type="button"
                          onClick={() => copyLog(log)}
                          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        >
                          {copiedId === log.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                          {copiedId === log.id ? "Copied" : "Copy JSON"}
                        </button>
                      </div>
                      <pre className="px-4 py-3 overflow-x-auto whitespace-pre-wrap break-words font-mono text-xs leading-relaxed max-h-96 overflow-y-auto">
                        {JSON.stringify(log.data, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )
            })}
            <div ref={logsEndRef} />
          </div>
        )}
      </div>
    </div>
  )
}
