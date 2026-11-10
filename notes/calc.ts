// Small, dependency-free helpers for Notes: prices, money labels and inline arithmetic.
// Everything works on numbers (cents rounding) so totals never drift through float noise.

export const CURRENCIES = ["EUR", "GBP", "USD", "CHF", "SEK", "PLN"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const CURRENCY_LABELS: Record<Currency, string> = {
  EUR: "Euro",
  GBP: "Pound",
  USD: "Dollar",
  CHF: "Franc",
  SEK: "Krona",
  PLN: "Zloty",
};

const PREFIX: Record<Currency, string> = { EUR: "€", GBP: "£", USD: "$", CHF: "CHF ", SEK: "", PLN: "" };
const SUFFIX: Record<Currency, string> = { EUR: "", GBP: "", USD: "", CHF: "", SEK: " kr", PLN: " zł" };

export function currencySymbol(currency: Currency): string {
  return PREFIX[currency].trim();
}

export function isCurrency(value: unknown): value is Currency {
  return typeof value === "string" && (CURRENCIES as readonly string[]).includes(value);
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** A compact amount for inputs and table sums: 83.05, 60, 1250. */
export function formatAmount(value: number): string {
  const rounded = roundMoney(value);
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

/** Money with its symbol, matching the examples: €213.05, £60.00, 60.00 kr. */
export function formatMoney(value: number, currency: Currency = "EUR"): string {
  const sign = value < 0 ? "-" : "";
  const rounded = Math.abs(roundMoney(value));
  const amount = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
  return `${sign}${PREFIX[currency]}${amount}${SUFFIX[currency]}`;
}

/**
 * Reads a price typed by hand: "€83.05", "83,05", "1.250,00" and "1,250.00" all work.
 * Blank or non-numeric text returns null so a checklist stays a plain checklist.
 */
export function parsePrice(input: string): number | null {
  let text = input.trim();
  if (!text) return null;
  text = text.replace(/\s+/g, "");
  text = text.replace(/[€£$]/g, "").replace(/^chf/i, "").replace(/kr$/i, "").replace(/zł$/i, "");
  if (!text) return null;

  const comma = text.includes(",");
  const dot = text.includes(".");
  if (comma && dot) {
    // Whichever separator comes last is the decimal one.
    text =
      text.lastIndexOf(",") > text.lastIndexOf(".")
        ? text.replace(/\./g, "").replace(",", ".")
        : text.replace(/,/g, "");
  } else if (comma) {
    const parts = text.split(",");
    text = parts.length === 2 && parts[1].length <= 2 ? text.replace(",", ".") : text.replace(/,/g, "");
  }

  // A trailing separator is still being typed: "83." should already count as 83.
  text = text.replace(/[.,]$/, "");
  if (!/^\d+(\.\d+)?$/.test(text)) return null;
  const value = Number(text);
  return Number.isFinite(value) ? roundMoney(value) : null;
}

type Token = { type: "number"; value: number } | { type: "op"; value: "+" | "-" | "*" | "/" } | { type: "open" } | { type: "close" } | { type: "currency"; value: Currency };

function numberToken(raw: string): number | null {
  const normalized = raw.replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function tokenize(expression: string): Token[] | null {
  const tokens: Token[] = [];
  let index = 0;
  while (index < expression.length) {
    const char = expression[index];
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }
    if (/[0-9]/.test(char)) {
      let raw = "";
      while (index < expression.length && /[0-9.,]/.test(expression[index])) {
        raw += expression[index];
        index += 1;
      }
      const value = numberToken(raw);
      if (value === null) return null;
      tokens.push({ type: "number", value });
      continue;
    }
    if (char === "€") {
      tokens.push({ type: "currency", value: "EUR" });
      index += 1;
      continue;
    }
    if (char === "£") {
      tokens.push({ type: "currency", value: "GBP" });
      index += 1;
      continue;
    }
    if (char === "$") {
      tokens.push({ type: "currency", value: "USD" });
      index += 1;
      continue;
    }
    if (char === "+" || char === "-") {
      tokens.push({ type: "op", value: char });
      index += 1;
      continue;
    }
    if (char === "*" || char === "×") {
      tokens.push({ type: "op", value: "*" });
      index += 1;
      continue;
    }
    if (char === "/" || char === "÷") {
      tokens.push({ type: "op", value: "/" });
      index += 1;
      continue;
    }
    if (char === "(") {
      tokens.push({ type: "open" });
      index += 1;
      continue;
    }
    if (char === ")") {
      tokens.push({ type: "close" });
      index += 1;
      continue;
    }
    return null;
  }
  return tokens;
}

class ExpressionReader {
  private index = 0;
  constructor(private readonly tokens: Token[]) {}

  parse(): number | null {
    const value = this.expression();
    return value !== null && this.index === this.tokens.length ? value : null;
  }

  private expression(): number | null {
    let value = this.term();
    while (value !== null) {
      const token = this.tokens[this.index];
      if (!token || token.type !== "op" || (token.value !== "+" && token.value !== "-")) return value;
      this.index += 1;
      const right = this.term();
      if (right === null) return null;
      value = token.value === "+" ? value + right : value - right;
    }
    return value;
  }

  private term(): number | null {
    let value = this.factor();
    while (value !== null) {
      const token = this.tokens[this.index];
      if (!token || token.type !== "op" || (token.value !== "*" && token.value !== "/")) return value;
      this.index += 1;
      const right = this.factor();
      if (right === null) return null;
      if (token.value === "/" && right === 0) return null;
      value = token.value === "*" ? value * right : value / right;
    }
    return value;
  }

  private factor(): number | null {
    const token = this.tokens[this.index];
    if (!token) return null;
    if (token.type === "number") {
      this.index += 1;
      return token.value;
    }
    if (token.type === "op" && (token.value === "+" || token.value === "-")) {
      this.index += 1;
      const value = this.factor();
      if (value === null) return null;
      return token.value === "-" ? -value : value;
    }
    if (token.type === "open") {
      this.index += 1;
      const value = this.expression();
      if (value === null) return null;
      const close = this.tokens[this.index];
      if (!close || close.type !== "close") return null;
      this.index += 1;
      return value;
    }
    return null;
  }
}

export type Calculation = { value: number; currency: Currency | null; formatted: string };

/** Evaluates a simple arithmetic expression. Currency symbols only label the result. */
export function evaluateExpression(expression: string): Calculation | null {
  const tokens = tokenize(expression);
  if (!tokens || tokens.length === 0) return null;

  const currencies = new Set(tokens.filter((token): token is Extract<Token, { type: "currency" }> => token.type === "currency").map((token) => token.value));
  if (currencies.size > 1) return null;
  const currency = currencies.size === 1 ? [...currencies][0] : null;

  const numeric = tokens.filter((token) => token.type !== "currency");
  const value = new ExpressionReader(numeric).parse();
  if (value === null || !Number.isFinite(value) || Math.abs(value) > 1e12) return null;
  const rounded = roundMoney(value);
  return { value: rounded, currency, formatted: currency ? formatMoney(rounded, currency) : formatAmount(rounded) };
}

/**
 * When a line ends in "=", finishes the sum in place: "250 + 350 =" becomes
 * "250 + 350 = 600". Returns null when the line is not a calculation.
 */
export function completeCalculation(text: string, caret: number): { text: string; caret: number } | null {
  const safeCaret = Math.min(Math.max(caret, 0), text.length);
  const lineStart = text.lastIndexOf("\n", Math.max(0, safeCaret - 1)) + 1;
  const nextBreak = text.indexOf("\n", safeCaret);
  const lineEnd = nextBreak === -1 ? text.length : nextBreak;
  const line = text.slice(lineStart, lineEnd);
  if (!line.trim().endsWith("=")) return null;

  const equals = line.lastIndexOf("=");
  const expression = line.slice(0, equals).trim();
  if (!expression) return null;
  const result = evaluateExpression(expression);
  if (!result) return null;

  const nextLine = `${line.slice(0, equals + 1).trimEnd()} ${result.formatted}`;
  const nextText = `${text.slice(0, lineStart)}${nextLine}${text.slice(lineEnd)}`;
  return { text: nextText, caret: lineStart + nextLine.length };
}
