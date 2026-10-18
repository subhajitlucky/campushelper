import { describe, expect, it } from "vitest";
import * as lucide from "lucide-react";
import {
  formatRelativeTime,
  isUnread,
  notificationIconName,
} from "@/lib/notification-display";

/** All notification types the API can send, per the inbox contract. */
const ALL_TYPES = [
  "CLAIM_CREATED",
  "CLAIM_STATUS_CHANGED",
  "COMMENT_ON_ITEM",
  "MATCH_FOUND",
  "SAVED_SEARCH_HIT",
  "HANDOVER_CODE_ISSUED",
  "HANDOVER_CODE_INVALIDATED",
  "HANDOVER_VERIFIED",
  "ITEM_RESOLVED",
  "MODERATION_ACTION",
];

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// Noon UTC keeps the absolute-date assertion stable in any timezone.
const NOW = new Date("2026-10-19T12:00:00.000Z");

const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();

describe("formatRelativeTime", () => {
  it("says 'just now' for anything under a minute", () => {
    expect(formatRelativeTime(ago(0), NOW)).toBe("just now");
    expect(formatRelativeTime(ago(59 * SECOND), NOW)).toBe("just now");
  });

  it("switches to minutes at exactly 60 seconds", () => {
    expect(formatRelativeTime(ago(60 * SECOND), NOW)).toBe("1 minute ago");
  });

  it("counts whole minutes up to 59", () => {
    expect(formatRelativeTime(ago(59 * MINUTE), NOW)).toBe("59 minutes ago");
    expect(formatRelativeTime(ago(2 * MINUTE), NOW)).toBe("2 minutes ago");
  });

  it("switches to hours at exactly 60 minutes", () => {
    expect(formatRelativeTime(ago(60 * MINUTE), NOW)).toBe("1 hour ago");
  });

  it("counts whole hours up to 23", () => {
    expect(formatRelativeTime(ago(23 * HOUR), NOW)).toBe("23 hours ago");
  });

  it("says 'yesterday' from 24 hours until 48 hours", () => {
    expect(formatRelativeTime(ago(24 * HOUR), NOW)).toBe("yesterday");
    expect(formatRelativeTime(ago(47 * HOUR), NOW)).toBe("yesterday");
  });

  it("counts days up to 6", () => {
    expect(formatRelativeTime(ago(2 * DAY), NOW)).toBe("2 days ago");
    expect(formatRelativeTime(ago(6 * DAY + 12 * HOUR), NOW)).toBe("6 days ago");
  });

  it("uses an absolute date at 7 days", () => {
    expect(formatRelativeTime(ago(7 * DAY), NOW)).toBe("12 Oct 2026");
    expect(formatRelativeTime(ago(30 * DAY), NOW)).toBe("19 Sep 2026");
  });

  it("treats a future timestamp as 'just now'", () => {
    expect(formatRelativeTime(ago(-1 * MINUTE), NOW)).toBe("just now");
    expect(formatRelativeTime(ago(-30 * DAY), NOW)).toBe("just now");
  });

  it("returns an empty string for an unparseable timestamp", () => {
    expect(formatRelativeTime("not-a-date", NOW)).toBe("");
    expect(formatRelativeTime("", NOW)).toBe("");
  });
});

describe("isUnread", () => {
  it("treats a null readAt as unread", () => {
    expect(isUnread(null)).toBe(true);
  });

  it("treats a read timestamp as read", () => {
    expect(isUnread("2026-10-12T12:00:00.000Z")).toBe(false);
  });

  it("treats undefined like null", () => {
    expect(isUnread(undefined)).toBe(true);
  });
});

describe("notificationIconName", () => {
  it("covers every type in the contract instead of falling back to the default", () => {
    for (const type of ALL_TYPES) {
      expect(notificationIconName(type), `icon for ${type}`).not.toBe("Bell");
    }
  });

  it("only names icons that lucide-react actually ships", () => {
    for (const type of ALL_TYPES) {
      const name = notificationIconName(type) as keyof typeof lucide;

      expect(lucide[name], `${name} for ${type}`).toBeDefined();
    }
  });

  it("falls back to a bell for an unknown type", () => {
    expect(notificationIconName("SOMETHING_NEW")).toBe("Bell");
    expect(notificationIconName("")).toBe("Bell");
  });
});
