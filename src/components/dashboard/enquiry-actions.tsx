"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { EnquiryStatus } from "@prisma/client";
import { toast } from "sonner";
import {
  addEnquiryNote,
  convertEnquiryToAppointment,
  updateEnquiryStatus,
} from "@/server/actions/enquiries";
import { ENQUIRY_STATUS_LABELS } from "@/lib/status-labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const STATUSES = Object.keys(EnquiryStatus) as EnquiryStatus[];

export function EnquiryActions({
  businessId,
  enquiryId,
  currentStatus,
  defaultDurationMinutes = 60,
}: {
  businessId: string;
  enquiryId: string;
  currentStatus: EnquiryStatus;
  defaultDurationMinutes?: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState(currentStatus);
  const [note, setNote] = useState("");
  const [startsAt, setStartsAt] = useState("");

  function refresh() {
    router.refresh();
  }

  function onStatusSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await updateEnquiryStatus(businessId, enquiryId, status);
        toast.success("Status updated");
        refresh();
      } catch {
        toast.error("Could not update status");
      }
    });
  }

  function onNoteSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim()) return;
    startTransition(async () => {
      try {
        await addEnquiryNote(businessId, enquiryId, note.trim());
        setNote("");
        toast.success("Note added");
        refresh();
      } catch {
        toast.error("Could not add note");
      }
    });
  }

  function onConvert(e: React.FormEvent) {
    e.preventDefault();
    if (!startsAt) {
      toast.error("Pick a start date and time");
      return;
    }
    startTransition(async () => {
      const result = await convertEnquiryToAppointment({
        businessId,
        enquiryId,
        startsAt: new Date(startsAt).toISOString(),
        durationMinutes: defaultDurationMinutes,
      });
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Converted to confirmed appointment");
      refresh();
    });
  }

  return (
    <div className="space-y-6">
      <form onSubmit={onStatusSubmit} className="space-y-3">
        <Label htmlFor="status">Update status</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            id="status"
            value={status}
            onChange={(e) => setStatus(e.target.value as EnquiryStatus)}
            className="h-11 flex-1 rounded-xl border border-white/10 bg-[#111113] px-3 text-sm"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {ENQUIRY_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <Button type="submit" disabled={pending} variant="secondary">
            Save status
          </Button>
        </div>
      </form>

      <form onSubmit={onNoteSubmit} className="space-y-3">
        <Label htmlFor="note">Add note</Label>
        <Textarea
          id="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Call notes, quote given, next steps…"
          rows={3}
        />
        <Button type="submit" disabled={pending || !note.trim()} variant="secondary" size="sm">
          Add note
        </Button>
      </form>

      <form onSubmit={onConvert} className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <div>
          <Label htmlFor="startsAt">Convert to appointment</Label>
          <p className="mt-1 text-xs text-white/45">
            Sets enquiry to Booked and creates a confirmed appointment (checks conflicts + buffer).
          </p>
        </div>
        <Input
          id="startsAt"
          type="datetime-local"
          value={startsAt}
          onChange={(e) => setStartsAt(e.target.value)}
          required
        />
        <Button type="submit" disabled={pending}>
          Confirm appointment
        </Button>
      </form>
    </div>
  );
}
