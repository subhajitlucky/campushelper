import { describe, expect, it } from "vitest";
import { limitCustom } from "@/lib/rateLimit";

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
});
