"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Clapperboard,
  FolderOpen,
  LayoutDashboard,
  Link2,
  LogOut,
  Settings,
  Sparkles,
  Upload,
  Wrench,
  FileText,
  Film,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/server/actions/auth";

const NAV_ITEMS = [
  {
    href: "/dashboard",
    label: "Dashboard",
    emoji: "📊",
    icon: LayoutDashboard,
  },
  {
    href: "/media",
    label: "Media Library",
    emoji: "🖼️",
    icon: FolderOpen,
  },
  {
    href: "/upload",
    label: "Upload",
    emoji: "⬆️",
    icon: Upload,
  },
  {
    href: "/auto-generate",
    label: "Auto Generate",
    emoji: "✨",
    icon: Sparkles,
  },
  {
    href: "/manual-builder",
    label: "Manual Builder",
    emoji: "🛠️",
    icon: Wrench,
  },
  {
    href: "/drafts",
    label: "Drafts",
    emoji: "📄",
    icon: FileText,
  },
  {
    href: "/settings",
    label: "Settings",
    emoji: "⚙️",
    icon: Settings,
  },
  {
    href: "/connections",
    label: "Connections",
    emoji: "🔗",
    icon: Link2,
  },
  {
    href: "/render-jobs",
    label: "Render Jobs",
    emoji: "🎬",
    icon: Film,
  },
] as const;

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "flex h-dvh shrink-0 flex-col border-r border-zinc-800 bg-zinc-950",
        "w-14 md:w-60",
      )}
    >
      {/* Brand */}
      <div
        className={cn(
          "flex items-center border-b border-zinc-800",
          "justify-center px-2 py-4 md:justify-start md:gap-3 md:px-5 md:py-6",
        )}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-black">
          <Clapperboard className="h-5 w-5" aria-hidden />
        </div>
        <div className="hidden md:block">
          <p className="text-lg font-bold tracking-tight text-white">TOLG</p>
          <p className="text-[11px] uppercase tracking-wider text-zinc-500">
            Content Generator
          </p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-1.5 md:p-3">
        {NAV_ITEMS.map(({ href, label, emoji, icon: Icon }) => {
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
                "flex items-center rounded-lg transition-colors",
                "justify-center px-0 py-2.5 text-[1.2rem] leading-none md:justify-start md:gap-2.5 md:px-3 md:py-2 md:text-sm",
                active
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100",
              )}
            >
              <span className="md:hidden" aria-hidden>
                {emoji}
              </span>
              <Icon className="hidden h-4 w-4 shrink-0 md:block" aria-hidden />
              <span className="hidden md:inline">{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-zinc-800 p-1.5 md:p-3">
        <form action={logoutAction}>
          <Button
            type="submit"
            variant="ghost"
            title="Log out"
            aria-label="Log out"
            className={cn(
              "w-full text-zinc-400",
              "justify-center px-0 md:justify-start md:gap-2.5",
            )}
          >
            <span className="text-[1.2rem] leading-none md:hidden" aria-hidden>
              🚪
            </span>
            <LogOut className="hidden h-4 w-4 md:block" aria-hidden />
            <span className="hidden md:inline">Log out</span>
          </Button>
        </form>
      </div>
    </aside>
  );
}
