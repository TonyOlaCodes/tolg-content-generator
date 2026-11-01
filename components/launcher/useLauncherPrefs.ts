"use client";

import { useCallback, useEffect, useState } from "react";
import { APPS, type AppId } from "./apps";

const KEY = "launcher.prefs.v1";
const MAX_RECENTS = 6;
const VALID = new Set<string>(APPS.map((a) => a.id));

export type LauncherPrefs = {
  favourites: AppId[];
  recents: AppId[];
  widgetsOpen: boolean;
};

const DEFAULT_PREFS: LauncherPrefs = { favourites: [], recents: [], widgetsOpen: true };

/** Validates stored data so unknown or removed app ids are dropped. */
function sanitizeIds(value: unknown, limit: number): AppId[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: AppId[] = [];
  for (const item of value) {
    if (typeof item === "string" && VALID.has(item) && !seen.has(item)) {
      seen.add(item);
      out.push(item as AppId);
    }
  }
  return out.slice(0, limit);
}

function readPrefs(): LauncherPrefs {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      favourites: sanitizeIds(parsed.favourites, APPS.length),
      recents: sanitizeIds(parsed.recents, MAX_RECENTS),
      widgetsOpen: typeof parsed.widgetsOpen === "boolean" ? parsed.widgetsOpen : true,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

/** Preferences persist to localStorage. They load after mount, so server and client markup match. */
export function useLauncherPrefs() {
  const [prefs, setPrefs] = useState<LauncherPrefs>(DEFAULT_PREFS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setPrefs(readPrefs());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(KEY, JSON.stringify(prefs));
    } catch {
      // storage unavailable: the launcher still works for this session
    }
  }, [prefs, loaded]);

  const toggleFavourite = useCallback((id: AppId) => {
    setPrefs((p) => ({
      ...p,
      favourites: p.favourites.includes(id)
        ? p.favourites.filter((f) => f !== id)
        : [...p.favourites, id],
    }));
  }, []);

  const moveFavourite = useCallback((id: AppId, direction: -1 | 1) => {
    setPrefs((p) => {
      const index = p.favourites.indexOf(id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= p.favourites.length) return p;
      const next = [...p.favourites];
      [next[index], next[target]] = [next[target], next[index]];
      return { ...p, favourites: next };
    });
  }, []);

  const recordRecent = useCallback((id: AppId) => {
    setPrefs((p) => ({
      ...p,
      recents: [id, ...p.recents.filter((r) => r !== id)].slice(0, MAX_RECENTS),
    }));
  }, []);

  const setWidgetsOpen = useCallback((open: boolean) => {
    setPrefs((p) => ({ ...p, widgetsOpen: open }));
  }, []);

  return { prefs, toggleFavourite, moveFavourite, recordRecent, setWidgetsOpen };
}
