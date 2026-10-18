import { RateLimiterMemory, RateLimiterRes } from 'rate-limiter-flexible';

/**
 * Thrown when a caller exceeds a rate limit.
 *
 * Typed so that `safeApiHandler` can translate it into a 429 response with a
 * `Retry-After` header instead of falling through to a generic 500.
 */
export class RateLimitError extends Error {
  readonly endpoint: string;
  readonly retryAfterSeconds: number;

  constructor(endpoint: string, retryAfterSeconds: number) {
    const retryAfter = Math.max(Math.round(retryAfterSeconds) || 1, 1);
    super(`Too many requests to ${endpoint}. Try again in ${retryAfter} seconds.`);
    this.name = 'RateLimitError';
    this.endpoint = endpoint;
    this.retryAfterSeconds = retryAfter;
  }
}

// Different rate limiters for different use cases

// Signup: 5 requests per hour per IP
const signupLimiter = new RateLimiterMemory({
  points: 5,
  duration: 3600, // 1 hour in seconds
});

// Login: 10 requests per 15 minutes per email
const loginLimiter = new RateLimiterMemory({
  points: 10,
  duration: 900, // 15 minutes in seconds
});

// Items POST: 20 requests per hour per user
const itemsLimiter = new RateLimiterMemory({
  points: 20,
  duration: 3600, // 1 hour in seconds
});

// Claims POST: 10 requests per hour per user
const claimsLimiter = new RateLimiterMemory({
  points: 10,
  duration: 3600, // 1 hour in seconds
});

// Comments POST: 30 requests per hour per user
const commentsLimiter = new RateLimiterMemory({
  points: 30,
  duration: 3600, // 1 hour in seconds
});

// Profile PUT: 10 requests per hour per user
const profileLimiter = new RateLimiterMemory({
  points: 10,
  duration: 3600, // 1 hour in seconds
});

// Uploads: 20 uploads per hour per user
const uploadsLimiter = new RateLimiterMemory({
  points: 20,
  duration: 3600, // 1 hour in seconds
});

/**
 * Rate limiting middleware
 * @param key - Unique identifier for rate limiting (e.g., IP address, user ID)
 * @param limiter - The rate limiter instance to use
 * @returns Promise that resolves if allowed, throws error if rate limited
 */
async function rateLimit(
  key: string,
  limiter: RateLimiterMemory,
  endpointName: string
): Promise<void> {
  try {
    await limiter.consume(key);
  } catch (rejection) {
    const rejRes = rejection instanceof RateLimiterRes ? rejection : null;
    const secs = rejRes ? Math.round(rejRes.msBeforeNext / 1000) || 1 : 1;

    throw new RateLimitError(endpointName, Math.max(secs, 1));
  }
}

/**
 * Get client IP address from request
 */
function getClientIP(request: Request): string {
  // Check various headers that might contain the real IP
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    // x-forwarded-for can contain multiple IPs, first one is the original client
    return forwarded.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Fallback to default
  return '127.0.0.1';
}

/**
 * Rate limiter for signup endpoint
 */
export async function limitSignup(request: Request): Promise<void> {
  const ip = getClientIP(request);
  const key = `signup:${ip}`;
  await rateLimit(key, signupLimiter, 'signup');
}

/**
 * Rate limiter for login endpoint
 */
export async function limitLogin(request: Request, identifier: string): Promise<void> {
  // Use email or IP as key to prevent brute force
  const key = identifier ? `login:${identifier.toLowerCase()}` : `login:${getClientIP(request)}`;
  await rateLimit(key, loginLimiter, 'login');
}

/**
 * Rate limiter for items POST endpoint
 */
export async function limitItems(request: Request, userId: string): Promise<void> {
  const key = `items:${userId}`;
  await rateLimit(key, itemsLimiter, 'items');
}

/**
 * Rate limiter for claims POST endpoint
 */
export async function limitClaims(request: Request, userId: string): Promise<void> {
  const key = `claims:${userId}`;
  await rateLimit(key, claimsLimiter, 'claims');
}

/**
 * Rate limiter for comments POST endpoint
 */
export async function limitComments(request: Request, userId: string): Promise<void> {
  const key = `comments:${userId}`;
  await rateLimit(key, commentsLimiter, 'comments');
}

/**
 * Rate limiter for profile PUT endpoint
 */
export async function limitProfile(request: Request, userId: string): Promise<void> {
  const key = `profile:${userId}`;
  await rateLimit(key, profileLimiter, 'profile');
}

/**
 * Cache of custom limiter instances keyed by endpoint name and configuration.
 *
 * Note: in-memory rate limiting state is per serverless instance, so limits are
 * best-effort in multi-instance deployments. A shared store (e.g. Redis) would
 * be required for cluster-wide enforcement.
 */
const customLimiters = new Map<string, RateLimiterMemory>();

/**
 * Generic rate limiter for custom use cases
 */
export async function limitCustom(
  key: string,
  points: number,
  durationSeconds: number,
  endpointName: string
): Promise<void> {
  const limiterKey = `${endpointName}:${points}:${durationSeconds}`;
  let customLimiter = customLimiters.get(limiterKey);

  if (!customLimiter) {
    customLimiter = new RateLimiterMemory({
      points,
      duration: durationSeconds,
    });
    customLimiters.set(limiterKey, customLimiter);
  }

  await rateLimit(key, customLimiter, endpointName);
}

/**
 * Rate limiter for file uploads
 */
export async function limitUploads(request: Request, userId: string): Promise<void> {
  const key = `uploads:${userId}`;
  await rateLimit(key, uploadsLimiter, 'uploads');
}

/**
 * Rate limits for the v2 feature surfaces.
 *
 * All are keyed by user id and expressed as `points` per `durationSeconds`.
 */
const V2_LIMITS = {
  matches: { points: 30, duration: 3600 },
  savedSearches: { points: 20, duration: 3600 },
  notificationsRead: { points: 120, duration: 3600 },
  handover: { points: 10, duration: 3600 },
  bulkAdmin: { points: 10, duration: 3600 },
  export: { points: 5, duration: 3600 },
  analytics: { points: 60, duration: 3600 },
} as const;

export type V2LimitName = keyof typeof V2_LIMITS;

/**
 * Rate limit a v2 endpoint by user id.
 *
 * Usage: `await limitV2('handover', session.user.id)`.
 */
export async function limitV2(name: V2LimitName, userId: string): Promise<void> {
  const { points, duration } = V2_LIMITS[name];
  await limitCustom(`${name}:${userId}`, points, duration, name);
}
