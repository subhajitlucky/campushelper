import { describe, expect, it } from "vitest";
import {
  DUPLICATE_SIMILARITY_THRESHOLD,
  duplicateSimilarity,
  MATCH_THRESHOLD,
  MATCH_WINDOW_DAYS,
  findLikelyDuplicates,
  rankMatches,
  scoreMatch,
  type MatchableItem,
} from "@/lib/matching";

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-10-18T09:00:00.000Z");

function item(overrides: Partial<MatchableItem> & { id: string }): MatchableItem {
  return {
    itemType: "LOST",
    title: "Black leather wallet",
    description: "Bifold wallet with a metro card and a library card inside",
    location: "Central Library",
    categoryId: "cat_accessories",
    zoneId: "zone_central-library",
    tags: ["leather", "black"],
    createdAt: NOW,
    ...overrides,
  };
}

/** The mirror-image FOUND counterpart of the default item. */
function counterpart(overrides: Partial<MatchableItem> = {}): MatchableItem {
  return item({
    id: "found-1",
    itemType: "FOUND",
    ...overrides,
  });
}

describe("scoreMatch", () => {
  it("refuses to match two reports of the same type", () => {
    const a = item({ id: "a" });
    const b = item({ id: "b" });

    expect(scoreMatch(a, b)).toEqual({ score: 0, reasons: [] });
  });

  it("refuses to match an item with itself", () => {
    const a = item({ id: "a" });
    expect(scoreMatch(a, { ...a, itemType: "FOUND" }).score).toBe(0);
  });

  it("scores an identical lost/found pair at 90 or above", () => {
    const { score } = scoreMatch(item({ id: "lost-1" }), counterpart());
    expect(score).toBeGreaterThanOrEqual(90);
  });

  it("never exceeds 100", () => {
    const { score } = scoreMatch(item({ id: "lost-1" }), counterpart());
    expect(score).toBeLessThanOrEqual(100);
  });

  it("returns an integer score", () => {
    const { score } = scoreMatch(
      item({ id: "lost-1", title: "Blue denim jacket with a torn pocket" }),
      counterpart({ title: "Denim jacket blue, pocket torn" })
    );
    expect(Number.isInteger(score)).toBe(true);
  });

  it("scores unrelated reports below the suggestion threshold", () => {
    const lost = item({
      id: "lost-1",
      title: "Silver Casio wristwatch",
      description: "Analogue watch with a scratched glass face",
      location: "Sports Complex changing room",
      categoryId: "cat_accessories",
      zoneId: "zone_sports-complex",
      tags: ["watch"],
      createdAt: NOW,
    });

    const found = item({
      id: "found-9",
      itemType: "FOUND",
      title: "Physics lab manual",
      description: "Hardbound manual with handwritten notes in the margins",
      location: "Academic Block 1 laboratory",
      categoryId: "cat_books",
      zoneId: "zone_academic-block-1",
      tags: ["book"],
      createdAt: new Date(NOW.getTime() - 170 * DAY),
    });

    const { score } = scoreMatch(lost, found);
    expect(score).toBeLessThan(MATCH_THRESHOLD);
  });

  it("attributes every point to a named reason", () => {
    const { score, reasons } = scoreMatch(item({ id: "lost-1" }), counterpart());
    const summed = reasons.reduce((total, reason) => total + reason.weight, 0);

    expect(summed).toBe(score);
    for (const reason of reasons) {
      expect(reason.weight).toBeGreaterThan(0);
      expect(reason.label.length).toBeGreaterThan(0);
    }
  });

  it("uses the zone signal and never the location signal when both sides have a zone", () => {
    const { reasons } = scoreMatch(
      item({ id: "lost-1" }),
      counterpart({ location: "Completely different words entirely" })
    );

    const codes = reasons.map((r) => r.code);
    expect(codes).toContain("same_zone");
    expect(codes).not.toContain("similar_location");
  });

  it("falls back to location text when either side lacks a zone", () => {
    const { reasons } = scoreMatch(
      item({ id: "lost-1", zoneId: null }),
      counterpart({ zoneId: null })
    );

    const codes = reasons.map((r) => r.code);
    expect(codes).toContain("similar_location");
    expect(codes).not.toContain("same_zone");
  });

  it("gives no zone or location credit when zones differ", () => {
    const { reasons } = scoreMatch(
      item({ id: "lost-1" }),
      counterpart({ zoneId: "zone_canteen" })
    );

    const codes = reasons.map((r) => r.code);
    expect(codes).not.toContain("same_zone");
    expect(codes).not.toContain("similar_location");
  });

  it("decays the date signal proportionally across the window", () => {
    const dateWeight = (daysAgo: number) => {
      const { reasons } = scoreMatch(
        item({ id: "lost-1" }),
        counterpart({ createdAt: new Date(NOW.getTime() - daysAgo * DAY) })
      );
      return reasons.find((r) => r.code === "close_in_time")?.weight ?? 0;
    };

    // Full 8 points on the same day, half at the midpoint, none at the edge.
    expect(dateWeight(0)).toBe(8);
    expect(dateWeight(MATCH_WINDOW_DAYS / 2)).toBe(4);
    expect(dateWeight(MATCH_WINDOW_DAYS)).toBe(0);
    expect(dateWeight(MATCH_WINDOW_DAYS + 30)).toBe(0);
  });

  it("labels the date reason in whole days", () => {
    const { reasons } = scoreMatch(
      item({ id: "lost-1" }),
      counterpart({ createdAt: new Date(NOW.getTime() - 2 * DAY) })
    );
    const dateReason = reasons.find((r) => r.code === "close_in_time");
    expect(dateReason?.label).toBe("Reported 2 days apart");
  });

  it("uses the singular form for a one-day gap", () => {
    const { reasons } = scoreMatch(
      item({ id: "lost-1" }),
      counterpart({ createdAt: new Date(NOW.getTime() - 1 * DAY) })
    );
    expect(reasons.find((r) => r.code === "close_in_time")?.label).toBe(
      "Reported 1 day apart"
    );
  });

  it("says 'same day' when the reports share a date", () => {
    const { reasons } = scoreMatch(item({ id: "lost-1" }), counterpart());
    expect(reasons.find((r) => r.code === "close_in_time")?.label).toBe(
      "Reported the same day"
    );
  });

  it("gives no category credit when either side lacks one", () => {
    const { reasons } = scoreMatch(
      item({ id: "lost-1", categoryId: null }),
      counterpart()
    );
    expect(reasons.map((r) => r.code)).not.toContain("same_category");
  });

  it("gives no tag credit for untagged items", () => {
    const { reasons } = scoreMatch(
      item({ id: "lost-1", tags: [] }),
      counterpart({ tags: [] })
    );
    expect(reasons.map((r) => r.code)).not.toContain("shared_tags");
  });

  it("handles a candidate with an empty description without inflating the score", () => {
    const { score } = scoreMatch(
      item({ id: "lost-1", title: "Zebra", description: "" }),
      counterpart({ title: "Zebra", description: "", tags: [], categoryId: null, zoneId: null, location: "" })
    );
    expect(score).toBeLessThanOrEqual(MATCH_WEIGHTS_TOTAL_WITHOUT_LOCATION);
  });
});

