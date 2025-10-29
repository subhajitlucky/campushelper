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
    // Step 76: Parse and validate query parameters using Zod schema
    const { searchParams } = new URL(request.url);
    
    let queryParams;
    try {
      // Convert searchParams to plain object for Zod validation
      const paramsObject = Object.fromEntries(searchParams.entries());
      queryParams = itemsQuerySchema.parse(paramsObject);
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        return NextResponse.json(
          { 
            error: 'Invalid query parameters',
            details: error.message 
          },
          { status: 400 }
        );
      }
      throw error;
    }

    const { page, limit, search } = queryParams;
    const skip = (page - 1) * limit;

    // Step 76: Fetch items with search functionality
    const items = await prisma.item.findMany({
      skip,
      take: limit,
      where: {
        status: {
          not: 'DELETED' // Exclude deleted items by default
        },
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
      include: {
        // Include postedBy user details (excluding sensitive data)
        postedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          }
        },
        // Include claimedBy user details if item is claimed
        claimedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          }
        },
        // Get count of comments for each item
        comments: {
          select: {
            id: true,
          }
        },
        // Get count of claims for each item
        claims: {
          select: {
            id: true,
          }
        }
      }
    });

    // Transform data to include counts
    const transformedItems = items.map(item => ({
      ...item,
      commentCount: item.comments.length,
      claimCount: item.claims.length,
      // Remove the arrays we only used for counting
      comments: undefined,
      claims: undefined,
    }));

    // Get total count for pagination (respecting search conditions)
    const total = await prisma.item.count({
      where: {
        status: {
          not: 'DELETED' // Exclude deleted items by default
        },
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
      items: transformedItems,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1,
      },
      search: search || null // Include search term in response for frontend
    });

  } catch (error) {
    console.error('Error fetching items:', error);
    return NextResponse.json(
      { error: 'Failed to fetch items' },
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
