"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { encryptText } from "@/notes/crypto";
import {
  blocksToText,
  childrenOf,
  createBlock,
  firstLineOf,
  notePlainText,
  sortFolders,
  type Block,
  type Folder,
  type Note,
  type NoteColor,
} from "@/notes/store";
import { CURRENCIES, CURRENCY_LABELS, type Currency } from "@/notes/calc";
import BlockEditor from "./BlockEditor";
import ColorPicker from "./ColorPicker";
import PasswordPrompt from "./PasswordPrompt";

type SaveState = "idle" | "saving" | "saved";
type Draft = { title: string; folderId: string | null; color: NoteColor; currency: Currency; blocks: Block[] };

function displayTitleOf(draft: Draft): string {
  return draft.title.trim() || firstLineOf(draft.blocks) || "Untitled note";
}

function validFolderId(id: string | null, folders: Folder[]): string | null {
  return id && folders.some((folder) => folder.id === id) ? id : null;
}

export default function NoteEditor({
  note,
  folders,
  password,
  fresh,
  onClose,
  onPersist,
  onDelete,
}: {
  note: Note;
  folders: Folder[];
  password: string | null;
  fresh: boolean;
  onClose: () => void;
  onPersist: (note: Note) => void;
  onDelete: (id: string) => void;
}) {
  const [title, setTitle] = useState(note.title);
  const [folderId, setFolderId] = useState<string | null>(note.folderId);
  const [color, setColor] = useState<NoteColor>(note.color);
  const [currency, setCurrency] = useState<Currency>(note.currency);
  const [blocks, setBlocks] = useState<Block[]>(note.blocks.length ? note.blocks : [createBlock("paragraph")]);
  const [status, setStatus] = useState<SaveState>("idle");
  const [notice, setNotice] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [lockPrompt, setLockPrompt] = useState(false);

  const latest = useRef<Draft>({ title, folderId, color, currency, blocks });
  latest.current = { title, folderId, color, currency, blocks };
  const dirty = useRef(false);
  const initialized = useRef(false);
  const noteRef = useRef(note);
  noteRef.current = note;
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const flash = (message: string) => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    setNotice(message);
    noticeTimer.current = setTimeout(() => setNotice(null), 2200);
  };

  useEffect(() => () => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
  }, []);

  const flush = useCallback(async () => {
    if (!dirty.current) return;
    const draft = latest.current;
    const hasContent = Boolean(draft.title.trim()) || Boolean(blocksToText(draft.blocks).trim());
    if (fresh && !hasContent) {
      dirty.current = false;
      return;
    }

    dirty.current = false;
    setStatus("saving");
    try {
      const updatedAt = new Date().toISOString();
      const base: Note = {
        ...noteRef.current,
        title: displayTitleOf(draft),
        folderId: validFolderId(draft.folderId, folders),
        color: draft.color,
        currency: draft.currency,
        updatedAt,
      };
      if (noteRef.current.locked) {
        if (!password) throw new Error("Unlock this note again before saving.");
        const cipher = await encryptText(password, JSON.stringify(draft.blocks));
        onPersist({ ...base, blocks: [], locked: true, cipher });
      } else {
        onPersist({ ...base, blocks: draft.blocks, locked: false, cipher: null });
      }
      setStatus("saved");
    } catch (error) {
      setStatus("idle");
      flash(error instanceof Error ? error.message : "Could not save this note.");
    }
  }, [fresh, folders, onPersist, password]);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      return;
    }
    dirty.current = true;
    setStatus("idle");
    const timer = setTimeout(() => void flush(), 600);
    return () => clearTimeout(timer);
  }, [title, folderId, color, currency, blocks, flush]);

  const close = async () => {
    await flush();
    onClose();
  };

  const removeLock = () => {
    if (!window.confirm("Remove the password from this note? It will be saved unencrypted.")) return;
    const draft = latest.current;
    onPersist({
      ...noteRef.current,
      title: displayTitleOf(draft),
      folderId: validFolderId(draft.folderId, folders),
      color: draft.color,
      currency: draft.currency,
      blocks: draft.blocks,
      locked: false,
      cipher: null,
      updatedAt: new Date().toISOString(),
    });
    dirty.current = false;
    onClose();
  };

  const remove = () => {
    if (!window.confirm("Delete this note? You can undo it from the list.")) return;
    setMenuOpen(false);
    dirty.current = false;
    onDelete(note.id);
    onClose();
  };

  const copy = async () => {
    const text = notePlainText({
      ...noteRef.current,
      title: displayTitleOf(latest.current),
      blocks: latest.current.blocks,
      currency: latest.current.currency,
    });
    setMenuOpen(false);
    try {
      await navigator.clipboard.writeText(text);
      flash("Copied");
    } catch {
      flash("Could not copy");
    }
  };

  const exportText = () => {
    const text = notePlainText({
      ...noteRef.current,
      title: displayTitleOf(latest.current),
      blocks: latest.current.blocks,
      currency: latest.current.currency,
    });
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${displayTitleOf(latest.current).replace(/[^\w\- ]+/g, "").trim() || "note"}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    setMenuOpen(false);
  };

  const folderOptions = sortFolders(folders.filter((folder) => !folder.parentId)).flatMap((folder) => [
    { id: folder.id, label: folder.name },
    ...childrenOf(folders, folder.id).map((child) => ({ id: child.id, label: `— ${child.name}` })),
  ]);

  return (
    <div className="notes-sheet-wrap" role="dialog" aria-modal="true" aria-label={fresh ? "New note" : "Edit note"}>
      <button type="button" className="notes-scrim" onClick={() => void close()} aria-label="Close" />
      <div className="notes-sheet">
        <div className="notes-sheet-head">
          <button type="button" className="notes-link" onClick={() => void close()}>
            ‹ Notes
          </button>
          <span className="notes-sheet-label">{fresh ? "New note" : "Note"}</span>
          <div className="notes-head-right">
            <span className="notes-save-state" aria-live="polite">
              {notice ?? (status === "saving" ? "Saving…" : status === "saved" ? "Saved" : "")}
            </span>
            <button type="button" className="notes-icon-btn" aria-label="Note options" onClick={() => setMenuOpen(true)}>
              ⋯
            </button>
          </div>
        </div>

        <div className="notes-editor-scroll" ref={scrollRef}>
          <input
            className="notes-title-input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                scrollRef.current?.querySelector<HTMLElement>(".notes-block-text, .notes-item-input, .notes-table input")?.focus();
              }
            }}
            placeholder="Title"
            aria-label="Title"
            autoFocus={fresh}
          />

          <div className="notes-meta-row">
            <label className="notes-select-wrap">
              <span>Folder</span>
              <select
                className="notes-select"
                value={folderId ?? ""}
                onChange={(event) => setFolderId(event.target.value || null)}
              >
                <option value="">No folder</option>
                {folderOptions.map((option) => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="notes-select-wrap">
              <span>Currency</span>
              <select
                className="notes-select"
                value={currency}
                onChange={(event) => setCurrency(event.target.value as Currency)}
              >
                {CURRENCIES.map((code) => (
                  <option key={code} value={code}>{code} · {CURRENCY_LABELS[code]}</option>
                ))}
              </select>
            </label>
            <ColorPicker value={color} onChange={setColor} />
          </div>

          {note.locked ? <p className="notes-muted notes-lock-note">Locked · saving re-encrypts this note</p> : null}

          <BlockEditor blocks={blocks} onChange={setBlocks} currency={currency} />
        </div>
      </div>

      {menuOpen ? (
        <div className="notes-sheet-wrap" role="dialog" aria-modal="true" aria-label="Note options">
          <button type="button" className="notes-scrim" onClick={() => setMenuOpen(false)} aria-label="Close" />
          <div className="notes-menu">
            <div className="notes-menu-head">
              <span>Note</span>
              <button type="button" className="notes-link" onClick={() => setMenuOpen(false)}>Done</button>
            </div>
            <button type="button" className="notes-menu-row" onClick={() => void copy()}>Copy as text</button>
            <button type="button" className="notes-menu-row" onClick={exportText}>Export as .txt</button>
            <button
              type="button"
              className="notes-menu-row"
              onClick={() => {
                setMenuOpen(false);
                if (note.locked) removeLock();
                else setLockPrompt(true);
              }}
            >
              {note.locked ? "Remove password" : "Lock with password"}
            </button>
            <button type="button" className="notes-menu-row is-danger" onClick={remove}>Delete note</button>
          </div>
        </div>
      ) : null}

      {lockPrompt ? (
        <PasswordPrompt
          title="Lock note"
          hint="The title, folder and colour stay visible; everything you wrote is encrypted with this password. There is no recovery if you forget it."
          confirm="Lock"
          onClose={() => setLockPrompt(false)}
          onSubmit={async (pwd) => {
            const cipher = await encryptText(pwd, JSON.stringify(latest.current.blocks));
            onPersist({
              ...noteRef.current,
              title: displayTitleOf(latest.current),
              folderId: validFolderId(latest.current.folderId, folders),
              color: latest.current.color,
              currency: latest.current.currency,
              blocks: [],
              locked: true,
              cipher,
              updatedAt: new Date().toISOString(),
            });
            dirty.current = false;
            setLockPrompt(false);
            onClose();
            return null;
          }}
        />
      ) : null}
    </div>
  );
}
