/**
 * DashboardStats
 *
 * The dashboard's opening figures: three or four large numbers with micro
 * labels, and nothing else. This used to be a row of shadcn `<Card>`s — each one
 * a bordered box wrapping a 14px label and a single number, which is the
 * anti-pattern the redesign brief deletes on sight (§3: "a bordered box whose
 * only content is a heading and a short paragraph").
 *
 * Grouping is done with a grid and whitespace, so the numbers carry the
 * hierarchy on their own. Type comes straight from the ladder (§2): the value is
 * the stat role (`text-2xl font-semibold tabular-nums`), the label is micro
 * (`text-xs font-medium text-muted-foreground`). Weight never exceeds 600.
 *
 * Marked up as a description list so the label/value pairing survives without
 * sight — `flex-col-reverse` puts the number first visually while keeping
 * `<dt>` before `<dd>` in the DOM.
 */

export interface DashboardStat {
  /** Micro label under the number, e.g. "Items posted". */
  label: string;
  /** The figure itself. */
  value: number;
}

interface DashboardStatsProps {
  stats: DashboardStat[];
  className?: string;
}

export default function DashboardStats({ stats, className = "" }: DashboardStatsProps) {
  if (stats.length === 0) {
    return null;
  }

  return (
    <dl
      className={`grid grid-cols-2 gap-x-8 gap-y-8 sm:grid-cols-4 ${className}`}
      aria-label="Your activity"
    >
      {stats.map((stat) => (
        <div key={stat.label} className="flex flex-col-reverse gap-1.5">
          <dt className="text-xs font-medium text-muted-foreground">{stat.label}</dt>
          <dd className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">
            {stat.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
