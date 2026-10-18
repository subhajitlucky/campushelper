'use client';

import { Award, Shield, ShieldCheck, Sprout, Trophy } from 'lucide-react';
import { reputationTier, type ReputationTier } from '@/lib/reputation';
import { cn } from '@/lib/utils';

/**
 * Reputation tier badge.
 *
 * The tier is derived from the user's total, so the badge cannot disagree with
 * the ledger. Icons are resolved through an explicit map rather than a dynamic
 * lookup so the bundle only carries the five icons actually used.
 */

const TIER_ICONS: Record<string, typeof Sprout> = {
  Sprout,
  Shield,
  ShieldCheck,
  Award,
  Trophy,
};

interface ReputationBadgeProps {
  /** The user's reputation total. */
  total: number;
  /** Render the numeric total beside the tier name. */
  showPoints?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

function Icon({ tier }: { tier: ReputationTier }) {
  const Component = TIER_ICONS[tier.icon] ?? Sprout;
  return <Component className="h-3 w-3" aria-hidden="true" />;
}

export default function ReputationBadge({
  total,
  showPoints = false,
  size = 'sm',
  className,
}: ReputationBadgeProps) {
  const tier = reputationTier(total);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border font-medium',
        tier.className,
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
        className
      )}
      // Screen readers get the full meaning; the visual is just the tier name.
      title={`${tier.name} — ${total} reputation point${total === 1 ? '' : 's'}`}
    >
      <Icon tier={tier} />
      {tier.name}
      {showPoints && <span className="tabular-nums opacity-75">({total})</span>}
    </span>
  );
}
