"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";

import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/post", label: "Post Item" },
  { href: "/search", label: "Search" },
  { href: "/resolved", label: "Resolved" },
];

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => setIsMenuOpen((prev) => !prev);
  const closeMenu = () => setIsMenuOpen(false);

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
          <Button variant="outline" asChild>
            <Link href="/login">Login / Sign Up</Link>
          </Button>
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
            <Button variant="outline" className="justify-start" asChild>
              <Link href="/login" onClick={closeMenu}>
                Login / Sign Up
              </Link>
            </Button>
          </div>
        </div>
      )}
    </nav>
  );
}