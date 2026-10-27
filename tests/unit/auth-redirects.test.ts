import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({ prisma: {} }));
vi.mock('@/lib/rateLimit', () => ({ limitLogin: vi.fn() }));

import { authOptions } from '@/lib/auth';
import { safeCallbackUrl } from '@/lib/redirects';

describe('safeCallbackUrl', () => {
  it('keeps a same-origin path, including its query and hash', () => {
    expect(safeCallbackUrl('/post')).toBe('/post');
    expect(safeCallbackUrl('/search?q=wallet#results')).toBe('/search?q=wallet#results');
  });

  it('takes the first value when the query repeats', () => {
    expect(safeCallbackUrl(['/post', '/dashboard'])).toBe('/post');
  });

  it.each([
    'https://evil.example/post',
    '//evil.example/post',
    '/\\evil.example',
    '\\\\evil.example',
    'javascript:alert(1)',
    'dashboard',
  ])('rejects %s', (value) => {
    expect(safeCallbackUrl(value)).toBe('/dashboard');
  });

  it('falls back for missing values and supports a custom fallback', () => {
    expect(safeCallbackUrl(undefined)).toBe('/dashboard');
    expect(safeCallbackUrl('')).toBe('/dashboard');
    expect(safeCallbackUrl('https://evil.example', '/')).toBe('/');
  });
});

describe('sign-in page configuration', () => {
  it('points NextAuth at the branded login page', () => {
    expect(authOptions.pages?.signIn).toBe('/auth/login');
  });

  it('sets the same page on the middleware, which does not read authOptions', () => {
    const source = readFileSync(path.join(process.cwd(), 'src/proxy.ts'), 'utf8');
    expect(source).toMatch(/pages:\s*\{\s*signIn:\s*'\/auth\/login'/);
  });
});
