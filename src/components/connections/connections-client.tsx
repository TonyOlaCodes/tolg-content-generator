"use client";

import { useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { upsertConnectionAction } from "@/server/actions/settings";

type EnvStatus = {
  configured: boolean;
  missing: string[];
};

type ConnectionRow = {
  provider: "OPENAI" | "TIKTOK" | "CLOUDINARY" | "RENDER_WORKER";
  isEnabled: boolean;
  configPublic: unknown;
  hasSecret: boolean;
  statusMessage: string | null;
  lastVerifiedAt: string | Date | null;
};

type ConnectionsClientProps = {
  connections: ConnectionRow[];
  envStatus: {
    blob: EnvStatus;
    openai: EnvStatus;
    tiktok: EnvStatus;
    renderWorker: EnvStatus;
  };
};

export function ConnectionsClient({
  connections,
  envStatus,
}: ConnectionsClientProps) {
  const openai = connections.find((c) => c.provider === "OPENAI");
  const [apiKey, setApiKey] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function saveOpenAiKey() {
    if (!apiKey.trim()) {
      setError("Enter an API key to save.");
      return;
    }
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        await upsertConnectionAction({
          provider: "OPENAI",
          isEnabled: true,
          secretValue: apiKey.trim(),
        });
        setApiKey("");
        setMessage("OpenAI API key saved (encrypted).");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save key");
      }
    });
  }

  const tiktokDisabledReason = !envStatus.tiktok.configured
    ? `TikTok OAuth requires env vars: ${envStatus.tiktok.missing.join(", ")}. Configure them before Connect works.`
    : "TikTok Connect lands in Phase 5. Credentials are present; OAuth wiring comes next.";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Connections
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          External services used by TOLG. Secrets are stored encrypted when
          saved here.
        </p>
      </div>

      {message ? (
        <p className="rounded-lg border border-emerald-900 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-300">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-red-900 bg-red-950/50 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle>OpenAI</CardTitle>
              <Badge variant={openai?.hasSecret ? "success" : "warning"}>
                {openai?.hasSecret ? "Key saved" : "Not configured"}
              </Badge>
            </div>
            <CardDescription>
              Used for AI tagging and hook generation (Phase 2+). You can store
              a key here or set OPENAI_API_KEY in the environment.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {envStatus.openai.configured ? (
              <p className="text-xs text-zinc-500">
                Env OPENAI_API_KEY is present as a fallback.
              </p>
            ) : (
              <p className="text-xs text-amber-400/90">
                OPENAI_API_KEY is not set in the environment.
              </p>
            )}
            {openai?.statusMessage ? (
              <p className="text-xs text-zinc-500">{openai.statusMessage}</p>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="openai-key">API key</Label>
              <Input
                id="openai-key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={
                  openai?.hasSecret ? "•••••••• (replace existing)" : "sk-…"
                }
                autoComplete="off"
              />
            </div>
            <Button
              type="button"
              onClick={saveOpenAiKey}
              disabled={pending || !apiKey.trim()}
              title={!apiKey.trim() ? "Enter a key first" : undefined}
            >
              {pending ? "Saving…" : "Save encrypted key"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle>TikTok</CardTitle>
              <Badge variant={envStatus.tiktok.configured ? "success" : "warning"}>
                {envStatus.tiktok.configured ? "Env ready" : "Env missing"}
              </Badge>
            </div>
            <CardDescription>
              OAuth connect and publish land in Phase 4. Buttons stay disabled
              until credentials and publishing are available.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!envStatus.tiktok.configured ? (
              <p className="text-sm text-amber-400/90">
                Missing: {envStatus.tiktok.missing.join(", ")}
              </p>
            ) : (
              <p className="text-sm text-zinc-400">
                Client credentials detected. Connect flow ships in Phase 4.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled title={tiktokDisabledReason}>
                Connect
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled
                title={tiktokDisabledReason}
              >
                Disconnect
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled
                title={tiktokDisabledReason}
              >
                Send
              </Button>
            </div>
            <p className="text-xs text-zinc-500">{tiktokDisabledReason}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle>Vercel Blob</CardTitle>
              <Badge
                variant={envStatus.blob.configured ? "success" : "danger"}
              >
                {envStatus.blob.configured ? "Configured" : "Required"}
              </Badge>
            </div>
            <CardDescription>
              Media storage for theme images, physique photos, and music.
              Originals are stored without cropping.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {envStatus.blob.configured ? (
              <p className="text-sm text-emerald-400/90">
                BLOB_READ_WRITE_TOKEN is present. Uploads use Vercel Blob.
              </p>
            ) : (
              <p className="text-sm text-red-300">
                Missing: {envStatus.blob.missing.join(", ")}. Create a Blob
                store in the Vercel project Storage tab.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle>Render Worker</CardTitle>
              <Badge
                variant={
                  envStatus.renderWorker.configured ? "success" : "warning"
                }
              >
                {envStatus.renderWorker.configured ? "URL set" : "Not set"}
              </Badge>
            </div>
            <CardDescription>
              Video render worker endpoint (Phase 4). Status reflects
              RENDER_WORKER_URL.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {envStatus.renderWorker.configured ? (
              <p className="text-sm text-emerald-400/90">
                RENDER_WORKER_URL is configured.
              </p>
            ) : (
              <p className="text-sm text-amber-400/90">
                RENDER_WORKER_URL is not set. Rendering will be unavailable until
                Phase 4 when a worker is configured.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
