"use client";

import { useState } from "react";
import { exportSnapshot, validateBackup } from "@/money/backup";
import { replaceAll } from "@/money/store";
import { EMPTY_SNAPSHOT } from "@/money/types";
import type { MoneyApi } from "../MoneyApp";

export default function SettingsPage({ api, notify, onClose }: { api: MoneyApi; notify: (m: string) => void; onClose: () => void }) {
  const { snap, reload } = api;
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const download = () => {
    const json = exportSnapshot(snap);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `money-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify("Backup downloaded");
  };

  const restore = async (file: File) => {
    setError(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      return setError("That file is not valid JSON. Nothing was restored.");
    }
    const v = validateBackup(parsed);
    if (!v.ok) return setError(`${v.error} Nothing was restored.`);
    if (!window.confirm("Replace ALL current Money Tracker data with this backup? This cannot be undone.")) return;
    setBusy(true);
    try {
      await replaceAll(v.data);
      await reload();
      notify("Backup restored");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Restore failed. Nothing was changed.");
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (!window.confirm("Erase ALL Money Tracker data on this device? Export a backup first if you might need it.")) return;
    if (!window.confirm("Final confirmation: this permanently deletes every account, transaction and subscription here.")) return;
    setBusy(true);
    try {
      await replaceAll(EMPTY_SNAPSHOT);
      await reload();
      notify("All data erased");
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reset failed. Nothing was changed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="money-page">
      <section className="money-panel">
        <h2 className="money-h2">Your data stays on this device</h2>
        <p className="money-muted">
          Money Tracker stores everything in this browser. Clearing site data, using a private window or uninstalling the app can erase your records.
          Export a backup regularly. No financial data is sent to any server.
        </p>
      </section>

      <section className="money-panel">
        <h2 className="money-h2">Backup</h2>
        <button type="button" className="money-btn-primary" onClick={download}>Export JSON backup</button>
        <label className="money-field">
          <span>Restore from a backup file</span>
          <input type="file" accept="application/json,.json" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) void restore(f); e.target.value = ""; }} />
        </label>
        {error && <p className="money-error" role="alert">{error}</p>}
      </section>

      <section className="money-panel">
        <h2 className="money-h2">Erase data</h2>
        <button type="button" className="money-btn-danger" disabled={busy} onClick={reset}>Erase all data on this device</button>
      </section>
    </div>
  );
}
