"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Home, Mic2, Target, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/learn", label: "Learn", icon: BookOpen },
  { href: "/practice", label: "Practice", icon: Target },
  { href: "/freestyle", label: "Freestyle", icon: Mic2 },
  { href: "/progress", label: "Progress", icon: TrendingUp },
];

export function BottomNav() {
  const pathname = usePathname();
  const hide =
    pathname?.startsWith("/freestyle/session") ||
    pathname?.startsWith("/onboarding") ||
    pathname?.includes("/distraction");

  if (hide) return null;

  return (
    <nav className="glass-bar fixed inset-x-0 bottom-0 z-50 pb-[var(--safe-bottom)]">
      <div className="mx-auto flex h-[var(--nav-height)] max-w-lg items-stretch justify-between px-2">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname?.startsWith(`${href}/`);
          const isFreestyle = href === "/freestyle";
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative flex flex-1 flex-col items-center justify-center gap-1 text-[11px] transition",
                active ? "text-white" : "text-[var(--text-muted)]",
              )}
            >
              <span
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-2xl transition",
                  isFreestyle && "bg-[var(--accent)] text-black shadow-[0_0_24px_rgba(61,222,168,0.35)]",
                  !isFreestyle && active && "bg-white/10",
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={active || isFreestyle ? 2.4 : 2} />
              </span>
              <span className={cn(isFreestyle && "font-semibold text-[var(--accent)]")}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
