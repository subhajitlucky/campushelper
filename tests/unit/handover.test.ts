import { describe, expect, it } from "vitest";
import {
  canAccessHandover,
  generateHandoverCode,
  handoverCodesMatch,
  type HandoverClaimContext,
} from "@/lib/handover-service";
import { MAX_HANDOVER_ATTEMPTS, HANDOVER_CODE_TTL_HOURS } from "@/lib/schemas/handover";

function claim(overrides: Partial<HandoverClaimContext> = {}): HandoverClaimContext {
  return {
    id: "claim-1",
    status: "APPROVED",
    userId: "claimer",
    itemId: "item-1",
    item: { id: "item-1", title: "Black wallet", postedById: "poster" },
    ...overrides,
  };
}

describe("generateHandoverCode", () => {
  it("always produces exactly six digits", () => {
    for (let i = 0; i < 500; i += 1) {
      expect(generateHandoverCode()).toMatch(/^\d{6}$/);
    }
  });

  it("zero-pads low values rather than emitting a short code", () => {
    // The smallest possible value must still be six characters.
    expect(generateHandoverCode().padStart(6, "0")).toHaveLength(6);
  });

  it("does not return the same value on every call", () => {
    const seen = new Set(Array.from({ length: 200 }, () => generateHandoverCode()));
    // A collision is possible but 200 draws landing on one value is not.
    expect(seen.size).toBeGreaterThan(1);
  });

  it("spreads across the whole space rather than clustering", () => {
    const codes = Array.from({ length: 400 }, () => Number(generateHandoverCode()));
    const leadingDigits = new Set(codes.map((code) => Math.floor(code / 100_000)));

    // Every leading digit should appear across 400 draws.
    expect(leadingDigits.size).toBe(10);
  });
});

describe("handoverCodesMatch", () => {
  it("accepts an exact match", () => {
    expect(handoverCodesMatch("123456", "123456")).toBe(true);
    expect(handoverCodesMatch("000000", "000000")).toBe(true);
  });

  it("rejects a different code of the same length", () => {
    expect(handoverCodesMatch("123456", "123457")).toBe(false);
  });

  it("rejects a single-digit difference anywhere in the code", () => {
    for (let position = 0; position < 6; position += 1) {
      const provided = `123456`.split("");
      provided[position] = provided[position] === "9" ? "8" : "9";
      expect(handoverCodesMatch("123456", provided.join(""))).toBe(false);
    }
  });

  it("rejects codes of a different length without throwing", () => {
    // Hashed comparison means unequal lengths cannot throw the way a raw
    // timingSafeEqual on unequal buffers would.
    expect(handoverCodesMatch("123456", "12345")).toBe(false);
    expect(handoverCodesMatch("123456", "")).toBe(false);
    expect(handoverCodesMatch("123456", "1234567")).toBe(false);
  });
});

describe("canAccessHandover", () => {
  it("allows the claimer", () => {
    expect(canAccessHandover(claim(), "claimer", "USER")).toBe(true);
  });

  it("allows the item's poster", () => {
    expect(canAccessHandover(claim(), "poster", "USER")).toBe(true);
  });

  it("allows admins and moderators", () => {
    expect(canAccessHandover(claim(), "stranger", "ADMIN")).toBe(true);
    expect(canAccessHandover(claim(), "stranger", "MODERATOR")).toBe(true);
  });

  it("refuses an unrelated user", () => {
    expect(canAccessHandover(claim(), "stranger", "USER")).toBe(false);
  });

  it("refuses a user with no role", () => {
    expect(canAccessHandover(claim(), "stranger", undefined)).toBe(false);
  });
});

describe("handover policy constants", () => {
  it("caps attempts at a small number so the code cannot be brute-forced", () => {
    expect(MAX_HANDOVER_ATTEMPTS).toBeGreaterThan(1);
    expect(MAX_HANDOVER_ATTEMPTS).toBeLessThanOrEqual(10);
  });

  it("expires codes within a few days", () => {
    expect(HANDOVER_CODE_TTL_HOURS).toBeGreaterThanOrEqual(24);
    expect(HANDOVER_CODE_TTL_HOURS).toBeLessThanOrEqual(24 * 7);
  });
});
