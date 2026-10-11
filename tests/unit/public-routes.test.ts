import { describe, expect, it } from "vitest";
import {
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
