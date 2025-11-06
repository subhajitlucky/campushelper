import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getSupabaseServiceRoleClient } from '@/lib/supabase';
import { checkCSRF } from '@/lib/csrf-middleware';
import { limitUploads } from '@/lib/rateLimit';
import {
  AuthenticationRequired,
  ValidationError,
  safeApiHandler
} from '@/lib/errors';

export async function POST(request: NextRequest) {
  return safeApiHandler(async () => {
    const csrfError = await checkCSRF(request);
    if (csrfError) {
      return csrfError;
    }

    const session = await getSession();
    if (!session?.user?.id) {
      throw AuthenticationRequired('You must be logged in to upload images.');
    }

    await limitUploads(request, session.user.id);

    let formData: FormData;
    let file: File | null;
    try {
      formData = await request.formData();
      file = formData.get('file') as File | null;
    } catch (parseError: any) {
      throw new Error(`Failed to parse form data: ${parseError.message}`);
    }

    if (!file) {
      throw ValidationError('No file provided. Please select an image to upload.');
    }

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      throw ValidationError('Invalid file type. Only JPEG, PNG, and WebP images are allowed.');
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      throw ValidationError('File size must be less than 5MB.');
    }

    const serviceRoleClient = getSupabaseServiceRoleClient();
    if (!serviceRoleClient) {
      throw new Error('Storage service is not configured.');
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 15);
      const fileExtension = file.name.split('.').pop() || 'jpg';
      const fileName = `item-${timestamp}-${randomString}.${fileExtension}`;

      const { data, error: uploadError } = await serviceRoleClient.storage
        .from('item-images')
        .upload(fileName, buffer, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type,
        });

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      const { data: urlData } = serviceRoleClient.storage
        .from('item-images')
        .getPublicUrl(data.path);

      const imageUrl = urlData.publicUrl;

      return NextResponse.json({
        success: true,
        imageUrl,
        message: 'Image uploaded successfully',
      });
    } catch (error: any) {
      throw new Error(`Failed to upload image: ${error?.message || 'Unknown error'}`);
    }
  });
}
