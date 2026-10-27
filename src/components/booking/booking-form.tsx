"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { submitPublicEnquiry } from "@/server/actions/enquiries";
import { formatEur } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type BookingService = {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  priceCents: number | null;
};

export type IntakeField = {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  options?: string[];
};

export function BookingForm({
  businessSlug,
  businessName,
  accent,
  services,
  intakeFields,
  locationOptions,
}: {
  businessSlug: string;
  businessName: string;
  accent: string;
  services: BookingService[];
  intakeFields: IntakeField[];
  locationOptions: ("MOBILE" | "PREMISES")[];
}) {
  const [pending, startTransition] = useTransition();
  const [success, setSuccess] = useState(false);
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const intake: Record<string, string> = {};
    for (const field of intakeFields) {
      const v = String(fd.get(`intake_${field.key}`) || "");
      if (v) intake[field.key] = v;
    }

    startTransition(async () => {
      const result = await submitPublicEnquiry({
        businessSlug,
        serviceId: String(fd.get("serviceId")),
        name: String(fd.get("name")),
        email: String(fd.get("email")),
        phone: String(fd.get("phone") || "") || undefined,
        message: String(fd.get("message") || "") || undefined,
        preferredDate: String(fd.get("preferredDate") || "") || undefined,
        preferredTime: String(fd.get("preferredTime") || "") || undefined,
        locationType: (String(fd.get("locationType") || "") || undefined) as
          | "MOBILE"
          | "PREMISES"
          | undefined,
        locationText: String(fd.get("locationText") || "") || undefined,
        intake,
        website: String(fd.get("website") || "") || undefined,
      });

      if (result && "error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      setSuccess(true);
      toast.success("Request submitted");
    });
  }

  if (success) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/30 p-6 text-center">
        <p className="font-display text-2xl" style={{ color: accent }}>
          Thanks — we got your request
        </p>
        <p className="mt-3 text-sm text-white/65">
          This is an acknowledgement only. It is <strong>not</strong> a confirmed appointment.
          {businessName} will be in touch to confirm availability.
        </p>
        <Button
          className="mt-6"
          variant="secondary"
          onClick={() => setSuccess(false)}
          type="button"
        >
          Submit another request
        </Button>
      </div>
    );
  }

  if (services.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-white/55">
        No services are available right now.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {/* honeypot */}
      <input type="text" name="website" className="hidden" tabIndex={-1} autoComplete="off" />

      <div className="space-y-2">
        <Label htmlFor="serviceId">Service</Label>
        <select
          id="serviceId"
          name="serviceId"
          required
          value={serviceId}
          onChange={(e) => setServiceId(e.target.value)}
          className="h-11 w-full rounded-xl border border-white/10 bg-[#111113] px-3 text-sm"
        >
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} · {s.durationMinutes} min · {formatEur(s.priceCents)}
            </option>
          ))}
        </select>
        {services.find((s) => s.id === serviceId)?.description ? (
          <p className="text-xs text-white/45">
            {services.find((s) => s.id === serviceId)?.description}
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Your name</Label>
          <Input id="name" name="name" required minLength={2} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">Phone</Label>
        <Input id="phone" name="phone" type="tel" />
      </div>

      {intakeFields.map((field) => (
        <div key={field.key} className="space-y-2">
          <Label htmlFor={`intake_${field.key}`}>
            {field.label}
            {field.required ? " *" : ""}
          </Label>
          {field.type === "select" && field.options ? (
            <select
              id={`intake_${field.key}`}
              name={`intake_${field.key}`}
              required={field.required}
              className="h-11 w-full rounded-xl border border-white/10 bg-[#111113] px-3 text-sm"
              defaultValue=""
            >
              <option value="" disabled>
                Select…
              </option>
              {field.options.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          ) : (
            <Input
              id={`intake_${field.key}`}
              name={`intake_${field.key}`}
              required={field.required}
            />
          )}
        </div>
      ))}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="preferredDate">Preferred date</Label>
          <Input id="preferredDate" name="preferredDate" type="date" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="preferredTime">Preferred time</Label>
          <Input id="preferredTime" name="preferredTime" type="time" />
        </div>
      </div>

      {locationOptions.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="locationType">Location type</Label>
            <select
              id="locationType"
              name="locationType"
              className="h-11 w-full rounded-xl border border-white/10 bg-[#111113] px-3 text-sm"
              defaultValue={locationOptions[0]}
            >
              {locationOptions.map((o) => (
                <option key={o} value={o}>
                  {o === "MOBILE" ? "Mobile (we come to you)" : "Premises"}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="locationText">Location details</Label>
            <Input id="locationText" name="locationText" placeholder="Area or address" />
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="message">Message</Label>
        <Textarea id="message" name="message" rows={3} placeholder="Anything we should know?" />
      </div>

      <p className="text-xs text-white/45">
        Submitting sends a booking <strong>request</strong>, not a confirmed appointment.{" "}
        {businessName} will confirm separately.
      </p>

      <Button type="submit" className="w-full" disabled={pending} style={{ backgroundColor: accent }}>
        {pending ? "Sending…" : "Request booking"}
      </Button>
    </form>
  );
}
