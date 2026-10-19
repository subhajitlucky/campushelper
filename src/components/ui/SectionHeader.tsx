import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  /** Section title — the second step of the type scale (20px, weight 600). */
  title: React.ReactNode;
  /** One line of context, 14px. */
  description?: React.ReactNode;
  /** Right-side action: a quiet text button or link, not a filled button. */
  action?: React.ReactNode;
  /** Heading level. h2 by default; use h3 for a section nested in a tab panel. */
  as?: "h2" | "h3";
  /** Set when a container needs `aria-labelledby` to point at this heading. */
  id?: string;
  /**
   * Draw the hairline rule above the heading. Sections group by proximity and a
   * rule, never by a container — set false only when the section is the first
   * thing under a PageHeader that already drew one.
   */
  divider?: boolean;
  className?: string;
}

/**
 * SectionHeader
 *
 * Groups content with whitespace and a top rule instead of a bordered box. This
 * is the replacement for the "bordered box containing a heading and a sentence"
 * anti-pattern called out in the redesign brief (§3).
 */
export default function SectionHeader({
  title,
  description,
  action,
  as = "h2",
  id,
  divider = true,
  className,
}: SectionHeaderProps) {
  const titleClassName = "text-xl font-semibold tracking-tight text-foreground";

  return (
    <div
      className={cn(
        "flex flex-wrap items-end justify-between gap-x-6 gap-y-2",
        divider && "border-t border-border pt-6",
        className
      )}
    >
      <div className="min-w-0">
        {as === "h3" ? (
          <h3 id={id} className={titleClassName}>
            {title}
          </h3>
        ) : (
          <h2 id={id} className={titleClassName}>
            {title}
          </h2>
        )}

        {description && (
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
        )}
      </div>

      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}
