import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Conditionally joins Tailwind CSS class names and resolves conflicts.
 * Combines clsx for conditional joining with tailwind-merge for dedup.
 *
 * @example
 * cn("px-2 py-1", isActive && "bg-blue-500", "px-4") // → "py-1 bg-blue-500 px-4"
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Formats an integer cents amount as a localized currency string.
 * Money is always stored/transmitted in integer cents to avoid IEEE-754 drift.
 *
 * @param cents - Integer value in minor currency units (e.g., 1250 for $12.50)
 * @param currency - ISO 4217 currency code (default "USD")
 */
export function formatCurrency(cents: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

/**
 * Formats a Date or ISO-8601 string using Intl.DateTimeFormat.
 *
 * @param date - Date object or ISO date string
 * @param locale - BCP 47 locale tag (default "en-US")
 */
export function formatDate(
  date: Date | string,
  locale: string = "en-US"
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d);
}

/**
 * Generates a RFC4122 UUID v4 with an optional short prefix.
 * Primary use is test fixtures; production IDs come from the DB layer.
 *
 * @param prefix - Optional string prepended to the UUID (e.g., "org_")
 */
export function generateId(prefix?: string): string {
  const uuid = crypto.randomUUID();
  return prefix ? `${prefix}${uuid}` : uuid;
}

/**
 * Simple promise-based sleep, useful for rate-limits and test timeouts.
 *
 * @param ms - Milliseconds to pause
 */
export function sleep(ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Returns a shallow copy of `obj` without the specified keys.
 * Type-safe: output type correctly omits the removed keys.
 */
export function omit<T, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  const result = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result;
}

/**
 * Returns a shallow copy of `obj` containing only the specified keys.
 * Type-safe: output type correctly picks only the selected keys.
 */
export function pick<T, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    result[key] = obj[key];
  }
  return result;
}

/**
 * Returns true for "empty" values: null, undefined, "", [], {}, NaN.
 * Non-zero numbers, booleans (incl. false), and Dates are *not* empty.
 */
export function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.length === 0;
  if (typeof value === "number") return Number.isNaN(value);
  if (typeof value === "boolean") return false;
  if (value instanceof Date) return false;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value as Record<string, unknown>).length === 0;
  return false;
}
