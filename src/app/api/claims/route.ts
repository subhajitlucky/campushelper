import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  createClaimSchema,
  claimsQuerySchema
} from '@/lib/schemas/claim';
import { sanitizeInput } from '@/lib/security';
import { limitClaims } from '@/lib/rateLimit';
import { checkCSRF } from '@/lib/csrf-middleware';

// GET /api/claims?itemId=xxx
export async function GET(request: NextRequest) {
  try {
    // CRITICAL FIX: Require authentication to prevent claims data harvesting
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required to access claims' },
        { status: 401 }
      );
    }

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

    // SECURITY FIX: Implement proper access control for claims
    const { itemId, userId } = queryParams;
    
    // Build authorization-aware where clause
    let whereClause: any = {};
    
    // If querying by specific userId (user is looking for their own claims)
    if (userId) {
      // Users can only see their own claims
      if (userId !== session.user.id && session.user.role !== 'ADMIN' && session.user.role !== 'MODERATOR') {
        return NextResponse.json(
          { error: 'You can only view your own claims' },
          { status: 403 }
        );
      }
      whereClause.userId = userId;
    }
    // If querying by itemId (user wants to see claims on a specific item)
    else if (itemId) {
      const item = await prisma.item.findUnique({
        where: { id: itemId },
        select: { id: true, postedById: true }
      });

      if (!item) {
        return NextResponse.json(
          { error: 'Item not found' },
          { status: 404 }
        );
      }
      
      // Only item owner or admin/moderator can see claims on this item
      if (item.postedById !== session.user.id && 
          session.user.role !== 'ADMIN' && 
          session.user.role !== 'MODERATOR') {
        return NextResponse.json(
          { error: 'You can only view claims on your own items' },
          { status: 403 }
        );
      }
      whereClause.itemId = itemId;
    } 
    // No specific filter - user wants their own claims
    else {
      whereClause.userId = session.user.id;
    }

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
    return NextResponse.json(
      { error: 'Failed to fetch claims' },
      { status: 500 }
    );
  }
}

// POST /api/claims
export async function POST(request: NextRequest) {
  try {
    // Check CSRF protection first
    const csrfError = await checkCSRF(request);
    if (csrfError) {
      return csrfError;
    }

    // Check authentication
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required. Please log in to create a claim.' },
        { status: 401 }
      );
    }

    // Apply rate limiting: 10 claims per hour per user
    await limitClaims(request, session.user.id);

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

    const { claimType, itemId, message: rawMessage } = validatedData;
    
    // Sanitize user input
    const message = rawMessage ? sanitizeInput(rawMessage) : null;

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
      return NextResponse.json(
        { error: 'Failed to create claim in database' },
        { status: 500 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
