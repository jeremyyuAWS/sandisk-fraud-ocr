import { TrendingDown, Zap, Eye, Workflow } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

const impacts = [
  {
    icon: TrendingDown,
    title: "Reduce Fraudulent Approvals",
    description:
      "AI-powered OCR detects serial mismatches and counterfeit labels before replacements are shipped.",
  },
  {
    icon: Zap,
    title: "Speed Legitimate Claims",
    description:
      "Genuine products are verified instantly, reducing wait times and improving customer satisfaction.",
  },
  {
    icon: Eye,
    title: "AI-Generated Evidence",
    description:
      "Agents receive pre-analyzed OCR data, risk scores, and recommendations for faster case resolution.",
  },
  {
    icon: Workflow,
    title: "CRM Integration Ready",
    description:
      "Integrates into existing support and Service Cloud workflows without disrupting current processes.",
  },
]

export function BusinessImpact() {
  return (
    <section className="w-full bg-foreground text-primary-foreground py-16 px-8">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-2xl font-bold mb-2 text-center">
          Business Impact
        </h2>
        <p className="text-sm text-primary-foreground/70 text-center mb-10 max-w-xl mx-auto">
          How AI-powered product verification transforms SanDisk warranty operations
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {impacts.map((item) => (
            <Card
              key={item.title}
              className="bg-primary-foreground/10 border-primary-foreground/20"
            >
              <CardContent className="p-5 space-y-3">
                <item.icon className="h-6 w-6 text-sandisk-red" />
                <div className="font-semibold text-sm text-primary-foreground">
                  {item.title}
                </div>
                <p className="text-xs text-primary-foreground/70 leading-relaxed">
                  {item.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
