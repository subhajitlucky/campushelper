import { describe, expect, it } from "vitest";
import { timingSafeTokenCompare } from "@/lib/csrf";

describe("timingSafeTokenCompare", () => {
  it("returns true for equal tokens", () => {
    expect(timingSafeTokenCompare("a".repeat(64), "a".repeat(64))).toBe(true);
  });

  it("returns false for unequal tokens", () => {
    expect(timingSafeTokenCompare("a".repeat(64), "b".repeat(64))).toBe(false);
    expect(timingSafeTokenCompare("token-one", "token-two")).toBe(false);
  });

  it("returns false when either token is empty or missing", () => {
    expect(timingSafeTokenCompare("", "")).toBe(false);
    expect(timingSafeTokenCompare("token", "")).toBe(false);
    expect(timingSafeTokenCompare("", "token")).toBe(false);
    expect(timingSafeTokenCompare(null, "token")).toBe(false);
    expect(timingSafeTokenCompare("token", undefined)).toBe(false);
  });

  it("compares different-length tokens without throwing", () => {
    expect(timingSafeTokenCompare("short", "a-much-longer-token-value")).toBe(false);
  });
});
