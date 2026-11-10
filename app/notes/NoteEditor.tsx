"use client";

import { useState } from "react";
import { encryptText } from "@/notes/crypto";
import { childrenOf, sortFolders, type Block, type Folder, type Note, type NoteColor } from "@/notes/store";
import BlockEditor from "./BlockEditor";
import ColorPicker from "./ColorPicker";
import PasswordPrompt from "./PasswordPrompt";

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
  const [blocks, setBlocks] = useState<Block[]>(note.blocks);
  const [lockPrompt, setLockPrompt] = useState(false);
  const [saving, setSaving] = useState(false);

  const options: { id: string; label: string }[] = sortFolders(folders.filter((folder) => !folder.parentId)).flatMap(
    (folder) => [
      { id: folder.id, label: folder.name },
      ...childrenOf(folders, folder.id).map((child) => ({ id: child.id, label: `— ${child.name}` })),
    ],
  );

  const nextTitle = () => title.trim() || "Untitled note";
  const nextFolder = () => (folderId && folders.some((folder) => folder.id === folderId) ? folderId : null);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    const updatedAt = new Date().toISOString();
    if (note.locked) {
      if (!password) {
        setSaving(false);
        return;
      }
      const cipher = await encryptText(password, JSON.stringify(blocks));
      onPersist({
        ...note,
        title: nextTitle(),
        folderId: nextFolder(),
        color,
        blocks: [],
        locked: true,
        cipher,
        updatedAt,
      });
    } else {
      onPersist({
        ...note,
        title: nextTitle(),
        folderId: nextFolder(),
        color,
        blocks,
        locked: false,
        cipher: null,
        updatedAt,
      });
    }
    setSaving(false);
    onClose();
  };

  const removeLock = () => {
    if (!window.confirm("Remove the password from this note? It will be saved unencrypted.")) return;
    onPersist({
      ...note,
      title: nextTitle(),
      folderId: nextFolder(),
      color,
      blocks,
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
            autoFocus={fresh}
          />

          <div className="notes-meta-row">
            <select
              className="notes-select"
              value={folderId ?? ""}
              aria-label="Folder"
              onChange={(event) => setFolderId(event.target.value || null)}
            >
              <option value="">No folder</option>
              {options.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
            <ColorPicker value={color} onChange={setColor} />
          </div>

          {note.locked ? <p className="notes-muted">This note is locked. Saving encrypts these sections again.</p> : null}

          <BlockEditor blocks={blocks} onChange={setBlocks} />

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
          hint="The title, folder and colour stay visible; the sections are encrypted with this password. There is no recovery if you forget it."
          confirm="Lock"
          onClose={() => setLockPrompt(false)}
          onSubmit={async (pwd) => {
            const cipher = await encryptText(pwd, JSON.stringify(blocks));
            onPersist({
              ...note,
              title: nextTitle(),
              folderId: nextFolder(),
              color,
              blocks: [],
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
