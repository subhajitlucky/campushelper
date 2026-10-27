import { describe, expect, it } from "vitest";
import { NextResponse } from "next/server";
import { z } from "zod";
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

describe("safeApiHandler validation errors", () => {
  it("names the field only when the issue has a path", async () => {
    const schema = z.object({
      page: z.string().refine(() => false, "Page is not valid"),
      limit: z.string().refine(() => false, "Limit is not valid"),
    });
    const parsed = schema.safeParse({ page: "x", limit: "y" });
    if (parsed.success) throw new Error("Expected validation to fail");

    const response = (await safeApiHandler(async () => {
      throw parsed.error;
    })) as NextResponse;
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe(ErrorCodes.VALIDATION_ERROR);
    expect(body.error).toBe("Validation failed: page: Page is not valid, limit: Limit is not valid");
  });

  it("does not prefix a pathless issue with an empty field name", async () => {
    const schema = z.object({ page: z.string() }).refine(() => false, "Bad query");
    const parsed = schema.safeParse({ page: "x" });
    if (parsed.success) throw new Error("Expected validation to fail");

    const response = (await safeApiHandler(async () => {
      throw parsed.error;
    })) as NextResponse;
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Validation failed: Bad query");
  });
});
