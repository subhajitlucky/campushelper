"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { Menu, X, User, LogOut } from "lucide-react";

import NotificationBell from "@/components/NotificationBell";
import ThemeToggle from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Four primary destinations plus one primary action. "Post Item" was a fifth
 * nav link competing with the four browse links; it is the thing a student
 * comes here to do, so it is a button now.
 */
const navItems = [
  { href: "/search", label: "Search" },
  { href: "/lost-items", label: "Lost Items" },
  { href: "/resolved", label: "Resolved" },
  { href: "/map", label: "Map" },
];

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { data: session, status } = useSession();
  const pathname = usePathname();

  const toggleMenu = () => setIsMenuOpen((prev) => !prev);
  const closeMenu = () => setIsMenuOpen(false);

  const handleLogout = () => {
    signOut({ callbackUrl: "/" });
    closeMenu();
  };

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  // Active is a colour change, not a weight change: weight is already carrying
  // too much meaning across the app, and 500 collapses to 700 on Linux anyway.
  const linkClass = (href: string) =>
    cn(
      "rounded-lg px-3 py-2 text-sm transition-colors",
      isActive(href)
        ? "text-foreground"
        : "text-muted-foreground hover:text-foreground"
    );

  return (
    <nav className="border-b border-border bg-background">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="text-lg font-semibold tracking-tight text-foreground"
          onClick={closeMenu}
        >
          Campus Helper
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={linkClass(item.href)}
              aria-current={isActive(item.href) ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}

          <Button asChild size="sm" className="ml-2">
            <Link href="/post">Report an item</Link>
          </Button>

          <div className="ml-2 flex items-center gap-1">
            <ThemeToggle />

            {status === "loading" ? (
              <Button variant="ghost" size="icon-sm" disabled aria-label="Loading account">
                <User className="size-4" />
              </Button>
            ) : session?.user ? (
              <>
                <NotificationBell />
                <Button variant="ghost" size="icon-sm" asChild>
                  <Link href="/dashboard" title="Go to Dashboard" aria-label="Go to Dashboard">
                    <User className="size-5" />
                  </Link>
                </Button>
                <Button variant="quiet" size="sm" onClick={handleLogout}>
                  <LogOut className="size-4 mr-1.5" />
                  Log out
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" asChild>
                <Link href="/auth/login">Log in</Link>
              </Button>
            )}
          </div>
        </div>

        <div className="md:hidden">
          <Button
            variant="ghost"
            size="icon"
            aria-expanded={isMenuOpen}
            aria-controls="mobile-menu"
            aria-label="Toggle navigation"
            onClick={toggleMenu}
          >
            {isMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
        </div>
      </div>

      {isMenuOpen && (
        <div
          id="mobile-menu"
          className="rise-in border-t border-border bg-background md:hidden"
        >
          <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-4 sm:px-6">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeMenu}
                className={cn(linkClass(item.href), "px-3 py-2.5")}
                aria-current={isActive(item.href) ? "page" : undefined}
              >
                {item.label}
              </Link>
            ))}

            <Button asChild className="mt-2">
              <Link href="/post" onClick={closeMenu}>
                Report an item
              </Link>
            </Button>

            <div className="mt-2 flex items-center justify-between border-t border-border pt-3">
              <span className="text-sm text-muted-foreground">Appearance</span>
              <ThemeToggle />
            </div>

            {status === "loading" ? (
              <Button variant="ghost" className="justify-start" disabled>
                <User className="size-4 mr-2" />
                Loading…
              </Button>
            ) : session?.user ? (
              <>
                <div className="flex items-center py-1">
                  <NotificationBell />
                </div>
                <Button variant="ghost" className="justify-start" asChild>
                  <Link href="/dashboard" onClick={closeMenu}>
                    <User className="size-4 mr-2" />
                    Dashboard
                  </Link>
                </Button>
                <Button variant="quiet" className="justify-start" onClick={handleLogout}>
                  <LogOut className="size-4 mr-2" />
                  Log out
                </Button>
              </>
            ) : (
              <Button variant="outline" className="justify-start" asChild>
                <Link href="/auth/login" onClick={closeMenu}>
                  <User className="size-4 mr-2" />
                  Log in
                </Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
