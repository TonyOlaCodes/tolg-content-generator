"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3, CalendarDays, CreditCard, Inbox, LayoutDashboard, Settings, Users, Wrench, Bot, UsersRound,
} from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/enquiries", label: "Enquiries", icon: Inbox },
  { href: "/dashboard/bookings", label: "Bookings", icon: CalendarDays },
  { href: "/dashboard/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/dashboard/customers", label: "Customers", icon: Users },
  { href: "/dashboard/services", label: "Services", icon: Wrench },
  { href: "/dashboard/automations", label: "Automations", icon: Bot },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/team", label: "Team", icon: UsersRound },
  { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function DashboardSidebar({ businessName, bookingSlug }: { businessName: string; bookingSlug: string }) {
  const pathname = usePathname();
  return (
    <aside className="hidden w-64 shrink-0 border-r border-white/10 bg-black/30 p-4 md:flex md:flex-col">
      <Link href="/dashboard" className="font-display text-xl">Detail<span className="text-[var(--accent)]">Flow</span></Link>
      <p className="mt-1 truncate text-xs text-white/45">{businessName}</p>
      <nav className="mt-6 flex-1 space-y-1">
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition",
                active ? "bg-[var(--accent)]/15 text-[var(--accent)]" : "text-white/70 hover:bg-white/5 hover:text-white",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
      <Link href={`/book/${bookingSlug}`} className="rounded-xl border border-white/10 px-3 py-2 text-xs text-white/60 hover:text-white">
        Public page: /book/{bookingSlug}
      </Link>
    </aside>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  const items = links.slice(0, 5);
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-white/10 bg-[#0b0b0c]/95 px-2 py-2 backdrop-blur md:hidden">
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
        return (
          <Link key={href} href={href} className={cn("flex flex-1 flex-col items-center gap-1 py-1 text-[10px]", active ? "text-[var(--accent)]" : "text-white/55")}>
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
