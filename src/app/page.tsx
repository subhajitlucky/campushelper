import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const sampleItems = [
  {
    title: "Navy Backpack",
    status: "Lost",
    location: "Library Study Hall",
    date: "Oct 18, 2025",
    description: "Contains a silver laptop and calculus notebook.",
  },
  {
    title: "AirPods Case",
    status: "Found",
    location: "Engineering Block B",
    date: "Oct 19, 2025",
    description: "White case with a lightning sticker.",
  },
  {
    title: "ID Card",
    status: "Resolved",
    location: "Student Center Desk",
    date: "Oct 17, 2025",
    description: "Claimed by owner. Check here for resolved stories.",
  },
];

export default function Home() {
  return (
    <main className="flex-1 bg-muted/20">
      {/* Hero Section */}
      <section className="border-b bg-gradient-to-br from-primary/10 via-white to-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-3 py-12 sm:gap-8 sm:px-4 sm:py-16 md:flex-row md:items-center md:justify-between md:gap-10 md:py-20 lg:py-24 xl:px-6">
          <div className="max-w-xl space-y-4 text-center sm:space-y-6 md:text-left">
            <p className="text-xs font-semibold text-primary sm:text-sm">Campus lost & found made simple</p>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl md:text-4xl lg:text-5xl">
              Reunite people with their belongings faster than the campus rumor mill.
            </h1>
            <p className="text-sm text-muted-foreground sm:text-base md:text-lg">
              Post what you&apos;ve lost, browse recent finds, and track resolved cases in a single portal
              built for students and staff.
            </p>
            <div className="flex flex-col gap-2 sm:gap-3 sm:flex-row sm:justify-center md:justify-start">
              <Button size="sm" asChild className="sm:size-base md:size-lg">
                <Link href="/post">Report an Item</Link>
              </Button>
              <Button variant="outline" size="sm" asChild className="sm:size-base md:size-lg">
                <Link href="/search">Browse all listings</Link>
              </Button>
            </div>
          </div>

          <div className="w-full max-w-md gap-4 rounded-2xl bg-white p-4 shadow-lg ring-1 ring-black/5 sm:gap-6 sm:p-6">
            <div className="grid grid-cols-2 gap-4 text-center sm:gap-6">
              <div>
                <p className="text-2xl font-semibold text-gray-900 sm:text-3xl">120+</p>
                <p className="text-xs text-muted-foreground sm:text-sm">Items reunited</p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-gray-900 sm:text-3xl">48h</p>
                <p className="text-xs text-muted-foreground sm:text-sm">Average resolve time</p>
              </div>
            </div>
            <div className="space-y-2 sm:space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide sm:text-sm">
                Trending items
              </p>
              <ul className="space-y-1 text-xs text-gray-700 sm:space-y-2 sm:text-sm">
                <li>• Hydroflask spotted near Arts Quad</li>
                <li>• Calculus textbook found in Lab 204</li>
                <li>• Hoodie claimed from Dorm C lobby</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Latest Updates Section */}
      <section className="mx-auto flex max-w-6xl flex-col gap-6 px-3 py-12 sm:gap-8 sm:px-4 sm:py-16 lg:px-6">
        <div className="flex flex-col gap-3 sm:gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl space-y-1 sm:space-y-2">
            <h2 className="text-xl font-semibold text-gray-900 sm:text-2xl md:text-3xl">Latest updates</h2>
            <p className="text-xs text-muted-foreground sm:text-sm md:text-base">
              A snapshot of what&apos;s recently reported. Sign in to view more details and get notified when
              matches appear.
            </p>
          </div>
          <Button variant="ghost" size="sm" asChild className="w-fit sm:size-base">
            <Link href="/resolved">See resolved stories</Link>
          </Button>
        </div>

        <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {sampleItems.map((item) => (
            <Card key={item.title} className="border-muted bg-white flex flex-col">
              <CardHeader className="pb-3 sm:pb-4">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-lg font-semibold text-gray-900 sm:text-xl">{item.title}</CardTitle>
                  <span className="rounded-full border px-2 py-1 text-xs font-semibold uppercase tracking-wide text-primary whitespace-nowrap">
                    {item.status}
                  </span>
                </div>
                <CardDescription className="text-xs sm:text-sm">
                  {item.location} · {item.date}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 sm:gap-4 flex-grow">
                <p className="text-xs text-gray-700 sm:text-sm">{item.description}</p>
                <Button variant="secondary" size="sm" asChild className="w-full mt-auto">
                  <Link href="/search">View details</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* How It Works Section */}
      <section className="border-t bg-white">
        <div className="mx-auto grid max-w-6xl gap-6 px-3 py-12 sm:gap-8 sm:px-4 sm:py-16 md:grid-cols-3 lg:px-6">
          {["Report", "Verify", "Reconnect"].map((step, index) => (
            <div key={step} className="space-y-2 sm:space-y-3">
              <span className="inline-flex size-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary sm:size-10 sm:text-sm">
                {index + 1}
              </span>
              <h3 className="text-base font-semibold text-gray-900 sm:text-lg">{step}</h3>
              <p className="text-xs text-muted-foreground sm:text-sm leading-relaxed">
                {index === 0 && "Share details and photos in under a minute so others can help keep an eye out."}
                {index === 1 && "We verify campus email and activity to keep listings trusted and actionable."}
                {index === 2 && "Chat with the finder securely and mark the item resolved once it is back with you."}
              </p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
