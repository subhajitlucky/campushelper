import { z } from 'zod';

// Base claim schema
export const baseClaimSchema = z.object({
  claimType: z.enum(['FOUND_IT', 'OWN_IT']),
  itemId: z.string().min(1, 'Item ID is required'),
  message: z.string().max(500, 'Message must be less than 500 characters').optional(),
});

// Schema for creating a claim
export const createClaimSchema = baseClaimSchema;

// Schema for claims query parameters
export const claimsQuerySchema = z.object({
  itemId: z.string().min(1, 'Item ID is required'),
});

// Schema for claim response
export const claimResponseSchema = z.object({
  id: z.string(),
  claimType: z.enum(['FOUND_IT', 'OWN_IT']),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']),
  message: z.string().nullable(),
  itemId: z.string(),
  userId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  resolvedAt: z.string().nullable(),
  user: z.object({
    id: z.string(),
    name: z.string().nullable(),
    email: z.string(),
    avatar: z.string().nullable(),
  }),
  item: z.object({
    id: z.string(),
    title: z.string(),
  }),
});

// Schema for claims API response
export const claimsApiResponseSchema = z.object({
  claims: z.array(claimResponseSchema),
  total: z.number(),
});

// Type inference
export type CreateClaimInput = z.infer<typeof createClaimSchema>;
export type ClaimsQueryInput = z.infer<typeof claimsQuerySchema>;
export type ClaimResponse = z.infer<typeof claimResponseSchema>;
export type ClaimsApiResponse = z.infer<typeof claimsApiResponseSchema>;
