import Link from "next/link";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0b0b0c]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="font-display text-xl tracking-tight">
          Detail<span className="text-[var(--accent)]">Flow</span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-white/70 md:flex">
          <Link href="/features" className="hover:text-white">Features</Link>
          <Link href="/industries" className="hover:text-white">Industries</Link>
          <Link href="/pricing" className="hover:text-white">Pricing</Link>
          <Link href="/demo" className="hover:text-white">Demo</Link>
          <Link href="/contact" className="hover:text-white">Contact</Link>
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">Log in</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/demo">Try the demo</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
