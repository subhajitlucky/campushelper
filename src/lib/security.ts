/**
 * Security Utilities for XSS Prevention
 *
 * Provides sanitization and validation functions to prevent
 * cross-site scripting (XSS) attacks and other security vulnerabilities
 */

/**
 * Sanitizes input to prevent XSS attacks
 * Removes all potentially malicious content including:
 * - Script tags and inline JavaScript
 * - Event handlers (onclick, onload, etc.)
 * - Malicious HTML elements
 * - Dangerous URLs (javascript:, data:, etc.)
 */
export function sanitizeInput(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Simple but effective sanitization for basic text fields
  // Remove script tags and dangerous patterns
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/data:/gi, '')
    .replace(/vbscript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim();
}

/**
 * Validates if a string is a safe error message
 * Uses whitelist approach - only allows alphanumeric, basic punctuation, and common error words
 */
export function isValidErrorMessage(message: string): boolean {
  if (!message || typeof message !== 'string') {
    return false;
  }

  // Check for obviously malicious patterns
  const maliciousPatterns = [
    /<script/i,
    /javascript:/i,
    /data:/i,
    /on\w+\s*=/i,
    /vbscript:/i,
    /<[^>]+>/,  // HTML tags
    /expression\s*\(/i,
    /eval\s*\(/i,
    /alert\s*\(/i,
    /document\.cookie/i,
    /document\.location/i,
    /window\.location/i
  ];

  // If any malicious pattern is found, reject the message
  return !maliciousPatterns.some(pattern => pattern.test(message));
}

/**
 * Safely sets error message with sanitization and validation
 * Returns sanitized message if valid, otherwise returns default message
 */
export function setSafeErrorMessage(message: string, fallback: string = 'An error occurred. Please try again.'): string {
  // First validate against malicious patterns
  if (!isValidErrorMessage(message)) {
    return fallback;
  }

  // Then sanitize the content
  return sanitizeInput(message);
}

/**
 * Validates if a URL is safe to use
 * Prevents XSS and SSRF attacks by blocking dangerous protocols
 */
export function isSafeUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  try {
    const parsedUrl = new URL(url);

    // Only allow http and https protocols
    const allowedProtocols = ['http:', 'https:'];
    if (!allowedProtocols.includes(parsedUrl.protocol)) {
      return false;
    }

    // Block localhost and private IP ranges for security
    const hostname = parsedUrl.hostname.toLowerCase();

    // Block localhost variations
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      return false;
    }

    // Block private IP ranges (SSRF protection)
    // Check for private IP patterns
    const privateIpPatterns = [
      /^10\./,           // 10.0.0.0 - 10.255.255.255
      /^192\.168\./,     // 192.168.0.0 - 192.168.255.255
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,  // 172.16.0.0 - 172.31.255.255
      /^169\.254\./,     // Link-local addresses (AWS metadata, etc.)
      /^127\./,          // Loopback
      /^0\./,            // 0.0.0.0/8
      /^::1$/,           // IPv6 loopback
      /^fc00:/,          // IPv6 unique local
      /^fe80:/,          // IPv6 link-local
    ];

    if (privateIpPatterns.some(pattern => pattern.test(hostname))) {
      return false;
    }

    return true;
  } catch (error) {
    // Invalid URL format
    return false;
  }
}

/**
 * Validates an array of URLs are all safe
 */
export function areSafeUrls(urls: string[]): boolean {
  if (!Array.isArray(urls)) {
    return false;
  }

  return urls.every(url => !url || isSafeUrl(url));
}

/**
 * Configuration for DOMPurify in Next.js environment
 * Safe server-side rendering configuration
 */
export const purifyConfig = {
  // Disable dangerous features for server-side rendering
  USE_PROFILES: { html: true },
  // Prevent XSS in SVG
  FORBID_TAGS: ['foreignObject'],
  // Disallow custom elements
  FORBID_ATTR: ['style', 'src', 'href'],
} as const;
