import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { cn } from "@/lib/utils";

interface PageHeaderProps {
  /** The page's only h1. Keep it to one line where you can. */
  title: React.ReactNode;
  /** One or two lines of context at 16px. Long prose belongs in the page body. */
  description?: React.ReactNode;
  /** Right-aligned actions: one primary button, at most one secondary. */
  actions?: React.ReactNode;
  /** Optional back link, rendered above the title. */
  back?: { href: string; label?: string };
  /** Optional inline meta row under the title — result counts, badges, filters. */
  meta?: React.ReactNode;
  className?: string;
}

/**
 * PageHeader
 *
 * Exactly one per page. Encodes the top of the type scale so no page has to
 * re-derive it, and separates itself from the content with a single hairline
 * rule rather than a box.
 *
 * Two details decide how much of the first screen the content gets:
 *
 * - **Actions are top-aligned, not bottom-aligned.** `sm:items-end` pinned the
 *   primary action to the bottom of the description, so a two-line description
 *   left the button floating at a y-offset aligned to nothing. Top-aligned it
 *   sits against the title cap-height, which is where the eye already is.
 * - **The description is capped at `max-w-xl` and expected to be one line.** It
 *   was `max-w-2xl` and routinely wrapped to two, which is most of why list
 *   pages started below the fold. The header says what the page is; the body
 *   says everything else.
 *
 * The rule is on the bottom edge because every page reads top-down; the header
 * deliberately carries no outer margin, so the page owns its own rhythm.
 */
export default function PageHeader({
  title,
  description,
  actions,
  back,
  meta,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn("border-b border-border pb-6", className)}>
      {back && (
        <Link
          href={back.href}
          className="mb-3 inline-flex items-center gap-1.5 rounded-md text-sm text-muted-foreground transition-colors hover:text-brand"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {back.label ?? "Back"}
        </Link>
      )}

      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="text-balance text-3xl font-semibold leading-[1.12] tracking-[-0.028em] text-foreground sm:text-4xl">
              {title}
            </h1>

            {/* The count rides on the title's baseline rather than taking a
                line of its own below the description. */}
            {meta && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                {meta}
              </div>
            )}
          </div>

          {description && (
            <p className="mt-2.5 max-w-xl text-base leading-relaxed text-muted-foreground">
              {description}
            </p>
          )}
        </div>

        {actions && (
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:pt-1">{actions}</div>
        )}
      </div>
    </header>
  );
}
