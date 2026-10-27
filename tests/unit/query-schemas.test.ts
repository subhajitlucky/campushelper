import { describe, expect, it } from 'vitest';

import { itemsQuerySchema } from '@/lib/schemas/item';
import {
  MAX_PAGE,
  isoDateSchema,
  limitSchema,
  pageSchema,
} from '@/lib/schemas/query';

describe('pageSchema', () => {
  it('defaults to page 1 when absent or blank', () => {
    expect(pageSchema.parse(undefined)).toBe(1);
    expect(pageSchema.parse('')).toBe(1);
  });

  it('accepts a positive whole page', () => {
    expect(pageSchema.parse('2')).toBe(2);
    expect(pageSchema.parse(String(MAX_PAGE))).toBe(MAX_PAGE);
  });

  it('rejects text, fractions, zero, negatives, and overflow', () => {
    for (const value of ['1abc', '1.5', '0', '-1', '99999999999999999999']) {
      expect(pageSchema.safeParse(value).success, value).toBe(false);
    }
  });

  it('rejects a page above the safe maximum', () => {
    expect(pageSchema.safeParse(String(MAX_PAGE + 1)).success).toBe(false);
  });
});

describe('limitSchema', () => {
  it('uses the caller-provided default', () => {
    expect(limitSchema(50).parse(undefined)).toBe(50);
    expect(limitSchema(20).parse('')).toBe(20);
  });

  it('accepts 1 through 100 and rejects everything else', () => {
    expect(limitSchema().parse('1')).toBe(1);
    expect(limitSchema().parse('100')).toBe(100);

    for (const value of ['0', '101', '-5', '10.5', '10abc']) {
      expect(limitSchema().safeParse(value).success, value).toBe(false);
    }
  });
});

describe('isoDateSchema', () => {
  it('accepts real calendar dates and timestamps', () => {
    expect(isoDateSchema.safeParse('2024-02-29').success).toBe(true);
    expect(isoDateSchema.safeParse('2024-01-31T10:30:00Z').success).toBe(true);
    expect(isoDateSchema.safeParse('2024-01-31T10:30:00.123+05:30').success).toBe(true);
  });

  it('rejects impossible calendar dates that Date.parse rolls over', () => {
    // Date.parse('2024-02-30') silently means 1 March.
    expect(isoDateSchema.safeParse('2024-02-30').success).toBe(false);
    expect(isoDateSchema.safeParse('2023-02-29').success).toBe(false);
    expect(isoDateSchema.safeParse('2024-13-01').success).toBe(false);
  });

  it('rejects bare numbers and loose date strings', () => {
    // Date.parse('1') means the year 2001.
    expect(isoDateSchema.safeParse('1').success).toBe(false);
    expect(isoDateSchema.safeParse('01/02/2024').success).toBe(false);
    expect(isoDateSchema.safeParse('not-a-date').success).toBe(false);
  });

  it('rejects impossible times and offsets', () => {
    expect(isoDateSchema.safeParse('2024-01-01T24:00:00Z').success).toBe(false);
    expect(isoDateSchema.safeParse('2024-01-01T10:60:00Z').success).toBe(false);
    expect(isoDateSchema.safeParse('2024-01-01T10:30:00+25:00').success).toBe(false);
  });
});

describe('itemsQuerySchema', () => {
  it('applies pagination defaults and validates filters', () => {
    const parsed = itemsQuerySchema.parse({});
    expect(parsed.page).toBe(1);
    expect(parsed.limit).toBe(20);

    expect(itemsQuerySchema.safeParse({ page: 'abc' }).success).toBe(false);
    expect(itemsQuerySchema.safeParse({ from: '2024-02-30' }).success).toBe(false);
  });
});
