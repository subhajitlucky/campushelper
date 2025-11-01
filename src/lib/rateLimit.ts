import { RateLimiterMemory } from 'rate-limiter-flexible';

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
  } catch (rejRes) {
    const secs = Math.round(rejRes.msBeforeNext / 1000) || 1;
    const retryAfter = Math.max(secs, 1);

    // Log rate limit violation
    console.warn(`Rate limit exceeded for ${endpointName}`, {
      key,
      limit: rejRes.totalHits,
      retryAfter,
      timestamp: new Date().toISOString(),
    });

    throw new Error(
      `Too many requests to ${endpointName}. Try again in ${retryAfter} seconds.`
    );
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
 * Generic rate limiter for custom use cases
 */
export async function limitCustom(
  key: string,
  points: number,
  durationSeconds: number,
  endpointName: string
): Promise<void> {
  const customLimiter = new RateLimiterMemory({
    points,
    duration: durationSeconds,
  });
  await rateLimit(key, customLimiter, endpointName);
}
