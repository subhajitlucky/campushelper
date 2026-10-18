import { z } from 'zod';

/**
 * Schemas for handover verification.
 *
 * The code is a short-lived proof of a physical handover, not a password, so it
 * is exactly six digits. Verification attempts are capped in the route.
 */

export const MAX_HANDOVER_ATTEMPTS = 5;

/** How long an issued code stays valid. */
export const HANDOVER_CODE_TTL_HOURS = 72;

export const handoverCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, 'The handover code must be exactly 6 digits');

export const verifyHandoverSchema = z.object({
  code: handoverCodeSchema,
});

export const reissueHandoverSchema = z.object({
  reissue: z.literal(true),
});

/** Body is either a verification attempt or an explicit re-issue request. */
export const handoverActionSchema = z.union([verifyHandoverSchema, reissueHandoverSchema]);

export const handoverParamSchema = z.object({
  id: z.string().min(1, 'Claim ID is required'),
});

export type VerifyHandoverInput = z.infer<typeof verifyHandoverSchema>;
export type HandoverActionInput = z.infer<typeof handoverActionSchema>;
