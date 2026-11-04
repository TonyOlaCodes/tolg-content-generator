import type { Ctx, Result } from "@/daily/actions";
import type { Settings, Snapshot } from "@/daily/model";

export type PageId = "today" | "history" | "trends" | "settings";

export type SheetState =
  | { kind: "steps" }
  | { kind: "calories" }
  | { kind: "sleep" }
  | { kind: "water" }
  | { kind: "weight" }
  | { kind: "quicklog" }
  | null;

/**
 * Shared handle every page uses to read the snapshot and commit validated
 * changes. `commit` writes atomically and returns an error message (or null).
 */
export type DailyApi = {
  snap: Snapshot;
  settings: Settings;
  today: string;
  selected: string;
  setSelected: (date: string) => void;
  commit: (result: Result, message: string, undoable?: boolean) => Promise<string | null>;
  replace: (snapshot: Snapshot) => Promise<string | null>;
  notify: (message: string) => void;
  openSheet: (sheet: SheetState) => void;
  setPage: (page: PageId) => void;
};

/** Builds a validation context from the app's current local day. */
export function uiCtx(today: string): Ctx {
  return {
    today,
    now: new Date().toISOString(),
    newId: () =>
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `id-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`,
  };
}

/** Parses a decimal text field. Returns null for blank or non-numeric text. */
export function parseDecimal(text: string): number | null {
  const clean = text.trim().replace(",", ".").replace(/\s/g, "");
  if (!clean) return null;
  if (!/^\d*\.?\d*$/.test(clean)) return null;
  const value = Number(clean);
  return Number.isFinite(value) ? value : null;
}

/** Parses a non-negative integer text field. */
export function parseWhole(text: string): number | null {
  const clean = text.trim().replace(/[,\s]/g, "");
  if (!clean) return null;
  if (!/^\d+$/.test(clean)) return null;
  const value = Number(clean);
  return Number.isSafeInteger(value) ? value : null;
}

