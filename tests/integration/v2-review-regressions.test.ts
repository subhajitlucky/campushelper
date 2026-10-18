/**
 * Regression tests for the defects found in the v2 adversarial review
 * (docs/audit/2026-10-18-v2-adversarial-review.md).
 *
 * Each test names the finding it guards. Only the session and CSRF checks are
 * stubbed, so these exercise the real routes and Prisma queries.
 *
 * Requires DATABASE_URL; skips entirely without it, so CI (no database) is
 * unaffected.
 */
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const hasDatabase = Boolean(process.env.DATABASE_URL);
const ADMIN = 'u_reg_admin';
const POSTER = 'u_reg_poster';
const OTHER = 'u_reg_other';

/* eslint-disable @typescript-eslint/no-explicit-any */
let prisma: any;
let itemsRoute: any;
let claimsIdRoute: any;
let bulkItemsRoute: any;
let notifications: any;
let matchSchema: any;

vi.mock('@/lib/auth', () => ({
  getSession: vi.fn(async () => ({
    user: { id: 'u_reg_admin', email: 'reg@x.test', name: 'Reg', role: 'ADMIN' },
    expires: new Date(Date.now() + 3600_000).toISOString(),
  })),
}));

vi.mock('@/lib/csrf-middleware', () => ({ checkCSRF: vi.fn(async () => null) }));

type Init = ConstructorParameters<typeof NextRequest>[1];
const req = (url: string, init?: Init) => new NextRequest(url, init);
const post = (body: unknown): Init => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

