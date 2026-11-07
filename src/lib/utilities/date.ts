import {
  addMonths,
  endOfMonth,
  format,
  isAfter,
  isBefore,
  isSameDay,
  startOfMonth,
  subMonths,
} from 'date-fns';

export const dateUtils = {
  /** Formats a date as ISO string (YYYY-MM-DD). */
  toISODate(date: Date | string): string {
    return format(new Date(date), 'yyyy-MM-dd');
  },
  /** Formats a date as ISO datetime. */
  toISODateTime(date: Date | string): string {
    return new Date(date).toISOString();
  },
  /** Returns the start of the given month. */
  startOfMonth(date: Date | string): Date {
    return startOfMonth(new Date(date));
  },
  /** Returns the end of the given month. */
  endOfMonth(date: Date | string): Date {
    return endOfMonth(new Date(date));
  },
  /** Adds N months to a date. */
  addMonths(date: Date | string, months: number): Date {
    return addMonths(new Date(date), months);
  },
  /** Subtracts N months from a date. */
  subMonths(date: Date | string, months: number): Date {
    return subMonths(new Date(date), months);
  },
  /** Returns true if date is between start and end (inclusive). */
  isBetween(date: Date | string, start: Date | string, end: Date | string): boolean {
    const d = new Date(date);
    return (
      (isAfter(d, new Date(start)) || isSameDay(d, new Date(start))) &&
      (isBefore(d, new Date(end)) || isSameDay(d, new Date(end)))
    );
  },
  /** Returns the number of days between two dates. */
  daysBetween(start: Date | string, end: Date | string): number {
    const ms = new Date(end).getTime() - new Date(start).getTime();
    return Math.round(ms / (1000 * 60 * 60 * 24));
  },
  /** Formats a date for display. */
  format(date: Date | string, pattern = 'yyyy-MM-dd'): string {
    return format(new Date(date), pattern);
  },
};
