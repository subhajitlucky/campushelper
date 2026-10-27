'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

import DashboardStats, { type DashboardStat } from '@/components/dashboard/DashboardStats';
import IncomingClaimsSection from '@/components/IncomingClaimsSection';
import UserClaimsSection from '@/components/UserClaimsSection';
import UserItemsSection from '@/components/UserItemsSection';
import UserProfileSection from '@/components/UserProfileSection';
import { cn } from '@/lib/utils';

import { DashboardShellSkeleton } from './loading';

const TABS = [
  { id: 'items', label: 'My items' },
  { id: 'claims', label: 'My claims' },
  { id: 'incoming', label: 'Incoming claims' },
] as const;

type DashboardTab = (typeof TABS)[number]['id'];

interface StatsPayload {
  myItems: number;
  claimsMade: number;
  resolvedItems: number;
  thisWeek: number;
}

/**
 * Dashboard — protected route.
 *
 * The page is three flat bands instead of a stack of panels: the profile
 * `PageHeader`, a strip of four numbers, then an underline tab set whose panels
 * are each introduced by a `SectionHeader`. That replaces five bordered
 * containers at the top of the old page (four stat `Card`s and a `Quick Actions`
 * box) with no containers at all — the actions they held now live in the
 * header, and search moved into the items section.
 *
 * Tabs are a real tab set, not styled buttons: `role="tab"` / `aria-selected`
 * with roving `tabIndex`, arrow/Home/End keys, and `role="tabpanel"` panels
 * wired back with `aria-controls` / `aria-labelledby`. All three panels stay
 * mounted (inactive ones are `hidden`), so switching tabs never refetches and a
 * half-finished approve/reject flow survives a look at another tab.
 */
export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [userStats, setUserStats] = useState<StatsPayload>({
    myItems: 0,
    claimsMade: 0,
    resolvedItems: 0,
    thisWeek: 0,
  });
  /**
   * Taken from `postedBy.reputation` on the user's own item rows — there is no
   * endpoint that returns the signed-in user's total. Falls back to 0, which is
   * where every account starts.
   */
  const [reputation, setReputation] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<DashboardTab>('items');
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // Handover notifications link to the tab that has the action: the poster's
  // "Incoming claims" or the claimer's "My claims". Read the query on mount so
  // those links land on the right panel without adding a Suspense boundary.
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('tab');
    if (TABS.some((tab) => tab.id === requested)) {
      setActiveTab(requested as DashboardTab);
    }
  }, []);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login?callbackUrl=/dashboard');
    }
  }, [status, router]);

  // Fetch real user stats from API
  const fetchUserStats = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch user's items using postedById filter
      const itemsResponse = await fetch(`/api/items?postedById=${session?.user?.id}&limit=100`);
      if (itemsResponse.ok) {
        const itemsData = await itemsResponse.json();
        const items: Array<{
          status: string;
          createdAt: string;
          postedBy?: { reputation?: number | null } | null;
        }> = itemsData.items || [];

        // Calculate item stats from real data
        const myItems = items.length;
        const resolvedItems = items.filter(
          (item) => item.status === 'RESOLVED' || item.status === 'CLAIMED'
        ).length;

        // Calculate this week's items
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        const thisWeek = items.filter((item) => new Date(item.createdAt) > oneWeekAgo).length;

        // Either own row carries the same denormalised total.
        const withReputation = items.find(
          (item) => typeof item.postedBy?.reputation === 'number'
        );
        if (withReputation?.postedBy?.reputation !== undefined) {
          setReputation(withReputation.postedBy.reputation ?? 0);
        }

        // Fetch user's claims
        let claimsMade = 0;
        try {
          const claimsResponse = await fetch(`/api/claims?userId=${session?.user?.id}`);
          if (claimsResponse.ok) {
            const claimsData = await claimsResponse.json();
            claimsMade = claimsData.claims?.length || 0;
          }
        } catch {
          // A missing claims count must not blank the rest of the stats.
        }

        setUserStats({
          myItems,
          resolvedItems,
          thisWeek,
          claimsMade,
        });
      }
    } catch {
      // Keep default values on error
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

  // Fetch user stats when authenticated
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.id) {
      fetchUserStats();
    }
  }, [status, session?.user?.id, fetchUserStats]);

  /** Arrow keys move between tabs, as the tab pattern requires. */
  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const lastIndex = TABS.length - 1;
    let nextIndex: number | null = null;

    switch (event.key) {
      case 'ArrowRight':
        nextIndex = index === lastIndex ? 0 : index + 1;
        break;
      case 'ArrowLeft':
        nextIndex = index === 0 ? lastIndex : index - 1;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = lastIndex;
        break;
      default:
        return;
    }

    event.preventDefault();
    setActiveTab(TABS[nextIndex].id);
    tabRefs.current[nextIndex]?.focus();
  };

  // Show skeletons of the real layout while checking auth or fetching data
  if (status === 'loading' || (status === 'authenticated' && loading)) {
    return <DashboardShellSkeleton />;
  }

  // Don't render if not authenticated
  if (status === 'unauthenticated') {
    return null;
  }

  const userId = session?.user?.id || '';
  const stats: DashboardStat[] = [
    { label: 'Items posted', value: userStats.myItems },
    { label: 'Claims submitted', value: userStats.claimsMade },
    { label: 'Items resolved', value: userStats.resolvedItems },
    { label: 'New this week', value: userStats.thisWeek },
  ];

  return (
    <main className="page-canvas min-h-screen pb-24 pt-10 sm:pt-14">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="rise-in space-y-10">
          <UserProfileSection reputation={reputation} />

          <DashboardStats stats={stats} />

          <div>
            <div
              role="tablist"
              aria-label="Dashboard sections"
              className="flex gap-6 overflow-x-auto border-b border-border sm:gap-8"
            >
              {TABS.map((tab, index) => {
                const selected = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    ref={(node) => {
                      tabRefs.current[index] = node;
                    }}
                    type="button"
                    role="tab"
                    id={`tab-${tab.id}`}
                    aria-selected={selected}
                    aria-controls={`panel-${tab.id}`}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => setActiveTab(tab.id)}
                    onKeyDown={(event) => handleTabKeyDown(event, index)}
                    className={cn(
                      '-mb-px whitespace-nowrap rounded-t-sm border-b-2 px-0.5 pb-3 pt-1',
                      'text-sm font-medium transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                      selected
                        ? 'border-primary text-foreground'
                        : 'border-transparent text-muted-foreground hover:border-border-strong hover:text-foreground'
                    )}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {TABS.map((tab) => (
              <div
                key={tab.id}
                role="tabpanel"
                id={`panel-${tab.id}`}
                aria-labelledby={`tab-${tab.id}`}
                hidden={activeTab !== tab.id}
                className="pt-8"
              >
                {tab.id === 'items' && <UserItemsSection userId={userId} />}
                {tab.id === 'claims' && <UserClaimsSection userId={userId} />}
                {tab.id === 'incoming' && (
                  <IncomingClaimsSection userId={userId} onGoToItems={() => setActiveTab('items')} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
