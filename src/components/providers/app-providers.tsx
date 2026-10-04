"use client";

import { useEffect } from "react";
import { useAppStore } from "@/lib/store/use-app-store";

export function AppProviders({ children }: { children: React.ReactNode }) {
  const hydrate = useAppStore((s) => s.hydrate);
  const hydrated = useAppStore((s) => s.hydrated);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  if (!hydrated) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="animate-fade-up text-center">
          <p className="font-display text-2xl tracking-tight">Freestyle Lab</p>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">Loading your training desk…</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
