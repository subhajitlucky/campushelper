import { describe, expect, it } from 'vitest';
import {
  areSafeUrls,
  isSafeUrl,
  isValidErrorMessage,
  sanitizeInput,
  setSafeErrorMessage,
} from '@/lib/security';

describe('sanitizeInput', () => {
  it('strips script blocks including their content', () => {
    expect(sanitizeInput('<script>alert("xss")</script>')).toBe('');
    const withInlineScript = sanitizeInput('hello <script src="evil.js"></script> world');
    expect(withInlineScript).not.toContain('<script');
    expect(withInlineScript).toContain('hello');
    expect(withInlineScript).toContain('world');
  });

  it('removes dangerous URL schemes and inline event handlers', () => {
    expect(sanitizeInput('javascript:alert(1)')).toBe('alert(1)');
    expect(sanitizeInput('<img src=x onerror=alert(1)>')).not.toContain('onerror=');
    expect(sanitizeInput('vbscript:msgbox(1)')).not.toContain('vbscript:');
  });

  it('trims whitespace and handles invalid input', () => {
    expect(sanitizeInput('  hello  ')).toBe('hello');
    expect(sanitizeInput('')).toBe('');
    expect(sanitizeInput(undefined as unknown as string)).toBe('');
  });
});

describe('isSafeUrl', () => {
  it('allows standard http and https URLs', () => {
    expect(isSafeUrl('https://example.com')).toBe(true);
    expect(isSafeUrl('http://example.com/path?q=1')).toBe(true);
  });

  it('rejects dangerous protocols', () => {
    expect(isSafeUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeUrl('data:text/html;base64,PHNjcmlwdD4=')).toBe(false);
    expect(isSafeUrl('ftp://example.com')).toBe(false);
    expect(isSafeUrl('vbscript:msgbox(1)')).toBe(false);
  });

  it('blocks localhost, loopback, and private address ranges', () => {
    expect(isSafeUrl('http://localhost:3000')).toBe(false);
    expect(isSafeUrl('http://127.0.0.1/admin')).toBe(false);
    expect(isSafeUrl('http://10.0.0.5')).toBe(false);
    expect(isSafeUrl('http://192.168.1.1')).toBe(false);
    expect(isSafeUrl('http://172.16.0.1')).toBe(false);
    expect(isSafeUrl('http://169.254.169.254/latest/meta-data')).toBe(false);
  });

  it('rejects malformed input', () => {
    expect(isSafeUrl('not a url')).toBe(false);
    expect(isSafeUrl('')).toBe(false);
    expect(isSafeUrl(undefined as unknown as string)).toBe(false);
  });
});

describe('isValidErrorMessage', () => {
  it('accepts plain error text', () => {
    expect(isValidErrorMessage('Invalid email or password.')).toBe(true);
    expect(isValidErrorMessage('Request failed, please retry')).toBe(true);
  });

  it('rejects markup and script-like payloads', () => {
    expect(isValidErrorMessage('<script>alert(1)</script>')).toBe(false);
    expect(isValidErrorMessage('<b>bold</b>')).toBe(false);
    expect(isValidErrorMessage('eval(1)')).toBe(false);
    expect(isValidErrorMessage('document.location = x')).toBe(false);
    expect(isValidErrorMessage('window.location = x')).toBe(false);
  });
});

describe('setSafeErrorMessage', () => {
  it('returns the message when it is safe', () => {
    expect(setSafeErrorMessage('Something went wrong.')).toBe('Something went wrong.');
  });

  it('falls back for malicious or invalid messages', () => {
    expect(setSafeErrorMessage('<script>alert(1)</script>')).toBe('An error occurred. Please try again.');
    expect(setSafeErrorMessage('<b>markup</b>', 'Custom fallback')).toBe('Custom fallback');
  });
});

describe('areSafeUrls', () => {
  it('validates arrays of URLs', () => {
    expect(areSafeUrls(['https://a.example.com', 'https://b.example.com'])).toBe(true);
    expect(areSafeUrls(['https://a.example.com', 'javascript:alert(1)'])).toBe(false);
    expect(areSafeUrls([])).toBe(true);
    expect(areSafeUrls(undefined as unknown as string[])).toBe(false);
  });
});
