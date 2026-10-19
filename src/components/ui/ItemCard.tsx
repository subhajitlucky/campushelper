import Image from "next/image";
import Link from "next/link";
import {
  Backpack,
  BookOpen,
  Dumbbell,
  FileText,
  IdCard,
  ImageIcon,
  KeyRound,
  MapPin,
  Package,
  Shirt,
  Smartphone,
  Watch,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

import { Button } from "./button";
import StatusBadge from "./StatusBadge";

interface Item {
  id: string;
  title: string;
  description: string;
  itemType: "LOST" | "FOUND";
  status: string;
  location: string;
  createdAt: string;
  images?: string[] | null;
  tags?: string[] | null;
  postedBy: {
    name: string | null;
    avatar: string | null;
    /** Optional: only present on endpoints that select it. */
    reputation?: number | null;
  };
  category?: { slug: string; name: string; icon: string } | null;
  zone?: { slug: string; name: string } | null;
}

interface ItemCardProps {
  item: Item;
  user?: {
    isLoggedIn: boolean;
    userId?: string;
  };
  showActions?: boolean;
  onFound?: (item: Item) => void;
  className?: string;
  variant?: "default" | "compact";
}

/**
 * Category taxonomy → icon. The database stores a lucide icon *name*
 * (see prisma/migrations/…_seed_categories_zones), so the ten seeded names are
 * mapped explicitly rather than pulling the whole icon set in through a dynamic
 * lookup — that would ship every icon in lucide to the browser.
 */
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Smartphone,
  IdCard,
  FileText,
  BookOpen,
  KeyRound,
  Backpack,
  Shirt,
  Watch,
  Dumbbell,
  Package,
};

/**
 * Relative dates, the way a person would say them. Absolute dates are kept on
 * the `title` attribute for anyone who needs the exact day.
 */
function relativeDate(iso: string) {
  const then = new Date(iso);
  const diffMinutes = Math.round((Date.now() - then.getTime()) / 60000);

  if (!Number.isFinite(diffMinutes)) return "";
  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes} min ago`;

  const hours = Math.round(diffMinutes / 60);
  if (hours < 24) return hours === 1 ? "1 hour ago" : `${hours} hours ago`;

  const days = Math.round(hours / 24);
  if (days < 30) return days === 1 ? "yesterday" : `${days} days ago`;

  return then.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function absoluteDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * ItemCard — image-led, fixed-geometry card for a single report.
 *
 * The brief's card spec (§4.2): photo at 4:3, title at 16px/500, one meta row
 * (zone or location + relative date), status badge. No description — it only
 * ever truncated, and it is what made every card a different height. The card
 * is the link; secondary actions sit below it as siblings so the markup never
 * nests a button inside an anchor.
 *
 * Props are unchanged from the previous implementation so existing callers keep
 * working; `variant="compact"` now only tightens the body padding.
 */
export default function ItemCard({
  item,
  user,
  showActions = true,
  onFound,
  className = "",
  variant = "default",
}: ItemCardProps) {
  const isCompact = variant === "compact";
  const image = item.images?.[0];
  const place = item.zone?.name ?? item.location;
  const CategoryIcon = (item.category?.icon && CATEGORY_ICONS[item.category.icon]) || ImageIcon;

  // Only a lost item can be found, and only the list pages pass a handler.
  const showFoundAction = showActions && item.status === "LOST" && typeof onFound === "function";

  return (
    <article
      className={cn(
        "group flex h-full flex-col overflow-hidden rounded-xl border border-border-subtle bg-card shadow-card",
        "transition-shadow hover:shadow-card-hover",
        // Keyboard focus rings the whole card, not just the text inside it —
        // and `has-` keeps the ring outside the clipping image container.
        "has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring",
        className
      )}
    >
      <Link
        href={`/item/${item.id}`}
        className="flex flex-1 flex-col focus-visible:outline-none"
      >
        {/* Image — fixed 4:3, so every card in a row is the same height */}
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
          {image ? (
            <Image
              src={image}
              alt=""
              fill
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
              className="object-cover transition-transform duration-300 ease-out group-hover:scale-[1.02]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <CategoryIcon className="size-10 text-muted-foreground/70" aria-hidden="true" />
            </div>
          )}
        </div>

        {/* Body */}
        <div className={cn("flex flex-1 flex-col gap-3", isCompact ? "p-4" : "p-5")}>
          <div className="flex items-start justify-between gap-3">
            <h3 className="line-clamp-2 min-h-[2.75rem] text-base font-medium leading-snug text-foreground">
              {item.title}
            </h3>
            <StatusBadge status={item.status} />
          </div>

          {/* One meta row: place · relative date */}
          <div className="mt-auto flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="size-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{place}</span>
            <span aria-hidden="true">·</span>
            <time
              dateTime={item.createdAt}
              title={absoluteDate(item.createdAt)}
              suppressHydrationWarning
              className="shrink-0 whitespace-nowrap tabular-nums"
            >
              {relativeDate(item.createdAt)}
            </time>
          </div>
        </div>
      </Link>

      {/* Secondary action — a sibling of the link, never inside it */}
      {showFoundAction && (
        <div className="border-t border-border-subtle px-4 py-3">
          {user?.isLoggedIn ? (
            <Button
              variant="quiet"
              size="sm"
              className="w-full"
              onClick={() => onFound?.(item)}
            >
              I found this
            </Button>
          ) : (
            <Button variant="quiet" size="sm" className="w-full" asChild>
              <Link href="/auth/login">Log in to claim</Link>
            </Button>
          )}
        </div>
      )}
    </article>
  );
}
