import { z } from 'zod';

// Schema for updating claim status
export const updateClaimStatusSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
});

// Type inference
export type UpdateClaimStatusInput = z.infer<typeof updateClaimStatusSchema>;
