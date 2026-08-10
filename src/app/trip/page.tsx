"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type AdventureOption = {
  name: string;
  region: string;
  emoji: string;
  matchScore: number;
  estimatedDriveTime: string;
  estimatedDistance: string;
  estimatedCost: number;
  reason: string;
};

type LiveChecks = {
  checkedAt: string;
  location: string;
  latitude: number;
  longitude: number;
  temperature: number | null;
  feelsLike: number | null;
  windSpeed: number | null;
  precipitation: number | null;
  weatherCode: number | null;
  high: number | null;
  low: number | null;
  rainChance: number | null;
};

type Section = {
  title: string;
  emoji: string;
  lines: string[];
  navigationQuery: string | null;
};

export default function TripPage() {
  const [request, setRequest] = useState("");
 const [aiPlan, setAiPlan] = useState ("");
  const [tripTitle, setTripTitle] = useState("");
  const [destination, setDestination] = useState("");
  const [summary, setSummary] = useState("");
  const [roundTripMiles, setRoundTripMiles] = useState<number | null>(null);
  const [whySelected, setWhySelected] = useState<string[]>([]);
  const [musicSuggestions, setMusicSuggestions] = useState<
  { title: string; artist: string; reason: string }[]
>([]);
  const [adventures, setAdventures] = useState<AdventureOption[]>([]);
  const [liveChecks, setLiveChecks] = useState<LiveChecks | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const saved = localStorage.getItem("trippindays-request") || "";
    setRequest(saved);

    if (!saved.trim()) {
      setError("No trip request was found. Return home and create a trip.");
      setIsLoading(false);
      return;
    }

    void buildTrip(saved);
  }, []);

  const start = getValue(request, "Starting Location");
  const budget = getValue(request, "Budget") || "Not specified";
  const time = getValue(request, "Time Available") || "Not specified";
  const travelers = getValue(request, "Travelers") || "Not specified";

  const sections = useMemo(
    () => parsePlan(aiPlan, destination),
    [aiPlan, destination]
  );

  async function buildTrip(savedRequest: string) {
    try {
      setIsLoading(true);
      setError("");
      setSaveMessage("");

      const response = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripRequest: savedRequest }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not build your trip.");
      }

      setAiPlan(data.plan || "");
      setTripTitle(data.title || "Your TrippinDays Adventure");
      setDestination(data.destination || "");
      setSummary(data.summary || "");
      setRoundTripMiles(
  typeof data.roundTripMiles === "number"
    ? data.roundTripMiles
    : null
);
      setWhySelected(Array.isArray(data.whySelected) ? data.whySelected : []);
      setAdventures(Array.isArray(data.adventures) ? data.adventures : []);
      setMusicSuggestions(
  Array.isArray(data.musicSuggestions) ? data.musicSuggestions : []
)
      setLiveChecks(data.liveChecks || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not build your trip.");
    } finally {
      setIsLoading(false);
    }
  }

  function openAdventure(adventure: AdventureOption) {
    const nextRequest = `
Starting Location: ${start || "Use the original starting location"}
Budget: $${adventure.estimatedCost}
Time Available: ${time}
Travelers: ${travelers}

Trip Request:
Create a complete itinerary for ${adventure.name}, ${adventure.region}.
Include realistic times, mileage, parking, fees, activities, food, weather, total cost, return time, and free RoadTunes song suggestions.

Why selected:
${adventure.reason}
    `.trim();

    localStorage.setItem("trippindays-request", nextRequest);
    window.location.href = "/trip";
  }

  async function saveTrip() {
    if (!aiPlan.trim()) {
      setSaveMessage("Build your trip before saving it.");
      return;
    }

    try {
      setIsSaving(true);
      setSaveMessage("");

      const supabase = createClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!user) {
        window.location.href = "/login?redirect=/trip";
        return;
      }

      const rawBudget = getValue(request, "Budget");
      const numericBudget = rawBudget
        ? Number(rawBudget.replace(/[^0-9.]/g, ""))
        : null;

      const { error: insertError } = await supabase.from("trips").insert({
        user_id: user.id,
        title: tripTitle.trim() || destination.trim() || "My TrippinDays Adventure",
        starting_location: start || null,
        destination: destination.trim() || null,
        budget:
          numericBudget !== null && !Number.isNaN(numericBudget)
            ? numericBudget
            : null,
        time_available: getValue(request, "Time Available") || null,
        travelers: getValue(request, "Travelers") || null,
        trip_request: request,
        itinerary: aiPlan,
        status: "saved",
      });

      if (insertError) throw insertError;
      setSaveMessage("Adventure saved to your account!");
    } catch (err) {
      setSaveMessage(
        err instanceof Error ? err.message : "The trip could not be saved."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function shareTrip() {
    try {
      const text = [tripTitle, destination, summary].filter(Boolean).join("\n\n");

      if (navigator.share) {
        await navigator.share({
          title: tripTitle,
          text,
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(`${text}\n\n${window.location.href}`);
        setSaveMessage("Trip details copied to your clipboard.");
      }
    } catch {
      setSaveMessage("Sharing was cancelled.");
    }
  }

  function navigate(query = destination) {
    if (!query.trim()) {
      setSaveMessage("No destination is available for navigation.");
      return;
    }

    const params = new URLSearchParams({
      api: "1",
      destination: query,
      travelmode: "driving",
      dir_action: "navigate",
    });

    if (start.trim()) params.set("origin", start);

    window.location.href = `https://www.google.com/maps/dir/?${params.toString()}`;
  }
function openFoodNearby() {
  const destination = liveChecks?.location || "";

  const query = `restaurants near ${destination}`;

  const url =
    "https://www.google.com/maps/search/?" +
    new URLSearchParams({
      api: "1",
      query,
    }).toString();

  window.open(url, "_blank", "noopener,noreferrer");
}

function openGasNearby() {
  const destination = liveChecks?.location || "";

  const query = `gas stations near ${destination}`;

  const url =
    "https://www.google.com/maps/search/?" +
    new URLSearchParams({
      api: "1",
      query,
    }).toString();

  window.open(url, "_blank", "noopener,noreferrer");
}

function openWorshipNearby() {
  const destination = liveChecks?.location || "";

  const query = `places of worship near ${destination}`;

  const url =
    "https://www.google.com/maps/search/?" +
    new URLSearchParams({
      api: "1",
      query,
    }).toString();

  window.open(url, "_blank", "noopener,noreferrer");
}
function openMedicalNearby() {
  const destination = liveChecks?.location || "";

  const query = `hospitals and urgent care near ${destination}`;

  const url =
    "https://www.google.com/maps/search/?" +
    new URLSearchParams({
      api: "1",
      query,
    }).toString();

  window.open(url, "_blank", "noopener,noreferrer");
}
function openRoadConditions() {
  const destination = liveChecks?.location || "";

  const query = `current road conditions closures traffic near ${destination}`;

  const url =
    "https://www.google.com/search?" +
    new URLSearchParams({
      q: query,
    }).toString();

  window.open(url, "_blank", "noopener,noreferrer");
}
  return (
    <main className="min-h-screen bg-[#061426] text-white">
      <header className="border-b border-white/10 bg-[#061426]/90 px-6 py-5 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <a href="/" className="text-2xl font-black">
            Trippin<span className="text-sky-400">Days</span>
          </a>
          <a href="/" className="rounded-full border border-white/20 px-5 py-2 font-bold hover:bg-white/10">
            New Adventure
          </a>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-10">
        {isLoading && <LoadingPanel />}

        {error && !isLoading && (
          <section className="rounded-3xl border border-red-400/30 bg-red-500/10 p-8">
            <h1 className="text-3xl font-black">We couldn&apos;t build that trip</h1>
            <p className="mt-3 text-red-100/80">{error}</p>
            <a href="/" className="mt-6 inline-block rounded-2xl bg-sky-500 px-6 py-4 font-black">
              Return Home
            </a>
          </section>
        )}
{roundTripMiles !== null && (
  <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm text-center">
    <div className="text-sm font-semibold text-gray-500">
      🚗 ROUND TRIP
    </div>

    <div className="mt-1 text-3xl font-bold text-gray-900">
      {Math.round(roundTripMiles)} mi
    </div>
  </div>
)}
        {!isLoading && !error && aiPlan && (
          <>
  
            <section className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-blue-700 via-sky-700 to-slate-950 p-8 shadow-2xl">
              <p className="text-sm font-black uppercase tracking-[0.25em] text-sky-200">
                Your itinerary is ready
              </p>
              <h1 className="mt-4 text-4xl font-black sm:text-6xl">{tripTitle}</h1>
              <p className="mt-4 text-2xl font-bold text-sky-100">📍 {destination}</p>
              {summary && <p className="mt-5 max-w-3xl text-lg leading-8 text-white/80">{summary}</p>}
              <div className="mt-8 flex flex-wrap gap-3">
                <button onClick={() => navigate()} className="rounded-2xl bg-white px-6 py-4 font-black text-slate-950">
                  🧭 Start Navigation
                </button>
                <button onClick={() => void saveTrip()} disabled={isSaving} className="rounded-2xl bg-emerald-500 px-6 py-4 font-black disabled:opacity-50">
                  {isSaving ? "Saving..." : "💾 Save Trip"}
                </button>
              </div>
            </section>

            <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <SummaryCard icon="🏁" label="Starting Point" value={start || "Current location"} />
              <SummaryCard icon="💵" label="Budget" value={budget} />
              <SummaryCard icon="⏱️" label="Time Available" value={time} />
              <SummaryCard icon="👥" label="Travelers" value={travelers} />
            </section>

            <section className="mt-8 grid gap-6 lg:grid-cols-2">
              <div className="rounded-3xl border border-emerald-400/25 bg-emerald-500/10 p-7">
                <p className="text-sm font-black uppercase tracking-widest text-emerald-300">🏆 Why this trip fits</p>
                <h2 className="mt-3 text-3xl font-black">{destination}</h2>
                <div className="mt-5 space-y-3">
                  {(whySelected.length ? whySelected : ["Matches your request, budget, and available time."]).map((reason, index) => (
                    <p key={`${reason}-${index}`} className="rounded-2xl bg-black/20 p-4 text-white/80">
                      ✅ {reason}
                    </p>
                  ))}
                </div>
              </div>
<div className="grid gap-4 sm:grid-cols-2">
  <button
    type="button"
    onClick={openFoodNearby}
    className="rounded-3xl border border-white/10 bg-white/5 p-6 text-left transition hover:border-cyan-300/40 hover:bg-white/10"
  >
    <div className="text-3xl">🍽️</div>
    <h3 className="mt-3 text-xl font-black">Food Nearby</h3>
    <p className="mt-2 text-sm text-white/60">
      Find restaurants near your destination.
    </p>
    <p className="mt-4 text-sm font-black text-cyan-300">
      Open in Maps →
    </p>
  </button>

  <button
    type="button"
    onClick={openGasNearby}
    className="rounded-3xl border border-white/10 bg-white/5 p-6 text-left transition hover:border-cyan-300/40 hover:bg-white/10"
  >
    <div className="text-3xl">⛽</div>
    <h3 className="mt-3 text-xl font-black">Gas Nearby</h3>
    <p className="mt-2 text-sm text-white/60">
      Find fuel stops near your destination.
    </p>
    <p className="mt-4 text-sm font-black text-cyan-300">
      Open in Maps →
    </p>
  </button>

  <button
    type="button"
    onClick={openWorshipNearby}
    className="rounded-3xl border border-white/10 bg-white/5 p-6 text-left transition hover:border-cyan-300/40 hover:bg-white/10"
  >
    <div className="text-3xl">🙏</div>
    <h3 className="mt-3 text-xl font-black">Places of Worship</h3>
    <p className="mt-2 text-sm text-white/60">
      Find churches, temples, mosques, synagogues, and other places of worship nearby.
    </p>
    <p className="mt-4 text-sm font-black text-cyan-300">
      Explore Nearby →
    </p>
  </button>

  <button
    type="button"
    onClick={openMedicalNearby}
    className="rounded-3xl border border-white/10 bg-white/5 p-6 text-left transition hover:border-cyan-300/40 hover:bg-white/10"
  >
    <div className="text-3xl">🏥</div>
    <h3 className="mt-3 text-xl font-black">
      Hospitals & Urgent Care
    </h3>
    <p className="mt-2 text-sm text-white/60">
      Find hospitals, emergency rooms, and urgent care near your destination.
    </p>
    <p className="mt-4 text-sm font-black text-cyan-300">
      Open in Maps →
    </p>
  </button>

<button
  type="button"
  onClick={openRoadConditions}
  className="rounded-3xl border border-white/10 bg-white/5 p-6 text-left transition hover:border-cyan-300/40 hover:bg-white/10"
>
  <div className="text-3xl">🚧</div>

  <h3 className="mt-3 text-xl font-black">
    Road Conditions
  </h3>

  <p className="mt-2 text-sm text-white/60">
    Check current road conditions, closures, and traffic.
  </p>

  <p className="mt-4 text-sm font-black text-cyan-300">
    Check Roads →
  </p>
</button>
{musicSuggestions.length > 0 && (
  <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-left">
    <div className="text-3xl">🎵</div>

    <h3 className="mt-3 text-xl font-black">
      Music for the Trip
    </h3>

    <p className="mt-2 text-sm text-white/60">
      Songs picked to match your adventure.
    </p>

    <div className="mt-4 space-y-2">
      {musicSuggestions.map((song, index) => (
        <div key={index}>
          <p className="text-sm font-black">{song.title}</p>
          <p className="text-sm text-cyan-300">{song.artist}</p>
        </div>
      ))}
    </div>
  </div>
)}
</div>


              <WeatherPanel liveChecks={liveChecks} onNavigate={() => navigate()} />
            </section>

            <section className="mt-10">
              <p className="text-sm font-black uppercase tracking-widest text-sky-300">
                Your day, stop by stop
              </p>
              <h2 className="mt-2 text-4xl font-black">Adventure itinerary</h2>

              <div className="mt-6 space-y-5">
                {sections.map((section, index) => (
                  <ItineraryCard
                    key={`${section.title}-${index}`}
                    section={section}
                    index={index}
                    onNavigate={(query) => navigate(query)}
                  />
                ))}
              </div>
            </section>

            {adventures.length > 0 && (
              <section className="mt-10">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="text-sm font-black uppercase tracking-widest text-sky-300">
                      Other adventures
                    </p>
                    <h2 className="mt-2 text-4xl font-black">
                      More matches for your request
                    </h2>
                  </div>

                  <div className="rounded-full bg-sky-500/15 px-5 py-2 font-bold text-sky-200">
                    {adventures.length} choices
                  </div>
                </div>

                <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {adventures.map((adventure, index) => (
                    <AdventureCard
                      key={`${adventure.name}-${index}`}
                      adventure={adventure}
                      selected={index === 0}
                      onOpen={() => openAdventure(adventure)}
                    />
                  ))}
                </div>
              </section>
            )}

            <section className="mt-10 rounded-3xl border border-white/10 bg-white/5 p-8">
              <p className="text-sm font-black uppercase tracking-widest text-sky-300">
                Finish your adventure
              </p>

              <div className="mt-6 flex flex-wrap gap-4">
                <button
                  type="button"
                  onClick={() => void saveTrip()}
                  disabled={isSaving}
                  className="rounded-2xl bg-emerald-500 px-6 py-4 font-black hover:bg-emerald-400 disabled:opacity-50"
                >
                  {isSaving ? "Saving..." : "💾 Save Trip"}
                </button>

                <button
                  type="button"
                  onClick={() => navigate()}
                  className="rounded-2xl bg-blue-600 px-6 py-4 font-black hover:bg-blue-500"
                >
                  🧭 Start Entire Trip
                </button>

                <a href="/journal" className="rounded-2xl bg-sky-500 px-6 py-4 font-black">
                  📖 Create Journal
                </a>

                <a href="/passport" className="rounded-2xl border border-white/15 px-6 py-4 font-black">
                  🛂 View Passport
                </a>

                <button onClick={() => window.print()} className="rounded-2xl border border-white/15 px-6 py-4 font-black">
                  🖨 Print
                </button>

                <button onClick={() => void shareTrip()} className="rounded-2xl border border-white/15 px-6 py-4 font-black">
                  📤 Share
                </button>
              </div>

              {saveMessage && (
                <div
                  className={`mt-5 rounded-2xl p-4 font-bold ${
                    saveMessage.toLowerCase().includes("saved")
                      ? "bg-emerald-500/15 text-emerald-300"
                      : "bg-amber-500/15 text-amber-200"
                  }`}
                >
                  {saveMessage}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function SummaryCard({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
      <div className="text-3xl">{icon}</div>
      <p className="mt-4 text-xs font-black uppercase tracking-widest text-white/40">
        {label}
      </p>
      <p className="mt-2 text-lg font-black">{value}</p>
    </div>
  );
}

function ItineraryCard({
  section,
  index,
  onNavigate,
}: {
  section: Section;
  index: number;
  onNavigate: (query: string) => void;
}) {
  return (
    <article className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl">
      <div className="flex items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-sky-400/15 text-3xl">
          {section.emoji}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-sky-300">
            Stop {index + 1}
          </p>
          <h3 className="mt-2 text-2xl font-black">{section.title}</h3>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {section.lines.map((line, lineIndex) => (
          <p
            key={`${line}-${lineIndex}`}
            className="rounded-2xl bg-black/20 p-4 leading-7 text-white/80"
          >
            {decorateLine(line)}
          </p>
        ))}
      </div>

      {section.navigationQuery && (
        <button
          type="button"
          onClick={() => onNavigate(section.navigationQuery!)}
          className="mt-5 w-full rounded-2xl bg-blue-600 px-5 py-4 font-black hover:bg-blue-500"
        >
          🧭 Navigate Here
        </button>
      )}
    </article>
  );
}

function AdventureCard({
  adventure,
  selected,
  onOpen,
}: {
  adventure: AdventureOption;
  selected: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`relative w-full rounded-3xl border p-6 text-left transition hover:-translate-y-1 hover:shadow-2xl ${
        selected
          ? "border-emerald-400/50 bg-emerald-500/10"
          : "border-white/10 bg-white/5"
      }`}
    >
      {selected && (
        <div className="absolute right-4 top-4 rounded-full bg-emerald-400 px-3 py-1 text-xs font-black text-slate-950">
          AI PICK
        </div>
      )}

      <div className="text-5xl">{adventure.emoji || "🚗"}</div>
      <h3 className="mt-4 pr-16 text-2xl font-black">{adventure.name}</h3>
      <p className="mt-1 text-white/55">{adventure.region}</p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <InfoCard label="Match" value={`${adventure.matchScore}/100`} />
        <InfoCard label="Cost" value={`$${adventure.estimatedCost}`} />
        <InfoCard label="Drive" value={adventure.estimatedDriveTime} />
        <InfoCard label="Distance" value={adventure.estimatedDistance} />
      </div>

      <p className="mt-5 leading-7 text-white/70">{adventure.reason}</p>
      <div className="mt-6 font-black text-sky-300">Build This Trip →</div>
    </button>
  );
}

function WeatherPanel({
  liveChecks,
  onNavigate,
}: {
  liveChecks: LiveChecks | null;
  onNavigate: () => void;
}) {
  if (!liveChecks) {
    return (
      <div className="rounded-3xl border border-yellow-300/20 bg-yellow-400/10 p-7 text-yellow-100">
        <p className="text-sm font-black uppercase tracking-widest">Live weather</p>
        <h2 className="mt-3 text-2xl font-black">Weather location unavailable</h2>
        <p className="mt-3 leading-7">Check current conditions before leaving.</p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-sky-400/25 bg-sky-500/10 p-7">
      <p className="text-sm font-black uppercase tracking-widest text-sky-300">
        Live destination weather
      </p>
      <h2 className="mt-3 text-3xl font-black">{liveChecks.location}</h2>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <InfoCard label="Temperature" value={formatTemperature(liveChecks.temperature)} />
        <InfoCard label="Feels Like" value={formatTemperature(liveChecks.feelsLike)} />
        <InfoCard
          label="High / Low"
          value={
            liveChecks.high === null || liveChecks.low === null
              ? "Unavailable"
              : `${Math.round(liveChecks.high)}° / ${Math.round(liveChecks.low)}°`
          }
        />
        <InfoCard
          label="Rain Chance"
          value={liveChecks.rainChance === null ? "Unavailable" : `${liveChecks.rainChance}%`}
        />
      </div>

      <button
        type="button"
        onClick={onNavigate}
        className="mt-5 w-full rounded-2xl bg-sky-500 px-5 py-4 font-black"
      >
        🧭 Start Navigation
      </button>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-black/20 p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-white/45">
        {label}
      </p>
      <p className="mt-2 font-black">{value}</p>
    </div>
  );
}

function LoadingPanel() {
  return (
    <section className="rounded-3xl border border-sky-400/20 bg-sky-500/10 p-10 text-center">
      <div className="animate-bounce text-7xl">🧭</div>
      <h1 className="mt-5 text-4xl font-black">Finding Your Best Adventure</h1>

      <div className="mx-auto mt-8 max-w-md space-y-3 text-left text-lg">
        <p>🧠 Understanding your request</p>
        <p>📍 Comparing destinations</p>
        <p>💰 Matching your budget</p>
        <p>🚗 Estimating the drive</p>
        <p>🌤️ Checking live weather</p>
        <p>🎵 Building RoadTunes suggestions</p>
      </div>
    </section>
  );
}

function getValue(text: string, label: string) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = text.match(new RegExp(`^${escaped}:\\s*(.+)$`, "im"));
  return match?.[1]?.trim() || "";
}

function parsePlan(plan: string, fallbackDestination: string): Section[] {
  const lines = plan
    .replace(/\r/g, "")
    .split("\n")
    .map((line) =>
      line
        .trim()
        .replace(/^#{1,6}\s*/, "")
        .replace(/^\*\*(.+)\*\*$/, "$1")
    )
    .filter(Boolean);

  if (!lines.length) return [];

  const sections: Section[] = [];
  let current: Section | null = null;

  for (const raw of lines) {
    const line = raw.trim();

    if (isHeading(line)) {
      if (current && current.lines.length) sections.push(current);

      const title = cleanHeading(line);

      current = {
        title,
        emoji: chooseEmoji(title),
        lines: [],
        navigationQuery: navigationQuery(title),
      };

      continue;
    }

    if (!current) {
      current = {
        title: fallbackDestination || "Adventure Overview",
        emoji: "🚗",
        lines: [],
        navigationQuery: fallbackDestination || null,
      };
    }

    current.lines.push(line.replace(/^[-•]\s*/, ""));
  }

  if (current) sections.push(current);

  const useful = sections
    .filter((section) => section.lines.length)
    .slice(0, 12);

  return useful.length
    ? useful
    : [
        {
          title: fallbackDestination || "Your Adventure",
          emoji: "🚗",
          lines,
          navigationQuery: fallbackDestination || null,
        },
      ];
}

function isHeading(line: string) {
  return (
    /^\d{1,2}(:\d{2})?\s*(AM|PM)?\s*[-–—:]/i.test(line) ||
    /^(morning|afternoon|evening|breakfast|lunch|dinner|departure|arrival|return|stop\s*\d+|day\s*\d+|roadtunes|weather|cost|budget|check before leaving)/i.test(
      line
    ) ||
    (line.length < 70 && /:$/.test(line))
  );
}

function cleanHeading(line: string) {
  return line.replace(/:$/, "").replace(/^\d+\.\s*/, "").trim();
}

function navigationQuery(title: string) {
  const cleaned = title
    .replace(/^\d{1,2}(:\d{2})?\s*(AM|PM)?\s*[-–—:]\s*/i, "")
    .replace(
      /^(stop\s*\d+|morning|afternoon|evening|breakfast|lunch|dinner|departure|arrival)\s*[-–—:]\s*/i,
      ""
    )
    .trim();

  if (
    !cleaned ||
    /^(weather|roadtunes|cost|budget|check before leaving|return home)$/i.test(
      cleaned
    )
  ) {
    return null;
  }

  return cleaned;
}

function chooseEmoji(title: string) {
  const value = title.toLowerCase();

  if (/breakfast|lunch|dinner|food/.test(value)) return "🍽️";
  if (/waterfall|falls/.test(value)) return "💦";
  if (/ghost|historic/.test(value)) return "👻";
  if (/church|worship|cathedral|temple/.test(value)) return "⛪";
  if (/hike|trail|walk/.test(value)) return "🥾";
  if (/weather|check before/.test(value)) return "🌤️";
  if (/music|roadtunes|song/.test(value)) return "🎵";
  if (/cost|budget/.test(value)) return "💵";
  if (/return|home/.test(value)) return "🏠";

  return "📍";
}

function decorateLine(line: string) {
  if (/^(estimated|cost|price|budget)/i.test(line)) return `💵 ${line}`;
  if (/^(drive|distance|travel|depart|arrive)/i.test(line)) return `🚗 ${line}`;
  if (/^(why|reason|best|highlight)/i.test(line)) return `⭐ ${line}`;
  if (/^(warning|alert|check|closure)/i.test(line)) return `⚠️ ${line}`;
  return line;
}

function formatTemperature(value: number | null) {
  return value === null ? "Unavailable" : `${Math.round(value)}°F`;
}