import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createItemSchema, itemsQuerySchema } from '@/lib/schemas/item';

/**
 * GET /api/items
 * Fetch all items with pagination and optional filtering
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Simple parameter parsing without Zod for public resolved items
    const status = searchParams.get('status') as 'LOST' | 'FOUND' | 'CLAIMED' | 'RESOLVED' | 'DELETED' | undefined;
    const search = searchParams.get('search') || undefined;
    const postedById = searchParams.get('postedById') || undefined;
    const from = searchParams.get('from') || undefined;
    const to = searchParams.get('to') || undefined;
    const itemType = searchParams.get('itemType') as 'LOST' | 'FOUND' | undefined;
    const location = searchParams.get('location') || undefined;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    
    const skip = (page - 1) * limit;

    // Allow public access for resolved items only
    const isPublicResolvedOnly = status === 'RESOLVED' && !search && !postedById && !from && !to;
    
    // Only require authentication for non-public requests
    if (!isPublicResolvedOnly) {
      const session = await getSession();
      if (!session?.user?.id) {
        return NextResponse.json(
          { error: 'Authentication required to access items' },
          { status: 401 }
        );
      }
    }

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
        },
        // Include appropriate user data based on request type
        include: isPublicResolvedOnly ? {
          // For public resolved items, show minimal user info for "success stories"
          postedBy: { 
            select: { 
              id: true, 
              name: true,        // Show name for human connection
              avatar: true       // Show avatar if available
              // Deliberately excluding email for privacy
            } 
          },
        } : undefined,
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
    const session = await getSession();
    
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
