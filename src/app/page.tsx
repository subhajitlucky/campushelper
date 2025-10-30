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
    <main className="flex-1 bg-white">
      {/* Hero Section */}
      <section className="relative py-12 sm:py-16 lg:py-20 bg-gradient-to-b from-gray-50 to-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Column - Content */}
            <div className="text-center lg:text-left">
              <div className="inline-block px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded mb-6">
                Campus Lost & Found
              </div>
              
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
                Reunite people with their belongings
              </h1>
              
              <p className="text-base text-gray-600 mb-6 max-w-lg mx-auto lg:mx-0">
                Post what you&apos;ve lost, browse recent finds, and track resolved cases.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
                <Button asChild className="bg-gray-900 hover:bg-gray-800 text-white px-6 py-2">
                  <Link href="/post">
                    Report Item
                  </Link>
                </Button>
                <Button variant="outline" asChild className="border-gray-300 text-gray-700 hover:bg-gray-50 px-6 py-2">
                  <Link href="/search">
                    Browse Items
                  </Link>
                </Button>
              </div>
            </div>

            {/* Right Column - Stats Card */}
            <div className="lg:justify-self-end">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 w-full max-w-sm mx-auto lg:mx-0">
                <div className="text-center mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">Platform Stats</h3>
                  <p className="text-sm text-gray-600">Current activity</p>
                </div>
                
                <div className="grid grid-cols-2 gap-6 mb-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900 mb-1">120+</div>
                    <div className="text-xs text-gray-600">Items reunited</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900 mb-1">48h</div>
                    <div className="text-xs text-gray-600">Avg resolution</div>
                  </div>
                </div>
                
                <div className="space-y-3 pt-4 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Users</span>
                    <span className="text-sm font-medium text-gray-900">2,341</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Success rate</span>
                    <span className="text-sm font-medium text-gray-900">89%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Latest Items Section */}
      <section className="py-12 bg-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Recent Items
            </h2>
            <p className="text-sm text-gray-600">
              Recently reported items across campus
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 mb-8">
            {sampleItems.map((item) => (
              <div key={item.title} className="bg-white rounded border border-gray-200 p-4 hover:shadow-sm">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900 flex-1 pr-2">{item.title}</h3>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    item.status === 'Lost' 
                      ? 'bg-red-50 text-red-700 border border-red-200' 
                      : item.status === 'Found'
                      ? 'bg-green-50 text-green-700 border border-green-200'
                      : 'bg-blue-50 text-blue-700 border border-blue-200'
                  }`}>
                    {item.status}
                  </span>
                </div>
                <p className="text-xs text-gray-600 mb-3 leading-relaxed">{item.description}</p>
                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <span className="text-xs text-gray-500">{item.location}</span>
                  <Button variant="ghost" size="sm" asChild className="h-6 px-2 text-xs text-gray-600 hover:text-gray-900">
                    <Link href="/search">View</Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center">
            <Button asChild className="bg-gray-900 hover:bg-gray-800 text-white px-6 py-2 text-sm">
              <Link href="/search">View All</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-12 bg-gray-50">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              How It Works
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                number: '01',
                title: 'Report',
                description: 'Share details about lost or found items.',
              },
              {
                number: '02',
                title: 'Search',
                description: 'Browse items using filters to find matches.',
              },
              {
                number: '03',
                title: 'Connect',
                description: 'Contact owners or finders securely.',
              }
            ].map((step) => (
              <div key={step.number} className="text-center">
                <div className="w-8 h-8 bg-gray-900 text-white rounded-full flex items-center justify-center mx-auto mb-3 text-sm font-medium">
                  {step.number}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-sm text-gray-600">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