const MATCH_WEIGHTS_TOTAL_WITHOUT_LOCATION = 34 + 18 + 8;

describe("matching in non-Latin scripts", () => {
  // Regression: Devanagari normalised to "" so both text signals contributed 0
  // and a pair of identical Hindi reports scored at most 46 -- below the 55
  // match threshold and the 70 duplicate threshold. The feature was inert for
  // anyone reporting in Hindi or Odia.
  const hindiBase = {
    itemType: "LOST" as const,
    title: "काला चमड़े का बटुआ",
    description: "मेट्रो कार्ड और लाइब्रेरी कार्ड वाला बटुआ",
    location: "सेंट्रल लाइब्रेरी",
    categoryId: null,
    zoneId: null,
    tags: [],
    createdAt: NOW,
  };

  it("matches an identical Hindi lost/found pair", () => {
    const lost = { ...hindiBase, id: "hi-1" };
    const found = { ...hindiBase, id: "hi-2", itemType: "FOUND" as const };

    expect(scoreMatch(lost, found).score).toBeGreaterThanOrEqual(MATCH_THRESHOLD);
  });

  it("does not match unrelated Hindi reports", () => {
    const wallet = { ...hindiBase, id: "hi-3" };
    const bat = {
      itemType: "FOUND" as const,
      title: "लकड़ी का क्रिकेट बल्ला",
      description: "टूटी हुई ग्रिप वाला बल्ला",
      location: "स्पोर्ट्स कॉम्प्लेक्स",
      categoryId: null,
      zoneId: null,
      tags: [],
      createdAt: NOW,
      id: "hi-4",
    };

    expect(scoreMatch(wallet, bat).score).toBeLessThan(MATCH_THRESHOLD);
  });

  it("flags a duplicate Hindi repost", () => {
    const first = { ...hindiBase, id: "hi-5" };
    const repost = { ...hindiBase, id: "hi-6" };

    expect(duplicateSimilarity(repost, first)).toBeGreaterThanOrEqual(
      DUPLICATE_SIMILARITY_THRESHOLD
    );
    expect(findLikelyDuplicates(repost, [first]).map((d) => d.item.id)).toEqual(["hi-5"]);
  });
});

