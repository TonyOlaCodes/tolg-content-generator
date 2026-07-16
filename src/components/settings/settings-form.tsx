"use client";

import { useState, useTransition } from "react";

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
import { Switch } from "@/components/ui/switch";
import {
  SETTING_GROUPS,
  type AppSettingsMap,
} from "@/lib/constants/settings";
import { updateSettingsAction } from "@/server/actions/settings";

function humanizeKey(key: string): string {
  const leaf = key.split(".").pop() ?? key;
  return leaf
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

type SettingsFormProps = {
  initialSettings: AppSettingsMap;
};

export function SettingsForm({ initialSettings }: SettingsFormProps) {
  const [settings, setSettings] = useState<AppSettingsMap>(initialSettings);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function updateValue<K extends keyof AppSettingsMap>(
    key: K,
    value: AppSettingsMap[K],
  ) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      try {
        const result = await updateSettingsAction({ settings });
        if (result.ok) {
          setSettings(result.settings);
          setMessage("Settings saved.");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Settings
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Configure generation, text, reel, TikTok, and export defaults.
          </p>
        </div>
        <Button type="button" onClick={handleSave} disabled={pending}>
          {pending ? "Saving…" : "Save settings"}
        </Button>
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

      {Object.entries(SETTING_GROUPS).map(([groupKey, group]) => (
        <Card key={groupKey}>
          <CardHeader>
            <CardTitle>{group.label}</CardTitle>
            <CardDescription>
              Adjust defaults used when this feature ships.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {group.keys.map((key) => {
              const value = settings[key];
              const id = `setting-${key}`;

              if (typeof value === "boolean") {
                return (
                  <div
                    key={key}
                    className="flex items-center justify-between gap-4"
                  >
                    <Label htmlFor={id}>{humanizeKey(key)}</Label>
                    <Switch
                      id={id}
                      checked={value}
                      onCheckedChange={(checked) =>
                        updateValue(key, checked as AppSettingsMap[typeof key])
                      }
                    />
                  </div>
                );
              }

              if (typeof value === "number") {
                return (
                  <div key={key} className="space-y-2">
                    <Label htmlFor={id}>{humanizeKey(key)}</Label>
                    <Input
                      id={id}
                      type="number"
                      step="any"
                      value={value}
                      onChange={(e) =>
                        updateValue(
                          key,
                          Number(e.target.value) as AppSettingsMap[typeof key],
                        )
                      }
                    />
                  </div>
                );
              }

              return (
                <div key={key} className="space-y-2">
                  <Label htmlFor={id}>{humanizeKey(key)}</Label>
                  <Input
                    id={id}
                    type="text"
                    value={String(value)}
                    onChange={(e) =>
                      updateValue(
                        key,
                        e.target.value as AppSettingsMap[typeof key],
                      )
                    }
                  />
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}

      <Button type="button" onClick={handleSave} disabled={pending}>
        {pending ? "Saving…" : "Save settings"}
      </Button>
    </div>
  );
}
