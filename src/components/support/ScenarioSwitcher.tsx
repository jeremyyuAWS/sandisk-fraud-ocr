import { Eye, EyeOff } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { LyzrAgentConfig } from "@/data/lyzr-config"

const scenarioOptions = [
  { id: "genuine", label: "Genuine Product", color: "bg-green-50 text-green-700 border-green-200" },
  { id: "suspicious", label: "Suspicious / Fraudulent", color: "bg-red-50 text-red-700 border-red-200" },
  { id: "unverifiable", label: "Unverifiable Image", color: "bg-amber-50 text-amber-700 border-amber-200" },
]

interface ScenarioSwitcherProps {
  selected: string
  onSelect: (id: string) => void
  lyzrConfig: LyzrAgentConfig
  onLyzrConfigChange: (updates: Partial<LyzrAgentConfig>) => void
  onClose: () => void
}

export function ScenarioSwitcherPanel({ selected, onSelect, lyzrConfig, onLyzrConfigChange, onClose }: ScenarioSwitcherProps) {
  return (
    <div className="absolute right-0 top-full mt-2 bg-background border border-border rounded-lg shadow-lg min-w-[300px] z-[60]">
      <div className="flex items-center justify-between px-3 pt-3 pb-1">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Demo Controls
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={onClose}
        >
          x
        </Button>
      </div>
      <Tabs defaultValue="scenarios" className="px-3 pb-3">
        <TabsList className="w-full">
          <TabsTrigger value="scenarios" className="flex-1 text-xs">Scenarios</TabsTrigger>
          <TabsTrigger value="settings" className="flex-1 text-xs">Movate Agents</TabsTrigger>
        </TabsList>
        <TabsContent value="scenarios" className="mt-2">
          <div className="space-y-1.5">
            {scenarioOptions.map((opt) => (
              <button
                key={opt.id}
                onClick={() => {
                  onSelect(opt.id)
                  onClose()
                }}
                className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs flex items-center justify-between transition-colors cursor-pointer ${
                  selected === opt.id
                    ? "bg-secondary font-medium"
                    : "hover:bg-secondary/50"
                }`}
              >
                {opt.label}
                {selected === opt.id && (
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${opt.color}`}>
                    Active
                  </Badge>
                )}
              </button>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="settings" className="mt-2">
          <LyzrSettingsPanel config={lyzrConfig} onChange={onLyzrConfigChange} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function LyzrSettingsPanel({
  config,
  onChange,
}: {
  config: LyzrAgentConfig
  onChange: (updates: Partial<LyzrAgentConfig>) => void
}) {
  const [showApiKey, setShowApiKey] = useState(false)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium">Enable Movate Agent</p>
          <p className="text-[10px] text-muted-foreground">Power chat with a live Movate AI agent</p>
        </div>
        <Switch
          checked={config.enabled}
          onCheckedChange={(checked: boolean) => onChange({ enabled: checked })}
          size="sm"
        />
      </div>
      <Separator />
      <div className="space-y-2.5">
        <div className="space-y-1">
          <Label htmlFor="lyzr-api-key" className="text-xs">API Key</Label>
          <div className="relative">
            <Input
              id="lyzr-api-key"
              type={showApiKey ? "text" : "password"}
              placeholder="sk-default-..."
              value={config.apiKey}
              onChange={(e) => onChange({ apiKey: e.target.value })}
              className="h-7 text-xs font-mono pr-8"
            />
            <button
              type="button"
              onClick={() => setShowApiKey((v) => !v)}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showApiKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="lyzr-agent-id" className="text-xs">Agent ID</Label>
          <Input
            id="lyzr-agent-id"
            placeholder="69ea29fa48859962fb807a69"
            value={config.agentId}
            onChange={(e) => onChange({ agentId: e.target.value })}
            className="h-7 text-xs font-mono"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="lyzr-user-id" className="text-xs">User ID</Label>
          <Input
            id="lyzr-user-id"
            placeholder="jeremy.yu@movate.com"
            value={config.userId}
            onChange={(e) => onChange({ userId: e.target.value })}
            className="h-7 text-xs"
          />
        </div>
      </div>
      {config.enabled && config.apiKey && config.agentId && config.userId && (
        <Badge variant="outline" className="w-fit bg-green-50 text-green-700 border-green-200 text-[10px]">
          Agent Connected
        </Badge>
      )}
      {config.enabled && (!config.apiKey || !config.agentId || !config.userId) && (
        <Badge variant="outline" className="w-fit bg-amber-50 text-amber-700 border-amber-200 text-[10px]">
          Missing required fields
        </Badge>
      )}
    </div>
  )
}
