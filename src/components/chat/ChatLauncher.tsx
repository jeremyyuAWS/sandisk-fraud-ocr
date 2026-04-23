import { MessageCircle } from "lucide-react"

interface ChatLauncherProps {
  onClick: () => void
}

export function ChatLauncher({ onClick }: ChatLauncherProps) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-sandisk-red text-white shadow-lg hover:shadow-xl transition-shadow flex items-center justify-center cursor-pointer"
      aria-label="Open support chat"
    >
      <MessageCircle className="h-6 w-6" />
    </button>
  )
}
