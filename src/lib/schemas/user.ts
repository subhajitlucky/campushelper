import { z } from 'zod';

/**
 * User profile update schema
 */
export const updateProfileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name must be less than 100 characters'),
});
