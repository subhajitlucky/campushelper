// Zod schemas for Comment validation
import { z } from 'zod';

// Base comment schema
export const baseCommentSchema = z.object({
  message: z
    .string()
    .min(1, 'Message is required')
    .max(1000, 'Message must be less than 1000 characters'),
  itemId: z
    .string()
    .min(1, 'Item ID is required'),
  images: z
    .array(z.string().url('Each image must be a valid URL'))
    .optional()
    .default([]),
});

// Schema for creating a comment
export const createCommentSchema = baseCommentSchema;

// Schema for comment query parameters
export const commentsQuerySchema = z.object({
  itemId: z
    .string()
    .min(1, 'Item ID is required'),
});

// Schema for comment response
export const commentResponseSchema = z.object({
  id: z.string(),
  message: z.string(),
  images: z.array(z.string()),
  itemId: z.string(),
  userId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
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

// Schema for comments API response
export const commentsApiResponseSchema = z.object({
  comments: z.array(commentResponseSchema),
  total: z.number(),
});

// Type inference
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type CommentsQueryInput = z.infer<typeof commentsQuerySchema>;
export type CommentResponse = z.infer<typeof commentResponseSchema>;
export type CommentsApiResponse = z.infer<typeof commentsApiResponseSchema>;
