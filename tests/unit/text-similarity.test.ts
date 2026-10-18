import { describe, expect, it } from "vitest";
import { jaccard, normalizeText, tokenize } from "@/lib/text-similarity";

describe("normalizeText", () => {
  it("lowercases and collapses punctuation into single spaces", () => {
    expect(normalizeText("Red  iPhone 15!!")).toBe("red iphone 15");
  });

  it("strips diacritics so accented and plain spellings agree", () => {
    expect(normalizeText("Café Résumé")).toBe("cafe resume");
  });

  it("handles non-latin scripts without throwing", () => {
    expect(() => normalizeText("मेरा बैग")).not.toThrow();
  });

  it("returns an empty string for punctuation-only input", () => {
    expect(normalizeText("!!! ???")).toBe("");
  });
});

describe("tokenize", () => {
  it("drops stopwords and report filler", () => {
    expect(tokenize("I lost my black wallet near the library")).toEqual([
      "black",
      "wallet",
      "library",
    ]);
  });

  it("drops tokens shorter than three characters", () => {
    expect(tokenize("a of id bag")).toEqual(["bag"]);
  });

  it("keeps short numeric tokens because model numbers discriminate", () => {
    expect(tokenize("iphone 15 charger")).toEqual(["iphone", "15", "charger"]);
  });

  it("still drops single-digit noise", () => {
    expect(tokenize("bag 5")).toEqual(["bag"]);
  });

  it("de-duplicates while preserving first-seen order", () => {
    expect(tokenize("blue blue bag blue")).toEqual(["blue", "bag"]);
  });

  it("returns an empty array for empty input", () => {
    expect(tokenize("")).toEqual([]);
  });

  it("keeps alphanumeric model numbers intact", () => {
    expect(tokenize("iphone 15 pro max")).toEqual(["iphone", "15", "pro", "max"]);
  });
});

describe("jaccard", () => {
  it("returns 1 for identical sets", () => {
    expect(jaccard(["a", "b"], ["a", "b"])).toBe(1);
  });

  it("returns 1/3 for a one-of-three overlap", () => {
    expect(jaccard(["a", "b"], ["b", "c"])).toBeCloseTo(1 / 3, 10);
  });

  it("returns 0 for disjoint sets", () => {
    expect(jaccard(["a"], ["b"])).toBe(0);
  });

  it("returns 0 when either side is empty", () => {
    expect(jaccard([], ["a"])).toBe(0);
    expect(jaccard(["a"], [])).toBe(0);
  });

  it("returns 0 when both sides are empty rather than dividing by zero", () => {
    expect(jaccard([], [])).toBe(0);
  });

  it("accepts Sets as well as arrays", () => {
    expect(jaccard(new Set(["a", "b"]), new Set(["a", "b"]))).toBe(1);
  });

  it("ignores duplicates because sets are used", () => {
    expect(jaccard(["a", "a", "a"], ["a"])).toBe(1);
  });
});
