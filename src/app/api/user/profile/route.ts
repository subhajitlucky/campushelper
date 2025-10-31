import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// Schema for profile update validation
const updateProfileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name must not exceed 100 characters'),
});

/**
 * PUT /api/user/profile
 * Update current user's profile information
 */
export async function PUT(request: NextRequest) {
  try {
    // Check authentication
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse and validate request body
    let requestBody;
    try {
      requestBody = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    let validatedData;
    try {
      validatedData = updateProfileSchema.parse(requestBody);
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

    // Update user profile in database
    try {
      const updatedUser = await prisma.user.update({
        where: { id: session.user.id },
        data: {
          name: validatedData.name,
          updatedAt: new Date(),
        },
        select: {
          id: true,
          name: true,
          email: true,
          avatar: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return NextResponse.json(
        { 
          user: updatedUser,
          message: 'Profile updated successfully' 
        },
        { status: 200 }
      );
    } catch (dbError) {
      console.error('Database error updating user profile:', dbError);
      return NextResponse.json(
        { error: 'Failed to update profile in database' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Unexpected error updating profile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
