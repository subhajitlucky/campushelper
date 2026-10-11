import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { checkCSRF } from '@/lib/csrf-middleware';
import { limitUploads } from '@/lib/rateLimit';
import { put } from '@vercel/blob';
import { detectImageType, extensionForImageType } from '@/lib/image-type';
import {
  AuthenticationRequired,
  ValidationError,
  InternalServerError,
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
    } catch (parseError) {
      console.error('[upload] Failed to parse form data:', parseError);
      throw ValidationError('Unable to process the uploaded file. Please try again.');
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

    // Never trust the declared MIME type or filename: inspect the actual bytes.
    const headerBytes = new Uint8Array(await file.arrayBuffer()).subarray(0, 12);
    const detectedType = detectImageType(headerBytes);
    if (!detectedType) {
      throw ValidationError(
        'File content does not match an allowed image format (JPEG, PNG, or WebP).'
      );
    }

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      throw InternalServerError('Image storage is not configured. Please contact support.');
    }

    try {
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 15);
      const fileExtension = extensionForImageType(detectedType);
      const fileName = `item-${timestamp}-${randomString}.${fileExtension}`;

      const blob = await put(fileName, file, {
        access: 'public',
        contentType: detectedType,
      });

      return NextResponse.json({
        success: true,
        imageUrl: blob.url,
        message: 'Image uploaded successfully',
      });
    } catch (error) {
      console.error('[upload] Failed to upload image to blob storage:', error);
      throw InternalServerError('Unable to upload the image right now. Please try again later.');
    }
  });
}
