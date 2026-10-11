import { z } from 'zod';

/**
 * User signup schema (server-side validation).
 * Zod strips unknown keys, so attempted privilege fields such as `role`
 * are never accepted into the parsed result.
 */
export const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  name: z.string().min(2, 'Name must be at least 2 characters long').max(100, 'Name must be at most 100 characters long'),
});

/**
 * User profile update schema
 */
export const updateProfileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name must be less than 100 characters'),
});
