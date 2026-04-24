import { Loader as Loader2, CircleCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { WsEvent } from "@/hooks/useLyzrWebSocket"

interface AgentActivityFeedProps {
  events: WsEvent[]
  isConnected: boolean
}

function getAgentLabel(name: string): { label: string; className: string } {
  const n = name.toLowerCase()
  if (n.includes("ocr"))
    return { label: "OCR Agent", className: "bg-amber-50 text-amber-700 border-amber-200" }
  if (n.includes("validator"))
    return { label: "Validator", className: "bg-teal-50 text-teal-700 border-teal-200" }
  if (n.includes("manager") || n.includes("returns"))
    return { label: "Manager", className: "bg-sky-50 text-sky-700 border-sky-200" }
  if (name)
    return { label: "Agent", className: "bg-gray-50 text-gray-600 border-gray-200" }
  return { label: "", className: "" }
}

export function AgentActivityFeed({ events, isConnected }: AgentActivityFeedProps) {
  const hasEvents = events.length > 0

  return (
    <div className="space-y-1.5">
      {hasEvents ? (
        events.map((ev, i) => {
          const agent = getAgentLabel(ev.agentName)
          return (
            <div key={i} className="flex items-start gap-2 animate-in fade-in slide-in-from-bottom-1 duration-300">
              {ev.status === "pending" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-sandisk-red shrink-0 mt-0.5" />
              ) : (
                <CircleCheck className="h-3.5 w-3.5 text-green-600 shrink-0 mt-0.5" />
              )}
              {agent.label && (
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 shrink-0 ${agent.className}`}>
                  {agent.label}
                </Badge>
              )}
              <span className="text-xs text-foreground leading-snug">{ev.text}</span>
            </div>
          )
        })
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
