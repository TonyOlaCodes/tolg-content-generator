/** All money is stored as integer cents (EUR). Never use floats for stored amounts. */

const eur = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" });

export function formatEUR(cents: number): string {
  return eur.format(cents / 100);
}

/** Parses "1234.5", "1,234.50" or "€12". Returns null when the input is not a valid amount. */
export function parseEuroToCents(input: string): number | null {
  const s = input.trim().replace(/^€/, "").replace(/\s/g, "").replace(/,/g, "");
  if (!/^-?\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
}

/** Local calendar date as YYYY-MM-DD (never UTC, so Irish dates do not shift). */
export function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export const todayISO = () => isoDate(new Date());
export const currentMonth = () => todayISO().slice(0, 7);

export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export const monthOf = (iso: string) => iso.slice(0, 7);

/** "YYYY-MM" plus n months. */
export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

export function addDays(iso: string, n: number): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return isoDate(d);
}

/** Month-based shift keeping the anchor day, clamped to the target month's length (31 Jan + 1 month = 28/29 Feb). */
export function addMonthsKeepDay(iso: string, n: number, anchorDay: number): string {
  const target = addMonths(monthOf(iso), n);
  const day = Math.min(anchorDay, daysInMonth(target));
  return `${target}-${String(day).padStart(2, "0")}`;
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((parseISO(toIso).getTime() - parseISO(fromIso).getTime()) / 86_400_000);
}

export function formatDateIE(iso: string): string {
  return parseISO(iso).toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" });
}

export function formatMonthIE(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IE", { month: "long", year: "numeric" });
}

export function formatMonthShortIE(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IE", { month: "short" });
}

/** Human due label, e.g. "Due today", "Due in 3 days", "Overdue by 2 days". */
export function dueLabel(dueIso: string, today: string = todayISO()): { text: string; overdue: boolean } {
  const diff = daysBetween(today, dueIso);
  if (diff < 0) return { text: `Overdue by ${-diff} ${-diff === 1 ? "day" : "days"}`, overdue: true };
  if (diff === 0) return { text: "Due today", overdue: false };
  if (diff === 1) return { text: "Due tomorrow", overdue: false };
  return { text: `Due in ${diff} days`, overdue: false };
}

export type IntervalSpec = { interval: "weekly" | "monthly" | "yearly" | "custom"; customDays: number | null; dayOfMonth: number };

/** The next occurrence after `fromIso` for a recurring rule. */
export function nextOccurrence(spec: IntervalSpec, fromIso: string): string {
  switch (spec.interval) {
    case "weekly":
      return addDays(fromIso, 7);
    case "custom":
      return addDays(fromIso, Math.max(1, spec.customDays ?? 30));
    case "yearly":
      return addMonthsKeepDay(fromIso, 12, parseISO(fromIso).getDate());
    case "monthly":
      return addMonthsKeepDay(fromIso, 1, spec.dayOfMonth);
  }
}

/** Monthly-equivalent cost of a recurring amount, in cents (fractional cents rounded). */
export function monthlyEquivalentCents(amountCents: number, spec: IntervalSpec): number {
  switch (spec.interval) {
    case "weekly":
      return Math.round((amountCents * 52) / 12);
    case "monthly":
      return amountCents;
    case "yearly":
      return Math.round(amountCents / 12);
    case "custom":
      return Math.round((amountCents * 365) / Math.max(1, spec.customDays ?? 30) / 12);
  }
}
