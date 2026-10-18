/**
 * Integration coverage for the admin routes, against a real PostgreSQL database.
 *
 * Only the session and CSRF checks are stubbed, so the Prisma queries, CSV
 * serialisation, audit writes, and response shapes exercised here are the real
 * code paths — none of which the pure unit tests can reach.
 *
 * Requires DATABASE_URL. Without it the suite skips entirely, because CI has no
 * database; run it locally against a disposable database to check these routes.
 */
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const hasDatabase = Boolean(process.env.DATABASE_URL);

/* eslint-disable @typescript-eslint/no-explicit-any */
let prisma: any;
let analyticsRoute: any;
let auditRoute: any;
let exportRoute: any;
let bulkItemsRoute: any;

const ADMIN_ID = 'u_admin';
const LOST_ID = 'u_lost_it';
const FOUND_ID = 'u_found_it';

vi.mock('@/lib/auth', () => ({
  getSession: vi.fn(async () => ({
    user: { id: ADMIN_ID, email: 'admin@campus.test', name: 'Admin', role: 'ADMIN' },
    expires: new Date(Date.now() + 3600_000).toISOString(),
  })),
}));

vi.mock('@/lib/csrf-middleware', () => ({
  checkCSRF: vi.fn(async () => null),
}));

// The routes read request.nextUrl.searchParams, so the harness must supply a
// real NextRequest rather than a plain Request. NextRequest also expects Next's
// own RequestInit type, which is narrower than the DOM lib's (its `signal`
// cannot be null).
type NextRequestInit = ConstructorParameters<typeof NextRequest>[1];

function req(url: string, init?: NextRequestInit) {
  return new NextRequest(url, init);
}

beforeAll(async () => {
  if (!hasDatabase) return;

  // Imported lazily so that a run without DATABASE_URL never constructs a
  // Prisma client at all.
  prisma = (await import('@/lib/prisma')).prisma;
  analyticsRoute = await import('@/app/api/admin/analytics/route');
  auditRoute = await import('@/app/api/admin/audit/route');
  exportRoute = await import('@/app/api/admin/export/[report]/route');
  bulkItemsRoute = await import('@/app/api/admin/items/bulk/route');

  // Make the run idempotent: earlier runs of this file leave audit and
  // notification rows behind, and the assertions count them.
  await prisma.auditLog.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.claim.deleteMany({});
  await prisma.item.deleteMany({});
  await prisma.user.deleteMany({});

  await prisma.user.createMany({
    data: [
      { id: ADMIN_ID, email: 'admin@campus.test', name: 'Admin', role: 'ADMIN' },
      { id: LOST_ID, email: 'lost@campus.test', name: 'Asha' },
      { id: FOUND_ID, email: 'found@campus.test', name: 'Ravi' },
    ],
    skipDuplicates: true,
  });

  const base = {
    description: 'A description long enough to pass validation checks.',
    location: 'Central Library',
    updatedAt: new Date(),
  };

  await prisma.item.createMany({
    data: [
      { id: 'it_lost_1', title: 'Wallet A', itemType: 'LOST', status: 'LOST', postedById: LOST_ID, categoryId: 'cat_accessories', zoneId: 'zone_central-library', tags: ['leather'], createdAt: new Date(Date.now() - 3 * 86400000), ...base },
      { id: 'it_found_1', title: 'Wallet B', itemType: 'FOUND', status: 'RESOLVED', postedById: FOUND_ID, categoryId: 'cat_accessories', zoneId: 'zone_central-library', tags: ['leather'], createdAt: new Date(Date.now() - 2 * 86400000), resolvedAt: new Date(Date.now() - 86400000), ...base },
      { id: 'it_lost_2', title: 'Umbrella', itemType: 'LOST', status: 'LOST', postedById: LOST_ID, categoryId: 'cat_other', zoneId: 'zone_canteen', tags: [], createdAt: new Date(), ...base },
    ],
    skipDuplicates: true,
  });

  await prisma.claim.createMany({
    data: [
      { id: 'cl_1', claimType: 'OWN_IT', status: 'COMPLETED', userId: LOST_ID, itemId: 'it_found_1', completedAt: new Date(), resolvedAt: new Date() },
      { id: 'cl_2', claimType: 'OWN_IT', status: 'APPROVED', userId: LOST_ID, itemId: 'it_lost_2', resolvedAt: new Date() },
      { id: 'cl_3', claimType: 'FOUND_IT', status: 'PENDING', userId: FOUND_ID, itemId: 'it_lost_1' },
    ],
    skipDuplicates: true,
  });
});

afterAll(async () => {
  await prisma?.$disconnect();
});

describe.skipIf(!hasDatabase)('GET /api/admin/analytics', () => {
  it('returns the documented shape with real aggregates', async () => {
    const response = await analyticsRoute.GET(req('http://localhost/api/admin/analytics?range=30d'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.range).toBe('30d');
    expect(body.totals.posted).toBe(3);
    expect(body.totals.resolved).toBe(1);
    expect(body.totals.resolutionRate).toBeCloseTo(1 / 3, 3);
    // One resolved item, returned 1 day after posting -> 24 hours. The
    // formatter shows hours below 48, so the label is "24.0 hours".
    expect(body.medianTimeToReturnHours).toBe(24);
    expect(body.medianTimeToReturnLabel).toBe('24.0 hours');
    expect(body.dailySeries.length).toBeGreaterThanOrEqual(30);
    expect(body.topZones[0]).toMatchObject({ name: 'Central Library', count: 2 });
    expect(body.topCategories[0]).toMatchObject({ name: 'Accessories', count: 2 });
    expect(body.claimsFunnel.createdToApproved).toBeCloseTo(66.7, 1);
    expect(body.claimsFunnel.approvedToCompleted).toBe(50);
  });

  it('rejects an unsupported range', async () => {
    const response = await analyticsRoute.GET(req('http://localhost/api/admin/analytics?range=1y'));
    expect(response.status).toBe(400);
  });

  it('resolves the all-time range without a lower bound', async () => {
    const response = await analyticsRoute.GET(req('http://localhost/api/admin/analytics?range=all'));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.dailySeries.length).toBeGreaterThan(0);
  });
});

