import { BottomNav } from "@/components/layout/bottom-nav";
import { OnboardingGate } from "@/components/layout/onboarding-gate";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <OnboardingGate>
      <div className="mx-auto min-h-dvh w-full max-w-lg">
        <main className="scroll-pb-nav px-4 pt-5">{children}</main>
        <BottomNav />
      </div>
    </OnboardingGate>
  );
}
