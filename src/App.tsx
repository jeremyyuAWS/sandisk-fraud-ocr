import { useState, useCallback } from "react"
import { Toaster } from "@/components/ui/sonner"
import { SupportPage } from "@/components/support/SupportPage"
import { AgentWorkspace } from "@/components/agent/AgentWorkspace"
import { ChatLauncher } from "@/components/chat/ChatLauncher"
import { ChatModal } from "@/components/chat/ChatModal"
import { ScenarioSwitcherPanel } from "@/components/support/ScenarioSwitcher"
import { LogsViewer } from "@/components/logs/LogsViewer"
import { useLyzrConfig } from "@/data/lyzr-config"
import type { LogEntry } from "@/data/agent-logs"
import { WelcomeModal } from "@/components/support/WelcomeModal"
import type { AppView, ChatStep } from "@/data/app-state"

export default function App() {
  const [currentView, setCurrentView] = useState<AppView>("support")
  const [chatOpen, setChatOpen] = useState(false)
  const [chatStep, setChatStep] = useState<ChatStep>("closed")
  const [selectedScenario, setSelectedScenario] = useState("suspicious")
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [logsOpen, setLogsOpen] = useState(false)
  const [agentLogs, setAgentLogs] = useState<LogEntry[]>([])
  const { config: lyzrConfig, setConfig: setLyzrConfig, isConfigured: isLyzrConfigured, resetSession: resetLyzrSession } = useLyzrConfig()

  const addLog = useCallback((log: LogEntry) => {
    setAgentLogs((prev) => [...prev, log])
  }, [])

  const clearLogs = useCallback(() => {
    setAgentLogs([])
  }, [])

  const openChat = useCallback(() => {
    setChatOpen(true)
    setChatStep((prev) => (prev === "closed" ? "welcome" : prev))
  }, [])

  const closeChat = useCallback(() => {
    setChatOpen(false)
  }, [])

  const handleEscalate = useCallback(() => {
    closeChat()
    setCurrentView("agent")
  }, [closeChat])

  const handleBackToSupport = useCallback(() => {
    setCurrentView("support")
    setChatOpen(false)
  }, [])

  const handleScenarioChange = useCallback((id: string) => {
    setSelectedScenario(id)
    setChatOpen(false)
    setChatStep("welcome")
  }, [])

  const settingsPanel = (
    <ScenarioSwitcherPanel
      selected={selectedScenario}
      onSelect={handleScenarioChange}
      lyzrConfig={lyzrConfig}
      onLyzrConfigChange={setLyzrConfig}
      onClose={() => setSettingsOpen(false)}
    />
  )

  return (
    <>
      <WelcomeModal />
      <Toaster position="bottom-left" />
      {currentView === "support" ? (
        <>
          <SupportPage
            settingsPanel={settingsPanel}
            settingsOpen={settingsOpen}
            onSettingsToggle={() => setSettingsOpen((v) => !v)}
            logCount={agentLogs.length}
            onLogsOpen={() => setLogsOpen(true)}
          />
          {!chatOpen && <ChatLauncher onClick={openChat} />}
          <ChatModal
            open={chatOpen}
            step={chatStep}
            selectedScenario={selectedScenario}
            onClose={closeChat}
            onStepChange={setChatStep}
            onEscalate={handleEscalate}
            onImageUploaded={setUploadedImageUrl}
            lyzrConfig={lyzrConfig}
            isLyzrConfigured={isLyzrConfigured}
            onResetSession={resetLyzrSession}
            onAddLog={addLog}
          />
        </>
      ) : (
        <AgentWorkspace
          selectedScenario={selectedScenario}
          uploadedImageUrl={uploadedImageUrl}
          onBack={handleBackToSupport}
        />
      )}
      <LogsViewer
        open={logsOpen}
        logs={agentLogs}
        onClose={() => setLogsOpen(false)}
        onClear={clearLogs}
      />
    </>
  )
}
