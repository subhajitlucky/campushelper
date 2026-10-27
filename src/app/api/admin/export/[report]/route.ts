// GET /api/admin/export/[report] — CSV download of item or claim data.

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { limitV2 } from '@/lib/rateLimit';
import { prisma } from '@/lib/prisma';
import { toCsv, type CsvColumn } from '@/lib/csv';
import { EXPORT_FORMATS, MAX_EXPORT_ROWS } from '@/lib/schemas/analytics';
import { auditIpFromRequest, recordAudit } from '@/lib/audit';
import {
  AdminAccessRequired,
  AuthenticationRequired,
  NotFound,
  safeApiHandler,
} from '@/lib/errors';

/** Reports this endpoint can render. */
type ExportReport = (typeof EXPORT_FORMATS)[number];

/** True when a path segment names a supported report. */
function isExportReport(value: string): value is ExportReport {
  return (EXPORT_FORMATS as readonly string[]).includes(value);
}

interface CsvExport {
  csv: string;
  rowCount: number;
  truncated: boolean;
}

/**
 * Keep the first {@link MAX_EXPORT_ROWS} rows, reporting whether more existed.
 *
 * The query asks for one extra row so truncation is detected without a second
 * count query, and the caller can tell the client the download is incomplete.
 */
function capRows<T>(rows: T[]): { rows: T[]; truncated: boolean } {
  const truncated = rows.length > MAX_EXPORT_ROWS;

  return {
    rows: truncated ? rows.slice(0, MAX_EXPORT_ROWS) : rows,
    truncated,
  };
}

/**
 * Fetch one report's rows and serialise them to CSV.
 *
 * Every column is an explicit `select`, so a later schema change cannot leak a
 * new sensitive field into an export by default, and the row count is capped at
 * {@link MAX_EXPORT_ROWS}.
 */
async function buildCsv(report: ExportReport): Promise<CsvExport> {
  if (report === 'claims') {
    const fetched = await prisma.claim.findMany({
      select: {
        id: true,
        claimType: true,
        status: true,
        message: true,
        createdAt: true,
        resolvedAt: true,
        completedAt: true,
        user: { select: { email: true, name: true } },
        item: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: MAX_EXPORT_ROWS + 1,
    });

    const { rows, truncated } = capRows(fetched);

    const columns: CsvColumn<(typeof rows)[number]>[] = [
      { key: 'id', header: 'Claim ID', value: (row) => row.id },
      { key: 'claimType', header: 'Claim Type', value: (row) => row.claimType },
      { key: 'status', header: 'Status', value: (row) => row.status },
      { key: 'message', header: 'Message', value: (row) => row.message },
      { key: 'createdAt', header: 'Created At', value: (row) => row.createdAt },
      { key: 'resolvedAt', header: 'Resolved At', value: (row) => row.resolvedAt },
      { key: 'completedAt', header: 'Completed At', value: (row) => row.completedAt },
      { key: 'userEmail', header: 'Claimant Email', value: (row) => row.user.email },
      { key: 'userName', header: 'Claimant Name', value: (row) => row.user.name },
      { key: 'itemId', header: 'Item ID', value: (row) => row.item.id },
      { key: 'itemTitle', header: 'Item Title', value: (row) => row.item.title },
    ];

    return { csv: toCsv(rows, columns), rowCount: rows.length, truncated };
  }

  const fetched = await prisma.item.findMany({
    select: {
      id: true,
      title: true,
      description: true,
      itemType: true,
      status: true,
      location: true,
      tags: true,
      images: true,
      createdAt: true,
      resolvedAt: true,
      moderationStatus: true,
      postedBy: { select: { email: true, name: true } },
      category: { select: { name: true } },
      zone: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: MAX_EXPORT_ROWS + 1,
  });

  const { rows, truncated } = capRows(fetched);

  const columns: CsvColumn<(typeof rows)[number]>[] = [
    { key: 'id', header: 'Item ID', value: (row) => row.id },
    { key: 'title', header: 'Title', value: (row) => row.title },
    { key: 'description', header: 'Description', value: (row) => row.description },
    { key: 'itemType', header: 'Type', value: (row) => row.itemType },
    { key: 'status', header: 'Status', value: (row) => row.status },
    { key: 'location', header: 'Location', value: (row) => row.location },
    { key: 'tags', header: 'Tags', value: (row) => row.tags },
    { key: 'images', header: 'Images', value: (row) => row.images },
    { key: 'createdAt', header: 'Created At', value: (row) => row.createdAt },
    { key: 'resolvedAt', header: 'Resolved At', value: (row) => row.resolvedAt },
    {
      key: 'moderationStatus',
      header: 'Moderation Status',
      value: (row) => row.moderationStatus,
    },
    { key: 'postedByEmail', header: 'Posted By Email', value: (row) => row.postedBy.email },
    { key: 'postedByName', header: 'Posted By Name', value: (row) => row.postedBy.name },
    { key: 'categoryName', header: 'Category', value: (row) => row.category?.name },
    { key: 'zoneName', header: 'Zone', value: (row) => row.zone?.name },
  ];

  return { csv: toCsv(rows, columns), rowCount: rows.length, truncated };
}

/**
 * GET /api/admin/export/[report]
 * Stream `items` or `claims` as an attachment, capped at {@link MAX_EXPORT_ROWS}.
 *
 * The download is audited as `EXPORT_DOWNLOAD`: a CSV of every item or claim
 * carries student names and email addresses out of the system, which is exactly
 * the kind of data egress an audit trail exists to record.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ report: string }> }
) {
  return safeApiHandler(async () => {
    const session = await getSession();
    if (!session?.user?.id) {
      return AuthenticationRequired();
    }

    if (session.user.role !== 'ADMIN' && session.user.role !== 'MODERATOR') {
      return AdminAccessRequired();
    }

    await limitV2('export', session.user.id);

    const { report } = await params;

    if (!isExportReport(report)) {
      return NotFound('Report');
    }

    const { csv, rowCount, truncated } = await buildCsv(report);
    const today = new Date().toISOString().slice(0, 10);

    await recordAudit({
      actorId: session.user.id,
      actorEmail: session.user.email ?? 'unknown',
      action: 'EXPORT_DOWNLOAD',
      targetType: report === 'items' ? 'Item' : 'Claim',
      targetId: report,
      reason: `Exported ${report} as CSV`,
      metadata: { rowCap: MAX_EXPORT_ROWS, rowCount, truncated },
      ip: auditIpFromRequest(request),
    });

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="campushelper-${report}-${today}.csv"`,
        'Cache-Control': 'no-store',
        // The cap is otherwise silent, so a truncated download looks complete.
        'X-Export-Row-Count': String(rowCount),
        'X-Export-Row-Cap': String(MAX_EXPORT_ROWS),
        'X-Export-Truncated': String(truncated),
      },
    });
  });
}
