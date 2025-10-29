import { z } from 'zod';

/**
 * Item Zod Schemas
 * 
 * Defines validation schemas for item creation, updates, and responses
 * Used for both API validation and form validation
 */

// URL validation helper
const urlSchema = z.string().url().optional().or(z.literal(''));

// Base item schema with all fields
export const baseItemSchema = z.object({
  title: z
    .string()
    .min(3, 'Title must be at least 3 characters')
    .max(100, 'Title must not exceed 100 characters'),
  
  description: z
    .string()
    .min(10, 'Description must be at least 10 characters')
    .max(2000, 'Description must not exceed 2000 characters'),
  
  itemType: z.enum(['LOST', 'FOUND']),
  
  location: z
    .string()
    .min(3, 'Location must be at least 3 characters')
    .max(200, 'Location must not exceed 200 characters'),
  
  images: z
    .array(urlSchema)
    .default([])
    .refine(
      (images) => images.every(image => !image || z.string().url().safeParse(image).success),
      'All images must be valid URLs'
    ),
});

// Schema for creating a new item (all required fields)
export const createItemSchema = baseItemSchema;

// Schema for updating an item (all fields optional)
export const updateItemSchema = baseItemSchema.partial();

// Schema for API request validation
export const createItemRequestSchema = z.object({
  body: createItemSchema,
});

export const updateItemRequestSchema = z.object({
  body: updateItemSchema,
  params: z.object({
    id: z.string().min(1, 'Item ID is required'),
  }),
});

// Schema for query parameters (filtering, pagination)
export const itemsQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => val ? parseInt(val, 10) : 1)
    .refine((val) => val > 0, 'Page must be greater than 0'),
  
  limit: z
    .string()
    .optional()
    .transform((val) => val ? parseInt(val, 10) : 20)
    .refine((val) => val > 0 && val <= 100, 'Limit must be between 1 and 100'),
  
  itemType: z
    .enum(['LOST', 'FOUND'])
    .optional(),
  
  status: z
    .enum(['LOST', 'FOUND', 'CLAIMED', 'RESOLVED', 'DELETED'])
    .optional(),
  
  location: z
    .string()
    .optional()
    .transform((val) => val?.trim())
    .refine((val) => !val || val.length >= 3, 'Location filter must be at least 3 characters'),
  
  search: z
    .string()
    .optional()
    .transform((val) => val?.trim())
    .refine((val) => !val || val.length >= 2, 'Search term must be at least 2 characters'),
});

// Type exports for TypeScript
export type CreateItemInput = z.infer<typeof createItemSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
export type ItemsQueryInput = z.infer<typeof itemsQuerySchema>;

// Response schemas (for API responses)
export const itemResponseSchema = baseItemSchema.extend({
  id: z.string(),
  status: z.enum(['LOST', 'FOUND', 'CLAIMED', 'RESOLVED', 'DELETED']),
  postedById: z.string(),
  claimedById: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  resolvedAt: z.date().nullable(),
  
  // Optional relations (for GET responses)
  postedBy: z.object({
    id: z.string(),
    name: z.string().nullable(),
    email: z.string(),
    avatar: z.string().nullable(),
  }).optional(),
  
  claimedBy: z.object({
    id: z.string(),
    name: z.string().nullable(),
    email: z.string(),
    avatar: z.string().nullable(),
  }).optional(),
  
  commentCount: z.number().optional(),
  claimCount: z.number().optional(),
});

export type ItemResponse = z.infer<typeof itemResponseSchema>;

export const itemsApiResponseSchema = z.object({
  items: z.array(itemResponseSchema),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    totalPages: z.number(),
    hasNextPage: z.boolean(),
    hasPrevPage: z.boolean(),
  }),
});

export type ItemsApiResponse = z.infer<typeof itemsApiResponseSchema>;

/*
SCHEMA USAGE EXAMPLES:

1. API Route Validation:
   const requestData = createItemSchema.parse(requestBody);

2. Form Validation (React Hook Form):
   const form = useForm({
     resolver: zodResolver(createItemSchema),
     defaultValues: { ... }
   });

3. Query Parameter Validation:
   const queryParams = itemsQuerySchema.parse(searchParams);

4. Type Safety:
   const newItem: CreateItemInput = { title: "...", ... };

5. Error Handling:
   try {
     const validData = createItemSchema.parse(rawData);
   } catch (error) {
     if (error instanceof z.ZodError) {
       // Handle validation errors
     }
   }

CONSTRAINTS SUMMARY:
- title: 3-100 characters
- description: 10-2000 characters  
- itemType: LOST | FOUND
- location: 3-200 characters
- images: array of valid URLs (optional)
- status: LOST | FOUND | CLAIMED | RESOLVED (read-only)
- pagination: page > 0, limit 1-100
- filtering: itemType, status, location, search
*/
