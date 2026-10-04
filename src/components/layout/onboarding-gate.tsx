"use client";

/** Kept as a pass-through wrapper — no login/onboarding gate for single-user use. */
export function OnboardingGate({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
