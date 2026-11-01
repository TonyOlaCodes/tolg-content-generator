"use client";

import { useRef, useState } from "react";
import type { GroceriesApi } from "../GroceriesApp";
import { exportSnapshot, validateBackup } from "@/groceries/backup";
import { replaceAll } from "@/groceries/store";
import { EMPTY_SNAPSHOT } from "@/groceries/model";
import { ensureDefaults } from "../defaults";

/** Backup, restore and reset. Everything here is local; nothing leaves the device. */
export function BackupSheet({ api, onClose }: { api: GroceriesApi; onClose: () => void }) {
  const { snap, notify } = api;
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const download = () => {
    const text = exportSnapshot(snap);
    const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `groceries-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify("Backup downloaded");
  };

  const restore = async (file: File) => {
    setError(null);
    const parsed = validateBackup(await file.text());
    if (!parsed.ok) return setError(parsed.error);
    if (!window.confirm("Restoring replaces ALL current Groceries data on this device with the backup. Continue?")) return;
    setBusy(true);
    try {
      await replaceAll(parsed.data);
      await ensureDefaults();
      await api.act(() => ({ ops: [] }));
      notify("Backup restored");
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Restore failed. Nothing was changed.");
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (!window.confirm("Delete ALL Groceries data stored on this device? Export a backup first if you might need it.")) return;
    if (!window.confirm("This cannot be undone. Clearing browser data also removes these records. Delete everything now?")) return;
    setBusy(true);
    try {
      await replaceAll(EMPTY_SNAPSHOT);
      await ensureDefaults();
      await api.act(() => ({ ops: [] }));
      notify("All Groceries data deleted");
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete data.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="gr-sheet-wrap" role="dialog" aria-modal="true" aria-label="Backup and data">
      <button className="gr-scrim" onClick={onClose} aria-label="Close" />
      <div className="gr-sheet">
        <div className="gr-sheet-head">
          <span />
          <h2 className="gr-h3">Backup &amp; data</h2>
          <button className="gr-link" onClick={onClose}>Done</button>
        </div>
        <div className="gr-form">
          <p className="gr-muted">Data is stored only in this browser. Clearing browser data removes it, so keep a backup.</p>
          <button className="gr-primary" onClick={download} disabled={busy}>Export backup (JSON)</button>
          <button className="gr-secondary" onClick={() => fileRef.current?.click()} disabled={busy}>Restore from backup…</button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void restore(f);
            }}
          />
          <button className="gr-secondary is-danger" onClick={reset} disabled={busy}>Delete all Groceries data</button>
          {error && <p className="gr-error" role="alert">{error}</p>}
        </div>
      </div>
    </div>
  );
}
