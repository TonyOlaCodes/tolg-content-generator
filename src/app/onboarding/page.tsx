"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Industry, BusinessType } from "@prisma/client";
import { toast } from "sonner";
import { createBusinessWorkspace } from "@/server/actions/business";
import { INDUSTRY_LABELS } from "@/lib/industries";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const result = await createBusinessWorkspace({
      name: String(fd.get("name")),
      industry: String(fd.get("industry")) as Industry,
      email: String(fd.get("email")),
      phone: String(fd.get("phone") || ""),
      county: String(fd.get("county") || ""),
      city: String(fd.get("city") || ""),
      address: String(fd.get("address") || ""),
      businessType: String(fd.get("businessType")) as BusinessType,
      timezone: "Europe/Dublin",
    });
    setLoading(false);
    if (!result.ok) {
      toast.error("Could not create workspace.");
      return;
    }
    toast.success("Workspace ready");
    router.push("/dashboard");
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-2xl">Set up your business</CardTitle>
          <p className="text-sm text-white/55">Takes a minute. You can change everything later in Settings.</p>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="name">Business name</Label>
              <Input id="name" name="name" required placeholder="CleanCar Mobile Detailing" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="industry">Industry</Label>
              <select id="industry" name="industry" className="h-11 w-full rounded-xl border border-white/10 bg-[#111113] px-3 text-sm" defaultValue={Industry.CAR_DETAILING}>
                {Object.entries(INDUSTRY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="email">Business email</Label>
                <Input id="email" name="email" type="email" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" name="phone" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="county">County</Label>
                <Input id="county" name="county" placeholder="Dublin" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">City / town</Label>
                <Input id="city" name="city" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address (optional)</Label>
              <Input id="address" name="address" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="businessType">Business type</Label>
              <select id="businessType" name="businessType" className="h-11 w-full rounded-xl border border-white/10 bg-[#111113] px-3 text-sm" defaultValue={BusinessType.MOBILE}>
                <option value={BusinessType.MOBILE}>Mobile</option>
                <option value={BusinessType.PREMISES}>Premises</option>
                <option value={BusinessType.BOTH}>Both</option>
              </select>
            </div>
            <Button className="w-full" disabled={loading}>{loading ? "Creating…" : "Create workspace"}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
