"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  LogOut,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/server/actions/auth";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", emoji: "📊" },
  { href: "/media", label: "Media Library", emoji: "🖼️" },
  { href: "/upload", label: "Upload", emoji: "⬆️" },
  { href: "/auto-generate", label: "Auto Generate", emoji: "✨" },
  { href: "/manual-builder", label: "Manual Builder", emoji: "🛠️" },
  { href: "/drafts", label: "Drafts", emoji: "📄" },
  { href: "/settings", label: "Settings", emoji: "⚙️" },
  { href: "/connections", label: "Connections", emoji: "🔗" },
  { href: "/render-jobs", label: "Render Jobs", emoji: "🎬" },
] as const;

const STORAGE_KEY = "tolg-sidebar-open";

export function AppSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "0") {
      setOpen(false);
    } else if (stored === "1") {
      setOpen(true);
    } else {
      setOpen(window.matchMedia("(min-width: 768px)").matches);
    }
    setReady(true);
  }, []);

  function toggle() {
    setOpen((prev) => {
      const next = !prev;
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }

  if (!ready) {
    return <aside className="w-0 shrink-0 md:w-60" aria-hidden />;
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={toggle}
        title="Open toolbar"
        aria-label="Open toolbar"
        className="fixed left-2 top-2 z-50 flex h-8 w-8 items-center justify-center rounded-md border border-zinc-700 bg-zinc-950 text-zinc-300 shadow-lg hover:bg-zinc-900 hover:text-white"
      >
        <ChevronRight className="h-4 w-4" aria-hidden />
      </button>
    );
  }

  return (
    <aside className="relative flex h-dvh w-56 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950 sm:w-60">
      <div className="relative flex items-center gap-3 border-b border-zinc-800 px-4 py-5 sm:px-5 sm:py-6">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-black">
          <Clapperboard className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-lg font-bold tracking-tight text-white">TOLG</p>
          <p className="truncate text-[11px] uppercase tracking-wider text-zinc-500">
            Content Generator
          </p>
        </div>

        <button
          type="button"
          onClick={toggle}
          title="Close toolbar"
          aria-label="Close toolbar"
          className="absolute right-0 top-1/2 z-10 flex h-7 w-5 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-md border border-zinc-700 bg-zinc-950 text-zinc-300 hover:bg-zinc-900 hover:text-white"
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
        {NAV_ITEMS.map(({ href, label, emoji }) => {
          const active =
            pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100",
              )}
            >
              <span className="text-base leading-none" aria-hidden>
                {emoji}
              </span>
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-zinc-800 p-3">
        <form action={logoutAction}>
          <Button
            type="submit"
            variant="ghost"
            className="w-full justify-start gap-2.5 text-zinc-400"
          >
            <span className="text-base leading-none" aria-hidden>
              🚪
            </span>
            Log out
          </Button>
        </form>
      </div>
    </aside>
  );
}
