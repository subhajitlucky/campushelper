import { describe, expect, it } from "vitest";
import { createItemApiSchema, createItemSchema, itemsQuerySchema, updateItemSchema } from "@/lib/schemas/item";
import {
  MAX_TAGS_PER_ITEM,
  normalizeTag,
  slugSchema,
  tagSchema,
  tagsSchema,
} from "@/lib/schemas/taxonomy";
import { bulkItemActionSchema, bulkUserActionSchema, auditQuerySchema } from "@/lib/schemas/admin";
import { markNotificationsReadSchema, notificationsQuerySchema } from "@/lib/schemas/notification";
import { createSavedSearchSchema, savedSearchFiltersSchema } from "@/lib/schemas/saved-search";
import { handoverCodeSchema, verifyHandoverSchema } from "@/lib/schemas/handover";
import { analyticsQuerySchema, resolveRange } from "@/lib/schemas/analytics";
import { matchActionSchema } from "@/lib/schemas/match";

const validItem = {
  title: "Black leather wallet",
  description: "Bifold wallet with a metro card inside",
  itemType: "LOST" as const,
  location: "Central Library",
};

describe("tagsSchema", () => {
  it("lowercases, trims, and de-duplicates", () => {
    expect(tagsSchema.parse(["  Leather ", "LEATHER", "black"])).toEqual([
      "leather",
      "black",
    ]);
  });

  it("turns spaces and underscores into single hyphens", () => {
    expect(tagsSchema.parse(["study material", "id_card"])).toEqual([
      "study-material",
      "id-card",
    ]);
  });

  it("accepts exactly the maximum number of tags", () => {
    const max = Array.from({ length: MAX_TAGS_PER_ITEM }, (_, i) => `tag-${i}`);
    expect(tagsSchema.parse(max)).toHaveLength(MAX_TAGS_PER_ITEM);
  });

  it("rejects more than the maximum number of tags", () => {
    const tooMany = Array.from({ length: MAX_TAGS_PER_ITEM + 1 }, (_, i) => `tag-${i}`);
    expect(tagsSchema.safeParse(tooMany).success).toBe(false);
  });

  it("rejects an oversized raw list even when it collapses to fewer unique tags", () => {
    // Twenty submissions that normalise to eight unique tags must still be
    // rejected: the user submitted twenty entries, not eight.
    const raw = Array.from({ length: 20 }, (_, i) => `tag-${i % 8}`);
    expect(tagsSchema.safeParse(raw).success).toBe(false);
  });

  it("rejects a tag longer than 24 characters", () => {
    expect(tagsSchema.safeParse(["x".repeat(25)]).success).toBe(false);
  });

  it("rejects a tag shorter than 2 characters", () => {
    expect(tagsSchema.safeParse(["x"]).success).toBe(false);
  });

  it("rejects illegal characters rather than silently stripping them", () => {
    // "he!!o" must not quietly become "heo": the user is told instead.
    expect(tagsSchema.safeParse(["he!!o"]).success).toBe(false);
    expect(tagSchema.safeParse("he!!o").success).toBe(false);
  });

  it("drops empty entries, which are a form artifact rather than intent", () => {
    expect(tagsSchema.parse(["keys", "", "   "])).toEqual(["keys"]);
  });
});

describe("slugSchema", () => {
  it("accepts seeded category and zone slugs", () => {
    expect(slugSchema.parse("academic-block-1")).toBe("academic-block-1");
    expect(slugSchema.parse("id-cards")).toBe("id-cards");
  });

  it("rejects bare and repeated hyphens", () => {
    expect(slugSchema.safeParse("-").success).toBe(false);
    expect(slugSchema.safeParse("--").success).toBe(false);
    expect(slugSchema.safeParse("foo--bar").success).toBe(false);
    expect(slugSchema.safeParse("-foo").success).toBe(false);
    expect(slugSchema.safeParse("foo-").success).toBe(false);
  });
});

