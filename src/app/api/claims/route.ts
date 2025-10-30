import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { 
  createClaimSchema, 
  claimsQuerySchema 
} from '@/lib/schemas/claim';

// GET /api/claims?itemId=xxx
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    let queryParams;
    
    try {
      const paramsObject = Object.fromEntries(searchParams.entries());
      queryParams = claimsQuerySchema.parse(paramsObject);
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

    const { itemId, userId } = queryParams;

    // If querying by itemId, check if item exists
    if (itemId) {
      const itemExists = await prisma.item.findUnique({
        where: { id: itemId },
        select: { id: true, title: true, postedById: true }
      });

      if (!itemExists) {
        return NextResponse.json(
          { error: 'Item not found' },
          { status: 404 }
        );
      }
    }

    // Build where clause based on query parameters
    const whereClause = itemId 
      ? { itemId } 
      : { userId };

    // Fetch claims with user data and item data
    const claims = await prisma.claim.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        item: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' }, // Newest first
    });

    // Transform claims to match response schema
    const transformedClaims = claims.map(claim => ({
      id: claim.id,
      claimType: claim.claimType,
      status: claim.status,
      message: claim.message,
      itemId: claim.itemId,
      userId: claim.userId,
      createdAt: claim.createdAt.toISOString(),
      updatedAt: claim.updatedAt.toISOString(),
      resolvedAt: claim.resolvedAt?.toISOString() || null,
      user: {
        id: claim.user.id,
        name: claim.user.name,
        email: claim.user.email,
        avatar: claim.user.avatar,
      },
      item: {
        id: claim.item.id,
        title: claim.item.title,
      },
    }));

    const response = {
      claims: transformedClaims,
      total: claims.length,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching claims:', error);
    return NextResponse.json(
      { error: 'Failed to fetch claims' },
      { status: 500 }
    );
  }
}

// POST /api/claims
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required. Please log in to create a claim.' },
        { status: 401 }
      );
    }

    // Parse request body
    let requestBody;
    try {
      requestBody = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    // Validate request data
    let validatedData;
    try {
      validatedData = createClaimSchema.parse(requestBody);
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        return NextResponse.json(
          {
            error: 'Invalid request data',
            details: error.message
          },
          { status: 400 }
        );
      }
      throw error;
    }

    const { claimType, itemId, message } = validatedData;

    // Check if item exists
    const item = await prisma.item.findUnique({
      where: { id: itemId },
      select: { id: true, title: true, status: true, postedById: true }
    });

    if (!item) {
      return NextResponse.json(
        { error: 'Item not found' },
        { status: 404 }
      );
    }

    // Check if item is deleted
    if (item.status === 'DELETED') {
      return NextResponse.json(
        { error: 'Cannot create claim on deleted item' },
        { status: 400 }
      );
    }

    // Prevent item owner from claiming their own item
    if (item.postedById === session.user.id) {
      return NextResponse.json(
        { error: 'You cannot create a claim on your own item' },
        { status: 400 }
      );
    }

    // Check for existing pending claim from this user
    const existingClaim = await prisma.claim.findFirst({
      where: {
        itemId,
        userId: session.user.id,
        status: 'PENDING'
      }
    });

    if (existingClaim) {
      return NextResponse.json(
        { error: 'You already have a pending claim on this item' },
        { status: 400 }
      );
    }

    try {
      // Create claim in database
      const newClaim = await prisma.claim.create({
        data: {
          claimType,
          itemId,
          userId: session.user.id,
          message: message || null,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            },
          },
          item: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      });

      // Transform claim to match response schema
      const responseClaim = {
        id: newClaim.id,
        claimType: newClaim.claimType,
        status: newClaim.status,
        message: newClaim.message,
        itemId: newClaim.itemId,
        userId: newClaim.userId,
        createdAt: newClaim.createdAt.toISOString(),
        updatedAt: newClaim.updatedAt.toISOString(),
        resolvedAt: newClaim.resolvedAt?.toISOString() || null,
        user: {
          id: newClaim.user.id,
          name: newClaim.user.name,
          email: newClaim.user.email,
          avatar: newClaim.user.avatar,
        },
        item: {
          id: newClaim.item.id,
          title: newClaim.item.title,
        },
      };

      return NextResponse.json(
        { claim: responseClaim, message: 'Claim created successfully' },
        { status: 201 }
      );
    } catch (dbError) {
      console.error('Database error creating claim:', dbError);
      return NextResponse.json(
        { error: 'Failed to create claim in database' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Unexpected error creating claim:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
