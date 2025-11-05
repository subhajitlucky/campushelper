import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { checkCSRF } from '@/lib/csrf-middleware';
import { limitUploads } from '@/lib/rateLimit';
import {
  AuthenticationRequired,
  ValidationError,
  ForbiddenError,
  safeApiHandler
} from '@/lib/errors';

/**
 * POST /api/upload
 * Upload an image to Supabase storage
 *
 * Expected:
 * - Content-Type: multipart/form-data
 * - File field: 'file'
 * - CSRF token in X-CSRF-Token header
 */
export async function POST(request: NextRequest) {
  return safeApiHandler(async () => {
    // Check CSRF protection
    const csrfError = await checkCSRF(request);
    if (csrfError) {
      return csrfError;
    }

    // Check authentication
    const session = await getSession();
    if (!session?.user?.id) {
      throw AuthenticationRequired('You must be logged in to upload images.');
    }

    // Apply rate limiting: 20 uploads per hour per user
    await limitUploads(request, session.user.id);

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      throw ValidationError('No file provided. Please select an image to upload.');
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      throw ValidationError(
        'Invalid file type. Only JPEG, PNG, and WebP images are allowed.'
      );
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024; // 5MB in bytes
    if (file.size > maxSize) {
      throw ValidationError('File size must be less than 5MB.');
    }

    // Check if Supabase is configured
    if (!supabase) {
      console.error('Upload failed: Supabase client is null');
      console.error('Environment check:', {
        hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      });
      throw new Error('Storage service is not configured.');
    }

    console.log('Starting upload with Supabase client initialized');

    try {
      // Convert file to buffer
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Generate unique filename
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 15);
      const fileExtension = file.name.split('.').pop() || 'jpg';
      const fileName = `item-${timestamp}-${randomString}.${fileExtension}`;

      // Upload to Supabase storage
      console.log('Uploading to Supabase:', { fileName, fileType: file.type, fileSize: buffer.length });
      const { data, error: uploadError } = await supabase.storage
        .from('item-images')
        .upload(fileName, buffer, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type,
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        console.error('Upload error details:', {
          message: uploadError.message,
          name: uploadError.name,
          cause: uploadError.cause,
        });
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      console.log('Upload successful:', data);

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('item-images')
        .getPublicUrl(data.path);

      const imageUrl = urlData.publicUrl;

      return NextResponse.json({
        success: true,
        imageUrl,
        message: 'Image uploaded successfully',
      });
    } catch (error: any) {
      console.error('Upload failed:', {
        message: error?.message,
        stack: error?.stack,
        cause: error?.cause,
        code: error?.code,
      });
      throw new Error(`Failed to upload image: ${error?.message || 'Unknown error'}`);
    }
  });
}