describe("normalizeTag", () => {
  it("collapses repeated and edge hyphens", () => {
    expect(normalizeTag("--blue--bag--")).toBe("blue-bag");
    expect(normalizeTag("a   b")).toBe("a-b");
  });
});

describe("createItemSchema", () => {
  it("still accepts the pre-v2 payload", () => {
    const parsed = createItemSchema.parse(validItem);

    expect(parsed.title).toBe(validItem.title);
    expect(parsed.tags).toBeUndefined();
    expect(parsed.categorySlug).toBeUndefined();
  });

  it("does not leak the API-only duplicate flag into the form schema", () => {
    // The form value type must stay free of transport concerns.
    expect(createItemSchema.parse(validItem)).not.toHaveProperty("acknowledgeDuplicates");
  });

  it("defaults acknowledgeDuplicates to false on the API schema", () => {
    expect(createItemApiSchema.parse(validItem).acknowledgeDuplicates).toBe(false);
    expect(
      createItemApiSchema.parse({ ...validItem, acknowledgeDuplicates: true })
        .acknowledgeDuplicates
    ).toBe(true);
  });

  it("accepts taxonomy fields", () => {
    const parsed = createItemSchema.parse({
      ...validItem,
      categorySlug: "accessories",
      zoneSlug: "central-library",
      tags: ["Leather", "black"],
    });

    expect(parsed.categorySlug).toBe("accessories");
    expect(parsed.zoneSlug).toBe("central-library");
    expect(parsed.tags).toEqual(["leather", "black"]);
  });

  it("rejects an out-of-range latitude", () => {
    expect(createItemSchema.safeParse({ ...validItem, latitude: 91 }).success).toBe(false);
    expect(createItemSchema.safeParse({ ...validItem, longitude: -181 }).success).toBe(false);
  });

  it("rejects a malformed category slug", () => {
    expect(createItemSchema.safeParse({ ...validItem, categorySlug: "Not A Slug" }).success).toBe(
      false
    );
  });
});

describe("updateItemSchema", () => {
  it("allows a partial payload", () => {
    expect(updateItemSchema.parse({ title: "New title" }).title).toBe("New title");
  });

  it("still accepts the existing status values", () => {
    expect(updateItemSchema.parse({ status: "RESOLVED" }).status).toBe("RESOLVED");
  });
});

describe("itemsQuerySchema", () => {
  it("parses taxonomy filters", () => {
    const parsed = itemsQuerySchema.parse({ category: "books", zone: "central-library" });

    expect(parsed.category).toBe("books");
    expect(parsed.zone).toBe("central-library");
  });

  it("splits a comma-separated tag filter", () => {
    expect(itemsQuerySchema.parse({ tags: "leather, black" }).tags).toEqual([
      "leather",
      "black",
    ]);
  });

  it("leaves tags undefined when the filter is absent", () => {
    expect(itemsQuerySchema.parse({}).tags).toBeUndefined();
  });
});

describe("bulkItemActionSchema", () => {
  it("accepts a valid bulk action", () => {
    const parsed = bulkItemActionSchema.parse({
      ids: ["a", "b"],
      action: "FLAG",
      reason: "Duplicate posting",
    });
    expect(parsed.ids).toHaveLength(2);
  });

  it("rejects an empty id list", () => {
    expect(bulkItemActionSchema.safeParse({ ids: [], action: "FLAG", reason: "x y z" }).success).toBe(
      false
    );
  });

  it("rejects more than 50 ids", () => {
    const ids = Array.from({ length: 51 }, (_, i) => `id-${i}`);
    expect(bulkItemActionSchema.safeParse({ ids, action: "FLAG", reason: "spam" }).success).toBe(
      false
    );
  });

  it("requires a reason when flagging or removing", () => {
    expect(bulkItemActionSchema.safeParse({ ids: ["a"], action: "REMOVE" }).success).toBe(false);
    expect(bulkItemActionSchema.safeParse({ ids: ["a"], action: "FLAG" }).success).toBe(false);
  });

  it("does not require a reason to restore", () => {
    expect(bulkItemActionSchema.safeParse({ ids: ["a"], action: "RESTORE" }).success).toBe(true);
  });
});