describe("rankMatches", () => {
  it("returns matches best-first", () => {
    const subject = item({ id: "lost-1" });
    const strong = counterpart({ id: "found-strong" });
    const weak = counterpart({
      id: "found-weak",
      title: "Blue umbrella",
      description: "Folding umbrella",
      tags: ["umbrella"],
      categoryId: "cat_other",
      zoneId: "zone_parking",
    });

    const ranked = rankMatches(subject, [weak, strong]);
    expect(ranked.map((r) => r.item.id)).toEqual(["found-strong"]);
  });

  it("breaks score ties by most recent report", () => {
    const subject = item({ id: "lost-1" });
    const older = counterpart({ id: "found-old", createdAt: new Date(NOW.getTime() - 5 * DAY) });
    const newer = counterpart({ id: "found-new", createdAt: NOW });

    const ranked = rankMatches(subject, [older, newer]);
    expect(ranked.map((r) => r.item.id)).toEqual(["found-new", "found-old"]);
  });

  it("never returns the subject itself", () => {
    const subject = item({ id: "lost-1", itemType: "FOUND" });
    const ranked = rankMatches(subject, [subject]);
    expect(ranked).toEqual([]);
  });

  it("honours a custom threshold", () => {
    const subject = item({ id: "lost-1" });
    const weak = counterpart({
      id: "found-weak",
      title: "Blue umbrella",
      description: "Folding umbrella",
      tags: ["umbrella"],
      categoryId: "cat_other",
      zoneId: "zone_parking",
    });

    expect(rankMatches(subject, [weak], 0).map((r) => r.item.id)).toEqual(["found-weak"]);
  });

  it("returns an empty list when nothing clears the bar", () => {
    const subject = item({ id: "lost-1" });
    const unrelated = counterpart({
      id: "found-far",
      title: "Wooden cricket bat",
      description: "Signed bat with a cracked handle",
      location: "Sports Complex",
      categoryId: "cat_sports",
      zoneId: "zone_sports-complex",
      tags: ["cricket"],
      createdAt: new Date(NOW.getTime() - 179 * DAY),
    });

    expect(rankMatches(subject, [unrelated])).toEqual([]);
  });
});

describe("findLikelyDuplicates", () => {
  it("uses the stricter duplicate threshold", () => {
    // A ratio, not an absolute score: an absolute threshold above the maximum
    // achievable without a category made the guard unreachable.
    expect(DUPLICATE_SIMILARITY_THRESHOLD).toBeGreaterThan(0);
    expect(DUPLICATE_SIMILARITY_THRESHOLD).toBeLessThanOrEqual(1);
  });

  it("flags a near-identical re-post of the same type", () => {
    const original = item({ id: "lost-1" });
    const repost = item({ id: "lost-2" });

    const duplicates = findLikelyDuplicates(repost, [original]);
    expect(duplicates.map((d) => d.item.id)).toEqual(["lost-1"]);
    expect(duplicateSimilarity(repost, original)).toBeGreaterThanOrEqual(
      DUPLICATE_SIMILARITY_THRESHOLD
    );
  });

  it("flags a near-identical repost even with no category, zone, or tags", () => {
    // Regression: the previous absolute threshold of 70 could not be reached by
    // two identical reports lacking a category (maximum achievable was 68), so
    // the guard silently never fired for a double-submitted form.
    const bare = {
      itemType: 'LOST' as const,
      title: 'Black leather wallet',
      description: 'Bifold wallet with a metro card and a library card inside',
      location: 'Central Library',
      categoryId: null,
      zoneId: null,
      tags: [],
      createdAt: NOW,
    };

    const first = { ...bare, id: 'bare-1' };
    const repost = { ...bare, id: 'bare-2' };

    expect(duplicateSimilarity(repost, first)).toBe(1);
    expect(findLikelyDuplicates(repost, [first]).map((d) => d.item.id)).toEqual(['bare-1']);
  });

  it("does not flag a different item", () => {
    const repost = item({ id: "lost-2" });
    const other = item({
      id: "lost-3",
      title: "Blue water bottle",
      description: "Steel insulated bottle with stickers",
      categoryId: "cat_other",
      zoneId: "zone_canteen",
      tags: ["bottle"],
    });

    expect(findLikelyDuplicates(repost, [other])).toEqual([]);
  });
});
