import { describe, expect, it } from "vitest";
import { NextResponse } from "next/server";
import { RateLimitError } from "@/lib/rateLimit";
import { safeApiHandler, ErrorCodes } from "@/lib/errors";

describe("safeApiHandler rate limit handling", () => {
  it("maps a RateLimitError to 429 with a Retry-After header", async () => {
    const response = (await safeApiHandler(async () => {
      throw new RateLimitError("items", 42);
    })) as NextResponse;

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("42");

    const body = await response.json();
    expect(body.code).toBe(ErrorCodes.RATE_LIMIT_EXCEEDED);
    expect(body.error).toMatch(/Too many requests/);
    expect(body.timestamp).toEqual(expect.any(String));
  });

  it("never reports a retry delay below one second", async () => {
    const response = (await safeApiHandler(async () => {
      throw new RateLimitError("items", 0);
    })) as NextResponse;

    expect(response.headers.get("Retry-After")).toBe("1");
  });

  it("still maps unrelated errors to 500", async () => {
    const response = (await safeApiHandler(async () => {
      throw new Error("boom");
    })) as NextResponse;

    expect(response.status).toBe(500);
    expect(response.headers.get("Retry-After")).toBeNull();
  });
});
