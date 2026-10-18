import { describe, expect, it } from "vitest";
import { limitCustom, RateLimitError } from "@/lib/rateLimit";

describe("limitCustom", () => {
  it("reuses the limiter instance for the same endpoint configuration", async () => {
    await expect(limitCustom("reuse-user", 1, 60, "reuse-test")).resolves.toBeUndefined();
    await expect(limitCustom("reuse-user", 1, 60, "reuse-test")).rejects.toThrow(
      /Too many requests/
    );
  });

  it("keeps separate limiter state per endpoint name", async () => {
    await expect(limitCustom("shared-key", 1, 60, "endpoint-a")).resolves.toBeUndefined();
    await expect(limitCustom("shared-key", 1, 60, "endpoint-b")).resolves.toBeUndefined();
  });

  it("allows different keys within the same limiter", async () => {
    await expect(limitCustom("key-1", 1, 60, "keys-test")).resolves.toBeUndefined();
    await expect(limitCustom("key-2", 1, 60, "keys-test")).resolves.toBeUndefined();
  });

  it("throws a typed RateLimitError carrying retry metadata", async () => {
    await limitCustom("typed-user", 1, 60, "typed-test");

    const error = await limitCustom("typed-user", 1, 60, "typed-test").catch((e) => e);

    expect(error).toBeInstanceOf(RateLimitError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("RateLimitError");
    expect(error.endpoint).toBe("typed-test");
    expect(error.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    expect(error.retryAfterSeconds).toBeLessThanOrEqual(60);
    expect(error.message).toMatch(/Too many requests/);
  });
});
