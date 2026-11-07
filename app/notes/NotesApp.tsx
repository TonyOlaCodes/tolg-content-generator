"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import "./notes.css";
import { loadNotes, saveNotes, sortNotes, type Note } from "@/notes/store";
import { decryptText, encryptText } from "@/notes/crypto";

type EditorState = { note: Note; password: string | null; fresh: boolean };

export default function NotesApp({ onBack }: { onBack: () => void }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState("");
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [unlockTarget, setUnlockTarget] = useState<Note | null>(null);

  useEffect(() => {
    setNotes(sortNotes(loadNotes()));
    setReady(true);
  }, []);

  const persist = useCallback((note: Note) => {
    setNotes((prev) => {
      const next = sortNotes(
        prev.some((n) => n.id === note.id) ? prev.map((n) => (n.id === note.id ? note : n)) : [note, ...prev],
      );
      saveNotes(next);
      return next;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setNotes((prev) => {
      const next = prev.filter((n) => n.id !== id);
      saveNotes(next);
      return next;
    });
    setEditor(null);
  }, []);

  const newNote = () => {
    const now = new Date().toISOString();
    setEditor({
      note: { id: crypto.randomUUID(), title: "", body: "", locked: false, cipher: null, createdAt: now, updatedAt: now },
      password: null,
      fresh: true,
    });
  };

  const open = (note: Note) => {
    if (note.locked) setUnlockTarget(note);
    else setEditor({ note, password: null, fresh: false });
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter((n) => n.title.toLowerCase().includes(q) || (!n.locked && n.body.toLowerCase().includes(q)));
  }, [notes, query]);

  return (
    <div className="notes">
      <header className="notes-top">
        <button type="button" className="notes-back" onClick={onBack}>‹ Apps</button>
        <h1 className="notes-title">Notes</h1>
        {ready ? (
          <button type="button" className="notes-back" onClick={newNote}>+ New</button>
        ) : (
          <span />
        )}
      </header>

      <div className="notes-body">
        <input
          className="notes-search"
          type="search"
          placeholder="Search notes"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Search notes"
        />

        {!ready ? (
          <p className="notes-muted">Opening…</p>
        ) : notes.length === 0 ? (
          <div className="notes-empty">
            <p className="notes-empty-title">No notes yet</p>
            <p className="notes-muted">Write anything. Lock a note with a password if it is private.</p>
            <button type="button" className="notes-btn is-primary" onClick={newNote}>Write a note</button>
          </div>
        ) : filtered.length === 0 ? (
          <p className="notes-muted notes-center">No notes match “{query.trim()}”.</p>
        ) : (
          <ul className="notes-list">
            {filtered.map((note) => (
              <li key={note.id}>
                <button type="button" className="notes-card" onClick={() => open(note)}>
                  <span className="notes-card-head">
                    <strong>{note.title || "Untitled note"}</strong>
                    {note.locked ? <span className="notes-lock" aria-label="Locked">🔒</span> : null}
                  </span>
                  <span className="notes-preview">{note.locked ? "Locked — password needed" : preview(note.body)}</span>
                  <span className="notes-meta">{formatWhen(note.updatedAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {editor ? (
        <NoteEditor
          key={editor.note.id}
          note={editor.note}
          password={editor.password}
          fresh={editor.fresh}
          onClose={() => setEditor(null)}
          onPersist={persist}
          onDelete={remove}
        />
      ) : null}

      {unlockTarget ? (
        <PasswordPrompt
          title="Unlock note"
          hint="Enter the password for this note."
          confirm="Unlock"
          onClose={() => setUnlockTarget(null)}
          onSubmit={async (pwd) => {
            if (!unlockTarget.cipher) return "This note has no lock data.";
            try {
              const body = await decryptText(pwd, unlockTarget.cipher);
              setEditor({ note: { ...unlockTarget, body }, password: pwd, fresh: false });
              setUnlockTarget(null);
              return null;
            } catch {
              return "Wrong password.";
            }
          }}
        />
      ) : null}
    </div>
  );
}

function NoteEditor({
  note,
  password,
  fresh,
  onClose,
  onPersist,
  onDelete,
}: {
  note: Note;
  password: string | null;
  fresh: boolean;
  onClose: () => void;
  onPersist: (note: Note) => void;
  onDelete: (id: string) => void;
}) {
  const [title, setTitle] = useState(note.title);
  const [body, setBody] = useState(note.body);
  const [lockPrompt, setLockPrompt] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    const now = new Date().toISOString();
    const nextTitle = title.trim() || "Untitled note";
    if (note.locked) {
      if (!password) {
        setSaving(false);
        return;
      }
      const cipher = await encryptText(password, body);
      onPersist({ ...note, title: nextTitle, body: "", locked: true, cipher, updatedAt: now });
    } else {
      onPersist({ ...note, title: nextTitle, body, locked: false, cipher: null, updatedAt: now });
    }
    setSaving(false);
    onClose();
  };

  const removeLock = () => {
    if (!window.confirm("Remove the password from this note? It will be saved unencrypted.")) return;
    onPersist({
      ...note,
      title: title.trim() || "Untitled note",
      body,
      locked: false,
      cipher: null,
      updatedAt: new Date().toISOString(),
    });
    onClose();
  };

  return (
    <div className="notes-sheet-wrap" role="dialog" aria-modal="true" aria-label={fresh ? "New note" : "Edit note"}>
      <button type="button" className="notes-scrim" onClick={onClose} aria-label="Close" />
      <div className="notes-sheet">
        <div className="notes-sheet-head">
          <button type="button" className="notes-link" onClick={onClose}>Cancel</button>
          <span className="notes-sheet-label">{fresh ? "New note" : "Note"}</span>
          <button type="button" className="notes-link is-strong" onClick={() => void save()} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
        <div className="notes-editor">
          <input
            className="notes-title-input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Title"
            aria-label="Title"
            autoFocus
          />
          <textarea
            className="notes-body-input"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Write something…"
            aria-label="Note text"
          />
          <div className="notes-actions">
            {note.locked ? (
              <button type="button" className="notes-btn is-ghost" onClick={removeLock}>Remove lock</button>
            ) : (
              <button type="button" className="notes-btn is-ghost" onClick={() => setLockPrompt(true)}>Lock with password</button>
            )}
            <button
              type="button"
              className="notes-btn is-danger"
              onClick={() => {
                if (window.confirm("Delete this note? This cannot be undone.")) onDelete(note.id);
              }}
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      {lockPrompt ? (
        <PasswordPrompt
          title="Lock note"
          hint="The title stays visible; the text is encrypted with this password. There is no recovery if you forget it."
          confirm="Lock"
          onClose={() => setLockPrompt(false)}
          onSubmit={async (pwd) => {
            const cipher = await encryptText(pwd, body);
            onPersist({
              ...note,
              title: title.trim() || "Untitled note",
              body: "",
              locked: true,
              cipher,
              updatedAt: new Date().toISOString(),
            });
            setLockPrompt(false);
            onClose();
            return null;
          }}
        />
      ) : null}
    </div>
  );
}

function PasswordPrompt({
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

function preview(body: string): string {
  const text = body.trim().replace(/\s+/g, " ");
  if (!text) return "Empty note";
  return text.length > 110 ? `${text.slice(0, 110)}…` : text;
}

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const day = date.toLocaleDateString("en-IE", { day: "numeric", month: "short" });
  const time = date.toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit" });
  return `${day} · ${time}`;
}
