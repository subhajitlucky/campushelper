import { describe, expect, it } from "vitest";
import {
  MIDDLEWARE_MATCHER,
  isStaticAssetPath,
  matchesRouteBoundary,
  isPublicPageRoute,
  isPublicApiRoute,
} from "@/lib/public-routes";

describe("matchesRouteBoundary", () => {
  it("matches the root route only exactly", () => {
    expect(matchesRouteBoundary("/", "/")).toBe(true);
    expect(matchesRouteBoundary("/x", "/")).toBe(false);
    expect(matchesRouteBoundary("/search", "/")).toBe(false);
  });

  it("matches exact routes", () => {
    expect(matchesRouteBoundary("/search", "/search")).toBe(true);
    expect(matchesRouteBoundary("/auth/login", "/auth/login")).toBe(true);
  });

  it("matches nested paths under a route", () => {
    expect(matchesRouteBoundary("/search/items", "/search")).toBe(true);
    expect(matchesRouteBoundary("/auth/login/callback", "/auth/login")).toBe(true);
  });

  it("does not match routes with a shared prefix", () => {
    expect(matchesRouteBoundary("/search-results", "/search")).toBe(false);
    expect(matchesRouteBoundary("/auth/loginx", "/auth/login")).toBe(false);
    expect(matchesRouteBoundary("/resolved-items", "/resolved")).toBe(false);
  });
});

describe("isPublicPageRoute", () => {
  it("allows the intended public pages", () => {
    expect(isPublicPageRoute("/")).toBe(true);
    expect(isPublicPageRoute("/auth/login")).toBe(true);
    expect(isPublicPageRoute("/auth/signup")).toBe(true);
    expect(isPublicPageRoute("/search")).toBe(true);
    expect(isPublicPageRoute("/resolved")).toBe(true);
  });

  it("keeps protected pages private", () => {
    expect(isPublicPageRoute("/dashboard")).toBe(false);
    expect(isPublicPageRoute("/admin")).toBe(false);
    expect(isPublicPageRoute("/item/123")).toBe(false);
    expect(isPublicPageRoute("/x")).toBe(false);
  });
});

describe("isPublicApiRoute", () => {
  it("allows only the listed API routes and their subpaths", () => {
    expect(isPublicApiRoute("/api/csrf-token")).toBe(true);
    expect(isPublicApiRoute("/api/auth/session")).toBe(true);
    expect(isPublicApiRoute("/api/auth/signin")).toBe(true);
    expect(isPublicApiRoute("/api/auth/signout")).toBe(true);
  });

  it("keeps other API routes private", () => {
    expect(isPublicApiRoute("/api/items")).toBe(false);
    expect(isPublicApiRoute("/api/auth/sessions")).toBe(false);
    expect(isPublicApiRoute("/api/csrf-tokenx")).toBe(false);
  });
});

describe("isStaticAssetPath", () => {
  it("recognises the files a real public/ folder holds", () => {
    expect(isStaticAssetPath("/logo.png")).toBe(true);
    expect(isStaticAssetPath("/favicon.ico")).toBe(true);
    expect(isStaticAssetPath("/og-image.jpg")).toBe(true);
    expect(isStaticAssetPath("/next.svg")).toBe(true);
    expect(isStaticAssetPath("/fonts/geist.woff2")).toBe(true);
    expect(isStaticAssetPath("/LOGO.PNG")).toBe(true);
  });

  it("does not treat application routes as assets", () => {
    expect(isStaticAssetPath("/lost-items")).toBe(false);
    expect(isStaticAssetPath("/item/clx123")).toBe(false);
    expect(isStaticAssetPath("/api/items")).toBe(false);
    expect(isStaticAssetPath("/dashboard")).toBe(false);
    // A dot in an application route must not make it public.
    expect(isStaticAssetPath("/item/v1.2")).toBe(false);
    expect(isStaticAssetPath("/reports/2026.10")).toBe(false);
  });
});

/**
 * The matcher is a Next.js config regex, so the only meaningful test is to run
 * the real regex against real paths. This is the regression guard for the bug
 * where every file in `public/` was behind the auth middleware and answered a
 * signed-out visitor with a 307 to sign-in.
 */
describe("MIDDLEWARE_MATCHER", () => {
  // Next.js compiles this string against the full pathname, starting at "/".
  const matches = (pathname: string) =>
    new RegExp(`^${MIDDLEWARE_MATCHER}$`).test(pathname);

  it("skips public-folder assets so a signed-out visitor can load them", () => {
    expect(matches("/logo.png")).toBe(false);
    expect(matches("/favicon.ico")).toBe(false);
    expect(matches("/og-image.jpg")).toBe(false);
    expect(matches("/next.svg")).toBe(false);
    expect(matches("/fonts/geist.woff2")).toBe(false);
  });

  it("still skips the Next.js internals and the auth endpoints", () => {
    expect(matches("/_next/static/chunks/main.js")).toBe(false);
    expect(matches("/_next/image")).toBe(false);
    expect(matches("/api/auth/session")).toBe(false);
  });

  it("still runs on every protected application route", () => {
    expect(matches("/dashboard")).toBe(true);
    expect(matches("/admin/dashboard")).toBe(true);
    expect(matches("/api/items")).toBe(true);
    expect(matches("/item/clx123")).toBe(true);
    expect(matches("/notifications")).toBe(true);
  });

  it("does not open a route just because it contains a dot", () => {
    expect(matches("/item/v1.2")).toBe(true);
    expect(matches("/api/items")).toBe(true);
  });
});
