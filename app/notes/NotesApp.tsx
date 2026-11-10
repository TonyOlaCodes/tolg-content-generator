"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import "./notes.css";
import {
  blocksToText,
  childrenOf,
  createFolder,
  createNote,
  duplicateNote,
  folderPath,
  loadNotes,
  notePlainText,
  noteTitle,
  parseLockedBlocks,
  saveNotes,
  sortFolders,
  sortNotes,
  summarizeBlocks,
  type Folder,
  type Note,
  type NoteColor,
  type NotesState,
  type NoteSort,
} from "@/notes/store";
import { formatMoney } from "@/notes/calc";
import { decryptText } from "@/notes/crypto";
import { exportNotes, validateBackup } from "@/notes/backup";
import NoteEditor from "./NoteEditor";
import PasswordPrompt from "./PasswordPrompt";
import ColorPicker from "./ColorPicker";

type EditorState = { note: Note; password: string | null; fresh: boolean };
type FolderPromptState = { parentId: string | null; editing: Folder | null };
type ToastState = { message: string; undo?: Note };

const ALL = "all";
const UNSORTED = "unsorted";
const SORT_KEY = "detailflows-notes-sort";

function loadSort(): NoteSort {
  if (typeof localStorage === "undefined") return "edited";
  const value = localStorage.getItem(SORT_KEY);
  return value === "created" || value === "title" || value === "manual" || value === "edited" ? value : "edited";
}

