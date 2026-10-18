import { z } from 'zod';
import { slugSchema, tagsSchema } from './taxonomy';

/**
 * Schemas for match suggestions and the duplicate-post guard.
 */

/** What a user can do with a suggestion. */
export const matchActionSchema = z.object({
  action: z.enum(['dismiss', 'confirm']),
});

export const matchIdParamSchema = z.object({
  id: z.string().min(1, 'Match ID is required'),
});

/** Query for listing an item's suggestions. */
export const matchesQuerySchema = z.object({
  status: z.enum(['SUGGESTED', 'DISMISSED', 'CONFIRMED']).optional().default('SUGGESTED'),
});

/**
 * The extra fields `POST /api/items` accepts, including the duplicate-guard
 * acknowledgement that lets a client insist on posting a near-duplicate.
 */
export const duplicateGuardFieldsSchema = z.object({
  acknowledgeDuplicates: z.boolean().optional().default(false),
});

/** A preview of an item that looks like a duplicate of the one being posted. */
export const duplicateCandidateSchema = z.object({
  id: z.string(),
  title: z.string(),
  itemType: z.enum(['LOST', 'FOUND']),
  location: z.string(),
  createdAt: z.string(),
  score: z.number(),
  similarity: z.number(),
  reasons: z.array(
    z.object({
      code: z.string(),
      label: z.string(),
      weight: z.number(),
    })
  ),
});

export type MatchActionInput = z.infer<typeof matchActionSchema>;
export type DuplicateCandidate = z.infer<typeof duplicateCandidateSchema>;
export type MatchesQueryInput = z.infer<typeof matchesQuerySchema>;

/** Re-exported so route handlers import taxonomy rules from one place. */
export { slugSchema, tagsSchema };
