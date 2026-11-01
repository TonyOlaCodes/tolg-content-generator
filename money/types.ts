export type AccountKind = "current" | "digital" | "cash" | "savings" | "investment" | "custom";

export const ACCOUNT_KINDS: Record<AccountKind, { label: string; excludeFromSpendable: boolean }> = {
  current: { label: "Current account", excludeFromSpendable: false },
  digital: { label: "Revolut / digital", excludeFromSpendable: false },
  cash: { label: "Cash", excludeFromSpendable: false },
  savings: { label: "Savings", excludeFromSpendable: true },
  investment: { label: "Investment", excludeFromSpendable: true },
  custom: { label: "Custom", excludeFromSpendable: false },
};

export type Account = {
  id: string;
  name: string;
  kind: AccountKind;
  openingCents: number;
  excludeFromSpendable: boolean;
  archived: boolean;
  createdAt: string;
};

export type CategoryKind = "spending" | "saving";

export type Category = {
  id: string;
  name: string;
  icon: string;
  color: string;
  kind: CategoryKind;
  /** Suggested monthly target (used as default allocation after a "reset" rollover and in the forecast plan). */
  targetCents: number;
  /** Optional savings goal for progress bars. */
  goalCents: number | null;
  archived: boolean;
  order: number;
};

export type TxKind = "expense" | "income" | "transfer" | "refund" | "adjustment";
export type TxStatus = "planned" | "confirmed";

export type Transaction = {
  id: string;
  kind: TxKind;
  status: TxStatus;
  date: string;
  /** Positive for every kind except adjustment, where it is signed (+ adds money, - removes it). */
  amountCents: number;
  accountId: string | null;
  /** Destination account for transfers only. */
  toAccountId: string | null;
  categoryId: string | null;
  description: string;
  notes: string;
  recurringId: string | null;
  occurrenceDate: string | null;
  /** True when this record reverses another transaction (its effects are negated). */
  reverses: boolean;
  reversedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Rollover = "carry" | "release" | "reset";

export type Allocation = {
  /** `${month}|${categoryId}` */
  key: string;
  month: string;
  categoryId: string;
  cents: number;
};

export type Closure = { month: string; choices: Record<string, Rollover> };

export type RecurringKind = "bill" | "income";
export type Interval = "weekly" | "monthly" | "yearly" | "custom";

export type Recurring = {
  id: string;
  kind: RecurringKind;
  name: string;
  icon: string;
  amountCents: number;
  interval: Interval;
  customDays: number | null;
  dayOfMonth: number;
  nextDue: string;
  categoryId: string | null;
  accountId: string | null;
  status: "active" | "paused" | "cancelled";
  notes: string;
  history: { date: string; outcome: "paid" | "skipped"; txId: string | null }[];
  createdAt: string;
  updatedAt: string;
};

export type Settings = { id: "main"; plannedSpendAccountId: string | null };

export type Snapshot = {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  recurring: Recurring[];
  allocations: Allocation[];
  closures: Closure[];
  settings: Settings | null;
};

export const EMPTY_SNAPSHOT: Snapshot = {
  accounts: [],
  categories: [],
  transactions: [],
  recurring: [],
  allocations: [],
  closures: [],
  settings: null,
};

type Preset = Omit<Category, "id" | "archived" | "order" | "goalCents">;

/** Suggested targets only. Only the four euro amounts are suggestions; everything else starts empty. */
export const DEFAULT_CATEGORIES: { id: string; preset: Preset }[] = [
  { id: "food", preset: { name: "Food", icon: "🍎", color: "#34d399", kind: "spending", targetCents: 30000 } },
  { id: "transport", preset: { name: "Transport", icon: "🚌", color: "#7cc7ff", kind: "spending", targetCents: 25000 } },
  { id: "subscriptions", preset: { name: "Subscriptions", icon: "🔁", color: "#a78bfa", kind: "spending", targetCents: 25000 } },
  { id: "discretionary", preset: { name: "Discretionary spending", icon: "🛍", color: "#f472b6", kind: "spending", targetCents: 25000 } },
  { id: "savings", preset: { name: "Savings", icon: "🐷", color: "#ffd166", kind: "saving", targetCents: 0 } },
  { id: "emergency", preset: { name: "Emergency fund", icon: "🛟", color: "#fb923c", kind: "saving", targetCents: 0 } },
  { id: "gym", preset: { name: "Gym and fitness", icon: "🏋", color: "#2ec4b6", kind: "spending", targetCents: 0 } },
  { id: "car", preset: { name: "Car maintenance", icon: "🔧", color: "#94a3b8", kind: "spending", targetCents: 0 } },
  { id: "shopping", preset: { name: "Shopping and clothes", icon: "👕", color: "#e879f9", kind: "spending", targetCents: 0 } },
  { id: "entertainment", preset: { name: "Entertainment", icon: "🎬", color: "#f87171", kind: "spending", targetCents: 0 } },
  { id: "travel", preset: { name: "Travel", icon: "✈", color: "#38bdf8", kind: "spending", targetCents: 0 } },
  { id: "gifts", preset: { name: "Gifts", icon: "🎁", color: "#fca5a5", kind: "spending", targetCents: 0 } },
  { id: "other", preset: { name: "Other", icon: "•", color: "#a3a3a3", kind: "spending", targetCents: 0 } },
];

export function defaultCategories(): Category[] {
  return DEFAULT_CATEGORIES.map((c, i) => ({ id: c.id, ...c.preset, goalCents: null, archived: false, order: i }));
}