describe.skipIf(!hasDatabase)('v2 review regressions', () => {
  beforeAll(async () => {
    prisma = (await import('@/lib/prisma')).prisma;
    itemsRoute = await import('@/app/api/items/route');
    claimsIdRoute = await import('@/app/api/claims/[id]/route');
    bulkItemsRoute = await import('@/app/api/admin/items/bulk/route');
    notifications = await import('@/lib/notifications');
    matchSchema = await import('@/lib/schemas/notification');

    await prisma.notification.deleteMany({});
    await prisma.auditLog.deleteMany({});
    await prisma.reputationEvent.deleteMany({});
    await prisma.claim.deleteMany({});
    await prisma.matchSuggestion.deleteMany({});
    await prisma.item.deleteMany({});
    await prisma.user.deleteMany({});

    await prisma.user.createMany({
      data: [
        { id: ADMIN, email: 'reg@x.test', name: 'Reg', role: 'ADMIN' },
        { id: POSTER, email: 'poster@x.test', name: 'Poster' },
        { id: OTHER, email: 'other@x.test', name: 'Other' },
      ],
    });
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  /** C0: an item could be "returned" twice. */
  it('C0: refuses a second active claim on an already-returned item', async () => {
    const now = new Date();
    await prisma.item.create({
      data: {
        id: 'it_c0', title: 'Phone', description: 'A phone found near the canteen benches',
        itemType: 'FOUND', status: 'CLAIMED', location: 'Canteen', postedById: POSTER,
        createdAt: now, updatedAt: now,
      },
    });

    await prisma.claim.create({
      data: { id: 'cl_c0_a', claimType: 'OWN_IT', status: 'COMPLETED', userId: OTHER, itemId: 'it_c0' },
    });

    // The old partial index was `WHERE status = 'APPROVED'`, so COMPLETED left
    // the indexed set and this insert succeeded.
    await expect(
      prisma.claim.create({
        data: { id: 'cl_c0_b', claimType: 'OWN_IT', status: 'APPROVED', userId: ADMIN, itemId: 'it_c0' },
      })
    ).rejects.toThrow();
  });

  /** C1: the items list leaked moderation notes and coordinates. */
  it('C1: the items list does not expose moderation fields or coordinates', async () => {
    const now = new Date();
    await prisma.item.create({
      data: {
        id: 'it_c1', title: 'Wallet', description: 'A wallet with several cards inside it',
        itemType: 'LOST', status: 'LOST', location: 'Library', postedById: POSTER,
        latitude: 20.123456, longitude: 85.654321,
        moderationStatus: 'FLAGGED', moderationReason: 'suspected scam',
        moderatedById: ADMIN, moderatedAt: now,
        createdAt: now, updatedAt: now,
      },
    });

    const res = await itemsRoute.GET(req('http://localhost/api/items?limit=50'));
    const body = await res.json();
    const item = body.items.find((i: any) => i.id === 'it_c1');

    expect(item).toBeDefined();
    for (const field of [
      'moderationReason', 'moderatedById', 'moderatedAt', 'moderationStatus',
      'latitude', 'longitude', 'deletedById', 'deletionReason', 'deletedAt',
    ]) {
      expect(item, `${field} must not be exposed`).not.toHaveProperty(field);
    }
    // The public fields the UI relies on are still present.
    expect(item.title).toBe('Wallet');
    expect(item.postedBy.reputation).toBe(0);
  });

  /** C2: pagination read a non-existent top-level `total`. */
  it('C2: the items list returns a pagination envelope with a numeric total', async () => {
    const res = await itemsRoute.GET(req('http://localhost/api/items?limit=1&page=1'));
    const body = await res.json();

    expect(typeof body.pagination.total).toBe('number');
    expect(typeof body.pagination.totalPages).toBe('number');
    expect(body.pagination.totalPages).toBeGreaterThan(0);
    expect(body).not.toHaveProperty('total');
  });

  /** M2: dedupe suppressed a different actor's notification. */
  it('M2: a second, different actor still produces a notification', async () => {
    await prisma.notification.deleteMany({});

    await notifications.notify({
      userId: POSTER, type: 'CLAIM_CREATED', actorId: OTHER,
      actorName: 'Other', itemId: 'it_c1', itemTitle: 'Wallet',
    });
    await notifications.notify({
      userId: POSTER, type: 'CLAIM_CREATED', actorId: ADMIN,
      actorName: 'Reg', itemId: 'it_c1', itemTitle: 'Wallet',
    });

    expect(await prisma.notification.count({ where: { userId: POSTER } })).toBe(2);

    // The same actor repeating is still collapsed.
    await notifications.notify({
      userId: POSTER, type: 'CLAIM_CREATED', actorId: OTHER,
      actorName: 'Other', itemId: 'it_c1', itemTitle: 'Wallet',
    });
    expect(await prisma.notification.count({ where: { userId: POSTER } })).toBe(2);
  });

  /** M4: approval marked the item returned before any handover was verified. */
  it('M4: approving a claim leaves the item CLAIMED, not RESOLVED', async () => {
    const now = new Date();
    await prisma.item.create({
      data: {
        id: 'it_m4', title: 'Found phone', description: 'A phone found near the canteen benches',
        itemType: 'FOUND', status: 'FOUND', location: 'Canteen', postedById: POSTER,
        createdAt: now, updatedAt: now,
      },
    });

    const claim = await prisma.claim.create({
      data: { id: 'cl_m4', claimType: 'OWN_IT', status: 'PENDING', userId: OTHER, itemId: 'it_m4' },
    });

    const res = await claimsIdRoute.PUT(
      req(`http://localhost/api/claims/${claim.id}`, post({ status: 'APPROVED' })),
      { params: Promise.resolve({ id: claim.id }) }
    );
    expect(res.status).toBe(200);

    const item = await prisma.item.findUnique({ where: { id: 'it_m4' } });
    expect(item.status).toBe('CLAIMED');
    expect(item.resolvedAt).toBeNull();

    const after = await prisma.claim.findUnique({ where: { id: claim.id } });
    expect(after.handoverCode).not.toBeNull();
    expect(after.handoverVerifiedAt).toBeNull();
  });

  /** M9: bulk RESTORE hardcoded status LOST for FOUND items. */
  it('M9: restoring a FOUND item keeps status FOUND', async () => {
    const now = new Date();
    await prisma.item.create({
      data: {
        id: 'it_m9', title: 'Found umbrella', description: 'A blue folding umbrella left in the lab',
        itemType: 'FOUND', status: 'FOUND', location: 'Lab 2', postedById: POSTER,
        createdAt: now, updatedAt: now,
      },
    });

    const removed = await bulkItemsRoute.POST(
      req('http://localhost/api/admin/items/bulk', post({ ids: ['it_m9'], action: 'REMOVE', reason: 'spam test' }))
    );
    expect(removed.status).toBe(200);
    expect((await prisma.item.findUnique({ where: { id: 'it_m9' } })).status).toBe('DELETED');

    const restored = await bulkItemsRoute.POST(
      req('http://localhost/api/admin/items/bulk', post({ ids: ['it_m9'], action: 'RESTORE' }))
    );
    expect(restored.status).toBe(200);

    const item = await prisma.item.findUnique({ where: { id: 'it_m9' } });
    expect(item.itemType).toBe('FOUND');
    expect(item.status).toBe('FOUND');
  });

  /** M12: the "exclusive" union silently marked the whole inbox read. */
  it('M12: mark-read rejects a body mixing `all` with `ids`', () => {
    expect(matchSchema.markNotificationsReadSchema.safeParse({ all: true, ids: ['n1'] }).success).toBe(false);
    expect(matchSchema.markNotificationsReadSchema.safeParse({ all: true, ids: 'nope' }).success).toBe(false);
    expect(matchSchema.markNotificationsReadSchema.safeParse({}).success).toBe(false);
    expect(matchSchema.markNotificationsReadSchema.safeParse({ all: true }).success).toBe(true);
    expect(matchSchema.markNotificationsReadSchema.safeParse({ ids: ['n1'] }).success).toBe(true);
  });

  /** M1: the duplicate guard could never fire without a category. */
  it('M1: a byte-identical repost is reported as a duplicate', async () => {
    await prisma.item.deleteMany({ where: { title: 'Regression wallet' } });

    const payload = {
      title: 'Regression wallet',
      description: 'Bifold wallet with a metro card and a library card inside',
      itemType: 'LOST',
      location: 'Central Library',
      postedById: POSTER,
    };

    const first = await itemsRoute.POST(
      req('http://localhost/api/items', post({ ...payload, postedById: undefined }))
    );
    expect(first.status).toBe(201);

    const second = await itemsRoute.POST(
      req('http://localhost/api/items', post({ ...payload, postedById: undefined }))
    );
    const body = await second.json();

    expect(second.status).toBe(409);
    expect(body.code).toBe('DUPLICATE_SUSPECTED');
    expect(body.details.candidates.length).toBeGreaterThan(0);

    const acknowledged = await itemsRoute.POST(
      req('http://localhost/api/items', post({ ...payload, postedById: undefined, acknowledgeDuplicates: true }))
    );
    expect(acknowledged.status).toBe(201);
  });
});
