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
      <section className="border-b bg-gradient-to-br from-primary/10 via-white to-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-20 md:flex-row md:items-center md:justify-between lg:py-24">
          <div className="max-w-xl space-y-6 text-center md:text-left">
            <p className="text-sm font-semibold text-primary">Campus lost & found made simple</p>
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              Reunite people with their belongings faster than the campus rumor mill.
            </h1>
            <p className="text-lg text-muted-foreground">
              Post what you&apos;ve lost, browse recent finds, and track resolved cases in a single portal
              built for students and staff.
            </p>
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center md:justify-start">
              <Button size="lg" asChild>
                <Link href="/post">Report an Item</Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link href="/search">Browse all listings</Link>
              </Button>
            </div>
          </div>

          <div className="grid w-full max-w-md gap-6 rounded-2xl bg-white p-6 shadow-lg ring-1 ring-black/5">
            <div className="grid grid-cols-2 gap-6 text-center">
              <div>
                <p className="text-3xl font-semibold text-gray-900">120+</p>
                <p className="text-sm text-muted-foreground">Items reunited</p>
              </div>
              <div>
                <p className="text-3xl font-semibold text-gray-900">48h</p>
                <p className="text-sm text-muted-foreground">Average resolve time</p>
              </div>
            </div>
            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Trending items
              </p>
              <ul className="space-y-2 text-sm text-gray-700">
                <li>• Hydroflask spotted near Arts Quad</li>
                <li>• Calculus textbook found in Lab 204</li>
                <li>• Hoodie claimed from Dorm C lobby</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-16">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl space-y-2">
            <h2 className="text-2xl font-semibold text-gray-900">Latest updates</h2>
            <p className="text-muted-foreground">
              A snapshot of what&apos;s recently reported. Sign in to view more details and get notified when
              matches appear.
            </p>
          </div>
          <Button variant="ghost" asChild>
            <Link href="/resolved">See resolved stories</Link>
          </Button>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {sampleItems.map((item) => (
            <Card key={item.title} className="border-muted bg-white">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-xl text-gray-900">{item.title}</CardTitle>
                  <span
                    className="rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary"
                  >
                    {item.status}
                  </span>
                </div>
                <CardDescription>
                  {item.location} · {item.date}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-700">{item.description}</p>
                <Button variant="secondary" asChild>
                  <Link href="/search">View details</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="border-t bg-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 md:grid-cols-3">
          {["Report", "Verify", "Reconnect"].map((step, index) => (
            <div key={step} className="space-y-3">
              <span className="inline-flex size-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                {index + 1}
              </span>
              <h3 className="text-lg font-semibold text-gray-900">{step}</h3>
              <p className="text-sm text-muted-foreground">
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
