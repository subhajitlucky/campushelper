import Link from "next/link";

import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/ui/StatusBadge";
import { prisma } from "@/lib/prisma";
import { formatDuration, medianTimeToReturnHours } from "@/lib/analytics";

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

const MS_PER_HOUR = 1000 * 60 * 60;

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
      status: true,
      location: true,
      createdAt: true,
      category: { select: { name: true } },
      zone: { select: { name: true } },
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
    const [posted, returned, members, recent, resolvedRows] = await Promise.all([
      prisma.item.count({ where: { deletedAt: null, status: { not: "DELETED" } } }),
      prisma.item.count({ where: { deletedAt: null, status: "RESOLVED" } }),
      prisma.user.count({ where: { isActive: true } }),
      queryRecent(),
      prisma.item.findMany({
        where: { deletedAt: null, status: "RESOLVED", resolvedAt: { not: null } },
        select: { createdAt: true, resolvedAt: true },
        take: 2000,
      }),
    ]);

    const durations = resolvedRows
      .filter((row) => row.resolvedAt)
      .map((row) => (row.resolvedAt!.getTime() - row.createdAt.getTime()) / MS_PER_HOUR);

    const medianHours = medianTimeToReturnHours(durations);

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
      <div className="text-2xl font-semibold tracking-tight tabular-nums text-foreground">
        {value}
      </div>
      <div className="mt-0.5 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

export default async function Home() {
  const { ok, posted, returned, members, recent, medianReturnLabel, resolutionRate } =
    await getHomeData();

  return (
    <main className="flex-1 bg-background">
      {/* Hero */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <p className="inline-flex items-center rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                Campus lost &amp; found
              </p>

              <h1 className="mt-5 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
                Reunite people with their belongings
              </h1>

              <p className="mt-4 max-w-xl text-base text-muted-foreground">
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

            {/* Real platform figures. Nothing here is hardcoded. */}
            <div className="lg:justify-self-end lg:w-full lg:max-w-sm">
              <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                <h2 className="text-sm font-medium text-foreground">Platform activity</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {ok ? "Live counts from the database" : "Currently unavailable"}
                </p>

                {!ok ? (
                  <p className="mt-6 rounded-md border border-dashed border-border p-4 text-xs text-muted-foreground">
                    Activity figures can&apos;t be loaded right now. The rest of the site
                    works normally.
                  </p>
                ) : (
                <>
                <div className="mt-6 grid grid-cols-2 gap-6">
                  <Stat value={String(returned)} label="Items returned" />
                  <Stat value={String(posted)} label="Reports posted" />
                  <Stat value={String(members)} label="Members" />
                  <Stat
                    value={resolutionRate === null ? "—" : `${resolutionRate}%`}
                    label="Resolution rate"
                  />
                </div>

                <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
                  <span className="text-xs text-muted-foreground">Median time to return</span>
                  <span className="text-xs font-medium tabular-nums text-foreground">
                    {returned === 0 ? "No returns yet" : medianReturnLabel}
                  </span>
                </div>
                </>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Recent items */}
      <section className="border-b border-border py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                Recent reports
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                The latest across campus
              </p>
            </div>
            <Link
              href="/search"
              className="rounded-md text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              View all
            </Link>
          </div>

          {recent.length === 0 ? (
            <p className="mt-8 rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              No reports yet. Be the first to post one.
            </p>
          ) : (
            <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {recent.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/item/${item.id}`}
                    className="flex h-full flex-col rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-medium text-foreground">{item.title}</h3>
                      <StatusBadge status={item.status} size="sm" />
                    </div>

                    <p className="mt-2 line-clamp-2 flex-1 text-sm text-muted-foreground">
                      {item.description}
                    </p>

                    <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
                      <span className="truncate">
                        {item.zone?.name ?? item.location}
                      </span>
                      <span className="shrink-0 tabular-nums">
                        {item.createdAt.toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* How it works */}
      <section className="py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            How it works
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Three steps, and a verified handover at the end of them.
          </p>

          <ol className="mt-8 grid gap-8 md:grid-cols-3">
            {STEPS.map((step) => (
              <li key={step.number} className="border-t border-border pt-5">
                <span className="text-xs font-medium tabular-nums text-muted-foreground">
                  {step.number}
                </span>
                <h3 className="mt-2 text-base font-semibold text-foreground">{step.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </main>
  );
}
