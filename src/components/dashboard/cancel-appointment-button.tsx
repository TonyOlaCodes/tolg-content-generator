"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { updateAppointmentStatus } from "@/server/actions/appointments";
import { Button } from "@/components/ui/button";

export function CancelAppointmentButton({
  businessId,
  appointmentId,
}: {
  businessId: string;
  appointmentId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      size="sm"
      variant="danger"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          try {
            await updateAppointmentStatus(businessId, appointmentId, "CANCELLED");
            toast.success("Appointment cancelled");
            router.refresh();
          } catch {
            toast.error("Could not cancel appointment");
          }
        });
      }}
    >
      Cancel
    </Button>
  );
}
