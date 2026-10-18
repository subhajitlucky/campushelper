import { z } from 'zod';

/**
 * Schemas for the notification inbox.
 */

/** Shared pagination parsing, matching the convention used by the item list. */
const pageSchema = z
  .string()
  .optional()
  .transform((value) => (value ? Number.parseInt(value, 10) : 1))
  .refine((value) => Number.isInteger(value) && value > 0, 'Page must be greater than 0');

const limitSchema = z
  .string()
  .optional()
  .transform((value) => (value ? Number.parseInt(value, 10) : 20))
  .refine(
    (value) => Number.isInteger(value) && value > 0 && value <= 100,
    'Limit must be between 1 and 100'
  );

export const notificationsQuerySchema = z.object({
  page: pageSchema,
  limit: limitSchema,
  unread: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
});

/**
 * Mark notifications read. Either a specific set of ids, or everything.
 *
 * The union is exclusive: `{ all: true }` cannot be combined with ids, so a
 * client can never accidentally mark more than it intended.
 */
export const markNotificationsReadSchema = z
  .object({
    all: z.literal(true).optional(),
    ids: z
      .array(z.string().min(1, 'Notification ID must not be empty'))
      .min(1, 'Provide at least one notification ID')
      .max(200, 'At most 200 notifications can be marked at once')
      .optional(),
  })
  // `.strict()` plus the refine are load-bearing. A plain `z.union` of two
  // non-strict objects strips unknown keys, so `{ all: true, ids: [...] }`
  // matched the first member and silently marked the WHOLE inbox read.
  .strict()
  .refine((value) => Boolean(value.all) !== Boolean(value.ids), {
    message: 'Provide either { all: true } or { ids: [...] }, not both',
  });

export type NotificationsQueryInput = z.infer<typeof notificationsQuerySchema>;
export type MarkNotificationsReadInput = z.infer<typeof markNotificationsReadSchema>;
