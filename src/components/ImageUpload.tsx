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

import { useState, useRef, useEffect } from 'react';
import { Upload, X, Loader2 } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { UPLOAD_CONFIG } from '@/lib/supabase';
import { useAuthFetch } from '@/lib/auth-fetch';

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
  const [imageLoading, setImageLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const localPreviewRef = useRef<string | null>(null);
  const { fetchWithAuth } = useAuthFetch(true);

  // Sync preview with currentImage updates from parent (e.g. form reset)
  useEffect(() => {
    if (currentImage) {
      setPreview(currentImage);
      if (localPreviewRef.current) {
        URL.revokeObjectURL(localPreviewRef.current);
        localPreviewRef.current = null;
      }
      return;
    }

    if (!uploading) {
      setPreview(null);
    }
  }, [currentImage, uploading]);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      if (localPreviewRef.current) {
        URL.revokeObjectURL(localPreviewRef.current);
        localPreviewRef.current = null;
      }
    };
  }, []);

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
      // Provide immediate local preview while upload runs
      const localPreviewUrl = URL.createObjectURL(file);
      if (localPreviewRef.current) {
        URL.revokeObjectURL(localPreviewRef.current);
      }
      localPreviewRef.current = localPreviewUrl;
      setPreview(localPreviewUrl);
      setImageLoading(true);

      // Step 1: Compress image (without web worker to avoid CSP issues)
      const compressedFile = await imageCompression(file, UPLOAD_CONFIG.compression);

      // Fix: Preserve original filename extension
      // browser-image-compression sometimes loses the extension, so we fix it
      const originalName = file.name;
  const extension = originalName.includes('.') ? originalName.split('.').pop()! : 'jpg';
      const baseName = originalName.replace(/\.[^/.]+$/, '');
      // Create new File with proper name and extension
      const finalFile = new File([compressedFile], `${baseName}.${extension}`, {
        type: compressedFile.type,
        lastModified: Date.now(),
      });

      // Step 2: Create FormData for upload
      const formData = new FormData();
      formData.append('file', finalFile);

      // Check if we can upload (API will handle Supabase availability)
      const response = await fetchWithAuth('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (jsonErr) {
          errorData = {};
        }
        
        // Provide helpful error message if Supabase is not configured
        if (errorData.error?.includes('Supabase') || errorData.error?.includes('not configured')) {
          throw new Error('Image upload service is not available. Please contact support.');
        }
        
        throw new Error(errorData.error || `Upload failed with status ${response.status}`);
      }

      const data = await response.json();

      if (!data.imageUrl) {
        throw new Error('No image URL returned from server');
      }

      const imageUrl = data.imageUrl;

      // Step 5: Set preview and notify parent
      setPreview(imageUrl);
      setImageLoading(false);
      if (localPreviewRef.current) {
        URL.revokeObjectURL(localPreviewRef.current);
        localPreviewRef.current = null;
      }
      onImageUpload(imageUrl);
    } catch (err: any) {
      setError(err.message || 'Failed to upload image. Please try again.');
      setImageLoading(false);
      if (localPreviewRef.current) {
        URL.revokeObjectURL(localPreviewRef.current);
        localPreviewRef.current = null;
      }
      setPreview(currentImage || null);
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
    setImageLoading(false);

    if (localPreviewRef.current) {
      URL.revokeObjectURL(localPreviewRef.current);
      localPreviewRef.current = null;
    }

    // Just clear the preview and notify parent
    // The actual file cleanup will happen via garbage collection or a cleanup endpoint if needed
    setPreview(null);
    onImageRemove();

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  /**
   * Trigger file input
   */
  const handleClick = () => {
    if (uploading || imageLoading) return;
    fileInputRef.current?.click();
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Hidden file input - always rendered so ref stays valid */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        disabled={uploading}
        className="hidden"
        id="image-upload-input"
      />

      {/* Upload Area */}
      {!preview && (
        <Card className="border-2 border-dashed border-gray-300 hover:border-gray-400 transition-colors">
          <div className="p-8 text-center">
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
        <div className="space-y-4">
          {/* Loading spinner */}
          {imageLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
          )}
          
          {/* Image container with hover actions */}
          <div className="relative group">
            <div className="relative w-full max-w-md mx-auto rounded-lg overflow-hidden border-2 border-gray-200 bg-gray-50 shadow-sm">
              <img
                src={preview}
                alt="Preview"
                className="w-full h-auto display-block"
                style={{ maxHeight: '400px', objectFit: 'contain' }}
                onLoad={() => {
                  setImageLoading(false);
                }}
                onError={() => {
                  setImageLoading(false);
                }}
              />
              
              {/* Remove overlay - shows on hover over image only */}
              {!imageLoading && (
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-200 flex items-center justify-center">
                  <Button
                    onClick={handleRemove}
                    variant="destructive"
                    size="sm"
                    type="button"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Remove
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Replace button below image */}
          <Button
            onClick={handleClick}
            variant="outline"
            disabled={uploading || imageLoading}
            type="button"
            className="w-full"
          >
            <Upload className="w-4 h-4 mr-2" />
            Replace Image
          </Button>
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
