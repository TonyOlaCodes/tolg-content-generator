"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { submitContactRequest } from "@/server/actions/contact";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function ContactForm() {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await submitContactRequest({
        name: String(fd.get("name")),
        email: String(fd.get("email")),
        business: String(fd.get("business") || "") || undefined,
        message: String(fd.get("message")),
        website: String(fd.get("website") || "") || undefined,
      });
      if (result && "error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      setDone(true);
      toast.success("Message received — we'll be in touch.");
    });
  }

  if (done) {
    return (
      <p className="rounded-xl border border-white/10 bg-black/20 p-6 text-sm text-white/70">
        Thanks. Your message was stored. This is an MVP contact form — not a live support desk.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input type="text" name="website" className="hidden" tabIndex={-1} autoComplete="off" />
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" required minLength={2} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="business">Business (optional)</Label>
        <Input id="business" name="business" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="message">Message</Label>
        <Textarea id="message" name="message" required minLength={10} rows={5} />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Sending…" : "Send message"}
      </Button>
    </form>
  );
}
