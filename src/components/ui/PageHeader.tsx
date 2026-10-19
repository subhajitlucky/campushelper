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
 * Exactly one per page. Encodes the top of the type scale (30/36px, weight 600,
 * tracking-tight) so no page has to re-derive it, and separates itself from the
 * content with a single hairline rule rather than a box.
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
    <header className={cn("border-b border-border pb-8", className)}>
      {back && (
        <Link
          href={back.href}
          className="mb-4 inline-flex items-center gap-1.5 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {back.label ?? "Back"}
        </Link>
      )}

      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {title}
          </h1>

          {description && (
            <p className="mt-3 max-w-2xl text-base text-muted-foreground">{description}</p>
          )}

          {meta && (
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
              {meta}
            </div>
          )}
        </div>

        {actions && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>
    </header>
  );
}
