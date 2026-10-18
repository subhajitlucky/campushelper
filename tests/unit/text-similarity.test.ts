import { describe, expect, it } from "vitest";
import { jaccard, normalizeText, tokenize } from "@/lib/text-similarity";

describe("normalizeText", () => {
  it("lowercases and collapses punctuation into single spaces", () => {
    expect(normalizeText("Red  iPhone 15!!")).toBe("red iphone 15");
  });

  it("strips diacritics so accented and plain spellings agree", () => {
    expect(normalizeText("Café Résumé")).toBe("cafe resume");
  });

  // Regression: the previous rule was `[^a-z0-9]`, which deleted every
  // non-Latin character. The old test here asserted only that the call did not
  // throw, so it passed while Devanagari normalised to the empty string and
  // matching was inert for Hindi and Odia reports.
  it("preserves Devanagari rather than deleting it", () => {
    expect(normalizeText("मेरा काला बटुआ खो गया")).toBe("मेरा काला बटुआ खो गया");
  });

  it("keeps Devanagari vowel signs, which are combining marks and not letters", () => {
    // `\p{L}` alone strips these, turning "मेरा" into "म र".
    expect(normalizeText("मेरा")).toBe("मेरा");
    expect(normalizeText("बटुआ")).toBe("बटुआ");
  });

  it("preserves Odia", () => {
    expect(normalizeText("ମୋର କଳା ବ୍ୟାଗ")).toContain("ବ୍ୟାଗ");
  });

  it("still strips punctuation around non-Latin text", () => {
    expect(normalizeText("मेरा बैग!!! (जल्दी)")).toBe("मेरा बैग जल्दी");
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

  it("keeps Hindi content words and drops Hindi filler", () => {
    // "मेरा ... खो गया" is filler; "काला बटुआ" identifies the item.
    expect(tokenize("मेरा काला बटुआ खो गया")).toEqual(["काला", "बटुआ"]);
  });

  it("keeps a two-code-unit non-Latin word, which the ASCII floor would drop", () => {
    // "घर" (house) is two UTF-16 units: consonant + vowel sign.
    expect(tokenize("घर")).toEqual(["घर"]);
  });

  it("produces a non-empty token list for a Hindi report", () => {
    // The regression in one line: this used to be [].
    expect(tokenize("काला चमड़े का बटुआ").length).toBeGreaterThan(0);
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
