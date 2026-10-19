import Link from "next/link";

import { Button } from "@/components/ui/button";
import ItemCard from "@/components/ui/ItemCard";
import { prisma } from "@/lib/prisma";
import { formatDuration } from "@/lib/analytics";

/**
 * The figures below used to be invented (2,341 users, 120+ reunions, 89%
 * success) against a real 31 users and 6 returns. Everything shown here is now
 * queried from the database, so the page cannot claim traction the platform does
 * not have.
 *
 * Revalidated rather than rendered per request: the homepage is the most-hit
 * route and these aggregates move slowly.
 */
export const revalidate = 300;

const STEPS = [
  {
    number: "01",
    title: "Report",
    description: "Describe what you lost or found, and where. Photos and tags make it findable.",
  },
  {
    number: "02",
    title: "Match",
    description:
      "Reports are scored against each other on description, category, zone, and timing — so likely pairs surface on their own.",
  },
  {
    number: "03",
    title: "Verify",
    description:
      "An approved claim issues a six-digit code. The item is only marked returned once that code is exchanged in person.",
  },
];

interface HomeData {
  ok: boolean;
  posted: number;
  returned: number;
  members: number;
  recent: Awaited<ReturnType<typeof queryRecent>>;
  medianReturnLabel: string;
  resolutionRate: number | null;
}

function queryRecent() {
  return prisma.item.findMany({
    // Both representations must be excluded: the user delete path sets
    // status='DELETED' without touching deletedAt, so filtering deletedAt
    // alone surfaced 5 deleted items in "Recent reports".
    where: { deletedAt: null, status: { not: "DELETED" } },
    orderBy: { createdAt: "desc" },
    take: 3,
    select: {
      id: true,
      title: true,
      description: true,
      itemType: true,
      status: true,
      location: true,
      createdAt: true,
      // `images` was missing, so the three cards on the only page an anonymous
      // visitor can see were structurally incapable of showing a photo even
      // though most reports have one. The homepage never showed the product.
      images: true,
      tags: true,
      category: { select: { slug: true, name: true, icon: true } },
      zone: { select: { slug: true, name: true } },
      postedBy: { select: { name: true, avatar: true } },
    },
  });
}

/**
 * Degrades rather than fails.
 *
 * This page is prerendered, so an unreachable database would otherwise break the
 * build outright -- and a transient blip would break the page. On failure it
 * reports that activity is unavailable and shows the empty state, instead of
 * rendering a confident "0 members", which would be a lie rather than a
 * degradation.
 */
async function getHomeData(): Promise<HomeData> {
  try {
    const [posted, returned, members, recent, medianRows] = await Promise.all([
      prisma.item.count({ where: { deletedAt: null, status: { not: "DELETED" } } }),
      prisma.item.count({ where: { deletedAt: null, status: "RESOLVED" } }),
      prisma.user.count({ where: { isActive: true } }),
      queryRecent(),
      /*
       * The exact median, computed in the database.
       *
       * This used to be `findMany({ where: {…RESOLVED}, select: {createdAt,
       * resolvedAt}, take: 2000 })` with no `orderBy`. Prisma returns rows in
       * whatever order the planner produces — effectively heap order — so the
       * "median" was the median of the 2,000 *oldest* resolved items. Measured
       * against a 200k-item seed, the sample spanned 2023-10-18 to 2024-05-24
       * while the population ran to 2026-10-17: 265.392 h against a true
       * 253.026 h (+4.9%). The figure was also frozen on that cohort forever,
       * because the cap kept biting in the same place.
       *
       * `percentile_cont` is exact over the whole population and returns a
       * single row, so this is cheaper as well as correct.
       */
      prisma.$queryRaw<{ median_hours: number | null }[]>`
        SELECT percentile_cont(0.5) WITHIN GROUP (
                 ORDER BY EXTRACT(EPOCH FROM ("resolvedAt" - "createdAt")) / 3600
               ) AS median_hours
          FROM "Item"
         WHERE "deletedAt" IS NULL
           AND "status" = 'RESOLVED'
           AND "resolvedAt" IS NOT NULL
      `,
    ]);

    const rawMedian = medianRows[0]?.median_hours;
    const medianHours = rawMedian === null || rawMedian === undefined ? null : Number(rawMedian);

    // formatDuration renders sub-hour values as whole minutes, so a median of a
    // few seconds reads as the misleading "0 minutes".
    const medianReturnLabel =
      medianHours === null
        ? "—"
        : medianHours * 60 < 1
          ? "under a minute"
          : formatDuration(medianHours);

    return {
      ok: true,
      posted,
      returned,
      members,
      recent,
      medianReturnLabel,
      resolutionRate: posted > 0 ? Math.round((returned / posted) * 100) : null,
    };
  } catch (error) {
    console.error("[home] activity query failed; rendering degraded state", error);
    return {
      ok: false,
      posted: 0,
      returned: 0,
      members: 0,
      recent: [],
      medianReturnLabel: "—",
      resolutionRate: null,
    };
  }
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <dt className="sr-only">{label}</dt>
      <dd className="text-2xl font-semibold tracking-tight tabular-nums text-foreground">
        {value}
      </dd>
      <dd className="mt-0.5 text-xs text-muted-foreground" aria-hidden="true">
        {label}
      </dd>
    </div>
  );
}

