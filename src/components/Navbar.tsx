"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import {
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Menu,
  PackageSearch,
  Plus,
  User,
  X,
} from "lucide-react";

import NotificationBell from "@/components/NotificationBell";
import ThemeToggle from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The floating command bar.
 *
 * The previous bar was a full-width strip welded to the top edge with a bottom
 * border, a plain-text wordmark and no active state beyond a one-pixel
 * underline — the shape every admin template starts from. This one is a
 * detached, translucent pill that sits *below* the viewport edge, so the page
 * reads as one continuous surface behind it rather than a document with a
 * chrome band bolted on top.
 *
 * Three things carry the upgrade:
 *
 * 1. **A real wordmark.** A brand tile plus a two-tone lockup replaces the
 *    bare string. It is the only saturated element in the chrome, which is
 *    what makes the bar read as a product rather than a nav.
 * 2. **Segmented navigation.** Destinations are grouped into one recessed
 *    track, and the active one is a raised pill inside it. Proximity does the
 *    grouping work that four separate text links could not.
 * 3. **One account affordance.** The old bar showed a person icon *and* a
 *    "Log out" text button *and* a bell — three controls, two of which led to
 *    the same place. Account actions now live behind a single avatar menu.
 *
 * Design guidance applied from the loaded skills: a floating navbar with real
 * edge spacing (not `top-0`), a single accent moment, 44px touch targets,
 * visible focus rings, `aria-current` on the active route, Escape/outside-click
 * dismissal, and hover states that never shift layout.
 */

const navItems = [
  { href: "/search", label: "Search" },
  { href: "/lost-items", label: "Lost Items" },
  { href: "/resolved", label: "Resolved" },
  { href: "/map", label: "Map" },
] as const;

/** Marks the product. A tile rather than an icon, so it reads as a logo. */
function Wordmark({ onClick }: { onClick?: () => void }) {
  return (
    <Link
      href="/"
      onClick={onClick}
      aria-label="Campus Helper — home"
      className="group flex shrink-0 items-center gap-2.5 rounded-xl px-1 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <span
        aria-hidden="true"
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-[0.625rem]",
          "bg-brand text-brand-foreground",
          // A single inset highlight: enough to read as a solid object without
          // the gloss that makes a logo look like a toy.
          "shadow-[inset_0_1px_0_oklch(1_0_0/0.25),0_1px_2px_oklch(0.28_0.02_75/0.25)]",
          "transition-transform duration-200 ease-out group-hover:-rotate-3"
        )}
      >
        <PackageSearch className="size-[1.05rem]" strokeWidth={2.25} />
      </span>

      <span className="text-[0.9375rem] font-semibold tracking-[-0.02em] text-foreground">
        Campus<span className="font-medium text-muted-foreground"> Helper</span>
      </span>
    </Link>
  );
}

/**
 * Account menu.
 *
 * A disclosure, not a dependency: one button, one panel, Escape and
 * outside-click to dismiss, focus returned to the trigger. Keyboard order
 * follows the visual order because the panel is a sibling of the trigger.
 */
