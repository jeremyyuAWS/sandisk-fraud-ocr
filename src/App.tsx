import { useState, useCallback, useEffect } from "react"
import { Toaster } from "@/components/ui/sonner"
import { SupportPage } from "@/components/support/SupportPage"
import { AgentWorkspace } from "@/components/agent/AgentWorkspace"
import { ChatLauncher } from "@/components/chat/ChatLauncher"
import { ChatModal } from "@/components/chat/ChatModal"
import { ScenarioSwitcherPanel } from "@/components/support/ScenarioSwitcher"
import { LogsViewer } from "@/components/logs/LogsViewer"
import { OcrTestDialog } from "@/components/support/OcrTestDialog"
import { ValidatorTestDialog } from "@/components/support/ValidatorTestDialog"
import { useLyzrConfig } from "@/data/lyzr-config"
import { type LogEntry, type WsEventRow, persistLog, loadLogs, deleteLogsBySession, deleteAllLogs, persistWsEvent, loadWsEvents, deleteWsEventsBySession } from "@/data/agent-logs"
import { type ValidationResultRow, loadValidationResults, deleteValidationResultsBySession, deleteAllValidationResults } from "@/data/validation-results"
import type { AppView, ChatStep } from "@/data/app-state"

export default function App() {
  const [currentView, setCurrentView] = useState<AppView>("support")
  const [chatOpen, setChatOpen] = useState(false)
  const [chatStep, setChatStep] = useState<ChatStep>("closed")
  const [selectedScenario, setSelectedScenario] = useState("suspicious")
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [logsOpen, setLogsOpen] = useState(false)
  const [ocrTestOpen, setOcrTestOpen] = useState(false)
  const [validatorTestOpen, setValidatorTestOpen] = useState(false)
  const [agentLogs, setAgentLogs] = useState<LogEntry[]>([])
  const [wsEvents, setWsEvents] = useState<WsEventRow[]>([])
  const [validationResults, setValidationResults] = useState<ValidationResultRow[]>([])
  const { config: lyzrConfig, setConfig: setLyzrConfig, isConfigured: isLyzrConfigured, resetSession: resetLyzrSession } = useLyzrConfig()

  useEffect(() => {
    loadLogs().then(setAgentLogs)
    loadWsEvents().then(setWsEvents)
    loadValidationResults().then(setValidationResults)
  }, [])

  const addLog = useCallback((log: LogEntry) => {
    setAgentLogs((prev) => [...prev, log])
    persistLog(log)
  }, [])

  const addValidationResult = useCallback((result: ValidationResultRow) => {
    setValidationResults((prev) => [result, ...prev])
  }, [])

  const clearLogs = useCallback(() => {
    setAgentLogs([])
    deleteAllLogs()
    setValidationResults([])
    deleteAllValidationResults()
  }, [])

  const deleteSession = useCallback((sessionId: string) => {
    setAgentLogs((prev) => prev.filter((l) => l.sessionId !== sessionId))
    setWsEvents((prev) => prev.filter((e) => e.sessionId !== sessionId))
    deleteLogsBySession(sessionId)
    deleteWsEventsBySession(sessionId)
  }, [])

  const deleteValidationSession = useCallback((sessionId: string) => {
    setValidationResults((prev) => prev.filter((r) => r.sessionId !== sessionId))
    deleteValidationResultsBySession(sessionId)
  }, [])

  const handleRawWsEvent = useCallback((event: { sessionId: string; payload: Record<string, unknown>; eventType: string; level: string; agentName: string }) => {
    const row: WsEventRow = {
      id: Date.now() + Math.random(),
      sessionId: event.sessionId,
      payload: event.payload,
      eventType: event.eventType,
      level: event.level,
      agentName: event.agentName,
      createdAt: new Date().toISOString(),
    }
    setWsEvents((prev) => [...prev, row])
    persistWsEvent(event)
  }, [])

  const openChat = useCallback(() => {
    resetLyzrSession()
    setChatOpen(true)
    setChatStep("welcome")
  }, [resetLyzrSession])

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
      <Toaster position="bottom-left" />
      {currentView === "support" ? (
        <>
          <SupportPage
            settingsPanel={settingsPanel}
            settingsOpen={settingsOpen}
            onSettingsToggle={() => setSettingsOpen((v) => !v)}
            logCount={agentLogs.length}
            onLogsOpen={() => setLogsOpen(true)}
            onOcrTestOpen={() => setOcrTestOpen(true)}
            onValidatorTestOpen={() => setValidatorTestOpen(true)}
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
            onRawWsEvent={handleRawWsEvent}
            onValidationResult={addValidationResult}
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
        wsEvents={wsEvents}
        validationResults={validationResults}
        onClose={() => setLogsOpen(false)}
        onClear={clearLogs}
        onDeleteSession={deleteSession}
        onDeleteValidationSession={deleteValidationSession}
      />
      <OcrTestDialog
        open={ocrTestOpen}
        onOpenChange={setOcrTestOpen}
        onAddLog={addLog}
        lyzrConfig={lyzrConfig}
      />
      <ValidatorTestDialog
        open={validatorTestOpen}
        onOpenChange={setValidatorTestOpen}
        lyzrConfig={lyzrConfig}
        onAddLog={addLog}
      />
    </>
  )
}
