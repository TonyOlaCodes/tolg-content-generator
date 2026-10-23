"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { resetDemoBusiness } from "@/server/actions/demo";
import { Button } from "@/components/ui/button";

export function ResetDemoButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="secondary"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const result = await resetDemoBusiness();
          if (result && "error" in result && result.error) {
            toast.error(result.error);
            return;
          }
          toast.success("Demo data reset");
          router.refresh();
        });
      }}
    >
      {pending ? "Resetting…" : "Reset demo data"}
    </Button>
  );
}
