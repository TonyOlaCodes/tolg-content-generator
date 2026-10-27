"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { upsertService, deleteService } from "@/server/actions/services";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function ServiceForm({ businessId }: { businessId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [priceEur, setPriceEur] = useState("");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        const priceCents =
          priceEur.trim() === "" ? null : Math.round(Number(priceEur) * 100);
        if (priceCents != null && Number.isNaN(priceCents)) {
          toast.error("Enter a valid price");
          return;
        }
        await upsertService(businessId, {
          name,
          description: description || undefined,
          durationMinutes,
          priceCents,
          isActive: true,
        });
        setName("");
        setDescription("");
        setDurationMinutes(60);
        setPriceEur("");
        toast.success("Service saved");
        router.refresh();
      } catch {
        toast.error("Could not save service");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="service-name">Name</Label>
        <Input
          id="service-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={2}
          placeholder="Exterior Wash & Wax"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="service-desc">Description</Label>
        <Textarea
          id="service-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="duration">Duration (minutes)</Label>
          <Input
            id="duration"
            type="number"
            min={15}
            step={15}
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(Number(e.target.value))}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="price">Price (€, optional)</Label>
          <Input
            id="price"
            type="number"
            min={0}
            step={0.01}
            value={priceEur}
            onChange={(e) => setPriceEur(e.target.value)}
            placeholder="45.00"
          />
        </div>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Add service"}
      </Button>
    </form>
  );
}

export function DeactivateServiceButton({
  businessId,
  serviceId,
}: {
  businessId: string;
  serviceId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          try {
            await deleteService(businessId, serviceId);
            toast.success("Service deactivated");
            router.refresh();
          } catch {
            toast.error("Could not deactivate service");
          }
        });
      }}
    >
      Deactivate
    </Button>
  );
}
