'use client';

/**
 * ImageUpload Component
 *
 * Handles image upload, compression, and storage to Vercel Blob.
 * Features:
 * - File validation (type, size)
 * - Client-side compression
 * - Upload progress tracking
 * - Preview before upload
 * - Error handling
 *
 * The upload path itself (validate → compress → POST /api/upload through the
 * authenticated fetch) is unchanged. What changed is the shell: the control is a
 * large dashed drop zone rather than a card tucked below the fold, the chosen
 * photo is previewed at size, and removal is a visible action instead of a
 * hover-only overlay that a touch device cannot reach.
 */

import { useState, useRef, useEffect } from 'react';
import { AlertCircle, ImagePlus, Loader2, Trash2, Upload } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { UPLOAD_CONFIG } from '@/lib/upload';
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
  // Id for the file input, so an external <label htmlFor> can point at it
  inputId?: string;
  // ClassName for styling
  className?: string;
}

export default function ImageUpload({
  onImageUpload,
  onImageRemove,
  currentImage,
  inputId = 'image-upload-input',
  className = '',
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(currentImage || null);
  const [imageLoading, setImageLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const localPreviewRef = useRef<string | null>(null);
  const { fetchWithAuth } = useAuthFetch(true);

  const busy = uploading || imageLoading;

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
   * Validate, compress, and upload one file.
   *
   * Shared by the file picker and the drop zone so both routes behave
   * identically — same type/size checks, same compression, same endpoint.
   */
  const processFile = async (file: File) => {
    setError(null);

    // Validate file type
    const allowedImageTypes: readonly string[] = UPLOAD_CONFIG.allowedImageTypes;
    if (!allowedImageTypes.includes(file.type)) {
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
      // Don't show preview yet - keep uploading state visible
      // This ensures the spinner stays until everything is done
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

      // Check if we can upload (API will handle Vercel Blob availability)
      const response = await fetchWithAuth('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = {};
        }

        // Provide helpful error messages
        if (response.status === 500) {
          throw new Error(
            errorData.error ||
            'Server error occurred. This might be due to missing Vercel Blob configuration. Please check the setup guide.'
          );
        } else if (response.status === 401) {
          throw new Error('You must be logged in to upload images.');
        } else if (response.status === 413) {
          throw new Error('File is too large. Please choose a smaller image.');
        } else {
          throw new Error(
            errorData.error ||
            `Upload failed with status ${response.status}. Please try again or contact support.`
          );
        }
      }

      const data = await response.json();

      if (!data.imageUrl) {
        throw new Error('No image URL returned from server');
      }

      const imageUrl = data.imageUrl;

      // Step 5: Now show preview and notify parent (upload complete)
      setPreview(imageUrl);
      setImageLoading(false);
      setUploading(false);
      onImageUpload(imageUrl);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to upload image. Please try again.');
      setImageLoading(false);
      setUploading(false);
      if (localPreviewRef.current) {
        URL.revokeObjectURL(localPreviewRef.current);
        localPreviewRef.current = null;
      }
      setPreview(currentImage || null);
    } finally {
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  /**
   * Handle file selection
   */
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    await processFile(file);
  };

  /**
   * Handle a file dropped onto the zone.
   */
  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    if (busy) return;

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    await processFile(file);
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
    if (busy) return;
    fileInputRef.current?.click();
  };

  return (
    <div className={className}>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!busy) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          'rounded-xl border-2 border-dashed transition-colors',
          isDragging ? 'border-primary bg-primary/5' : 'border-border',
          // The input itself is visually hidden, so the zone carries its focus
          // indicator — a keyboard user still sees where they are.
          'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-background'
        )}
      >
        <input
          ref={fileInputRef}
          id={inputId}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          disabled={uploading}
          className="sr-only"
        />

        {preview ? (
          <div className="p-3">
            <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-lg bg-muted/40">
              {/* Object URL or blob URL preview: next/image would need remote
                  patterns for every upload host. */}
              <img
                src={preview}
                alt="The photo attached to this item"
                className="max-h-full max-w-full object-contain"
              />

              {/* Replacing keeps the current photo on screen under the progress
                  state, so the choice is never lost mid-upload. */}
              {busy && (
                <div
                  role="status"
                  className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/75 backdrop-blur-sm"
                >
                  <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
                  <p className="text-sm font-medium text-foreground">Uploading…</p>
                </div>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                This photo will be attached to your item.
              </p>

              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={handleClick} disabled={busy}>
                  <Upload className="mr-2 size-4" aria-hidden="true" />
                  Replace
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRemove}
                  disabled={busy}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="mr-2 size-4" aria-hidden="true" />
                  Remove
                </Button>
              </div>
            </div>
          </div>
        ) : busy ? (
          <div
            role="status"
            className="flex min-h-[13rem] flex-col items-center justify-center px-6 py-12 text-center sm:min-h-[15rem]"
          >
            <Loader2 className="size-8 animate-spin text-muted-foreground" aria-hidden="true" />
            <p className="mt-4 text-base font-medium text-foreground">Uploading your photo…</p>
            <p className="mt-1 text-sm text-muted-foreground">Compressing before upload</p>
          </div>
        ) : (
          <label
            htmlFor={inputId}
            className="flex min-h-[13rem] cursor-pointer flex-col items-center justify-center px-6 py-12 text-center sm:min-h-[15rem]"
          >
            <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <ImagePlus className="size-6" aria-hidden="true" />
            </span>
            <span className="mt-4 text-base font-medium text-foreground">
              Drop a photo here, or choose one
            </span>
            <span className="mt-1 text-sm text-muted-foreground">
              JPEG, PNG, or WebP — up to {UPLOAD_CONFIG.maxFileSize}MB
            </span>
            <span className="mt-5 inline-flex h-9 items-center rounded-lg border border-input px-4 text-sm font-medium text-foreground">
              Choose photo
            </span>
          </label>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <p role="alert" className="mt-3 flex items-start gap-1.5 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
