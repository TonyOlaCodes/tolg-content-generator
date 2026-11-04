"use client";

import { useState } from "react";
import { exportSnapshot, validateBackup } from "@/money/backup";
import { replaceAll } from "@/money/store";
import { EMPTY_SNAPSHOT } from "@/money/types";
import { todayISO } from "@/money/money";
import type { MoneyApi } from "../MoneyApp";
import { ErrorLine } from "../ui";

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
    a.download = `money-backup-${todayISO()}.json`;
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
    const validated = validateBackup(parsed);
    if (!validated.ok) return setError(`${validated.error} Nothing was restored.`);
    if (!window.confirm("Replace ALL current Money Tracker data with this backup? This cannot be undone.")) return;
    setBusy(true);
    try {
      await replaceAll(validated.data);
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
    if (!window.confirm("Final confirmation: this permanently deletes every account, transaction, bill and IOU here.")) return;
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
    <div className="mm-page">
      <header className="mm-page-head">
        <div>
          <p className="mm-kicker">Money Tracker</p>
          <h1>Settings</h1>
        </div>
      </header>

      <section className="mm-panel">
        <h2 className="mm-subhead">Your data stays on this device</h2>
        <p className="mm-caption">
          Everything is stored locally in this browser. Clearing site data or using a private window can erase your records, so export a backup
          regularly. No account data is sent to a server.
        </p>
      </section>

      <section className="mm-panel mm-form">
        <h2 className="mm-subhead">Backup</h2>
        <button type="button" className="mm-primary mm-wide" onClick={download}>
          Export backup
        </button>
        <label className="mm-field">
          <span>Restore from a backup file</span>
          <input
            className="mm-input"
            type="file"
            accept="application/json,.json"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void restore(file);
              event.target.value = "";
            }}
          />
        </label>
        <p className="mm-caption">Backups include accounts, pockets, transactions, bills, scheduled incoming money and IOUs. Older backups are upgraded safely.</p>
        <ErrorLine message={error} />
      </section>

      <section className="mm-panel mm-form">
        <h2 className="mm-subhead">Erase data</h2>
        <p className="mm-caption">This removes everything from this device. There is no automatic cloud copy.</p>
        <button type="button" className="mm-secondary mm-wide" style={{ color: "#ff8b9d" }} disabled={busy} onClick={() => void reset()}>
          Erase all data on this device
        </button>
      </section>
    </div>
  );
}
