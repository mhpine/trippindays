
"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type FeaturedTrip = {
  title: string;
  destination: string;
  region: string;
  description: string;
  image: string;
  estimatedCost: number;
  estimatedDriveTime: string;
  estimatedDistance: string;
  tripLength: string;
  difficulty: string;
  petFriendly: boolean;
  highlights: string[];
  packingList: string[];
  safetyNotes: string[];
};

const featuredTrip: FeaturedTrip = {
  title: "Mount Rainier Scenic Day Adventure",
  destination: "Mount Rainier National Park",
  region: "Washington",
  description:
    "A full-day mountain escape featuring waterfalls, alpine viewpoints, easy scenic walks, picnic stops, and memorable photo opportunities.",
  image: "/images/rainier.png",
  estimatedCost: 95,
  estimatedDriveTime: "About 2 hours each way",
  estimatedDistance: "About 95 miles each way",
  tripLength: "Full Day",
  difficulty: "Easy to Moderate",
  petFriendly: false,
  highlights: [
    "Paradise viewpoints",
    "Narada Falls",
    "Reflection Lakes",
    "Short scenic walks",
    "Mountain picnic stop",
    "Sunset photo opportunities",
  ],
  packingList: [
    "Water",
    "Layered clothing",
    "Rain jacket",
    "Comfortable walking shoes",
    "Phone charger",
    "Snacks or picnic lunch",
    "Camera",
  ],
  safetyNotes: [
    "Check current park road conditions before leaving.",
    "Weather can change quickly at higher elevations.",
    "Carry water and stay on marked trails.",
    "Verify entrance fees, closures, and reservation requirements.",
  ],
};

const relatedTrips = [
  {
    title: "Olympic Rainforest Escape",
    region: "Olympic Peninsula, Washington",
    emoji: "🌲",
    cost: 110,
  },
  {
    title: "Mount St. Helens Viewpoint Tour",
    region: "Southwest Washington",
    emoji: "🌋",
    cost: 85,
  },
  {
    title: "Columbia River Gorge Waterfalls",
    region: "Oregon",
    emoji: "💦",
    cost: 90,
  },
];

