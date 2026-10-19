import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `notifyMany` is the batched sibling of `notify`, added because the per-call
 * `findFirst` + `create` made the match path 902 SELECTs and 501 INSERTs on
 * `Notification` for a single item creation. It sits on the item-create and
 * match paths, so its two rules have to hold exactly as `notify`'s did:
 * never notify a user about their own action, and collapse an identical unread
 * notification inside the dedupe window.
 */

const findMany = vi.fn();
const createMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    notification: {
      get findMany() {
        return findMany;
      },
      get createMany() {
        return createMany;
      },
    },
  },
}));

const { notifyMany, DEDUPE_WINDOW_MINUTES } = await import("@/lib/notifications");

/** A minimal, valid input; overrides are applied per test. */
function input(overrides: Record<string, unknown> = {}) {
  return {
    userId: "user_1",
    type: "MATCH_FOUND" as const,
    itemId: "item_1",
    itemTitle: "Blue backpack",
    ...overrides,
  };
}

/** Rows as `findMany` would return them for the dedupe probe. */
function existingRow(overrides: Record<string, unknown> = {}) {
  return {
    userId: "user_1",
    type: "MATCH_FOUND",
    itemId: "item_1",
    actorId: null,
    ...overrides,
  };
}

describe("notifyMany", () => {
  beforeEach(() => {
    findMany.mockReset();
    createMany.mockReset();
    findMany.mockResolvedValue([]);
    createMany.mockImplementation(({ data }: { data: unknown[] }) => ({
      count: data.length,
    }));
  });

  it("writes the whole batch with one dedupe query and one insert", async () => {
    const created = await notifyMany([
      input({ userId: "user_1", itemId: "item_1" }),
      input({ userId: "user_2", itemId: "item_2" }),
      input({ userId: "user_3", itemId: "item_3" }),
    ]);

    expect(created).toBe(3);
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(createMany).toHaveBeenCalledTimes(1);
    expect(createMany.mock.calls[0][0].data).toHaveLength(3);
  });

  it("returns zero without touching the database for an empty batch", async () => {
    expect(await notifyMany([])).toBe(0);
    expect(findMany).not.toHaveBeenCalled();
    expect(createMany).not.toHaveBeenCalled();
  });

  it("never notifies a user about their own action", async () => {
    const created = await notifyMany([
      input({ userId: "user_1", actorId: "user_1" }),
      input({ userId: "user_2", actorId: "user_1", itemId: "item_2" }),
    ]);

    expect(created).toBe(1);
    const data = createMany.mock.calls[0][0].data;
    expect(data).toHaveLength(1);
    expect(data[0].userId).toBe("user_2");
  });

  it("does not query at all when every input is a self-notification", async () => {
    expect(await notifyMany([input({ actorId: "user_1" })])).toBe(0);
    expect(findMany).not.toHaveBeenCalled();
    expect(createMany).not.toHaveBeenCalled();
  });

  it("suppresses a repeat that is already unread inside the window", async () => {
    findMany.mockResolvedValue([existingRow()]);

    const created = await notifyMany([
      input({ userId: "user_1", itemId: "item_1" }),
      input({ userId: "user_2", itemId: "item_2" }),
    ]);

    expect(created).toBe(1);
    const data = createMany.mock.calls[0][0].data;
    expect(data.map((row: { userId: string }) => row.userId)).toEqual(["user_2"]);
  });

  it("treats the actor as part of the identity of the event", async () => {
    // A second person claiming the same item inside the window is a different
    // event and must not be collapsed — the poster would never learn about them.
    findMany.mockResolvedValue([existingRow({ actorId: "actor_a" })]);

    const created = await notifyMany([
      input({ actorId: "actor_a" }),
      input({ actorId: "actor_b" }),
    ]);

    expect(created).toBe(1);
    expect(createMany.mock.calls[0][0].data[0].actorId).toBe("actor_b");
  });

  it("collapses duplicate inputs inside one batch", async () => {
    // The per-call `notify()` could not do this: it only ever saw duplicates
    // that were already committed, so a batch containing the same event twice
    // wrote it twice.
    const created = await notifyMany([
      input({ userId: "user_1", itemId: "item_1" }),
      input({ userId: "user_1", itemId: "item_1" }),
      input({ userId: "user_1", itemId: "item_1" }),
    ]);

    expect(created).toBe(1);
    expect(createMany.mock.calls[0][0].data).toHaveLength(1);
  });

  it("separates a notification that has no item from ones that do", async () => {
    // `itemId` is nullable and null is a meaningful value here, so the dedupe
    // probe has to reach itemless rows as well as the id list.
    await notifyMany([
      input({ userId: "user_1", itemId: null }),
      input({ userId: "user_2", itemId: "item_2" }),
    ]);

    const where = findMany.mock.calls[0][0].where;
    expect(where.OR).toEqual(
      expect.arrayContaining([{ itemId: null }, { itemId: { in: ["item_2"] } }])
    );
  });

  it("scopes the dedupe probe to unread rows inside the window", async () => {
    const before = Date.now();
    await notifyMany([input()]);

    const where = findMany.mock.calls[0][0].where;
    expect(where.readAt).toBeNull();
    expect(where.createdAt.gte).toBeInstanceOf(Date);

    const windowMs = DEDUPE_WINDOW_MINUTES * 60 * 1000;
    const since = where.createdAt.gte.getTime();
    expect(since).toBeGreaterThanOrEqual(before - windowMs - 1000);
    expect(since).toBeLessThanOrEqual(Date.now() - windowMs + 1000);
  });

  it("formats title and body for every row it writes", async () => {
    await notifyMany([input({ userId: "user_1", itemTitle: "Blue backpack" })]);

    const row = createMany.mock.calls[0][0].data[0];
    expect(typeof row.title).toBe("string");
    expect(row.title.length).toBeGreaterThan(0);
    expect(typeof row.body).toBe("string");
    expect(row.body.length).toBeGreaterThan(0);
  });

  it("returns zero and does not throw when the database fails", async () => {
    // A notification failure must never fail the request that triggered it.
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    findMany.mockRejectedValue(new Error("connection terminated"));

    await expect(notifyMany([input()])).resolves.toBe(0);
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("does not insert when every input is deduped", async () => {
    findMany.mockResolvedValue([existingRow()]);

    expect(await notifyMany([input()])).toBe(0);
    expect(createMany).not.toHaveBeenCalled();
  });
});
