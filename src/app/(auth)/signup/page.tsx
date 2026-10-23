"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { registerUser } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SignupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const payload = {
      name: String(fd.get("name")),
      email: String(fd.get("email")),
      password: String(fd.get("password")),
    };
    const result = await registerUser(payload);
    if (result.error) {
      toast.error(result.error);
      setLoading(false);
      return;
    }
    await signIn("credentials", { ...payload, redirect: false });
    setLoading(false);
    router.push("/onboarding");
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md items-center px-4 py-12">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="font-display text-2xl">Create your DetailFlow account</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="name">Your name</Label>
              <Input id="name" name="name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Work email</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password (min 8 characters)</Label>
              <Input id="password" name="password" type="password" minLength={8} required />
            </div>
            <Button className="w-full" disabled={loading}>{loading ? "Creating…" : "Sign up"}</Button>
          </form>
          <p className="mt-4 text-sm text-white/55">
            Already have an account? <Link className="text-[var(--accent)]" href="/login">Log in</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
