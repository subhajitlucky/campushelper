import { describe, expect, it } from "vitest";
import {
  MAX_BODY_LENGTH,
  formatNotification,
  truncateAtWord,
} from "@/lib/notification-content";
import type { NotificationType } from "@/generated/prisma";

const ALL_TYPES: NotificationType[] = [
  "CLAIM_CREATED",
  "CLAIM_STATUS_CHANGED",
  "COMMENT_ON_ITEM",
  "MATCH_FOUND",
  "SAVED_SEARCH_HIT",
  "HANDOVER_CODE_ISSUED",
  "HANDOVER_VERIFIED",
  "ITEM_RESOLVED",
  "MODERATION_ACTION",
];

describe("formatNotification", () => {
  it("produces a non-empty title and body for every type", () => {
    for (const type of ALL_TYPES) {
      const { title, body } = formatNotification({
        type,
        actorName: "Asha",
        itemTitle: "Black wallet",
        status: "APPROVED",
        reason: "Spam",
        query: "wallets",
      });

      expect(title.trim().length, `title for ${type}`).toBeGreaterThan(0);
      expect(body.trim().length, `body for ${type}`).toBeGreaterThan(0);
      expect(body.length, `body length for ${type}`).toBeLessThanOrEqual(MAX_BODY_LENGTH);
    }
  });

  it("names the actor and the item when both are known", () => {
    const { body } = formatNotification({
      type: "COMMENT_ON_ITEM",
      actorName: "Asha",
      itemTitle: "Black wallet",
    });

    expect(body).toContain("Asha");
    expect(body).toContain('"Black wallet"');
  });

  it("falls back to 'Someone' when the actor is unknown", () => {
    const withNull = formatNotification({ type: "CLAIM_CREATED", actorName: null });
    const withBlank = formatNotification({ type: "CLAIM_CREATED", actorName: "   " });
    const withUndefined = formatNotification({ type: "CLAIM_CREATED" });

    expect(withNull.body).toContain("Someone");
    expect(withBlank.body).toContain("Someone");
    expect(withUndefined.body).toContain("Someone");
  });

  it("falls back to a generic item phrase when no title is available", () => {
    const { body } = formatNotification({ type: "ITEM_RESOLVED", itemTitle: null });
    expect(body).toContain("your item");
  });

  it("reflects each claim outcome in the title", () => {
    const approved = formatNotification({ type: "CLAIM_STATUS_CHANGED", status: "APPROVED" });
    const rejected = formatNotification({ type: "CLAIM_STATUS_CHANGED", status: "REJECTED" });
    const completed = formatNotification({ type: "CLAIM_STATUS_CHANGED", status: "COMPLETED" });

    expect(approved.title).toMatch(/approved/i);
    expect(rejected.title).toMatch(/rejected/i);
    expect(completed.title).toMatch(/complete/i);
  });

  it("defaults an unknown claim status to the pending wording", () => {
    const { title } = formatNotification({ type: "CLAIM_STATUS_CHANGED", status: null });
    expect(title).toMatch(/pending/i);
  });

  it("includes the moderator's reason when one is given", () => {
    const withReason = formatNotification({
      type: "MODERATION_ACTION",
      itemTitle: "Item",
      reason: "Duplicate posting",
    });
    const withoutReason = formatNotification({
      type: "MODERATION_ACTION",
      itemTitle: "Item",
      reason: "  ",
    });

    expect(withReason.body).toContain("Duplicate posting");
    expect(withoutReason.body).not.toContain("Reason given");
  });

  it("names the saved search when one is given", () => {
    const named = formatNotification({ type: "SAVED_SEARCH_HIT", query: "blue backpack" });
    const unnamed = formatNotification({ type: "SAVED_SEARCH_HIT", query: null });

    expect(named.body).toContain('"blue backpack"');
    expect(unnamed.body).toContain("your saved search");
  });

  it("never leaks a handover code, because the code is not an input", () => {
    for (const type of ["HANDOVER_CODE_ISSUED", "HANDOVER_VERIFIED"] as NotificationType[]) {
      const { title, body } = formatNotification({
        type,
        itemTitle: "Black wallet",
        // Simulates a caller mistakenly trying to smuggle the code through.
        ...({ code: "123456", handoverCode: "123456" } as Record<string, unknown>),
      });

      expect(`${title} ${body}`).not.toMatch(/\b\d{6}\b/);
    }
  });

  it("asks the recipient not to share the code early", () => {
    const { body } = formatNotification({ type: "HANDOVER_CODE_ISSUED" });
    expect(body).toMatch(/only when|never before/i);
  });

  it("passes HTML-ish characters through unchanged", () => {
    const { body } = formatNotification({
      type: "COMMENT_ON_ITEM",
      actorName: "<script>alert(1)</script>",
      itemTitle: "Bag & <b>tag</b>",
    });

    // Escaping is the renderer's job; the formatter must not mangle or execute.
    expect(body).toContain("<script>alert(1)</script>");
    expect(body).toContain("Bag & <b>tag</b>");
  });
});

describe("truncateAtWord", () => {
  it("leaves short text untouched", () => {
    expect(truncateAtWord("short body", 200)).toBe("short body");
  });

  it("leaves text exactly at the limit untouched", () => {
    const exact = "x".repeat(200);
    expect(truncateAtWord(exact, 200)).toBe(exact);
  });

  it("truncates long text at a word boundary with an ellipsis", () => {
    const result = truncateAtWord("alpha beta gamma delta", 12);

    expect(result.length).toBeLessThanOrEqual(12);
    expect(result.endsWith("…")).toBe(true);
    // Never cuts mid-word: the character before the ellipsis ends a whole word.
    expect(result).toBe("alpha beta…");
  });

  it("hard-cuts a single unbroken token that exceeds the limit", () => {
    const result = truncateAtWord("x".repeat(300), 20);

    expect(result.length).toBeLessThanOrEqual(20);
    expect(result.endsWith("…")).toBe(true);
  });

  it("never exceeds the maximum for a long realistic body", () => {
    const long = "A moderator took action on your item. Reason given: ".repeat(10);
    expect(truncateAtWord(long).length).toBeLessThanOrEqual(MAX_BODY_LENGTH);
  });
});
