/**
 * Backfills match suggestions for items posted before the match engine existed.
 *
 * Idempotent: `MatchSuggestion` has a unique constraint on the item pair, and
 * `computeMatchesForItem` upserts, so running this repeatedly is safe. Failed
 * suggestions are never resurrected.
 *
 * Usage: npm run db:backfill-matches [-- --limit 500]
 */
import { prisma } from '../src/lib/prisma';
import { computeMatchesForItem } from '../src/lib/match-service';

/** Default cap on how many items to process in one run. */
const DEFAULT_LIMIT = 500;

function parseLimit(argv: readonly string[]): number {
  const flagIndex = argv.indexOf('--limit');
  if (flagIndex === -1) return DEFAULT_LIMIT;

  const raw = argv[flagIndex + 1];
  const parsed = Number.parseInt(raw ?? '', 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    console.error(`Invalid --limit value: ${raw ?? '(missing)'}`);
    process.exit(1);
  }

  return parsed;
}

async function main(): Promise<void> {
  const limit = parseLimit(process.argv.slice(2));

  const items = await prisma.item.findMany({
    where: {
      deletedAt: null,
      status: { in: ['LOST', 'FOUND', 'CLAIMED'] },
    },
    select: { id: true },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  console.log(`Scoring ${items.length} item(s) against their counterparts...`);

  let suggestions = 0;
  let processed = 0;

  for (const item of items) {
    const count = await computeMatchesForItem(item.id);
    suggestions += count;
    processed += 1;

    if (processed % 50 === 0) {
      console.log(`  ${processed}/${items.length} items, ${suggestions} suggestion(s)`);
    }
  }

  const total = await prisma.matchSuggestion.count({
    where: { status: { in: ['SUGGESTED', 'CONFIRMED'] } },
  });

  console.log(
    `Done. Processed ${processed} item(s); ${suggestions} suggestion(s) created or refreshed.`
  );
  console.log(`Open suggestions now in the database: ${total}.`);
}

main()
  .catch((error) => {
    console.error('Backfill failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
