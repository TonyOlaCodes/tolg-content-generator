"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import "./daily.css";
import { invertChange, isEmptyChange, type Change, type Result } from "@/daily/actions";
import { todayKey } from "@/daily/date";
import { emptySnapshot, settingsOf, type Snapshot } from "@/daily/model";
import { localDailyStore } from "@/daily/store";
import TodayPage from "./TodayPage";
import HistoryPage from "./HistoryPage";
import TrendsPage from "./TrendsPage";
import SettingsPage from "./SettingsPage";
import { CaloriesSheet, QuickLogSheet, SleepSheet, StepsSheet, WaterSheet, WeightSheet } from "./Sheets";
import type { DailyApi, PageId, SheetState } from "./api";

const NAV: { id: PageId; label: string; icon: ReactNode }[] = [
  {
    id: "today",
    label: "Today",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden focusable="false">
        <circle cx={12} cy={12} r={8.5} />
        <path d="M12 8v4.5l3 2" />
      </svg>
    ),
  },
  {
    id: "history",
    label: "History",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden focusable="false">
        <rect x={3.5} y={5} width={17} height={15.5} rx={3} />
        <path d="M3.5 9.8h17M8 3v4M16 3v4" />
      </svg>
    ),
  },
  {
    id: "trends",
    label: "Trends",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden focusable="false">
        <path d="M4 19V6M4 19h16" />
        <path d="M7.5 15.5 11 11l3 3 3.5-5" />
      </svg>
    ),
  },
  {
    id: "settings",
    label: "Settings",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden focusable="false">
        <circle cx={12} cy={12} r={3.2} />
        <path d="M19.3 14.2a7.7 7.7 0 0 0 .1-4.3l1.7-1.3-1.6-2.8-2 .8a7.6 7.6 0 0 0-3.7-2.1L13.5 2h-3l-.3 2.5a7.6 7.6 0 0 0-3.7 2.1l-2-.8L2.9 8.6l1.7 1.3a7.7 7.7 0 0 0 .1 4.3L3 15.5l1.6 2.8 2-.8a7.6 7.6 0 0 0 3.6 2.1l.3 2.4h3l.3-2.4a7.6 7.6 0 0 0 3.6-2.1l2 .8 1.6-2.8Z" />
      </svg>
    ),
  },
];

type Notice = { id: number; message: string; undo: Change | null } | null;

