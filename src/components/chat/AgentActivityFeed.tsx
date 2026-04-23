import { Loader as Loader2, CircleCheck } from "lucide-react"
import type { WsEvent } from "@/hooks/useLyzrWebSocket"

interface AgentActivityFeedProps {
  events: WsEvent[]
  isConnected: boolean
}

export function AgentActivityFeed({ events, isConnected }: AgentActivityFeedProps) {
  const hasEvents = events.length > 0

  return (
    <div className="space-y-1.5">
      {hasEvents ? (
        events.map((ev, i) => (
          <div key={i} className="flex items-start gap-2 animate-in fade-in slide-in-from-bottom-1 duration-300">
            {ev.status === "pending" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-sandisk-red shrink-0 mt-0.5" />
            ) : (
              <CircleCheck className="h-3.5 w-3.5 text-green-600 shrink-0 mt-0.5" />
            )}
            <span className="text-xs text-foreground leading-snug">{ev.text}</span>
          </div>
        ))
      ) : isConnected ? (
        <div className="flex items-center gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-sandisk-red" />
          <span className="text-xs text-muted-foreground">Connecting to agent...</span>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Processing...</span>
        </div>
      )}
    </div>
  )
}
