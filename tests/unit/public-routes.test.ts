import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  STATIC_ASSET_EXTENSIONS,
  isStaticAssetPath,
  matchesRouteBoundary,
  isPublicPageRoute,
  isPublicApiRoute,
  isPublicReadApiRoute,
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
    expect(isPublicPageRoute("/lost-items")).toBe(true);
    expect(isPublicPageRoute("/map")).toBe(true);
    expect(isPublicPageRoute("/search")).toBe(true);
    expect(isPublicPageRoute("/resolved")).toBe(true);
    expect(isPublicPageRoute("/item/123")).toBe(true);
  });

  it("keeps protected pages private", () => {
    expect(isPublicPageRoute("/dashboard")).toBe(false);
    expect(isPublicPageRoute("/admin")).toBe(false);
    expect(isPublicPageRoute("/post")).toBe(false);
    expect(isPublicPageRoute("/notifications")).toBe(false);
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

describe("isPublicReadApiRoute", () => {
  it("allows anonymous reads of the public item, taxonomy and zone data", () => {
    expect(isPublicReadApiRoute("/api/items", "GET")).toBe(true);
    expect(isPublicReadApiRoute("/api/items/clx123", "GET")).toBe(true);
    expect(isPublicReadApiRoute("/api/items", "HEAD")).toBe(true);
    expect(isPublicReadApiRoute("/api/categories", "GET")).toBe(true);
    expect(isPublicReadApiRoute("/api/zones", "GET")).toBe(true);
    expect(isPublicReadApiRoute("/api/zones", "HEAD")).toBe(true);
  });

  it("does not open nested owner-only reads", () => {
    expect(isPublicReadApiRoute("/api/items/clx123/matches", "GET")).toBe(false);
    expect(isPublicReadApiRoute("/api/categories/anything", "GET")).toBe(false);
    expect(isPublicReadApiRoute("/api/zones/anything", "GET")).toBe(false);
  });

  it("keeps writes behind the auth middleware", () => {
    expect(isPublicReadApiRoute("/api/items", "POST")).toBe(false);
    expect(isPublicReadApiRoute("/api/items/clx123", "PUT")).toBe(false);
    expect(isPublicReadApiRoute("/api/items/clx123", "DELETE")).toBe(false);
    expect(isPublicReadApiRoute("/api/categories", "POST")).toBe(false);
    expect(isPublicReadApiRoute("/api/zones", "POST")).toBe(false);
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
 * The middleware matcher is a Next.js config field, so the only meaningful test
 * is to run the *real* regex against real paths.
 *
 * It is read out of `src/proxy.ts` as text rather than imported, because
 * Next.js requires the value to be a static literal — an earlier attempt to
 * share it as an exported constant produced
 *
 *   Error: Next.js can't recognize the exported `config` field in route.
 *   Entry `matcher[0]` need to be static strings or static objects.
 *
 * and neither `typecheck`, `lint` nor `test` noticed. Reading the file means the
 * tests exercise exactly what Next.js will analyse, and the drift check below
 * keeps the literal and `STATIC_ASSET_EXTENSIONS` in step.
 */
function readMatcherFromProxy(): string {
  const source = readFileSync(new URL("../../src/proxy.ts", import.meta.url), "utf8");
  // The trailing comma is part of the literal in the file; `\s*\]` alone does
  // not match past it.
  const match = source.match(/matcher:\s*\[\s*'([^']+)'\s*,?\s*\]/);

  if (!match) {
    throw new Error(
      "Could not find a static `matcher: ['...']` literal in src/proxy.ts. " +
        "Next.js requires the matcher to be a static string — do not replace it " +
        "with a variable or a template literal."
    );
  }

  // The capture is *source text*, so a `\\.` in the file means a literal `\.`
  // in the string Next.js actually compiles. Unescape before building a RegExp
  // from it, or `\\.` is read as "a backslash, then any character".
  return match[1].replace(/\\\\/g, "\\");
}

const MATCHER = readMatcherFromProxy();

describe("middleware matcher", () => {
  // Next.js compiles this string against the full pathname, starting at "/".
  const matches = (pathname: string) => new RegExp(`^${MATCHER}$`).test(pathname);

  it("is a static literal, which is what Next.js can analyse", () => {
    expect(typeof MATCHER).toBe("string");
    expect(MATCHER.startsWith("/(")).toBe(true);
  });

  it("skips public-folder assets so a signed-out visitor can load them", () => {
    // The regression this whole file exists for: every one of these used to be
    // 307-redirected to /api/auth/signin.
    expect(matches("/logo.png")).toBe(false);
    expect(matches("/favicon.ico")).toBe(false);
    expect(matches("/og-image.jpg")).toBe(false);
    expect(matches("/next.svg")).toBe(false);
    expect(matches("/fonts/geist.woff2")).toBe(false);
    expect(matches("/site.webmanifest")).toBe(false);
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
    expect(matches("/reports/2026.10")).toBe(true);
  });

  it("excludes exactly the extensions STATIC_ASSET_EXTENSIONS declares", () => {
    // Without this, the literal in proxy.ts and the predicate used by the rest
    // of the app could disagree — the same class of bug as excluding "public".
    for (const extension of STATIC_ASSET_EXTENSIONS) {
      expect(
        matches(`/asset.${extension}`),
        `${extension} is in STATIC_ASSET_EXTENSIONS but the matcher still routes it through auth`
      ).toBe(false);
      expect(isStaticAssetPath(`/asset.${extension}`)).toBe(true);
    }
  });
});
