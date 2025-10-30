"use client";

import Link from "next/link";
import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { Menu, X, User, LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/post", label: "Post Item" },
  { href: "/search", label: "Search" },
  { href: "/resolved", label: "Resolved" },
];

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { data: session, status } = useSession();

  const toggleMenu = () => setIsMenuOpen((prev) => !prev);
  const closeMenu = () => setIsMenuOpen(false);

  const handleLogout = () => {
    signOut({ callbackUrl: "/" });
    closeMenu();
  };

  return (
    <nav className="border-b bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link
          href="/"
          className="text-xl font-semibold tracking-tight text-gray-900"
          onClick={closeMenu}
        >
          Campus Helper
        </Link>

        <div className="hidden items-center gap-3 md:flex">
          {navItems.map((item) => (
            <Button key={item.href} variant="ghost" asChild>
              <Link href={item.href}>{item.label}</Link>
            </Button>
          ))}
          
          {status === 'loading' ? (
            <Button variant="outline" disabled>
              <User className="size-4 mr-2" />
              Loading...
            </Button>
          ) : session?.user ? (
            <div className="flex items-center gap-2">
              <Button variant="ghost" asChild className="p-2">
                <Link href="/dashboard" title="Go to Dashboard">
                  <User className="size-5 text-gray-700 hover:text-gray-900" />
                </Link>
              </Button>
              <Button variant="outline" onClick={handleLogout}>
                <LogOut className="size-4 mr-2" />
                Logout
              </Button>
            </div>
          ) : (
            <Button variant="outline" asChild>
              <Link href="/auth/login">
                <User className="size-4 mr-2" />
                Login / Sign Up
              </Link>
            </Button>
          )}
        </div>

        <div className="md:hidden">
          <Button
            variant="ghost"
            size="icon"
            aria-expanded={isMenuOpen}
            aria-controls="mobile-menu"
            onClick={toggleMenu}
          >
            {isMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            <span className="sr-only">Toggle navigation</span>
          </Button>
        </div>
      </div>

      {isMenuOpen && (
        <div id="mobile-menu" className="border-t bg-white md:hidden">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-3">
            {navItems.map((item) => (
              <Button key={item.href} variant="ghost" className="justify-start" asChild>
                <Link href={item.href} onClick={closeMenu}>
                  {item.label}
                </Link>
              </Button>
            ))}
            
            {status === 'loading' ? (
              <Button variant="outline" className="justify-start" disabled>
                <User className="size-4 mr-2" />
                Loading...
              </Button>
            ) : session?.user ? (
              <>
                <Button variant="ghost" className="justify-start" asChild>
                  <Link href="/dashboard" onClick={closeMenu}>
                    <User className="size-4 mr-2" />
                    Dashboard
                  </Link>
                </Button>
                <Button variant="outline" className="justify-start" onClick={handleLogout}>
                  <LogOut className="size-4 mr-2" />
                  Logout
                </Button>
              </>
            ) : (
              <Button variant="outline" className="justify-start" asChild>
                <Link href="/auth/login" onClick={closeMenu}>
                  <User className="size-4 mr-2" />
                  Login / Sign Up
                </Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}