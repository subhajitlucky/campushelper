/**
 * Post-authentication redirect handling.
 *
 * `callbackUrl` arrives from the query string, so it is untrusted. Only
 * same-origin absolute paths are accepted: anything that could send the
 * browser off-site (`https://…`, `//evil.com`, `/\evil.com`) falls back to the
 * dashboard. Query strings and hashes on a valid path are preserved.
 */

export const DEFAULT_CALLBACK_URL = '/dashboard';

const SAFE_ORIGIN = 'http://localhost';

export function safeCallbackUrl(
  value: string | string[] | undefined,
  fallback: string = DEFAULT_CALLBACK_URL
): string {
  const raw = Array.isArray(value) ? value[0] : value;

  // A relative path without the leading slash (`dashboard`) is ambiguous with
  // a hostname, so only root-relative paths are accepted.
  if (!raw || !raw.startsWith('/')) {
    return fallback;
  }

  try {
    // Resolving against a fixed origin applies the URL parser's normalisation
    // (backslashes, tabs, encoded slashes), so the origin check sees the same
    // destination the browser would.
    const url = new URL(raw, SAFE_ORIGIN);
    if (url.origin !== SAFE_ORIGIN) {
      return fallback;
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
