import { z } from 'zod';

/**
 * Taxonomy schemas: item tags, categories, and campus zones.
 *
 * Tag handling is deliberately forgiving about *shape* (spaces and underscores
 * become hyphens, case is folded) but strict about *content*: anything left
 * outside `[a-z0-9-]` is a validation error rather than being silently stripped,
 * so a user who types `he!!o` is told about it instead of quietly getting `heo`.
 */

export const MAX_TAGS_PER_ITEM = 8;
export const MAX_TAG_LENGTH = 24;
export const MIN_TAG_LENGTH = 2;

/**
 * Canonicalise a raw tag: trim, lowercase, and turn whitespace or underscores
 * into single hyphens.
 */
export function normalizeTag(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** A single canonical tag. */
export const tagSchema = z
  .string()
  .transform(normalizeTag)
  .pipe(
    z
      .string()
      .min(MIN_TAG_LENGTH, `Tags must be at least ${MIN_TAG_LENGTH} characters`)
      .max(MAX_TAG_LENGTH, `Tags must not exceed ${MAX_TAG_LENGTH} characters`)
      .regex(/^[a-z0-9-]+$/, 'Tags may only contain letters, numbers, and hyphens')
  );

/**
 * A tag list: normalised, de-duplicated, order-preserving, and capped.
 *
 * More than {@link MAX_TAGS_PER_ITEM} tags is an error rather than a silent
 * truncation, because dropping a user's input without telling them is worse.
 */
export const tagsSchema = z
  .array(z.string())
  .transform((raw) => {
    const seen = new Set<string>();
    const result: string[] = [];

    for (const entry of raw) {
      const normalized = normalizeTag(entry);
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      result.push(normalized);
    }

    return result;
  })
  .pipe(
    z
      .array(tagSchema)
      .max(MAX_TAGS_PER_ITEM, `An item may have at most ${MAX_TAGS_PER_ITEM} tags`)
  );

/** A category or zone slug as it appears in a URL or query string. */
export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Slug is required')
  .max(64, 'Slug must not exceed 64 characters')
  .regex(/^[a-z0-9-]+$/, 'Slug may only contain letters, numbers, and hyphens');

export type TagInput = z.infer<typeof tagSchema>;
