export const UPLOAD_CONFIG = {
  // Maximum file size in MB
  maxFileSize: 5,
  // Maximum file size in bytes (5MB)
  maxFileSizeBytes: 5 * 1024 * 1024,
  // Allowed image types
  allowedImageTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
  // Compression settings
  // Note: useWebWorker: false to avoid CSP issues in production
  compression: {
    maxSizeMB: 1,
    maxWidthOrHeight: 1920,
    useWebWorker: false,
  },
} as const;
