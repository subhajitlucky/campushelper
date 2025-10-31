import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createItemSchema, itemsQuerySchema } from '@/lib/schemas/item';

/**
 * GET /api/items
 * Fetch all items with pagination and optional filtering
 */
export async function GET(request: NextRequest) {
  try {
    // CRITICAL FIX: Require authentication to prevent data harvesting
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required to access items' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    let queryParams;
    
    try {
      queryParams = itemsQuerySchema.parse(searchParams);
    } catch (error) {
      console.error('Query validation error:', error);
      return NextResponse.json(
        { 
          error: 'Invalid query parameters'
        },
        { status: 400 }
      );
    }

    const { page, limit, search, itemType, status, location, from, to, postedById } = queryParams;
    const skip = (page - 1) * limit;

    try {
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
        }
        // REMOVED: User data exposure - security fix
        // include: {
        //   postedBy: { select: { id: true, name: true, email: true } },
        //   claimedBy: { select: { id: true, name: true, email: true } },
        // },
      });

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

      return NextResponse.json({
        items,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        filters: {
          search,
          itemType,
          status,
          location,
          from,
          to,
          postedById,
        },
      });
    } catch (dbError) {
      console.error('Database query error:', dbError);
      return NextResponse.json(
        { 
          error: 'Database error occurred. Please try again later.'
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error. Please try again later.'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/items
 * Create a new item (Steps 67-70: Authentication, Validation, Database Creation, Error Handling)
 */
export async function POST(request: NextRequest) {
  try {
    // Step 67: Check authentication (session required)
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required. Please log in to create an item.' },
        { status: 401 }
      );
    }

    // Step 68: Parse and validate POST request body
    let requestBody;
    try {
      requestBody = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    // Validate with Zod schema (Step 68: Validate with Zod schema)
    let validatedData;
    try {
      validatedData = createItemSchema.parse(requestBody);
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        return NextResponse.json(
          { 
            error: 'Validation failed',
            details: error.message 
          },
          { status: 400 }
        );
      }
      throw error; // Re-throw unexpected errors
    }

    // Step 69: Create item in database
    try {
      // Set status based on itemType
      const status = validatedData.itemType === 'LOST' ? 'LOST' : 'FOUND';
      
      // Create item in database
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

      // Transform response to include counts
      const responseItem = {
        ...newItem,
        commentCount: newItem.comments.length,
        claimCount: newItem.claims.length,
        // Remove the arrays we only used for counting
        comments: undefined,
        claims: undefined,
      };

      // Step 70: Return success response
      return NextResponse.json({
        item: responseItem,
        message: 'Item created successfully'
      }, { status: 201 });

    } catch (dbError) {
      console.error('Database error creating item:', dbError);
      return NextResponse.json(
        { error: 'Failed to save item to database' },
        { status: 500 }
      );
    }

  } catch (error) {
    // Step 70: General error handling
    console.error('Unexpected error creating item:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred while creating the item' },
      { status: 500 }
    );
  }
}