export default function DailyApp({ onBack }: { onBack: () => void }) {
  const [snap, setSnap] = useState<Snapshot>(() => emptySnapshot());
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [page, setPage] = useState<PageId>("today");
  const [selected, setSelected] = useState("");
  const [today, setToday] = useState("");
  const [sheet, setSheet] = useState<SheetState>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const snapRef = useRef(snap);
  const todayRef = useRef("");
  const sheetRef = useRef<SheetState>(null);

  useEffect(() => {
    snapRef.current = snap;
  }, [snap]);

  useEffect(() => {
    todayRef.current = today;
  }, [today]);

  useEffect(() => {
    sheetRef.current = sheet;
  }, [sheet]);

  // Load local data after mount so server and client markup match, and use the
  // device's local calendar day for "today" rather than the server's date.
  useEffect(() => {
    let alive = true;
    const initial = todayKey();
    setToday(initial);
    setSelected(initial);
    todayRef.current = initial;
    (async () => {
      try {
        const loaded = await localDailyStore.load();
        if (alive) setSnap(loaded);
      } catch (error) {
        if (alive) setLoadError(error instanceof Error ? error.message : "Could not open local storage.");
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Roll over at midnight (and when the tab becomes visible again) without ever
  // moving a day the user is editing: only "today" follows the new date.
  useEffect(() => {
    if (!ready) return;
    const check = () => {
      const next = todayKey();
      const previous = todayRef.current;
      if (next === previous) return;
      todayRef.current = next;
      setToday(next);
      setSelected((current) => (current === previous || current > next ? next : current));
      // Never let an editor opened yesterday write values into the new day.
      if (sheetRef.current) {
        setSheet(null);
        setNotice({ id: Date.now(), message: "A new day started, so the open editor was closed.", undo: null });
      }
    };
    const interval = window.setInterval(check, 30_000);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
    };
  }, [ready]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(
      () => setNotice((current) => (current && current.id === notice.id ? null : current)),
      notice.undo ? 7_000 : 3_200,
    );
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [page]);

  const showNotice = useCallback((message: string, undo: Change | null = null) => {
    setNotice({ id: Date.now(), message, undo });
  }, []);

  const commit = useCallback(
    async (result: Result, message: string, undoable = true): Promise<string | null> => {
      if (!result.ok) return result.error;
      if (isEmptyChange(result.change)) {
        showNotice(message);
        return null;
      }
      const inverse = undoable ? invertChange(snapRef.current, result.change) : null;
      try {
        await localDailyStore.apply(result.change);
        const next = await localDailyStore.load();
        snapRef.current = next;
        setSnap(next);
        showNotice(message, inverse);
        return null;
      } catch (error) {
        try {
          const next = await localDailyStore.load();
          snapRef.current = next;
          setSnap(next);
        } catch {
          // The original error is the useful one.
        }
        return error instanceof Error ? error.message : "Could not save. Nothing was changed.";
      }
    },
    [showNotice],
  );

  const undo = useCallback(async () => {
    const pending = notice?.undo;
    if (!pending) return;
    setNotice(null);
    try {
      await localDailyStore.apply(pending);
      const next = await localDailyStore.load();
      snapRef.current = next;
      setSnap(next);
      showNotice("Change undone");
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Could not undo that change.");
    }
  }, [notice, showNotice]);

  const replace = useCallback(
    async (next: Snapshot): Promise<string | null> => {
      try {
        await localDailyStore.replaceAll(next);
        const loaded = await localDailyStore.load();
        snapRef.current = loaded;
        setSnap(loaded);
        setSheet(null);
        showNotice("Daily Tracker data restored");
        return null;
      } catch (error) {
        return error instanceof Error ? error.message : "Restore failed. Nothing was changed.";
      }
    },
    [showNotice],
  );

  const openSheet = useCallback((next: SheetState) => setSheet(next), []);
  const closeSheet = useCallback(() => setSheet(null), []);

  const navigate = useCallback((next: PageId) => {
    setSheet(null);
    setPage(next);
  }, []);

  const api: DailyApi = {
    snap,
    settings: settingsOf(snap),
    today,
    selected: selected || today,
    setSelected,
    commit,
    replace,
    notify: (message: string) => showNotice(message),
    openSheet,
    setPage: navigate,
  };

  if (loadError) {
    return (
      <div className="daily">
        <div className="daily-appbar">
          <button type="button" className="daily-back" onClick={onBack}>
            ‹ Apps
          </button>
          <span className="daily-appbar-title">Daily Tracker</span>
          <span />
        </div>
        <div className="daily-page">
          <p className="daily-error" role="alert">
            Your local data could not be opened: {loadError} Nothing has been changed.
          </p>
        </div>
      </div>
    );
  }

  const sheetOpen = sheet !== null;

  return (
    <div className="daily">
      <div className="daily-appbar" inert={sheetOpen ? true : undefined}>
        <button type="button" className="daily-back" onClick={onBack}>
          ‹ Apps
        </button>
        <span className="daily-appbar-title">Daily Tracker</span>
        <span className="daily-appbar-status">
          <i aria-hidden /> Local
        </span>
      </div>

      {!ready ? (
        <p className="daily-loading">Opening your local tracker…</p>
      ) : (
        <div className="daily-body" inert={sheetOpen ? true : undefined}>
          {page === "today" ? <TodayPage api={api} /> : null}
          {page === "history" ? <HistoryPage api={api} /> : null}
          {page === "trends" ? <TrendsPage api={api} /> : null}
          {page === "settings" ? <SettingsPage api={api} /> : null}
        </div>
      )}

      {ready ? (
        <nav className="daily-nav" aria-label="Daily Tracker sections" inert={sheetOpen ? true : undefined}>
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`daily-nav-item${page === item.id ? " is-active" : ""}`}
              onClick={() => navigate(item.id)}
              aria-current={page === item.id ? "page" : undefined}
            >
              <span className="daily-nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      ) : null}

      {notice ? (
        <div className="daily-toast" role="status">
          <span>{notice.message}</span>
          {notice.undo ? (
            <button type="button" className="daily-toast-undo" onClick={() => void undo()}>
              Undo
            </button>
          ) : null}
        </div>
      ) : null}

      {sheet?.kind === "steps" ? <StepsSheet api={api} onClose={closeSheet} /> : null}
      {sheet?.kind === "calories" ? <CaloriesSheet api={api} onClose={closeSheet} /> : null}
      {sheet?.kind === "sleep" ? <SleepSheet api={api} onClose={closeSheet} /> : null}
      {sheet?.kind === "water" ? <WaterSheet api={api} onClose={closeSheet} /> : null}
      {sheet?.kind === "weight" ? <WeightSheet api={api} onClose={closeSheet} /> : null}
      {sheet?.kind === "quicklog" ? <QuickLogSheet api={api} onClose={closeSheet} /> : null}
    </div>
  );
}