export default async function Home() {
  const { ok, posted, returned, members, recent, medianReturnLabel, resolutionRate } =
    await getHomeData();

  // The most recent report is the hero's focal point. The homepage is the only
  // page an anonymous visitor can see, and it used to show a headline, a
  // paragraph and a box of four numbers — no photograph, no card, nothing that
  // proved the product exists or works.
  const latest = recent[0];

  return (
    <main className="page-canvas flex-1 bg-background">
      {/* Hero */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-4 pt-14 sm:px-6 lg:px-8 lg:pt-20">
          <div className="grid items-start gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-brand-subtle px-3 py-1 text-xs font-medium text-brand">
                <span
                  className="size-1.5 rounded-full bg-brand"
                  aria-hidden="true"
                />
                Campus lost &amp; found
              </p>

              <h1 className="mt-5 text-balance text-4xl font-semibold leading-[1.08] tracking-[-0.03em] text-foreground sm:text-5xl">
                Reunite people with their belongings
              </h1>

              <p className="mt-5 max-w-lg text-base leading-relaxed text-muted-foreground">
                Report what you&apos;ve lost, browse what others have found, and track
                returns through a verified handover — not just a hopeful claim.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg">
                  <Link href="/post">Report an item</Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/search">Browse items</Link>
                </Button>
              </div>
            </div>

            {/* The product itself, not a description of it. */}
            {latest ? (
              <div className="lg:justify-self-end lg:w-full lg:max-w-sm">
                <p className="mb-3 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  Latest report
                </p>
                <ItemCard
                  item={{
                    ...latest,
                    createdAt: latest.createdAt.toISOString(),
                  }}
                  showActions={false}
                />
              </div>
            ) : null}
          </div>

          {/* Real platform figures, as a strip rather than a bordered box.
              The box used to be the heaviest object on the page, which meant it
              out-competed the hero it was supposed to support. Nothing here is
              hardcoded. */}
          <dl className="mt-14 grid grid-cols-2 gap-x-6 gap-y-6 border-t border-border pt-8 sm:grid-cols-4 lg:mt-16">
            {!ok ? (
              <div className="col-span-full text-sm text-muted-foreground">
                Activity figures can&apos;t be loaded right now. The rest of the site
                works normally.
              </div>
            ) : (
              <>
                <Stat value={String(returned)} label="Items returned" />
                <Stat value={String(posted)} label="Reports posted" />
                <Stat value={String(members)} label="Members" />
                <Stat
                  value={resolutionRate === null ? "—" : `${resolutionRate}%`}
                  label="Resolution rate"
                />
              </>
            )}
          </dl>

          {ok && (
            <p className="py-6 text-xs text-muted-foreground">
              {returned === 0
                ? "No returns yet — median time to return will appear here."
                : `Median time to return: ${medianReturnLabel}`}
            </p>
          )}
        </div>
      </section>

      {/* Recent items */}
      <section className="border-b border-border py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-foreground">
                Recent reports
              </h2>
              <p className="mt-1 text-base text-muted-foreground">
                The latest across campus
              </p>
            </div>
            <Link
              href="/search"
              className="rounded-md text-sm font-medium text-brand underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              View all
            </Link>
          </div>

          {recent.length === 0 ? (
            <p className="mt-8 rounded-xl border border-dashed border-border p-10 text-center text-base text-muted-foreground">
              No reports yet. Be the first to post one.
            </p>
          ) : (
            <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {recent.map((item) => (
                <li key={item.id} className="flex">
                  {/* The same photo-led card the rest of the app uses, so the
                      homepage cannot drift from the product again. */}
                  <ItemCard
                    item={{
                      ...item,
                      createdAt: item.createdAt.toISOString(),
                    }}
                    className="w-full"
                    showActions={false}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* How it works */}
      <section className="py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            How it works
          </h2>
          <p className="mt-1 text-base text-muted-foreground">
            Three steps, and a verified handover at the end of them.
          </p>

          <ol className="mt-8 grid gap-8 md:grid-cols-3">
            {STEPS.map((step) => (
              <li key={step.number} className="border-t border-border pt-5">
                <span className="text-xs font-medium tabular-nums text-muted-foreground">
                  {step.number}
                </span>
                <h3 className="mt-2 text-base font-medium text-foreground">{step.title}</h3>
                <p className="mt-1 text-base leading-relaxed text-muted-foreground">{step.description}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </main>
  );
}
