'use client';

/**
 * ImageUpload Component
 *
 * Handles image upload, compression, and storage to Supabase.
 * Features:
 * - File validation (type, size)
 * - Client-side compression
 * - Upload progress tracking
 * - Preview before upload
 * - Error handling
 */

import { useState, useRef } from 'react';
import Image from 'next/image';
import { Upload, X, Loader2 } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { supabase, STORAGE_BUCKETS, UPLOAD_CONFIG } from '@/lib/supabase';

interface ImageUploadProps {
  // Callback when image is successfully uploaded
  onImageUpload: (imageUrl: string) => void;
  // Callback when image is removed
  onImageRemove: () => void;
  // Current image URL (for editing)
  currentImage?: string | null;
  // Maximum number of images (default: 1)
  maxImages?: number;
  // ClassName for styling
  className?: string;
}

export default function ImageUpload({
  onImageUpload,
  onImageRemove,
  currentImage,
  maxImages = 1,
  className = '',
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(currentImage || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Handle file selection
   */
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    // Validate file type
    if (!UPLOAD_CONFIG.allowedImageTypes.includes(file.type as any)) {
      setError('Please upload a valid image file (JPEG, PNG, or WebP)');
      return;
    }

    // Validate file size (before compression)
    if (file.size > UPLOAD_CONFIG.maxFileSizeBytes) {
      setError(`File size must be less than ${UPLOAD_CONFIG.maxFileSize}MB`);
      return;
    }

    setUploading(true);

    try {
      // Check if Supabase is available
      if (!supabase) {
        throw new Error(
          'Supabase is not configured. Please add environment variables.'
        );
      }

      // Step 1: Compress image
      const compressedFile = await imageCompression(file, UPLOAD_CONFIG.compression);

      // Step 2: Generate unique filename
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 15);
      const fileExtension = compressedFile.name.split('.').pop() || 'jpg';
      const fileName = `item-${timestamp}-${randomString}.${fileExtension}`;

      // Step 3: Upload to Supabase
      const { data, error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKETS.ITEM_IMAGES)
        .upload(fileName, compressedFile, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      // Step 4: Get public URL
      const { data: urlData } = supabase.storage
        .from(STORAGE_BUCKETS.ITEM_IMAGES)
        .getPublicUrl(data.path);

      const imageUrl = urlData.publicUrl;

      // Step 5: Set preview and notify parent
      setPreview(imageUrl);
      onImageUpload(imageUrl);
    } catch (err: any) {
      console.error('Upload failed:', err);
      setError(err.message || 'Failed to upload image. Please try again.');
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  /**
   * Remove uploaded image
   */
  const handleRemove = async () => {
    if (!preview) return;

    setError(null);

    try {
      // Check if Supabase is available
      if (supabase) {
        // Extract file path from URL
        const url = new URL(preview);
        const path = url.pathname.split('/').pop();

        if (path) {
          // Delete from Supabase storage
          await supabase.storage
            .from(STORAGE_BUCKETS.ITEM_IMAGES)
            .remove([path]);
        }
      }
    } catch (err) {
      console.error('Failed to delete image:', err);
      // Continue with cleanup even if storage delete fails
    } finally {
      setPreview(null);
      onImageRemove();
    }
  };

  /**
   * Trigger file input
   */
  const handleClick = () => {
    if (uploading) return;
    fileInputRef.current?.click();
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Upload Area */}
      {!preview && (
        <Card className="border-2 border-dashed border-gray-300 hover:border-gray-400 transition-colors">
          <div className="p-8 text-center">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              disabled={uploading}
              className="hidden"
              id="image-upload-input"
            />

            {uploading ? (
              <div className="flex flex-col items-center">
                <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
                <p className="text-gray-600">Compressing and uploading image...</p>
                <p className="text-sm text-gray-500 mt-2">This may take a moment</p>
              </div>
            ) : (
              <div className="flex flex-col items-center cursor-pointer" onClick={handleClick}>
                <Upload className="w-12 h-12 text-gray-400 mb-4" />
                <p className="text-lg font-medium text-gray-700 mb-2">
                  Upload an image (optional)
                </p>
                <p className="text-sm text-gray-500">
                  Click to browse or drag and drop
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  JPEG, PNG, or WebP • Max {UPLOAD_CONFIG.maxFileSize}MB
                </p>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Preview Area */}
      {preview && (
        <div className="relative group">
          <div className="relative aspect-square w-full max-w-md mx-auto rounded-lg overflow-hidden border">
            <Image
              src={preview}
              alt="Uploaded image"
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 400px"
            />

            {/* Overlay with actions */}
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-opacity flex items-center justify-center">
              <Button
                onClick={handleRemove}
                variant="destructive"
                size="sm"
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-4 h-4 mr-2" />
                Remove
              </Button>
            </div>
          </div>

          {/* Replace button */}
          <div className="mt-4 text-center">
            <Button
              onClick={handleClick}
              variant="outline"
              disabled={uploading}
              className="w-full"
            >
              <Upload className="w-4 h-4 mr-2" />
              Replace Image
            </Button>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Help Text */}
      {!preview && !uploading && !error && (
        <p className="text-xs text-gray-500 text-center">
          Adding an image helps others identify the item. Images are automatically compressed for faster loading.
        </p>
      )}
    </div>
  );
}
