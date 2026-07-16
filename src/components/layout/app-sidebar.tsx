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
  const [expanded, setExpanded] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "0") {
      setExpanded(false);
    } else if (stored === "1") {
      setExpanded(true);
    } else {
      setExpanded(window.matchMedia("(min-width: 768px)").matches);
    }
    setReady(true);
  }, []);

  function toggle() {
    setExpanded((prev) => {
      const next = !prev;
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }

  if (!ready) {
    return <aside className="w-14 shrink-0" aria-hidden />;
  }

  return (
    <aside
      className={cn(
        "relative flex h-dvh shrink-0 flex-col overflow-hidden border-r border-zinc-800 bg-zinc-950",
        expanded ? "w-56 sm:w-60" : "w-14",
      )}
    >
      <div
        className={cn(
          "relative flex shrink-0 items-center border-b border-zinc-800",
          expanded
            ? "gap-3 px-4 py-5 sm:px-5 sm:py-6"
            : "justify-center px-2 py-4",
        )}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-black">
          <Clapperboard className="h-5 w-5" aria-hidden />
        </div>
        {expanded ? (
          <div className="min-w-0">
            <p className="text-lg font-bold tracking-tight text-white">TOLG</p>
            <p className="truncate text-[11px] uppercase tracking-wider text-zinc-500">
              Content Generator
            </p>
          </div>
        ) : null}

        <button
          type="button"
          onClick={toggle}
          title={expanded ? "Collapse toolbar" : "Expand toolbar"}
          aria-label={expanded ? "Collapse toolbar" : "Expand toolbar"}
          aria-expanded={expanded}
          className={cn(
            "absolute z-10 flex h-7 w-5 items-center justify-center rounded-md border border-zinc-700 bg-zinc-950 text-zinc-300 hover:bg-zinc-900 hover:text-white",
            "right-0 top-1/2 -translate-y-1/2 translate-x-1/2",
          )}
        >
          {expanded ? (
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          )}
        </button>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col justify-start gap-0.5 overflow-hidden p-1.5 md:p-3">
        {NAV_ITEMS.map(({ href, label, emoji }) => {
          const active =
            pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              title={label}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex shrink-0 items-center rounded-lg transition-colors",
                expanded
                  ? "gap-2.5 px-3 py-2 text-sm"
                  : "justify-center px-0 py-2.5 text-[1.2rem] leading-none",
                active
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100",
              )}
            >
              <span
                className={cn(
                  "shrink-0 leading-none",
                  expanded ? "text-base" : "text-[1.2rem]",
                )}
                aria-hidden
              >
                {emoji}
              </span>
              {expanded ? <span className="truncate">{label}</span> : null}
            </Link>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-zinc-800 p-1.5 md:p-3">
        <form action={logoutAction}>
          <Button
            type="submit"
            variant="ghost"
            title="Log out"
            aria-label="Log out"
            className={cn(
              "w-full text-zinc-400",
              expanded
                ? "justify-start gap-2.5"
                : "justify-center px-0",
            )}
          >
            <span className="text-base leading-none" aria-hidden>
              🚪
            </span>
            {expanded ? <span>Log out</span> : null}
          </Button>
        </form>
      </div>
    </aside>
  );
}