export default function NotesApp({ onBack }: { onBack: () => void }) {
  const [state, setState] = useState<NotesState>({ notes: [], folders: [] });
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<string>(ALL);
  const [sort, setSortState] = useState<NoteSort>("edited");
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [unlockTarget, setUnlockTarget] = useState<Note | null>(null);
  const [backupOpen, setBackupOpen] = useState(false);
  const [folderPrompt, setFolderPrompt] = useState<FolderPromptState | null>(null);
  const [menuNote, setMenuNote] = useState<Note | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setState(loadNotes());
    setSortState(loadSort());
    setReady(true);
  }, []);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const update = useCallback((mutate: (prev: NotesState) => NotesState) => {
    setState((prev) => {
      const next = mutate(prev);
      saveNotes(next);
      return next;
    });
  }, []);

  const persist = useCallback(
    (note: Note) => {
      update((prev) => ({
        ...prev,
        notes: prev.notes.some((item) => item.id === note.id)
          ? prev.notes.map((item) => (item.id === note.id ? note : item))
          : [note, ...prev.notes],
      }));
    },
    [update],
  );

  const flash = (message: string, undo?: Note) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, undo });
    toastTimer.current = setTimeout(() => setToast(null), 5500);
  };

  const changeSort = (next: NoteSort) => {
    setSortState(next);
    if (typeof localStorage !== "undefined") localStorage.setItem(SORT_KEY, next);
  };

  const ordered = sortNotes(state.notes, sort);
  const topFolders = sortFolders(state.folders.filter((folder) => !folder.parentId));
  const activeFolder = state.folders.find((folder) => folder.id === filter) ?? null;
  const activeTop = activeFolder
    ? state.folders.find((folder) => folder.id === activeFolder.parentId) ?? activeFolder
    : null;
  const subFolders = activeTop ? childrenOf(state.folders, activeTop.id) : [];

  const matchesFolder = (note: Note): boolean => {
    if (filter === ALL) return true;
    if (filter === UNSORTED) return note.folderId === null;
    const folder = state.folders.find((item) => item.id === filter);
    if (!folder) return true;
    if (folder.parentId) return note.folderId === folder.id;
    const childIds = new Set(state.folders.filter((item) => item.parentId === folder.id).map((item) => item.id));
    return note.folderId === folder.id || (note.folderId !== null && childIds.has(note.folderId));
  };

  const needle = query.trim().toLowerCase();
  const filtered = ordered.filter((note) => {
    if (!matchesFolder(note)) return false;
    if (!needle) return true;
    if (noteTitle(note).toLowerCase().includes(needle)) return true;
    return !note.locked && blocksToText(note.blocks).toLowerCase().includes(needle);
  });

  const countFolder = (folderId: string): number => {
    const childIds = new Set(state.folders.filter((folder) => folder.parentId === folderId).map((folder) => folder.id));
    return state.notes.filter(
      (note) => note.folderId === folderId || (note.folderId !== null && childIds.has(note.folderId)),
    ).length;
  };

  const newNote = () => {
    const folderId = filter !== ALL && filter !== UNSORTED ? filter : null;
    const note = createNote(folderId);
    // New notes sit on top when the list is manually ordered.
    note.order = state.notes.reduce((lowest, item) => Math.min(lowest, item.order), note.order) - 1;
    setEditor({ note, password: null, fresh: true });
  };

  const open = (note: Note) => {
    if (note.locked) setUnlockTarget(note);
    else setEditor({ note, password: null, fresh: false });
  };

  const saveFolder = (input: { name: string; parentId: string | null; color: NoteColor }) => {
    update((prev) => {
      if (folderPrompt?.editing) {
        const editingId = folderPrompt.editing.id;
        return { ...prev, folders: prev.folders.map((folder) => (folder.id === editingId ? { ...folder, ...input } : folder)) };
      }
      return { ...prev, folders: [...prev.folders, createFolder(input.name, input.parentId, input.color)] };
    });
    setFolderPrompt(null);
  };

  const deleteFolder = (folder: Folder) => {
    const childIds = state.folders.filter((item) => item.parentId === folder.id).map((item) => item.id);
    const contained = state.notes.filter(
      (note) => note.folderId === folder.id || (note.folderId !== null && childIds.includes(note.folderId)),
    ).length;
    const moved = contained ? `${contained} note${contained === 1 ? "" : "s"} will move to Unsorted. ` : "";
    if (!window.confirm(`Delete “${folder.name}”? ${moved}Any subfolders become main folders.`)) return;

    update((prev) => ({
      ...prev,
      folders: prev.folders
        .filter((item) => item.id !== folder.id)
        .map((item) => (item.parentId === folder.id ? { ...item, parentId: null } : item)),
      notes: prev.notes.map((note) =>
        note.folderId === folder.id || (note.folderId !== null && childIds.includes(note.folderId))
          ? { ...note, folderId: null }
          : note,
      ),
    }));
    setFilter(ALL);
  };

  const togglePin = (note: Note) => {
    update((prev) => ({
      ...prev,
      notes: prev.notes.map((item) => (item.id === note.id ? { ...item, pinned: !item.pinned } : item)),
    }));
    setMenuNote(null);
    flash(note.pinned ? "Unpinned" : "Pinned to top");
  };

  const duplicate = (note: Note) => {
    const copy = duplicateNote(note);
    copy.order = state.notes.reduce((lowest, item) => Math.min(lowest, item.order), copy.order) - 1;
    update((prev) => ({ ...prev, notes: [copy, ...prev.notes] }));
    setMenuNote(null);
    flash("Note duplicated");
  };

  const moveNote = (note: Note, folderId: string | null) => {
    update((prev) => ({
      ...prev,
      notes: prev.notes.map((item) => (item.id === note.id ? { ...item, folderId } : item)),
    }));
    setMenuNote(null);
    flash("Note moved");
  };

  const moveManual = (note: Note, direction: -1 | 1) => {
    update((prev) => {
      const list = sortNotes(prev.notes, "manual");
      const index = list.findIndex((item) => item.id === note.id);
      if (index < 0) return prev;
      // Keep pinned and unpinned notes in their own groups.
      let target = index + direction;
      while (target >= 0 && target < list.length && list[target].pinned !== note.pinned) target += direction;
      if (target < 0 || target >= list.length) return prev;
      const reordered = [...list];
      [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
      const orders = new Map(reordered.map((item, position) => [item.id, position]));
      return {
        ...prev,
        notes: prev.notes.map((item) => ({ ...item, order: orders.get(item.id) ?? item.order })),
      };
    });
    setMenuNote(null);
  };

  const remove = (id: string) => {
    const target = state.notes.find((note) => note.id === id);
    if (!target) return;
    update((prev) => ({ ...prev, notes: prev.notes.filter((note) => note.id !== id) }));
    setEditor(null);
    setMenuNote(null);
    flash("Note deleted", target);
  };

  const undoDelete = () => {
    if (!toast?.undo) return;
    const note = toast.undo;
    update((prev) => ({ ...prev, notes: [note, ...prev.notes] }));
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(null);
  };

  const copyText = async (note: Note) => {
    if (note.locked) {
      flash("Unlock the note to copy it");
      return;
    }
    setMenuNote(null);
    try {
      await navigator.clipboard.writeText(notePlainText(note));
      flash("Copied");
    } catch {
      flash("Could not copy");
    }
  };

  const exportText = (note: Note) => {
    if (note.locked) {
      flash("Unlock the note to export it");
      return;
    }
    const url = URL.createObjectURL(new Blob([notePlainText(note)], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${noteTitle(note).replace(/[^\w\- ]+/g, "").trim() || "note"}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    setMenuNote(null);
    flash("Exported");
  };

  return (
    <div className="notes">
      <header className="notes-top">
        <button type="button" className="notes-back" onClick={onBack}>‹ Apps</button>
        <h1 className="notes-title">Notes</h1>
        {ready ? (
          <div className="notes-head-actions">
            <button type="button" className="notes-back" onClick={() => setBackupOpen(true)}>Data</button>
            <button type="button" className="notes-new" onClick={newNote}>+ New</button>
          </div>
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

        <div className="notes-folders" role="group" aria-label="Folders">
          <button
            type="button"
            className={`notes-chip ${filter === ALL ? "is-active" : ""}`}
            onClick={() => setFilter(ALL)}
          >
            All <span className="notes-count">{state.notes.length}</span>
          </button>
          <button
            type="button"
            className={`notes-chip ${filter === UNSORTED ? "is-active" : ""}`}
            onClick={() => setFilter(UNSORTED)}
          >
            Unsorted <span className="notes-count">{state.notes.filter((note) => note.folderId === null).length}</span>
          </button>
          {topFolders.map((folder) => (
            <button
              key={folder.id}
              type="button"
              data-color={folder.color}
              className={`notes-chip ${filter === folder.id ? "is-active" : ""}`}
              onClick={() => setFilter(folder.id)}
            >
              <span className="notes-dot" />
              {folder.name} <span className="notes-count">{countFolder(folder.id)}</span>
            </button>
          ))}
          <button type="button" className="notes-chip notes-add-chip" onClick={() => setFolderPrompt({ parentId: null, editing: null })}>
            + Folder
          </button>
        </div>

        {activeTop ? (
          <div className="notes-subfolders">
            {subFolders.map((folder) => (
              <button
                key={folder.id}
                type="button"
                data-color={folder.color}
                className={`notes-chip ${filter === folder.id ? "is-active" : ""}`}
                onClick={() => setFilter(folder.id)}
              >
                <span className="notes-dot" />
                {folder.name} <span className="notes-count">{countFolder(folder.id)}</span>
              </button>
            ))}
            <button
              type="button"
              className="notes-chip notes-add-chip"
              onClick={() => setFolderPrompt({ parentId: activeTop.id, editing: null })}
            >
              + Subfolder
            </button>
          </div>
        ) : null}

        {activeFolder ? (
          <div className="notes-folder-actions">
            <span className="notes-folder-name">{folderPath(state.folders, activeFolder.id)}</span>
            <button type="button" onClick={() => setFolderPrompt({ parentId: activeFolder.parentId, editing: activeFolder })}>
              Rename
            </button>
            <button type="button" className="is-danger" onClick={() => deleteFolder(activeFolder)}>Delete</button>
          </div>
        ) : null}

        {!ready ? (
          <p className="notes-muted">Opening…</p>
        ) : state.notes.length === 0 ? (
          <div className="notes-empty">
            <p className="notes-empty-title">A quiet place to write</p>
            <p className="notes-muted">Type freely, add a checklist and optional prices, and let the total add itself up.</p>
            <button type="button" className="notes-btn is-primary" onClick={newNote}>Start writing</button>
          </div>
        ) : filtered.length === 0 ? (
          <p className="notes-muted notes-center">
            {needle ? <>No notes match “{query.trim()}”.</> : "No notes in this folder yet."}
          </p>
        ) : (
          <>
            <div className="notes-sortbar">
              <span className="notes-result-count">{filtered.length} note{filtered.length === 1 ? "" : "s"}</span>
              <label className="notes-sort">
                <span>Sort</span>
                <select value={sort} onChange={(event) => changeSort(event.target.value as NoteSort)} aria-label="Sort notes">
                  <option value="edited">Last edited</option>
                  <option value="created">Date created</option>
                  <option value="title">A–Z</option>
                  <option value="manual">Manual</option>
                </select>
              </label>
            </div>
            <ul className="notes-list">
              {filtered.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  folders={state.folders}
                  onOpen={open}
                  onMenu={setMenuNote}
                />
              ))}
            </ul>
          </>
        )}
      </div>

      {editor ? (
        <NoteEditor
          key={editor.note.id}
          note={editor.note}
          folders={state.folders}
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
              const raw = await decryptText(pwd, unlockTarget.cipher);
              setEditor({ note: { ...unlockTarget, blocks: parseLockedBlocks(raw) }, password: pwd, fresh: false });
              setUnlockTarget(null);
              return null;
            } catch {
              return "Wrong password.";
            }
          }}
        />
      ) : null}

      {folderPrompt ? (
        <FolderPrompt
          folders={state.folders}
          parentId={folderPrompt.parentId}
          editing={folderPrompt.editing}
          onSubmit={saveFolder}
          onClose={() => setFolderPrompt(null)}
        />
      ) : null}

      {backupOpen ? (
        <NotesBackup
          state={state}
          onReplace={(next) => {
            setState(next);
            saveNotes(next);
            setFilter(ALL);
          }}
          onClose={() => setBackupOpen(false)}
        />
      ) : null}

      {menuNote ? (
        <NoteMenu
          note={menuNote}
          folders={state.folders}
          manual={sort === "manual"}
          onClose={() => setMenuNote(null)}
          onPin={() => togglePin(menuNote)}
          onDuplicate={() => duplicate(menuNote)}
          onMove={(folderId) => moveNote(menuNote, folderId)}
          onCopy={() => void copyText(menuNote)}
          onExport={() => exportText(menuNote)}
          onUp={() => moveManual(menuNote, -1)}
          onDown={() => moveManual(menuNote, 1)}
          onDelete={() => remove(menuNote.id)}
        />
      ) : null}

      {toast ? (
        <div className="notes-toast" role="status">
          <span>{toast.message}</span>
          {toast.undo ? (
            <button type="button" onClick={undoDelete}>Undo</button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function NoteCard({
  note,
  folders,
  onOpen,
  onMenu,
}: {
  note: Note;
  folders: Folder[];
  onOpen: (note: Note) => void;
  onMenu: (note: Note) => void;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const summary = summarizeBlocks(note.blocks);
  const title = noteTitle(note);
  const preview = note.locked
    ? "Locked — password needed"
    : blocksToText(note.blocks).replace(/\s+/g, " ").trim();

  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  useEffect(() => () => cancel(), []);

  return (
    <li className={`notes-card ${note.pinned ? "is-pinned" : ""}`} data-color={note.color}>
      <button
        type="button"
        className="notes-card-main"
        onPointerDown={(event) => {
          if (event.pointerType === "mouse" && event.button !== 0) return;
          start.current = { x: event.clientX, y: event.clientY };
          longPressed.current = false;
          cancel();
          timer.current = setTimeout(() => {
            longPressed.current = true;
            onMenu(note);
          }, 450);
        }}
        onPointerMove={(event) => {
          if (!start.current) return;
          if (Math.hypot(event.clientX - start.current.x, event.clientY - start.current.y) > 8) {
            cancel();
            start.current = null;
          }
        }}
        onPointerUp={() => {
          cancel();
          start.current = null;
        }}
        onPointerCancel={() => {
          cancel();
          start.current = null;
        }}
        onPointerLeave={cancel}
        onClick={(event) => {
          if (longPressed.current) {
            event.preventDefault();
            longPressed.current = false;
            return;
          }
          onOpen(note);
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          cancel();
          onMenu(note);
        }}
      >
        <span className="notes-card-title">
          <strong>{title}</strong>
          {note.pinned ? <span className="notes-pin" aria-label="Pinned">★</span> : null}
          {note.locked ? <span className="notes-lock" aria-label="Locked">🔒</span> : null}
        </span>
        <span className="notes-preview">{preview || "Empty note"}</span>
        <span className="notes-meta">
          <span>{formatWhen(note.updatedAt)}</span>
          {note.folderId ? <span className="notes-folder-tag">{folderPath(folders, note.folderId)}</span> : null}
          {summary.count > 0 ? <span className="notes-progress">{summary.done}/{summary.count}</span> : null}
          {summary.hasPrices ? <span className="notes-progress">{formatMoney(summary.remaining, note.currency)} left</span> : null}
        </span>
      </button>
      <button type="button" className="notes-card-menu" aria-label="Note actions" onClick={() => onMenu(note)}>
        ⋯
      </button>
    </li>
  );
}

function NoteMenu({
  note,
  folders,
  manual,
  onClose,
  onPin,
  onDuplicate,
  onMove,
  onCopy,
  onExport,
  onUp,
  onDown,
  onDelete,
}: {
  note: Note;
  folders: Folder[];
  manual: boolean;
  onClose: () => void;
  onPin: () => void;
  onDuplicate: () => void;
  onMove: (folderId: string | null) => void;
  onCopy: () => void;
  onExport: () => void;
  onUp: () => void;
  onDown: () => void;
  onDelete: () => void;
}) {
  const options = sortFolders(folders.filter((folder) => !folder.parentId)).flatMap((folder) => [
    { id: folder.id, label: folder.name },
    ...childrenOf(folders, folder.id).map((child) => ({ id: child.id, label: `— ${child.name}` })),
  ]);

  return (
    <div className="notes-sheet-wrap" role="dialog" aria-modal="true" aria-label="Note actions">
      <button type="button" className="notes-scrim" onClick={onClose} aria-label="Close" />
      <div className="notes-menu">
        <div className="notes-menu-head">
          <span>{noteTitle(note)}</span>
          <button type="button" className="notes-link" onClick={onClose}>Done</button>
        </div>
        <button type="button" className="notes-menu-row" onClick={onPin}>
          {note.pinned ? "Unpin" : "Pin to top"}
        </button>
        <button type="button" className="notes-menu-row" onClick={onDuplicate}>Duplicate</button>
        <label className="notes-menu-move">
          <span>Move to</span>
          <select
            value={note.folderId ?? ""}
            onChange={(event) => onMove(event.target.value || null)}
            aria-label="Move note to folder"
          >
            <option value="">No folder</option>
            {options.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        </label>
        <button type="button" className="notes-menu-row" disabled={note.locked} onClick={onCopy}>
          Copy as text
        </button>
        <button type="button" className="notes-menu-row" disabled={note.locked} onClick={onExport}>
          Export as .txt
        </button>
        {manual ? (
          <div className="notes-menu-pair">
            <button type="button" className="notes-menu-row" onClick={onUp}>Move up</button>
            <button type="button" className="notes-menu-row" onClick={onDown}>Move down</button>
          </div>
        ) : null}
        <button type="button" className="notes-menu-row is-danger" onClick={onDelete}>Delete</button>
      </div>
    </div>
  );
}

function FolderPrompt({
  folders,
  parentId,
  editing,
  onSubmit,
  onClose,
}: {
  folders: Folder[];
  parentId: string | null;
  editing: Folder | null;
  onSubmit: (input: { name: string; parentId: string | null; color: NoteColor }) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(editing?.name ?? "");
  const [color, setColor] = useState<NoteColor>(editing?.color ?? "slate");
  const [nextParent, setNextParent] = useState<string | null>(parentId);
  const [error, setError] = useState<string | null>(null);

  const hasChildren = editing ? folders.some((folder) => folder.parentId === editing.id) : false;
  const parents = sortFolders(folders.filter((folder) => !folder.parentId && folder.id !== editing?.id));

  const submit = () => {
    const clean = name.trim();
    if (!clean) return setError("Give the folder a name.");
    if (clean.length > 60) return setError("Keep folder names under 60 characters.");
    const targetParent = hasChildren ? null : nextParent;
    if (
      folders.some(
        (folder) =>
          folder.id !== editing?.id &&
          folder.parentId === targetParent &&
          folder.name.toLowerCase() === clean.toLowerCase(),
      )
    ) {
      return setError("A folder with that name already exists here.");
    }
    onSubmit({ name: clean, parentId: targetParent, color });
  };

  return (
    <div className="notes-prompt-wrap" role="dialog" aria-modal="true" aria-label={editing ? "Rename folder" : "New folder"}>
      <button type="button" className="notes-scrim" onClick={onClose} aria-label="Close" />
      <form
        className="notes-prompt"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <h2 className="notes-h2">{editing ? "Rename folder" : "New folder"}</h2>
        <input
          className="notes-input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Folder name"
          aria-label="Folder name"
          autoFocus
        />
        <label className="notes-field">
          <span className="notes-field-label">Inside</span>
          <select
            className="notes-select"
            value={hasChildren ? "" : nextParent ?? ""}
            disabled={hasChildren}
            onChange={(event) => setNextParent(event.target.value || null)}
          >
            <option value="">No parent (main folder)</option>
            {parents.map((folder) => (
              <option key={folder.id} value={folder.id}>{folder.name}</option>
            ))}
          </select>
        </label>
        {hasChildren ? <p className="notes-muted">This folder has subfolders, so it stays a main folder.</p> : null}
        <div className="notes-field">
          <span className="notes-field-label">Colour</span>
          <ColorPicker value={color} onChange={setColor} />
        </div>
        {error ? <p className="notes-error" role="alert">{error}</p> : null}
        <div className="notes-prompt-actions">
          <button type="button" className="notes-btn is-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="notes-btn is-primary">{editing ? "Save" : "Create"}</button>
        </div>
      </form>
    </div>
  );
}

function NotesBackup({
  state,
  onReplace,
  onClose,
}: {
  state: NotesState;
  onReplace: (state: NotesState) => void;
  onClose: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const count = state.notes.length;

  const download = () => {
    const url = URL.createObjectURL(new Blob([exportNotes(state)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `notes-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const restore = async (file: File) => {
    setError(null);
    const parsed = validateBackup(await file.text());
    if (!parsed.ok) return setError(parsed.error);
    if (
      !window.confirm(
        `Replace all ${count} note${count === 1 ? "" : "s"} and folders on this device with ${parsed.notes.length} note${parsed.notes.length === 1 ? "" : "s"} from the backup?`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      onReplace({ notes: sortNotes(parsed.notes), folders: sortFolders(parsed.folders) });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Restore failed. Nothing was changed.");
    } finally {
      setBusy(false);
    }
  };

  const clearAll = () => {
    if (!window.confirm("Delete ALL notes and folders on this device? Export a backup first if you might need them.")) return;
    if (!window.confirm("This cannot be undone. Clearing browser data also removes notes. Delete everything now?")) return;
    onReplace({ notes: [], folders: [] });
    onClose();
  };

  return (
    <div className="notes-sheet-wrap" role="dialog" aria-modal="true" aria-label="Backup and data">
      <button type="button" className="notes-scrim" onClick={onClose} aria-label="Close" />
      <div className="notes-sheet">
        <div className="notes-sheet-head">
          <span />
          <span className="notes-sheet-label">Backup &amp; data</span>
          <button type="button" className="notes-link" onClick={onClose}>Done</button>
        </div>
        <div className="notes-editor-scroll">
          <p className="notes-muted">
            Notes stay in this browser. Clearing site data removes them, so export a backup you can keep.
          </p>
          <p className="notes-muted">
            Folders, colours, prices, pins and sections are included. Locked notes are included as encrypted text, so you still need their password.
          </p>
          <div className="notes-actions">
            <button type="button" className="notes-btn is-primary" onClick={download} disabled={busy}>Export backup</button>
            <button type="button" className="notes-btn is-ghost" onClick={() => fileRef.current?.click()} disabled={busy}>
              Restore from backup…
            </button>
            <button type="button" className="notes-btn is-danger" onClick={clearAll} disabled={busy}>Delete all notes</button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void restore(file);
            }}
          />
          {error ? <p className="notes-error" role="alert">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const day = date.toLocaleDateString("en-IE", { day: "numeric", month: "short" });
  const time = date.toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit" });
  return `${day} · ${time}`;
}
