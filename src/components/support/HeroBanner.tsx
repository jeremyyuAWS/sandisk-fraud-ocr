import { Button } from "@/components/ui/button"
import { toast } from "sonner"

export function HeroBanner() {
  return (
    <section className="relative w-full h-[480px] overflow-hidden bg-foreground">
      <img
        src="/hero-banner.webp"
        alt="SanDisk Extreme Pro memory cards"
        className="absolute inset-0 w-full h-full object-cover opacity-80"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
      <div className="relative z-10 flex flex-col justify-end h-full px-8 pb-16 max-w-3xl">
        <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight leading-tight mb-3">
          Elite Performance for Every Match
        </h1>
        <p className="text-base text-white/90 mb-6 max-w-xl">
          A high-performance SANDISK microSD card built for fans who want to
          save, share, and relive the defining moments of FIFA World Cup 2026.
        </p>
        <Button
          variant="outline"
          className="w-fit border-white text-white bg-transparent hover:bg-white hover:text-foreground"
          onClick={() => toast("This would open the product page.")}
        >
          Learn More
        </Button>
      </div>
    </section>
  )
}
