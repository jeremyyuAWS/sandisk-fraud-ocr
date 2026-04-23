import { useState, useCallback } from "react"
import { Toaster } from "@/components/ui/sonner"
import { SupportPage } from "@/components/support/SupportPage"
import { AgentWorkspace } from "@/components/agent/AgentWorkspace"
import { ChatLauncher } from "@/components/chat/ChatLauncher"
import { ChatModal } from "@/components/chat/ChatModal"
import { ScenarioSwitcher } from "@/components/support/ScenarioSwitcher"
import { useLyzrConfig } from "@/data/lyzr-config"
import { WelcomeModal } from "@/components/support/WelcomeModal"
import type { AppView, ChatStep } from "@/data/app-state"

export default function App() {
  const [currentView, setCurrentView] = useState<AppView>("support")
  const [chatOpen, setChatOpen] = useState(false)
  const [chatStep, setChatStep] = useState<ChatStep>("closed")
  const [selectedScenario, setSelectedScenario] = useState("suspicious")
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null)
  const { config: lyzrConfig, setConfig: setLyzrConfig, isConfigured: isLyzrConfigured } = useLyzrConfig()

  const openChat = useCallback(() => {
    setChatOpen(true)
    setChatStep("welcome")
  }, [])

  const closeChat = useCallback(() => {
    setChatOpen(false)
    setChatStep("closed")
  }, [])

  const handleEscalate = useCallback(() => {
    closeChat()
    setCurrentView("agent")
  }, [closeChat])

  const handleBackToSupport = useCallback(() => {
    setCurrentView("support")
    setChatStep("closed")
    setChatOpen(false)
  }, [])

  const handleScenarioChange = useCallback((id: string) => {
    setSelectedScenario(id)
    setChatOpen(false)
    setChatStep("closed")
  }, [])

  return (
    <>
      <WelcomeModal />
      <Toaster position="bottom-left" />
      <ScenarioSwitcher
        selected={selectedScenario}
        onSelect={handleScenarioChange}
        lyzrConfig={lyzrConfig}
        onLyzrConfigChange={setLyzrConfig}
      />
      {currentView === "support" ? (
        <>
          <SupportPage />
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
          />
        </>
      ) : (
        <AgentWorkspace
          selectedScenario={selectedScenario}
          uploadedImageUrl={uploadedImageUrl}
          onBack={handleBackToSupport}
        />
      )}
    </>
  )
}
