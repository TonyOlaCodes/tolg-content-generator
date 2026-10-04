"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store/use-app-store";

export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const onboarded = useAppStore((s) => s.profile.onboarded);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!onboarded && !pathname?.startsWith("/onboarding")) {
      router.replace("/onboarding");
    }
  }, [onboarded, pathname, router]);

  if (!onboarded && !pathname?.startsWith("/onboarding")) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p className="text-[var(--text-secondary)]">Preparing onboarding…</p>
      </div>
    );
  }

  return <>{children}</>;
}
