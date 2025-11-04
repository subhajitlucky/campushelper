import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import {
  AuthenticationRequired,
  ValidationError,
  DatabaseError,
  NotFound,
  safeApiHandler
} from '@/lib/errors';
import { sanitizeInput } from '@/lib/security';
import { limitItems } from '@/lib/rateLimit';
import { checkCSRF } from '@/lib/csrf-middleware';

/**
 * GET /api/items
 * Fetch all items with pagination and optional filtering
 */
export async function GET(request: NextRequest) {
  return safeApiHandler(async () => {
    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const status = searchParams.get('status') as 'LOST' | 'FOUND' | 'CLAIMED' | 'RESOLVED' | 'DELETED' | undefined;
    const search = searchParams.get('search') || undefined;
    const postedById = searchParams.get('postedById') || undefined;
    const from = searchParams.get('from') || undefined;
    const to = searchParams.get('to') || undefined;
    const itemType = searchParams.get('itemType') as 'LOST' | 'FOUND' | undefined;
    const location = searchParams.get('location') || undefined;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    
    // Validate pagination parameters
    if (isNaN(page) || page < 1) {
      throw ValidationError('Page must be a positive number');
    }
    if (isNaN(limit) || limit < 1 || limit > 100) {
      throw ValidationError('Limit must be between 1 and 100');
    }
    
    // Validate date parameters
    if (from && isNaN(Date.parse(from))) {
      throw ValidationError('From date must be valid');
    }
    if (to && isNaN(Date.parse(to))) {
      throw ValidationError('To date must be valid');
    }
    
    const skip = (page - 1) * limit;

    // Check if user is logged in
    const session = await getSession();
    const isLoggedIn = !!session?.user?.id;
    const userId = session?.user?.id;

    // For items list: NEVER show emails (security fix)
    // Users can view individual items for contact details
    const items = await prisma.item.findMany({
      skip,
      take: limit,
      where: {
        // Exclude deleted items by default unless specifically requested
        ...(status ? { status } : { status: { not: 'DELETED' } }),

        ...(itemType && { itemType }),
        ...(location && {
          location: {
            contains: location,
            mode: 'insensitive'
          }
        }),
        ...(from && {
          createdAt: {
            gte: new Date(from)
          }
        }),
        ...(to && {
          createdAt: {
            lte: new Date(to)
          }
        }),
        ...(postedById && {
          postedById: postedById
        }),
        ...(search && {
          OR: [
            {
              title: {
                contains: search,
                mode: 'insensitive'
              }
            },
            {
              description: {
                contains: search,
                mode: 'insensitive'
              }
            },
            {
              location: {
                contains: search,
                mode: 'insensitive'
              }
            }
          ]
        })
      },
      orderBy: {
        createdAt: 'desc'
      },
      // Include user data but NEVER email (security fix for IDOR)
      include: {
        postedBy: {
          select: {
            id: true,
            name: true,
            avatar: true
            // Email intentionally excluded from items list
          }
        }
      }
    });

    // Get total count for pagination
    const total = await prisma.item.count({
      where: {
        ...(status ? { status } : { status: { not: 'DELETED' } }),
        ...(itemType && { itemType }),
        ...(location && {
          location: {
            contains: location,
            mode: 'insensitive'
          }
        }),
        ...(from && {
          createdAt: {
            gte: new Date(from)
          }
        }),
        ...(to && {
          createdAt: {
            lte: new Date(to)
          }
        }),
        ...(postedById && {
          postedById: postedById
        }),
        ...(search && {
          OR: [
            {
              title: {
                contains: search,
                mode: 'insensitive'
              }
            },
            {
              description: {
                contains: search,
                mode: 'insensitive'
              }
            },
            {
              location: {
                contains: search,
                mode: 'insensitive'
              }
            }
          ]
        })
      }
    });

    // Format items for consistent API response
    const formattedItems = items.map(item => ({
      ...item,
      commentsCount: 0, // Will be populated if we include comments in query
      claimsCount: 0,   // Will be populated if we include claims in query
      // Remove the arrays from the response to avoid confusion
      comments: undefined,
      claims: undefined
    }));

    return NextResponse.json({
      items: formattedItems,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      filters: {
        status,
        itemType,
        location,
        search,
        postedById,
        from,
        to
      },
      user: {
        isLoggedIn: isLoggedIn,
        // Only include user ID if logged in
        ...(isLoggedIn && { userId: session?.user?.id })
      }
    });
  });
}

/**
 * POST /api/items
 * Create a new item with standardized error handling
 */
export async function POST(request: NextRequest) {
  return safeApiHandler(async () => {
    // Check CSRF token first (for security)
    const csrfCheck = await checkCSRF(request);
    if (csrfCheck) {
      return csrfCheck;
    }
    
    // Check authentication first - getSession() now works correctly with App Router
    const session = await getSession();
    
    if (!session?.user?.id) {
      throw AuthenticationRequired('Please log in to create an item.');
    }

    // Apply rate limiting: 20 items per hour per user
    // Only apply rate limiting AFTER authentication is confirmed
    await limitItems(request, session.user.id);

    // Parse request body
    let requestBody;
    try {
      requestBody = await request.json();
    } catch {
      throw ValidationError('Invalid JSON in request body');
    }

    // Validate request body with inline schema
    const createItemSchema = z.object({
      title: z.string().min(1, 'Title is required').max(200, 'Title must be less than 200 characters'),
      description: z.string().min(10, 'Description must be at least 10 characters').max(2000, 'Description must be less than 2000 characters'),
      itemType: z.enum(['LOST', 'FOUND']),
      location: z.string().min(1, 'Location is required').max(100, 'Location must be less than 100 characters'),
      images: z.array(z.string().url('Invalid image URL')).max(5, 'Maximum 5 images allowed').optional().default([])
    });

    let validatedData;
    try {
      validatedData = createItemSchema.parse(requestBody);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw ValidationError('Validation failed', { 
          issues: error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message
          }))
        });
      }
      throw error;
    }

    // Create item in database with sanitized input
    const status = validatedData.itemType === 'LOST' ? 'LOST' : 'FOUND';
    
    const newItem = await prisma.item.create({
      data: {
        title: validatedData.title,
        description: validatedData.description,
        itemType: validatedData.itemType,
        status: status,
        location: validatedData.location,
        images: validatedData.images.filter(image => image && image.trim() !== '') as string[],
        postedById: session.user.id,
      },
      include: {
        // Include postedBy user details in response
        postedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          }
        },
        // Include counts for comments and claims
        comments: {
          select: {
            id: true,
          }
        },
        claims: {
          select: {
            id: true,
          }
        }
      }
    });

    // Format response
    const formattedItem = {
      ...newItem,
      commentsCount: 0, // New items have no comments
      claimsCount: 0,   // New items have no claims
      comments: undefined,
      claims: undefined
    };

    return NextResponse.json({
      message: 'Item created successfully',
      item: formattedItem
    }, { status: 201 });
  });
}