describe("bulkUserActionSchema", () => {
  it("requires a reason when granting or revoking verification", () => {
    // Granting a trust badge should always be justified and audited.
    expect(
      bulkUserActionSchema.safeParse({ ids: ["a"], action: "VERIFY_STUDENT" }).success
    ).toBe(false);
    expect(
      bulkUserActionSchema.safeParse({ ids: ["a"], action: "UNVERIFY_STUDENT" }).success
    ).toBe(false);
    expect(
      bulkUserActionSchema.safeParse({
        ids: ["a"],
        action: "VERIFY_STUDENT",
        reason: "Checked student ID at the desk",
      }).success
    ).toBe(true);
  });

  it("accepts reactivation without a reason", () => {
    expect(bulkUserActionSchema.safeParse({ ids: ["a"], action: "REACTIVATE" }).success).toBe(true);
  });

  it("requires a reason when deactivating", () => {
    expect(bulkUserActionSchema.safeParse({ ids: ["a"], action: "DEACTIVATE" }).success).toBe(false);
    expect(
      bulkUserActionSchema.safeParse({ ids: ["a"], action: "DEACTIVATE", reason: "Abuse" }).success
    ).toBe(true);
  });

  it("rejects an unknown action", () => {
    expect(bulkUserActionSchema.safeParse({ ids: ["a"], action: "PROMOTE" }).success).toBe(false);
  });
});

describe("auditQuerySchema", () => {
  it("defaults pagination", () => {
    const parsed = auditQuerySchema.parse({});
    expect(parsed.page).toBe(1);
    expect(parsed.limit).toBe(50);
  });

  it("accepts a known action", () => {
    expect(auditQuerySchema.parse({ action: "ITEM_REMOVE" }).action).toBe("ITEM_REMOVE");
  });

  it("rejects an unknown action", () => {
    expect(auditQuerySchema.safeParse({ action: "NUKE" }).success).toBe(false);
  });

  it("rejects a reversed date range", () => {
    expect(
      auditQuerySchema.safeParse({ from: "2026-10-20", to: "2026-10-01" }).success
    ).toBe(false);
  });

  it("accepts an equal or forward date range", () => {
    expect(auditQuerySchema.safeParse({ from: "2026-10-01", to: "2026-10-20" }).success).toBe(true);
    expect(auditQuerySchema.safeParse({ from: "2026-10-01", to: "2026-10-01" }).success).toBe(true);
  });
});

describe("markNotificationsReadSchema", () => {
  it("accepts mark-all", () => {
    expect(markNotificationsReadSchema.parse({ all: true })).toEqual({ all: true });
  });

  it("accepts an id list", () => {
    expect(markNotificationsReadSchema.parse({ ids: ["n1"] })).toEqual({ ids: ["n1"] });
  });

  it("rejects an empty id list", () => {
    expect(markNotificationsReadSchema.safeParse({ ids: [] }).success).toBe(false);
  });

  it("rejects an empty body", () => {
    expect(markNotificationsReadSchema.safeParse({}).success).toBe(false);
  });

  it("rejects all:false, which would be a no-op", () => {
    expect(markNotificationsReadSchema.safeParse({ all: false }).success).toBe(false);
  });

  it("caps a single mark-read request", () => {
    const ids = Array.from({ length: 201 }, (_, i) => `n${i}`);
    expect(markNotificationsReadSchema.safeParse({ ids }).success).toBe(false);
  });
});

