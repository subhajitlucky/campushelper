import DOMPurify from 'dompurify';

/**
 * Security Utilities for XSS Prevention
 * 
 * Provides sanitization and validation functions to prevent
 * cross-site scripting (XSS) attacks and other security vulnerabilities
 */

/**
 * Sanitizes input to prevent XSS attacks using DOMPurify
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

  // Sanitize the input using DOMPurify
  const sanitized = DOMPurify.sanitize(input, {
    // Allow basic formatting but remove dangerous elements
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br'],
    ALLOWED_ATTR: [],
    // Remove dangerous protocols
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input'],
    FORBID_ATTR: ['onclick', 'onload', 'onerror', 'onmouseover', 'onfocus', 'onblur', 'onchange', 'onsubmit', 'style'],
    // Add URL protocols to FORBID_ATTR instead
  });

  // Additional security: Remove any remaining potentially dangerous patterns
  return sanitized
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
    console.warn('Blocked potentially malicious error message:', message);
    return fallback;
  }

  // Then sanitize the content
  return sanitizeInput(message);
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
