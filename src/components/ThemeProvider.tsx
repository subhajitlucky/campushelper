'use client';

import { ThemeProvider as NextThemes } from 'next-themes';

/**
 * Theme provider.
 *
 * `attribute="class"` is required: globals.css keys dark mode off
 * `@custom-variant dark (&:is(.dark *))`, so the theme is applied as a class on
 * <html>. `disableTransitionOnChange` suppresses the colour-transition flash
 * that would otherwise sweep the page when the theme flips.
 *
 * `defaultTheme="system"` means a first-time visitor gets whatever their OS
 * prefers rather than being forced into light.
 */
export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemes
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemes>
  );
}
