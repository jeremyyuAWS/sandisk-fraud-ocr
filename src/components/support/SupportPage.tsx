import { Header } from "./Header"
import { HeroBanner } from "./HeroBanner"
import { SupportCategories } from "./SupportCategories"
import { BusinessImpact } from "./BusinessImpact"
import { toast } from "sonner"

const supportTopics = [
  { title: "Product Registration", desc: "Register your SanDisk product for warranty coverage" },
  { title: "Warranty Information", desc: "Check warranty status and eligibility" },
  { title: "Downloads & Drivers", desc: "Get the latest firmware and software" },
  { title: "Troubleshooting", desc: "Find solutions to common issues" },
  { title: "Returns & Replacements", desc: "Start a return or replacement request" },
  { title: "Contact Us", desc: "Reach our support team directly" },
]

interface SupportPageProps {
  settingsPanel?: React.ReactNode
  settingsOpen?: boolean
  onSettingsToggle?: () => void
  logCount?: number
  onLogsOpen?: () => void
  onOcrTestOpen?: () => void
  onValidatorTestOpen?: () => void
}

export function SupportPage({ settingsPanel, settingsOpen, onSettingsToggle, logCount, onLogsOpen, onOcrTestOpen, onValidatorTestOpen }: SupportPageProps) {
  return (
    <div className="min-h-screen bg-background">
      <Header settingsPanel={settingsPanel} settingsOpen={settingsOpen} onSettingsToggle={onSettingsToggle} logCount={logCount} onLogsOpen={onLogsOpen} onOcrTestOpen={onOcrTestOpen} onValidatorTestOpen={onValidatorTestOpen} />
      <HeroBanner />
      <SupportCategories />
      <section className="py-12 px-8 max-w-5xl mx-auto">
        <h2 className="text-2xl font-bold text-foreground text-center mb-2">
          How can we help?
        </h2>
        <p className="text-sm text-muted-foreground text-center mb-8">
          Select a topic below or use the chat widget for guided support.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {supportTopics.map((topic) => (
            <button
              key={topic.title}
              onClick={() => toast(`This would open the ${topic.title} section.`)}
              className="text-left border border-border rounded-xl p-5 hover:border-sandisk-red/40 hover:shadow-sm transition-all cursor-pointer bg-background"
            >
              <div className="font-semibold text-sm text-foreground mb-1">
                {topic.title}
              </div>
              <div className="text-xs text-muted-foreground">
                {topic.desc}
              </div>
            </button>
          ))}
        </div>
      </section>
      <BusinessImpact />
      <footer className="bg-background border-t border-border py-6 px-8 text-center">
        <p className="text-xs text-muted-foreground">
          SanDisk Fraudulent Returns OCR Concept Demo &mdash; For demonstration purposes only
        </p>
      </footer>
    </div>
  )
}
