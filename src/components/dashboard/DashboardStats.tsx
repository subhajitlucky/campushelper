import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, CheckCircle, Clock } from "lucide-react";

/**
 * DashboardStats Component
 *
 * PURPOSE:
 * - Shows quick stats about user's activity
 * - Displayed at top of dashboard
 * - Client component for smooth UI updates
 */
interface DashboardStatsProps {
  postedCount: number;
  claimedCount: number;
  pendingClaimsCount: number;
}

export default function DashboardStats({
  postedCount,
  claimedCount,
  pendingClaimsCount
}: DashboardStatsProps) {
  const stats = [
    {
      title: "Items Posted",
      value: postedCount,
      description: "Lost items you've reported",
      icon: Package,
      color: "text-blue-600"
    },
    {
      title: "Items Claimed",
      value: claimedCount,
      description: "Found items you've claimed",
      icon: CheckCircle,
      color: "text-green-600"
    },
    {
      title: "Pending Claims",
      value: pendingClaimsCount,
      description: "Claims awaiting your review",
      icon: Clock,
      color: "text-orange-600"
    }
  ];

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <Icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-gray-600 mt-1">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

/*
COMPONENT DESIGN:

1. Stateless:
   - Only receives data as props
   - No internal state or effects
   - Pure render function

2. Reusable:
   - Accepts any numbers as props
   - Works for any user's stats
   - Easy to modify or extend

3. Visual Hierarchy:
   - Large numbers for quick scanning
   - Icons for visual recognition
   - Color coding for different types

ALTERNATIVE APPROACHES:

1. Static (Current):
   - Good for simple displays
   - Easy to understand
   - Minimal re-renders

2. Animated Counters:
   - Add counting animation
   - More engaging but complex
   - Use for special occasions

3. Server Component:
   - Render HTML on server
   - Less client JavaScript
   - Harder to add animations

CURRENT CHOICE:
Server-rendered HTML + Client-side stats = Best of both worlds
*/
