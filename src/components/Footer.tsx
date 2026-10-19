import Link from "next/link";

const FOOTER_LINKS = [
  { href: "/search", label: "Search" },
  { href: "/lost-items", label: "Lost items" },
  { href: "/resolved", label: "Resolved" },
  { href: "/post", label: "Report an item" },
];

/**
 * Footer
 *
 * Was a full-width `bg-muted` band, which in dark mode painted a lighter strip
 * across the bottom of every page. It is now the page surface with a hairline
 * rule, aligned to the same max-w-6xl gutters as the navbar and page content.
 */
export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <p className="text-sm text-muted-foreground">
          &copy; {year} Campus Helper. Helping students find their lost items.
        </p>

        <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {FOOTER_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
