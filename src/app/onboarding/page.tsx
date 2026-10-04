import { redirect } from "next/navigation";

/** Onboarding disabled — go straight into the app. */
export default function OnboardingPage() {
  redirect("/home");
}
