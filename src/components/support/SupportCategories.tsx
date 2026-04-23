import { ArrowRight } from "lucide-react"
import { toast } from "sonner"

const categories = [
  "Creator Series",
  "ProRes",
  "Gaming",
  "Photography",
  "Backups",
]

export function SupportCategories() {
  return (
    <section className="w-full border-b border-border bg-background">
      <div className="flex flex-wrap">
        {categories.map((cat, i) => (
          <button
            key={cat}
            onClick={() =>
              toast(`This would navigate to the ${cat} category.`)
            }
            className={`flex-1 min-w-[160px] flex items-center justify-center gap-2 py-4 text-sm font-medium text-foreground hover:text-sandisk-red transition-colors cursor-pointer ${
              i < categories.length - 1 ? "border-r border-border" : ""
            }`}
          >
            {cat}
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        ))}
      </div>
    </section>
  )
}
