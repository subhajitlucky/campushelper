import { describe, expect, it } from "vitest";
import {
  COMMENT_DAILY_CAP,
  REPUTATION_POINTS,
  TIERS,
  canCreditComment,
  formatReputationDelta,
  nextTier,
  reputationTier,
  resolveAward,
  tierProgress,
} from "@/lib/reputation";

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

describe("nextTier", () => {
  it("finds the tier above the current one", () => {
    expect(nextTier(0)?.name).toBe("Bronze");
    expect(nextTier(30)?.name).toBe("Silver");
  });

  it("returns null at the top tier", () => {
    expect(nextTier(500)).toBeNull();
    expect(nextTier(99999)).toBeNull();
  });
});

describe("tierProgress", () => {
  it("is zero at the start of a tier", () => {
    expect(tierProgress(0)).toBe(0);
    expect(tierProgress(25)).toBe(0);
    expect(tierProgress(200)).toBe(0);
  });

  it("is halfway at the midpoint of a tier", () => {
    expect(tierProgress(50)).toBeCloseTo(0.5, 10); // Bronze 25 -> Silver 75
    expect(tierProgress(350)).toBeCloseTo(0.5, 10); // Gold 200 -> Champion 500
  });

  it("is 1 at the top tier so progress bars render full", () => {
    expect(tierProgress(500)).toBe(1);
    expect(tierProgress(5000)).toBe(1);
  });

  it("clamps out-of-range and non-finite input into 0..1", () => {
    expect(tierProgress(-10)).toBe(0);
    expect(tierProgress(Number.NaN)).toBe(0);
    expect(tierProgress(Number.POSITIVE_INFINITY)).toBe(1);
  });

  it("never exceeds 1 within a tier", () => {
    for (const total of [1, 24, 74, 199, 499]) {
      expect(tierProgress(total)).toBeLessThanOrEqual(1);
    }
  });
});

describe("canCreditComment", () => {
  it("allows credit below the daily cap", () => {
    expect(canCreditComment(0)).toBe(true);
    expect(canCreditComment(COMMENT_DAILY_CAP - 1)).toBe(true);
  });

  it("refuses credit at and above the cap", () => {
    expect(canCreditComment(COMMENT_DAILY_CAP)).toBe(false);
    expect(canCreditComment(COMMENT_DAILY_CAP + 5)).toBe(false);
  });

  it("treats non-finite counts as zero credited", () => {
    expect(canCreditComment(Number.NaN)).toBe(true);
  });
});

describe("formatReputationDelta", () => {
  it("prefixes positive values with a plus", () => {
    expect(formatReputationDelta(25)).toBe("+25");
  });

  it("uses a real minus sign for negative values", () => {
    expect(formatReputationDelta(-10)).toBe("−10");
  });

  it("renders zero without a sign", () => {
    expect(formatReputationDelta(0)).toBe("0");
  });

  it("rounds fractional input", () => {
    expect(formatReputationDelta(2.4)).toBe("+2");
  });
});

describe("resolveAward", () => {
  it("returns the table value for uncapped kinds", () => {
    expect(resolveAward("RETURN_COMPLETED")).toBe(25);
    expect(resolveAward("MODERATION_UPHELD")).toBe(-10);
  });

  it("returns zero once the daily comment cap is reached", () => {
    expect(resolveAward("COMMENT_POSTED", 0)).toBe(1);
    expect(resolveAward("COMMENT_POSTED", COMMENT_DAILY_CAP)).toBe(0);
  });

  it("does not apply the comment cap to other kinds", () => {
    expect(resolveAward("ITEM_POSTED", COMMENT_DAILY_CAP)).toBe(2);
  });
});
