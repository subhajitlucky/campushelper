import { z } from 'zod';

/**
 * Shared query-string primitives.
 *
 * Query values arrive as strings, so these schemas are the one place that
 * decides what a number or a date in a URL is allowed to mean. `parseInt` is
 * deliberately avoided: `parseInt('1abc')` silently becomes `1`, and a page
 * value beyond `Number.MAX_SAFE_INTEGER` produced a `skip` Prisma could not
 * represent.
 */

/** Largest page number we accept. Keeps `skip` comfortably inside an Int. */
export const MAX_PAGE = 100_000;

function wholeNumber(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') return fallback;
  return Number(value);
}

/** A 1-based page number, defaulting to 1 when absent or blank. */
export const pageSchema = z
  .string()
  .optional()
  .transform((value) => wholeNumber(value, 1))
  .refine(
    (value) => Number.isSafeInteger(value) && value > 0 && value <= MAX_PAGE,
    `Page must be a whole number between 1 and ${MAX_PAGE}`
  );

/** A page size between 1 and 100, with a caller-chosen default. */
export function limitSchema(defaultLimit = 20) {
  return z
    .string()
    .optional()
    .transform((value) => wholeNumber(value, defaultLimit))
    .refine(
      (value) => Number.isSafeInteger(value) && value > 0 && value <= 100,
      'Limit must be a whole number between 1 and 100'
    );
}

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})$/;

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;

  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/**
 * Whether a string is a real ISO 8601 date.
 *
 * `Date.parse('2024-02-30')` rolls over to 1 March and `Date.parse('1')` means
 * the year 2001, so both would slip through a `!isNaN(Date.parse(...))` check.
 * This requires either `YYYY-MM-DD` or a full timestamp with a timezone, and
 * verifies the calendar round-trips.
 */
export function isValidIsoDate(value: string): boolean {
  const dateOnly = DATE_ONLY_PATTERN.exec(value);
  if (dateOnly) {
    return isValidCalendarDate(
      Number(dateOnly[1]),
      Number(dateOnly[2]),
      Number(dateOnly[3])
    );
  }

  const dateTime = DATE_TIME_PATTERN.exec(value);
  if (!dateTime) return false;

  const [, year, month, day, hour, minute, second, , offset] = dateTime;

  if (!isValidCalendarDate(Number(year), Number(month), Number(day))) return false;
  if (Number(hour) > 23 || Number(minute) > 59) return false;
  if (second !== undefined && Number(second) > 59) return false;

  if (offset !== 'Z') {
    const [offsetHour, offsetMinute] = offset.slice(1).split(':').map(Number);
    if (offsetHour > 23 || offsetMinute > 59) return false;
  }

  return !Number.isNaN(Date.parse(value));
}

export const isoDateSchema = z
  .string()
  .refine(isValidIsoDate, 'Must be a valid ISO date (YYYY-MM-DD or an ISO timestamp)');