describe("notificationsQuerySchema", () => {
  it("treats unread=true as a filter and anything else as false", () => {
    expect(notificationsQuerySchema.parse({ unread: "true" }).unread).toBe(true);
    expect(notificationsQuerySchema.parse({ unread: "false" }).unread).toBe(false);
    expect(notificationsQuerySchema.parse({}).unread).toBe(false);
  });

  it("rejects a limit above 100", () => {
    expect(notificationsQuerySchema.safeParse({ limit: "500" }).success).toBe(false);
  });
});

describe("savedSearchFiltersSchema", () => {
  it("accepts a realistic filter set", () => {
    const parsed = savedSearchFiltersSchema.parse({
      search: "blue backpack",
      itemType: "LOST",
      category: "bags",
      tags: ["blue"],
    });
    expect(parsed.search).toBe("blue backpack");
  });

  it("rejects unknown keys rather than silently ignoring them", () => {
    expect(savedSearchFiltersSchema.safeParse({ search: "wallet", colour: "red" }).success).toBe(
      false
    );
  });

  it("rejects a reversed date range", () => {
    expect(
      savedSearchFiltersSchema.safeParse({ from: "2026-10-20", to: "2026-10-01" }).success
    ).toBe(false);
  });

  it("rejects a too-short search term", () => {
    expect(savedSearchFiltersSchema.safeParse({ search: "a" }).success).toBe(false);
  });
});

describe("createSavedSearchSchema", () => {
  it("requires a name", () => {
    expect(createSavedSearchSchema.safeParse({ name: "  ", filters: {} }).success).toBe(false);
  });

  it("accepts an empty filter set", () => {
    expect(createSavedSearchSchema.parse({ name: "Everything", filters: {} }).name).toBe(
      "Everything"
    );
  });
});

describe("handoverCodeSchema", () => {
  it("accepts exactly six digits", () => {
    expect(handoverCodeSchema.parse("123456")).toBe("123456");
    expect(handoverCodeSchema.parse(" 000000 ")).toBe("000000");
  });

  it("rejects the wrong number of digits", () => {
    expect(handoverCodeSchema.safeParse("12345").success).toBe(false);
    expect(handoverCodeSchema.safeParse("1234567").success).toBe(false);
    expect(handoverCodeSchema.safeParse("").success).toBe(false);
  });

  it("rejects non-digits", () => {
    expect(handoverCodeSchema.safeParse("12a456").success).toBe(false);
    expect(handoverCodeSchema.safeParse("12 456").success).toBe(false);
    expect(handoverCodeSchema.safeParse("-12345").success).toBe(false);
  });

  it("never coerces a numeric body value", () => {
    expect(verifyHandoverSchema.safeParse({ code: 123456 }).success).toBe(false);
  });
});

describe("analyticsQuerySchema", () => {
  it("accepts every supported range", () => {
    for (const range of ["7d", "30d", "90d", "all"] as const) {
      expect(analyticsQuerySchema.parse({ range }).range).toBe(range);
    }
  });

  it("defaults to 30 days", () => {
    expect(analyticsQuerySchema.parse({}).range).toBe("30d");
  });

  it("rejects an unsupported range", () => {
    expect(analyticsQuerySchema.safeParse({ range: "1y" }).success).toBe(false);
  });
});

describe("resolveRange", () => {
  const now = new Date("2026-10-18T12:00:00.000Z");

  it("has no lower bound for 'all'", () => {
    expect(resolveRange("all", now).start).toBeNull();
  });

  it("subtracts the window length in days", () => {
    const { start, end } = resolveRange("7d", now);
    expect(end).toEqual(now);
    expect(start?.toISOString()).toBe("2026-10-11T12:00:00.000Z");
  });
});

describe("matchActionSchema", () => {
  it("accepts only dismiss and confirm", () => {
    expect(matchActionSchema.parse({ action: "dismiss" }).action).toBe("dismiss");
    expect(matchActionSchema.parse({ action: "confirm" }).action).toBe("confirm");
    expect(matchActionSchema.safeParse({ action: "delete" }).success).toBe(false);
  });
});
