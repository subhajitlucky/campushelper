'use client';

import { useSyncExternalStore } from 'react';
import { useTheme } from 'next-themes';
import { Monitor, Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Cycles light → dark → system.
 *
 * A single button rather than a dropdown: it is one control, it is fully
 * keyboard operable, and the current state is in the accessible name as well as
 * the icon.
 *
 * Hydration: the theme is only known on the client, so rendering an icon on the
 * server would either mismatch or flash the wrong one. `useSyncExternalStore`
 * with a false server snapshot is the supported way to express "client only"
 * without calling setState inside an effect (which the React Compiler lint rule
 * rejects, and which causes a cascading render).
 */

const OPTIONS = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'system', label: 'System', Icon: Monitor },
] as const;

const emptySubscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export default function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(emptySubscribe, getClientSnapshot, getServerSnapshot);

  if (!mounted) {
    return <div className={cn('size-9', className)} aria-hidden="true" />;
  }

  const current = theme ?? 'system';
  const index = Math.max(
    OPTIONS.findIndex((option) => option.value === current),
    0
  );
  const next = OPTIONS[(index + 1) % OPTIONS.length];
  const { Icon } = OPTIONS[index];

  return (
    <button
      type="button"
      onClick={() => setTheme(next.value)}
      aria-label={`Colour theme: ${current}. Activate for ${next.label}.`}
      title={`Theme: ${current} — switch to ${next.label}`}
      className={cn(
        'inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors',
        'hover:bg-accent hover:text-accent-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        className
      )}
    >
      <Icon className="size-5" aria-hidden="true" />
    </button>
  );
}