function AccountMenu({
  name,
  email,
  onNavigate,
}: {
  name: string | null;
  email: string | null;
  onNavigate: () => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  const close = useCallback((refocus = false) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close(true);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  const initial = (name?.trim().charAt(0) || "U").toUpperCase();

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls={open ? panelId : undefined}
        aria-label={name ? `Account menu for ${name}` : "Account menu"}
        className={cn(
          "flex size-9 items-center justify-center gap-1 rounded-xl transition-colors",
          "text-sm font-semibold text-foreground",
          "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          open && "bg-muted"
        )}
      >
        <span
          className={cn(
            "grid size-7 place-items-center rounded-full",
            "bg-brand-subtle text-brand ring-1 ring-brand/20"
          )}
        >
          {initial}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "size-3.5 text-muted-foreground transition-transform duration-150",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div
          id={panelId}
          className={cn(
            "rise-in absolute right-0 top-[calc(100%+0.5rem)] z-50 w-60",
            "rounded-xl border border-border-subtle bg-popover p-1.5 shadow-overlay"
          )}
        >
          <div className="px-2.5 py-2">
            <p className="truncate text-sm font-medium text-foreground">
              {name ?? "Signed in"}
            </p>
            {email && (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{email}</p>
            )}
          </div>

          <div className="my-1 h-px bg-border-subtle" />

          <Link
            href="/dashboard"
            onClick={() => {
              setOpen(false);
              onNavigate();
            }}
            className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <LayoutDashboard className="size-4 text-muted-foreground" aria-hidden="true" />
            Dashboard
          </Link>

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onNavigate();
              signOut({ callbackUrl: "/" });
            }}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <LogOut className="size-4 text-muted-foreground" aria-hidden="true" />
            Log out
          </button>
        </div>
      )}
    </div>
  );
}

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const { data: session, status } = useSession();
  const pathname = usePathname();

  // Every link in the sheet closes it on click, which covers route changes
  // without an effect that would setState synchronously after render.
  const closeMenu = useCallback(() => setIsMenuOpen(false), []);

  // Only the elevation changes on scroll, never the height: a bar that resizes
  // as you scroll moves the content underneath it and reads as a glitch.
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      setIsScrolled(window.scrollY > 8);
    };
    const onScroll = () => {
      if (frame === 0) frame = window.requestAnimationFrame(update);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    if (!isMenuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsMenuOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isMenuOpen]);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header
      className={cn(
        "sticky top-0 z-50",
        // The fade under the pill is what lets the bar float without the page
        // showing raw through the gap above it.
        "bg-gradient-to-b from-background via-background/90 to-transparent",
        "pb-2 pt-3 sm:pt-4"
      )}
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <nav
          aria-label="Primary"
          className={cn(
            "flex h-14 items-center gap-2 rounded-2xl border px-2 pl-2.5",
            "bg-card/85 backdrop-blur-xl backdrop-saturate-150",
            "transition-[box-shadow,border-color] duration-200 ease-out",
            isScrolled
              ? "border-border-subtle shadow-card-hover"
              : "border-border-subtle/70 shadow-card"
          )}
        >
          <Wordmark />

          {/* Segmented destinations. The recessed track does the grouping that
              four separate text links could not, so the active pill reads as a
              selection rather than as a change of text colour. */}
          <div className="ml-1 hidden items-center gap-0.5 rounded-xl bg-muted/70 p-1 md:flex">
            {navItems.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative inline-flex h-8 items-center rounded-lg px-3 text-sm transition-colors duration-150",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    active
                      ? "bg-card font-medium text-foreground shadow-[0_1px_2px_oklch(0.28_0.02_75/0.12)]"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {item.label}
                  {active && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-brand"
                    />
                  )}
                </Link>
              );
            })}
          </div>

          <div className="ml-auto flex items-center gap-1">
            <Button
              asChild
              size="sm"
              className="mr-1 hidden h-9 rounded-xl px-3 sm:inline-flex"
            >
              <Link href="/post">
                <Plus className="size-4" aria-hidden="true" />
                Report an item
              </Link>
            </Button>

            <div className="hidden items-center gap-0.5 sm:flex">
              <ThemeToggle />
              <NotificationBell />

              {status === "loading" ? (
                <div
                  className="size-9 animate-pulse rounded-xl bg-muted"
                  aria-hidden="true"
                />
              ) : session?.user ? (
                <AccountMenu
                  name={session.user.name ?? null}
                  email={session.user.email ?? null}
                  onNavigate={closeMenu}
                />
              ) : (
                <Button variant="outline" size="sm" className="h-9 rounded-xl" asChild>
                  <Link href="/auth/login">
                    <User className="size-4" aria-hidden="true" />
                    Log in
                  </Link>
                </Button>
              )}
            </div>

            <Button
              variant="ghost"
              size="icon-sm"
              // 44px, not 36: this is the only navigation affordance on a
              // phone, and the guidance is a 44px minimum touch target.
              className="size-11 rounded-xl md:hidden"
              aria-expanded={isMenuOpen}
              aria-controls="mobile-menu"
              aria-label={isMenuOpen ? "Close navigation" : "Open navigation"}
              onClick={() => setIsMenuOpen((value) => !value)}
            >
              {isMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </Button>
          </div>
        </nav>

        {/* Mobile sheet: a card that belongs to the pill, not a separate band. */}
        {isMenuOpen && (
          <div
            id="mobile-menu"
            className={cn(
              "rise-in mt-2 overflow-hidden rounded-2xl border border-border-subtle",
              "bg-card/95 p-2 shadow-overlay backdrop-blur-xl md:hidden"
            )}
          >
            <div className="flex flex-col gap-0.5">
              {navItems.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={closeMenu}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-11 items-center rounded-xl px-3 text-base transition-colors",
                      active
                        ? "bg-brand-subtle font-medium text-brand"
                        : "text-foreground hover:bg-muted"
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>

            <div className="my-2 h-px bg-border-subtle" />

            <Button asChild className="h-11 w-full rounded-xl">
              <Link href="/post" onClick={closeMenu}>
                <Plus className="size-4" aria-hidden="true" />
                Report an item
              </Link>
            </Button>

            <div className="mt-3 flex items-center justify-between px-1 pb-1">
              <div className="flex items-center gap-1">
                <ThemeToggle />
                <NotificationBell />
              </div>

              {session?.user ? (
                <Button
                  variant="quiet"
                  onClick={() => {
                    closeMenu();
                    signOut({ callbackUrl: "/" });
                  }}
                  className="min-h-11"
                >
                  <LogOut className="size-4" aria-hidden="true" />
                  Log out
                </Button>
              ) : (
                <Button variant="outline" asChild className="min-h-11">
                  <Link href="/auth/login" onClick={closeMenu}>
                    <User className="size-4" aria-hidden="true" />
                    Log in
                  </Link>
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
