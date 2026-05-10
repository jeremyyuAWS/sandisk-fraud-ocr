import { Search, ShoppingCart, User, Monitor } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

const navItems = [
  "SSDs",
  "Memory Cards",
  "USB Flash",
  "Embedded & Removable",
  "Accessories",
  "Shop",
  "Support",
]

interface HeaderProps {
  onAgentConsole?: () => void
}

export function Header({ onAgentConsole }: HeaderProps) {
  return (
    <header className="w-full">
      <div className="bg-foreground text-primary-foreground px-6 py-1.5 text-xs flex items-center justify-between">
        <span>
          New SanDisk Customers Sign Up and{" "}
          <button
            onClick={() => toast("This would open the signup page in production.")}
            className="underline font-semibold cursor-pointer"
          >
            Save 10% Off.
          </button>
        </span>
        <div className="flex items-center gap-4">
          <button
            onClick={() => toast("This would open the Consumer portal.")}
            className="underline cursor-pointer"
          >
            Consumer
          </button>
          <span className="text-muted-foreground">|</span>
          <button
            onClick={() => toast("This would open the Business portal.")}
            className="cursor-pointer"
          >
            Business
          </button>
        </div>
      </div>
      <div className="bg-background border-b border-border px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-10">
          <img src="/sandisk-logo.svg" alt="SanDisk" className="h-5" />
          <nav className="hidden lg:flex items-center gap-6">
            {navItems.map((item) => (
              <button
                key={item}
                onClick={() =>
                  toast(`This would navigate to the ${item} section.`)
                }
                className="text-sm text-foreground hover:text-sandisk-red transition-colors cursor-pointer flex items-center gap-1"
              >
                <span className="w-1.5 h-1.5 rounded-sm bg-sandisk-red" />
                {item}
              </button>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => toast("Account login would open here.")}
          >
            <User className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => toast("Shopping cart would open here.")}
          >
            <ShoppingCart className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => toast("Search overlay would open here.")}
          >
            <Search className="h-5 w-5" />
          </Button>
          {onAgentConsole && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onAgentConsole}
              title="Agent Console"
            >
              <Monitor className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
