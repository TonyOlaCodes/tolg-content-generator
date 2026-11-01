/**
 * Local-calendar date helpers.
 *
 * The app stores entries against the user's *local* calendar day. We never use
 * `toISOString()` for day keys because that converts to UTC and would move an
 * evening entry to the next day (or an early-morning entry to the previous
 * one) in most time zones. Every key is built from local date parts, and day
 * arithmetic is done in UTC from those parts so daylight-saving changes cannot
 * add or lose a day.
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Parses a local date key to local midnight, or null when invalid. */
export function parseDateKey(key: string): Date | null {
  if (!DATE_KEY_RE.test(key)) return null;
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  // Rejects impossible dates such as 2026-02-31.
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return date;
}

export function isDateKey(value: unknown): value is string {
  return typeof value === "string" && parseDateKey(value) !== null;
}

export function todayKey(now: Date = new Date()): string {
  return toDateKey(now);
}

export function addDays(key: string, days: number): string {
  const date = parseDateKey(key);
  if (!date) return key;
  const shifted = new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
  return toDateKey(shifted);
}

/** Whole calendar days from `a` to `b` (positive when `b` is later). */
export function daysBetween(a: string, b: string): number {
  const da = parseDateKey(a);
  const db = parseDateKey(b);
  if (!da || !db) return 0;
  const ua = Date.UTC(da.getFullYear(), da.getMonth(), da.getDate());
  const ub = Date.UTC(db.getFullYear(), db.getMonth(), db.getDate());
  return Math.round((ub - ua) / 86_400_000);
}

export function compareDateKeys(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Marketing Monday-first week start. */
export function startOfWeek(key: string): string {
  const date = parseDateKey(key);
  if (!date) return key;
  const offset = (date.getDay() + 6) % 7;
  return addDays(key, -offset);
}

export function startOfMonth(key: string): string {
  const date = parseDateKey(key);
  if (!date) return key;
  return `${key.slice(0, 7)}-01`;
}

export function startOfYear(key: string): string {
  return `${key.slice(0, 4)}-01-01`;
}

export function monthKey(key: string): string {
  return key.slice(0, 7);
}

export function monthStart(month: string): string {
  return `${month}-01`;
}

export function addMonths(month: string, count: number): string {
  const [y, m] = month.split("-").map(Number);
  const date = new Date(y, m - 1 + count, 1);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

/** Every day key from `from` to `to` inclusive. Caps runaway ranges. */
export function eachDay(from: string, to: string, max = 4_000): string[] {
  const out: string[] = [];
  const total = daysBetween(from, to);
  if (total < 0) return out;
  for (let i = 0; i <= Math.min(total, max - 1); i += 1) out.push(addDays(from, i));
  return out;
}

export function dayOfMonth(key: string): number {
  return Number(key.slice(8, 10));
}

export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) return month;
  return `${MONTHS[m - 1]} ${y}`;
}

export function shortDate(key: string, withYear = false): string {
  const date = parseDateKey(key);
  if (!date) return key;
  return `${date.getDate()} ${MONTHS[date.getMonth()]}${withYear ? ` ${date.getFullYear()}` : ""}`;
}

export function weekdayShort(key: string): string {
  const date = parseDateKey(key);
  return date ? WEEKDAYS[date.getDay()] : "";
}

export function weekdayLong(key: string): string {
  const date = parseDateKey(key);
  return date ? WEEKDAYS_LONG[date.getDay()] : "";
}

export function weekdayInitialsMondayFirst(): string[] {
  return ["M", "T", "W", "T", "F", "S", "S"];
}

/**
 * Friendly label used in the Today header and day lists.
 * `today` is passed in so labels also update when the local day rolls over.
 */
export function dayLabel(key: string, today: string, withWeekday = true): string {
  const date = parseDateKey(key);
  if (!date) return key;
  const diff = daysBetween(key, today);
  const year = date.getFullYear() !== Number(today.slice(0, 4)) ? ` ${date.getFullYear()}` : "";
  const value = `${date.getDate()} ${MONTHS[date.getMonth()]}${year}`;
  const weekday = withWeekday ? `${WEEKDAYS_LONG[date.getDay()]} · ` : "";
  if (diff === 0) return `Today · ${weekday}${value}`;
  if (diff === 1) return `Yesterday · ${weekday}${value}`;
  if (diff === -1) return `Tomorrow · ${weekday}${value}`;
  return `${weekday}${value}`;
}

export function longDate(key: string): string {
  const date = parseDateKey(key);
  if (!date) return key;
  return `${WEEKDAYS_LONG[date.getDay()]}, ${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export function shortWeekdayDate(key: string): string {
  return `${weekdayShort(key)} ${shortDate(key, true)}`;
}

/** Calendar grid for a month: leading blanks (Monday first) plus day keys. */
export function monthGrid(month: string): (string | null)[] {
  const first = monthStart(month);
  const date = parseDateKey(first);
  if (!date) return [];
  const leading = (date.getDay() + 6) % 7;
  const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const cells: (string | null)[] = Array.from({ length: leading }, () => null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(`${month}-${pad(d)}`);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}
