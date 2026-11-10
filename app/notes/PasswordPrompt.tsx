"use client";

import { useState } from "react";

export default function PasswordPrompt({
  title,
  hint,
  confirm,
  onSubmit,
  onClose,
}: {
  title: string;
  hint: string;
  confirm: string;
  onSubmit: (password: string) => Promise<string | null>;
  onClose: () => void;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!value) return setError("Enter a password.");
    setBusy(true);
    setError(null);
    const err = await onSubmit(value);
    setBusy(false);
    if (err) setError(err);
  };

  return (
    <div className="notes-prompt-wrap" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="notes-scrim" onClick={onClose} aria-label="Close" />
      <form
        className="notes-prompt"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <h2 className="notes-h2">{title}</h2>
        <p className="notes-muted">{hint}</p>
        <input
          className="notes-input"
          type="password"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Password"
          aria-label="Password"
          autoFocus
        />
        {error ? <p className="notes-error" role="alert">{error}</p> : null}
        <div className="notes-prompt-actions">
          <button type="button" className="notes-btn is-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="notes-btn is-primary" disabled={busy}>
            {busy ? "Checking…" : confirm}
          </button>
        </div>
      </form>
    </div>
  );
}
