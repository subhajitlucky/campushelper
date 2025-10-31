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
    
    const skip = (page - 1) * limit;

    // Check if user is logged in for full user data access
    const session = await getSession();
    const isLoggedIn = !!session?.user?.id;
    
    // Public access: Always return items, but with different data based on auth status
    // For public access (not logged in): Basic item data only
    // For logged-in users: Full user data included
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
        include: isLoggedIn ? {
          // For logged-in users, include full user data
          postedBy: { 
            select: { 
              id: true, 
              name: true,        
              email: true,       // Show email for contact
              avatar: true       
            } 
          },
        } : {
          // For public access, include minimal user data (no email for privacy)
          postedBy: { 
            select: { 
              id: true, 
              name: true,        
              avatar: true       
              // Deliberately excluding email for public privacy
            } 
          },
        },
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
        user: {
          isLoggedIn: isLoggedIn,
          // Only include user ID if logged in
          ...(isLoggedIn && { userId: session?.user?.id })
        }
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
