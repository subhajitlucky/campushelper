/**
 * Supabase Client Configuration
 *
 * This file configures the Supabase client for file uploads and storage.
 * Supabase is a separate cloud service that provides:
 * - PostgreSQL database
 * - File storage with CDN
 * - Authentication
 * - Real-time subscriptions
 */

import { createClient } from '@supabase/supabase-js';

// Create Supabase client (or null if env vars not set)
let supabaseInstance: ReturnType<typeof createClient> | null = null;

// Function to get or create Supabase client
export function getSupabaseClient() {
  // Only create client if it doesn't exist
  if (!supabaseInstance) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // Don't throw during build, just return null
    if (!supabaseUrl || !supabaseAnonKey) {
      return null;
    }

    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        // Use NextAuth for authentication (not Supabase Auth)
        // This keeps authentication consistent across the app
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: {
          // Enable CORS for file uploads
          'X-Client-Info': 'campus-helper',
        },
      },
    });
  }

  return supabaseInstance;
}

// Export supabase instance (might be null during build)
const supabase = getSupabaseClient();
export { supabase };

/**
 * Get Supabase client with service role key for server-side operations
 * This bypasses RLS and can perform admin operations
 */
export const getSupabaseServiceRoleClient = () => {
  // Get service role configuration
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return null;
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};

// Storage bucket configuration
export const STORAGE_BUCKETS = {
  ITEM_IMAGES: 'item-images',
  USER_AVATARS: 'user-avatars',
} as const;

// Upload configuration
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

export default supabase;
