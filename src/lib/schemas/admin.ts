import { z } from 'zod';
import { AuditAction } from '@/generated/prisma';

/**
 * Schemas for the admin audit log and bulk moderation endpoints.
 */

/** Bulk operations are capped so one request cannot rewrite the whole table. */
export const MAX_BULK_IDS = 50;

const bulkIdsSchema = z
  .array(z.string().min(1, 'ID must not be empty'))
  .min(1, 'Provide at least one ID')
  .max(MAX_BULK_IDS, `At most ${MAX_BULK_IDS} items can be changed at once`);

const reasonSchema = z
  .string()
  .trim()
  .min(3, 'Reason must be at least 3 characters')
  .max(500, 'Reason must not exceed 500 characters');

export const bulkItemActionSchema = z
  .object({
    ids: bulkIdsSchema,
    action: z.enum(['FLAG', 'REMOVE', 'RESTORE']),
    reason: reasonSchema.optional(),
  })
  .refine((body) => body.action === 'RESTORE' || Boolean(body.reason), {
    message: 'A reason is required when flagging or removing items',
    path: ['reason'],
  });

export const bulkUserActionSchema = z
  .object({
    ids: bulkIdsSchema,
    action: z.enum(['DEACTIVATE', 'REACTIVATE', 'VERIFY_STUDENT', 'UNVERIFY_STUDENT']),
    reason: reasonSchema.optional(),
  })
  .refine((body) => body.action === 'REACTIVATE' || Boolean(body.reason), {
    message: 'A reason is required for this action',
    path: ['reason'],
  });

const pageSchema = z
  .string()
  .optional()
  .transform((value) => (value ? Number.parseInt(value, 10) : 1))
  .refine((value) => Number.isInteger(value) && value > 0, 'Page must be greater than 0');

const limitSchema = z
  .string()
  .optional()
  .transform((value) => (value ? Number.parseInt(value, 10) : 50))
  .refine(
    (value) => Number.isInteger(value) && value > 0 && value <= 100,
    'Limit must be between 1 and 100'
  );

const isoDateSchema = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), 'Must be a valid ISO date');

export const auditQuerySchema = z
  .object({
    page: pageSchema,
    limit: limitSchema,
    actorId: z.string().min(1).optional(),
    action: z.nativeEnum(AuditAction).optional(),
    targetType: z.enum(['Item', 'User', 'Claim']).optional(),
    targetId: z.string().min(1).optional(),
    from: isoDateSchema.optional(),
    to: isoDateSchema.optional(),
  })
  .refine(
    (query) => !query.from || !query.to || Date.parse(query.from) <= Date.parse(query.to),
    { message: 'The "from" date must not be after the "to" date', path: ['from'] }
  );

export type BulkItemActionInput = z.infer<typeof bulkItemActionSchema>;
export type BulkUserActionInput = z.infer<typeof bulkUserActionSchema>;
export type AuditQueryInput = z.infer<typeof auditQuerySchema>;