describe.skipIf(!hasDatabase)('GET /api/admin/export/[report]', () => {
  it('streams items as a CSV attachment and audits the download', async () => {
    const response = await exportRoute.GET(
      req('http://localhost/api/admin/export/items'),
      { params: Promise.resolve({ report: 'items' }) }
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('text/csv');
    expect(response.headers.get('Content-Disposition')).toContain('attachment');
    expect(response.headers.get('Content-Disposition')).toContain('campushelper-items-');

    const csv = await response.text();
    const lines = csv.split('\r\n');
    expect(lines[0]).toContain('Title');
    expect(csv).toContain('Wallet A');
    expect(csv).toContain('Accessories');
    // Header + 3 items.
    expect(lines).toHaveLength(4);

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'EXPORT_DOWNLOAD' },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit).not.toBeNull();
    expect(audit?.actorEmail).toBe('admin@campus.test');
    expect(audit?.targetId).toBe('items');
  });

  it('exports claims with the claim columns', async () => {
    const response = await exportRoute.GET(
      req('http://localhost/api/admin/export/claims'),
      { params: Promise.resolve({ report: 'claims' }) }
    );
    const csv = await response.text();

    expect(response.status).toBe(200);
    expect(csv.split('\r\n')).toHaveLength(4);
    expect(csv).toContain('COMPLETED');
    expect(csv).toContain('Wallet B');
  });

  it('404s an unknown report', async () => {
    const response = await exportRoute.GET(
      req('http://localhost/api/admin/export/secrets'),
      { params: Promise.resolve({ report: 'secrets' }) }
    );
    expect(response.status).toBe(404);
  });
});

describe.skipIf(!hasDatabase)('GET /api/admin/audit', () => {
  it('returns paginated entries and filters by action', async () => {
    const all = await auditRoute.GET(req('http://localhost/api/admin/audit?page=1&limit=10'));
    const allBody = await all.json();

    expect(all.status).toBe(200);
    expect(allBody.entries.length).toBeGreaterThan(0);
    expect(allBody.pagination.total).toBeGreaterThan(0);

    const filtered = await auditRoute.GET(
      req('http://localhost/api/admin/audit?action=EXPORT_DOWNLOAD')
    );
    const filteredBody = await filtered.json();
    expect(filteredBody.entries.length).toBeGreaterThan(0);
    expect(
      filteredBody.entries.every((e: { action: string }) => e.action === 'EXPORT_DOWNLOAD')
    ).toBe(true);

    const none = await auditRoute.GET(req('http://localhost/api/admin/audit?action=ITEM_FLAG'));
    expect((await none.json()).entries).toHaveLength(0);
  });

  it('rejects a reversed date range', async () => {
    const response = await auditRoute.GET(
      req('http://localhost/api/admin/audit?from=2026-10-20&to=2026-10-01')
    );
    expect(response.status).toBe(400);
  });
});

describe.skipIf(!hasDatabase)('POST /api/admin/items/bulk', () => {
  it('removes items, audits each one, and reports missing ids', async () => {
    const response = await bulkItemsRoute.POST(
      req('http://localhost/api/admin/items/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: ['it_lost_2', 'it_does_not_exist'],
          action: 'REMOVE',
          reason: 'Duplicate posting',
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.updated).toBe(1);
    expect(body.notFound).toEqual(['it_does_not_exist']);

    const item = await prisma.item.findUnique({ where: { id: 'it_lost_2' } });
    expect(item?.status).toBe('DELETED');
    expect(item?.deletionReason).toBe('Duplicate posting');
    expect(item?.moderationStatus).toBe('REMOVED');

    // One per-target row plus the bulk summary row.
    const rows = await prisma.auditLog.findMany({ where: { action: 'ITEM_REMOVE' } });
    expect(rows).toHaveLength(1);
    expect(rows[0].targetId).toBe('it_lost_2');

    const summary = await prisma.auditLog.findFirst({ where: { action: 'BULK_ITEM_ACTION' } });
    expect(summary?.targetId).toBe('bulk');

    // The owner was notified.
    const notification = await prisma.notification.findFirst({
      where: { userId: LOST_ID, type: 'MODERATION_ACTION' },
    });
    expect(notification).not.toBeNull();
  });

  it('requires a reason to remove', async () => {
    const response = await bulkItemsRoute.POST(
      req('http://localhost/api/admin/items/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: ['it_lost_1'], action: 'REMOVE' }),
      })
    );
    expect(response.status).toBe(400);
  });

  it('restores without requiring a reason', async () => {
    const response = await bulkItemsRoute.POST(
      req('http://localhost/api/admin/items/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: ['it_lost_2'], action: 'RESTORE' }),
      })
    );
    expect(response.status).toBe(200);

    const item = await prisma.item.findUnique({ where: { id: 'it_lost_2' } });
    expect(item?.status).toBe('LOST');
    expect(item?.deletedAt).toBeNull();
  });
});
