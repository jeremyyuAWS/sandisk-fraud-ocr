import { useState, useCallback, useEffect } from "react"
import { Toaster } from "@/components/ui/sonner"
import { SupportPage } from "@/components/support/SupportPage"
import { AgentWorkspace } from "@/components/agent/AgentWorkspace"
import { ChatLauncher } from "@/components/chat/ChatLauncher"
import { ChatModal } from "@/components/chat/ChatModal"
import { getHealth } from "@/lib/api"

type AppView = "support" | "agent"

export default function App() {
  const [currentView, setCurrentView] = useState<AppView>("support")
  const [chatOpen, setChatOpen] = useState(false)

  useEffect(() => {
    getHealth().catch(() => {})
  }, [])

  const openChat = useCallback(() => {
    setChatOpen(true)
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

  return (
    <>
      <Toaster position="bottom-left" />
      {currentView === "support" ? (
        <>
          <SupportPage onAgentConsole={() => setCurrentView("agent")} />
          {!chatOpen && <ChatLauncher onClick={openChat} />}
          <ChatModal
            open={chatOpen}
            onClose={closeChat}
            onEscalate={handleEscalate}
          />
        </>
      ) : (
        <AgentWorkspace onBack={handleBackToSupport} />
      )}
    </>
  )
}
