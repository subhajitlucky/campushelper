import { z } from 'zod';
import { slugSchema, tagsSchema } from './taxonomy';

/**
 * Schemas for match suggestions and the duplicate-post guard.
 */

/** What a user can do with a suggestion. */
export const matchActionSchema = z.object({
  action: z.enum(['dismiss', 'confirm']),
});

/**
 * The extra fields `POST /api/items` accepts, including the duplicate-guard
 * acknowledgement that lets a client insist on posting a near-duplicate.
 */
export type MatchActionInput = z.infer<typeof matchActionSchema>;

/** Re-exported so route handlers import taxonomy rules from one place. */
export { slugSchema, tagsSchema };