export default function FeaturedPage() {
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  function buildFeaturedRequest() {
    return `
Starting Location: Ask the traveler for their starting location if it is not already known.

Budget: $${featuredTrip.estimatedCost}

Time Available: ${featuredTrip.tripLength}

Travelers: Ask the traveler who is coming if not already known.

Trip Request:
Create a complete itinerary specifically for ${featuredTrip.destination}, ${featuredTrip.region}.

Include:
- realistic departure time
- estimated driving time and distance
- parking information
- entrance fees
- scenic stops
- easy walking options
- food recommendations
- total estimated cost
- return-home time
- packing suggestions
- safety notes

Featured highlights:
${featuredTrip.highlights.map((item) => `- ${item}`).join("\n")}
    `.trim();
  }

  function exploreAdventure() {
    localStorage.setItem(
      "trippindays-request",
      buildFeaturedRequest()
    );

    window.location.href = "/trip";
  }

  async function saveFeaturedTrip() {
    try {
      setIsSaving(true);
      setMessage("");

      const supabase = createClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        window.location.href = "/login?redirect=/featured";
        return;
      }

      const { error: insertError } = await supabase
        .from("trips")
        .insert({
          user_id: user.id,
          title: featuredTrip.title,
          starting_location: null,
          destination: featuredTrip.destination,
          budget: featuredTrip.estimatedCost,
          time_available: featuredTrip.tripLength,
          travelers: null,
          trip_request: buildFeaturedRequest(),
          itinerary:
            "Featured trip saved. Open Explore Adventure to generate the complete personalized itinerary.",
          status: "saved",
        });

      if (insertError) {
        throw insertError;
      }

      setMessage("Featured adventure saved to your account.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The featured trip could not be saved."
      );
    } finally {
      setIsSaving(false);
    }
  }

  function openGoogleMaps() {
    const url =
      "https://www.google.com/maps/dir/?api=1&" +
      new URLSearchParams({
        destination: featuredTrip.destination,
        travelmode: "driving",
        dir_action: "navigate",
      }).toString();

    window.open(url, "_blank", "noopener,noreferrer");
  }

  function openAppleMaps() {
    const url =
      "https://maps.apple.com/?" +
      new URLSearchParams({
        daddr: featuredTrip.destination,
        dirflg: "d",
      }).toString();

    window.open(url, "_blank", "noopener,noreferrer");
  }

  function openWaze() {
    const url =
      "https://www.waze.com/ul?" +
      new URLSearchParams({
        q: featuredTrip.destination,
        navigate: "yes",
      }).toString();

    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function shareAdventure() {
    try {
      if (navigator.share) {
        await navigator.share({
          title: featuredTrip.title,
          text: featuredTrip.description,
          url: window.location.href,
        });
        return;
      }

      await navigator.clipboard.writeText(window.location.href);
      setMessage("Featured adventure link copied.");
    } catch {
      setMessage("Sharing was cancelled.");
    }
  }

  function openRelatedTrip(
    title: string,
    region: string,
    cost: number
  ) {
    const request = `
Starting Location: Ask the traveler for their starting location.

Budget: $${cost}

Time Available: Full Day

Trip Request:
Create a complete itinerary specifically for ${title}, located in ${region}.

Include driving estimates, parking, fees, food, scenic stops, total cost, return time, packing suggestions, and safety notes.
    `.trim();

    localStorage.setItem("trippindays-request", request);
    window.location.href = "/trip";
  }

  return (
    <main className="min-h-screen bg-[#071426] text-white">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#071426]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <a href="/" className="text-3xl font-black tracking-tight">
            Trippin<span className="text-sky-400">Days</span>
          </a>

          <nav className="hidden items-center gap-8 text-sm font-bold text-white/65 md:flex">
            <a href="/" className="transition hover:text-white">
              Plan Trip
            </a>
            <a
              href="/featured"
              className="border-b-2 border-cyan-400 pb-2 text-white"
            >
              Featured
            </a>
            <a href="/passport" className="transition hover:text-white">
              Passport
            </a>
            <a href="/journal" className="transition hover:text-white">
              Journal
            </a>
          </nav>

          <a
            href="/login"
            className="rounded-full border border-white/20 px-5 py-2 font-black transition hover:bg-white/10"
          >
            Account
          </a>
        </div>
      </header>

      <section
        className="relative min-h-[620px] overflow-hidden bg-cover bg-center"
        style={{
          backgroundImage: `linear-gradient(90deg, rgba(3,12,28,.96) 0%, rgba(3,12,28,.72) 48%, rgba(3,12,28,.15) 80%), url('${featuredTrip.image}')`,
        }}
      >
        <div className="mx-auto flex min-h-[620px] max-w-7xl items-center px-6 py-16">
          <div className="max-w-3xl">
            <div className="inline-flex rounded-full border border-amber-300/30 bg-amber-400/10 px-4 py-2 text-sm font-black text-amber-200">
              ⭐ Featured Adventure
            </div>

            <h1 className="mt-6 text-5xl font-black leading-tight sm:text-6xl lg:text-7xl">
              {featuredTrip.title}
            </h1>

            <p className="mt-5 text-2xl font-bold text-cyan-200">
              📍 {featuredTrip.destination}, {featuredTrip.region}
            </p>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/75">
              {featuredTrip.description}
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <span className="rounded-full bg-white/10 px-4 py-2 font-bold">
                💰 About ${featuredTrip.estimatedCost}
              </span>
              <span className="rounded-full bg-white/10 px-4 py-2 font-bold">
                🚗 {featuredTrip.estimatedDriveTime}
              </span>
              <span className="rounded-full bg-white/10 px-4 py-2 font-bold">
                🕒 {featuredTrip.tripLength}
              </span>
              <span className="rounded-full bg-white/10 px-4 py-2 font-bold">
                🥾 {featuredTrip.difficulty}
              </span>
            </div>

            <div className="mt-9 flex flex-wrap gap-4">
              <button
                type="button"
                onClick={exploreAdventure}
                className="rounded-2xl bg-gradient-to-r from-cyan-400 to-sky-500 px-7 py-4 text-lg font-black text-slate-950 transition hover:scale-[1.02]"
              >
                Explore Adventure →
              </button>

              <button
                type="button"
                onClick={saveFeaturedTrip}
                disabled={isSaving}
                className="rounded-2xl border border-white/20 bg-white/10 px-7 py-4 text-lg font-black transition hover:bg-white/15 disabled:opacity-50"
              >
                {isSaving ? "Saving..." : "💾 Save Trip"}
              </button>
            </div>

            {message && (
              <p className="mt-5 rounded-2xl bg-white/10 px-5 py-4 font-bold text-cyan-200">
                {message}
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-6 lg:grid-cols-[1.25fr_.75fr]">
          <section className="rounded-[2rem] border border-white/10 bg-[#10263f] p-7 shadow-2xl">
            <p className="text-sm font-black uppercase tracking-[0.24em] text-cyan-300">
              Why we picked it
            </p>

            <h2 className="mt-3 text-3xl font-black">
              An unforgettable Washington day trip
            </h2>

            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              {featuredTrip.highlights.map((highlight) => (
                <div
                  key={highlight}
                  className="rounded-2xl bg-white/5 p-5 font-bold text-white/75"
                >
                  ✅ {highlight}
                </div>
              ))}
            </div>
          </section>

          <aside className="rounded-[2rem] border border-white/10 bg-[#10263f] p-7 shadow-2xl">
            <h2 className="text-2xl font-black">Trip Snapshot</h2>

            <div className="mt-6 space-y-5">
              {[
                ["Estimated Cost", `$${featuredTrip.estimatedCost}`],
                ["Drive Time", featuredTrip.estimatedDriveTime],
                ["Distance", featuredTrip.estimatedDistance],
                ["Trip Length", featuredTrip.tripLength],
                ["Difficulty", featuredTrip.difficulty],
                [
                  "Pet Friendly",
                  featuredTrip.petFriendly ? "Yes" : "Limited",
                ],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center justify-between gap-4 border-b border-white/10 pb-4"
                >
                  <span className="text-white/45">{label}</span>
                  <span className="text-right font-black">{value}</span>
                </div>
              ))}
            </div>
          </aside>
        </div>

        <section className="mt-6 rounded-[2rem] border border-cyan-400/20 bg-[#10263f] p-7 shadow-2xl">
          <h2 className="text-3xl font-black">🧭 Navigation Center</h2>

          <p className="mt-3 text-white/60">
            Launch directions in your preferred navigation app before you
            begin driving.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <button
              type="button"
              onClick={openGoogleMaps}
              className="rounded-2xl bg-blue-600 px-5 py-4 font-black transition hover:-translate-y-1 hover:bg-blue-500"
            >
              📍 Google Maps
            </button>

            <button
              type="button"
              onClick={openAppleMaps}
              className="rounded-2xl bg-slate-600 px-5 py-4 font-black transition hover:-translate-y-1 hover:bg-slate-500"
            >
              🍎 Apple Maps
            </button>

            <button
              type="button"
              onClick={openWaze}
              className="rounded-2xl bg-cyan-400 px-5 py-4 font-black text-slate-950 transition hover:-translate-y-1 hover:bg-cyan-300"
            >
              🚙 Waze
            </button>
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-[2rem] border border-white/10 bg-[#10263f] p-7 shadow-2xl">
            <h2 className="text-2xl font-black">🎒 What to Pack</h2>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {featuredTrip.packingList.map((item) => (
                <div
                  key={item}
                  className="rounded-2xl bg-white/5 p-4 font-bold text-white/70"
                >
                  • {item}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[2rem] border border-amber-300/20 bg-amber-400/10 p-7 shadow-2xl">
            <h2 className="text-2xl font-black text-amber-100">
              ⚠️ Before You Leave
            </h2>

            <div className="mt-6 space-y-3">
              {featuredTrip.safetyNotes.map((note) => (
                <p
                  key={note}
                  className="rounded-2xl bg-black/15 p-4 leading-7 text-amber-50/80"
                >
                  {note}
                </p>
              ))}
            </div>
          </section>
        </div>

        <section className="mt-6 rounded-[2rem] border border-white/10 bg-[#10263f] p-7 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.24em] text-cyan-300">
                More ideas
              </p>
              <h2 className="mt-2 text-3xl font-black">
                You may also like
              </h2>
            </div>

            <button
              type="button"
              onClick={shareAdventure}
              className="rounded-full border border-white/15 px-5 py-3 font-black transition hover:bg-white/10"
            >
              📤 Share Featured Trip
            </button>
          </div>

          <div className="mt-7 grid gap-5 md:grid-cols-3">
            {relatedTrips.map((trip) => (
              <button
                key={trip.title}
                type="button"
                onClick={() =>
                  openRelatedTrip(
                    trip.title,
                    trip.region,
                    trip.cost
                  )
                }
                className="rounded-3xl border border-white/10 bg-white/5 p-6 text-left transition hover:-translate-y-1 hover:bg-white/10"
              >
                <div className="text-5xl">{trip.emoji}</div>
                <h3 className="mt-5 text-2xl font-black">
                  {trip.title}
                </h3>
                <p className="mt-2 text-white/50">{trip.region}</p>
                <p className="mt-5 font-black text-cyan-300">
                  Explore itinerary →
                </p>
              </button>
            ))}
          </div>
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <button
            type="button"
            onClick={saveFeaturedTrip}
            className="rounded-2xl bg-emerald-500 px-5 py-4 font-black transition hover:bg-emerald-400"
          >
            💾 Save Trip
          </button>

          <a
            href="/journal"
            className="rounded-2xl bg-sky-500 px-5 py-4 text-center font-black transition hover:bg-sky-400"
          >
            📖 Create Journal
          </a>

          <a
            href="/passport"
            className="rounded-2xl border border-white/15 px-5 py-4 text-center font-black transition hover:bg-white/10"
          >
            🛂 View Passport
          </a>

          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-2xl border border-white/15 px-5 py-4 font-black transition hover:bg-white/10"
          >
            🖨 Print
          </button>
        </section>
      </section>
    </main>
  );
}