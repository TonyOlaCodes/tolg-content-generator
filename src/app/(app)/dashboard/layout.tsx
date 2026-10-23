import { redirect } from "next/navigation";
import { requireUser, getUserPrimaryBusiness } from "@/lib/tenant";
import { DashboardSidebar, MobileNav } from "@/components/dashboard/sidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const membership = await getUserPrimaryBusiness(user.id);
  if (!membership) redirect("/onboarding");

  const business = membership.business;

  return (
    <div className="flex min-h-dvh">
      <DashboardSidebar businessName={business.name} bookingSlug={business.slug} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-white/10 px-4 py-3 md:px-6">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-white/40">Workspace</p>
            <h1 className="font-display text-lg text-white md:text-xl">{business.name}</h1>
          </div>
          <p className="hidden text-sm text-white/45 sm:block">{user.email}</p>
        </header>
        <main className="flex-1 px-4 py-6 pb-24 md:px-6 md:pb-8">{children}</main>
        <MobileNav />
      </div>
    </div>
  );
}
