import { z } from 'zod';
import { tagSchema } from './taxonomy';

/**
 * Schemas for saved searches.
 *
 * The filter payload is the *same* shape the item list accepts, so a saved
 * search can always be replayed against `GET /api/items`. Unknown keys are
 * rejected rather than ignored, so a renamed filter surfaces as a validation
 * error instead of silently never matching.
 */

const isoDateSchema = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), 'Must be a valid ISO date');

export const savedSearchFiltersSchema = z
  .object({
    search: z.string().trim().min(2, 'Search term must be at least 2 characters').max(100).optional(),
    itemType: z.enum(['LOST', 'FOUND']).optional(),
    category: z.string().trim().max(64).optional(),
    zone: z.string().trim().max(64).optional(),
    tags: z.array(tagSchema).max(8).optional(),
    from: isoDateSchema.optional(),
    to: isoDateSchema.optional(),
  })
  .strict()
  .refine(
    (filters) =>
      !filters.from || !filters.to || Date.parse(filters.from) <= Date.parse(filters.to),
    { message: 'The "from" date must not be after the "to" date', path: ['from'] }
  );

export const createSavedSearchSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(80, 'Name must not exceed 80 characters'),
  filters: savedSearchFiltersSchema,
});

export const savedSearchIdParamSchema = z.object({
  id: z.string().min(1, 'Saved search ID is required'),
});

/** Maximum saved searches per user, enforced in the route. */
export const MAX_SAVED_SEARCHES_PER_USER = 20;

export type SavedSearchFilters = z.infer<typeof savedSearchFiltersSchema>;
export type CreateSavedSearchInput = z.infer<typeof createSavedSearchSchema>;
