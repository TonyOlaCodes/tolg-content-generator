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
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/media", label: "Media Library", icon: FolderOpen },
  { href: "/upload", label: "Upload", icon: Upload },
  { href: "/auto-generate", label: "Auto Generate", icon: Sparkles },
  { href: "/manual-builder", label: "Manual Builder", icon: Wrench },
  { href: "/drafts", label: "Drafts", icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/connections", label: "Connections", icon: Link2 },
  { href: "/render-jobs", label: "Render Jobs", icon: Film },
] as const;

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950">
      <div className="flex items-center gap-3 px-5 py-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-black">
          <Clapperboard className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <p className="text-lg font-bold tracking-tight text-white">TOLG</p>
          <p className="text-[11px] uppercase tracking-wider text-zinc-500">
            Content Generator
          </p>
        </div>
      </div>

      <Separator />

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active =
            pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              {label}
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
            <LogOut className="h-4 w-4" aria-hidden />
            Log out
          </Button>
        </form>
      </div>
    </aside>
  );
}
