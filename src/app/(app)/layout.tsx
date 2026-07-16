import { redirect } from "next/navigation";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { auth } from "@/lib/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-dvh bg-background">
      <AppSidebar />
      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-4 md:px-6 md:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
