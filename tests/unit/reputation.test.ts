import { describe, expect, it } from "vitest";
import { REPUTATION_POINTS, TIERS, reputationTier } from "@/lib/reputation";

describe("REPUTATION_POINTS", () => {
  it("matches the published rule table", () => {
    expect(REPUTATION_POINTS).toEqual({
      ITEM_POSTED: 2,
      COMMENT_POSTED: 1,
      CLAIM_APPROVED: 5,
      RETURN_COMPLETED: 25,
      MODERATION_UPHELD: -10,
    });
  });

  it("makes a completed return worth at least ten posts", () => {
    expect(REPUTATION_POINTS.RETURN_COMPLETED).toBeGreaterThanOrEqual(
      REPUTATION_POINTS.ITEM_POSTED * 10
    );
  });
});

describe("reputationTier", () => {
  it("returns Newcomer at zero", () => {
    expect(reputationTier(0).name).toBe("Newcomer");
  });

  it("returns exact tier boundaries", () => {
    expect(reputationTier(0).name).toBe("Newcomer");
    expect(reputationTier(25).name).toBe("Bronze");
    expect(reputationTier(75).name).toBe("Silver");
    expect(reputationTier(200).name).toBe("Gold");
    expect(reputationTier(500).name).toBe("Champion");
  });

  it("returns the lower tier just below each boundary", () => {
    expect(reputationTier(24).name).toBe("Newcomer");
    expect(reputationTier(74).name).toBe("Bronze");
    expect(reputationTier(199).name).toBe("Silver");
    expect(reputationTier(499).name).toBe("Gold");
  });

  it("keeps the top tier for very high totals", () => {
    expect(reputationTier(100000).name).toBe("Champion");
  });

  it("clamps negative and non-finite totals to the lowest tier", () => {
    expect(reputationTier(-50).name).toBe("Newcomer");
    expect(reputationTier(Number.NaN).name).toBe("Newcomer");
    expect(reputationTier(Number.POSITIVE_INFINITY).name).toBe("Champion");
  });

  it("orders tiers by ascending threshold", () => {
    const minimums = TIERS.map((tier) => tier.min);
    expect(minimums).toEqual([...minimums].sort((a, b) => a - b));
    expect(minimums[0]).toBe(0);
  });

  it("gives every tier a distinct name, icon, and style", () => {
    expect(new Set(TIERS.map((t) => t.name)).size).toBe(TIERS.length);
    expect(new Set(TIERS.map((t) => t.icon)).size).toBe(TIERS.length);
    for (const tier of TIERS) {
      expect(tier.className.length).toBeGreaterThan(0);
    }
  });
});

