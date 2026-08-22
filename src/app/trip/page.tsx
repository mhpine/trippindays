"use client";



import { useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
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
 const [isRemixing, setIsRemixing] = useState("");
const [selectedRemixes, setSelectedRemixes] = useState<string[]>([]);
  const [recentDestinations, setRecentDestinations] = useState<string[]>([]);
  function toggleRemix(type: string) {
  setSelectedRemixes((current) =>
    current.includes(type)
      ? current.filter((item) => item !== type)
      : [...current, type]
  );
}
useEffect(() => {
  const saved = localStorage.getItem("trippindays-recent-destinations");

  if (saved) {
    try {
      setRecentDestinations(JSON.parse(saved));
    } catch {
      setRecentDestinations([]);
    }
  }
}, []);
  const started = useRef(false);
const [user, setUser] = useState<User | null>(null);
const [isPremium, setIsPremium] = useState(false);
useEffect(() => {
  const supabase = createClient();

 supabase.auth.getUser().then(async ({ data }) => {
  const currentUser = data.user ?? null;
  setUser(currentUser);

  if (!currentUser) {
    setIsPremium(false);
    return;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_premium")
    .eq("id", currentUser.id)
    .single();

  setIsPremium(profile?.is_premium === true);
});

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    setUser(session?.user ?? null);
  });

  return () => {
    subscription.unsubscribe();
  };
}, []);
useEffect(() => {
  const supabase = createClient();

  async function checkPremium() {
    if (!user) {
      setIsPremium(false);
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("is_premium")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Premium check failed:", error);
      setIsPremium(false);
      return;
    }

    setIsPremium(data?.is_premium === true);
  }

  void checkPremium();
}, [user]);
  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const saved = localStorage.getItem("trippindays-request") || "";
    setRequest(saved);
const recentSaved =
  localStorage.getItem("trippindays-recent-destinations");

const recentForRequest: string[] = recentSaved
  ? JSON.parse(recentSaved)
  : [];
    if (!saved.trim()) {
      setError("No trip request was found. Return home and create a trip.");
      setIsLoading(false);
      return;
    }

    void buildTrip(saved, recentForRequest);
  }, []);

  const start = getValue(request, "Starting Location");
  const budget = getValue(request, "Budget") || "Not specified";
  const time = getValue(request, "Time Available") || "Not specified";
  const travelers = getValue(request, "Travelers") || "Not specified";

  const sections = useMemo(
    () => parsePlan(aiPlan, destination),
    [aiPlan, destination]
  );

  async function buildTrip(
  savedRequest: string,
  recentForRequest: string[]
) {
    try {
      setIsLoading(true);
      setError("");
      setSaveMessage("");

      const response = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
  tripRequest: savedRequest,
  recentDestinations: recentForRequest,
}),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not build your trip.");
      }

      setAiPlan(data.plan || "");
      setTripTitle(data.title || "Your TrippinDays Adventure");
      setDestination(data.destination || "");
     if (data.destination) {
  setRecentDestinations((current) => {
  const returnedDestinations = [
    data.destination,
    ...(Array.isArray(data.adventures)
      ? data.adventures.map((item: AdventureOption) => item.name)
      : []),
  ].filter(Boolean);

  const updated = [
    ...returnedDestinations,
    ...current.filter((item) => !returnedDestinations.includes(item)),
  ].slice(0, 30);

  localStorage.setItem(
    "trippindays-recent-destinations",
    JSON.stringify(updated)
  );

  return updated;
});
}
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
   
const supabase = createClient();

const {
  data: { session },
} = await supabase.auth.getSession();

if (!session?.user) {
  setSaveMessage("Create a free account to save your trip.");
 window.location.href = "/login?mode=signup&redirect=/trip";
  return;
}
 if (!aiPlan.trim()) {
      setSaveMessage("Build your trip before saving it.");
      return;
    }
try {

  const rawBudget = getValue(request, "Budget");

      const numericBudget = rawBudget
        ? Number(rawBudget.replace(/[^0-9.]/g, ""))
        : null;

      const { error: insertError } = await supabase.from("trips").insert({
        user_id: session.user.id,
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

      } catch (err) {
  const message =
    err instanceof Error ? err.message : "The trip could not be saved.";

  if (message.toLowerCase().includes("auth session missing")) {
    setSaveMessage("Create a free account to save your trip.");
    return;
  }

  setSaveMessage(message);
}

  }
 async function remixTrip(remixTypes: string[]) {
  if (!aiPlan.trim()) {
    setSaveMessage("Build a trip before remixing it.");
    return;
  }

 const remixInstructions: Record<string, string> = {
  cheaper:
    "Make this trip less expensive while keeping the best parts. Reduce unnecessary fuel, food, parking, admission, and activity costs. Favor free or low-cost alternatives.",

  romantic:
    "Remix this into a romantic adventure for a couple. Favor scenic stops, memorable meals, sunsets, intimate experiences, beautiful viewpoints, and relaxed pacing.",

  hiddenGems:
    "Remix this trip around hidden gems, unusual attractions, lesser-known viewpoints, quirky roadside stops, locally loved places, and experiences most tourists might miss.",

  adventure:
    "Make this trip more adventurous and exploratory. Add outdoor activities, interesting drives, unusual stops, hiking opportunities, and memorable experiences while staying realistic for the trip's time and budget.",

  rainyDay:
    "Remix this trip for rainy weather. Favor covered or indoor attractions, museums, scenic drives, interesting restaurants, indoor entertainment, and activities that still make the trip worthwhile in bad weather.",

  familyFriendly:
    "Remix this trip to be family friendly. Favor safe, fun, affordable activities suitable for families, reasonable driving times, accessible stops, food options, parks, attractions, and amusement parks when appropriate.",

  petFriendly:
    "Remix this trip to be pet friendly. Favor pet-friendly parks, trails, outdoor dining, lodging and attractions where appropriate. Avoid stops that generally prohibit pets and mention any likely leash or access restrictions.",

  adrenalineJunkie:
    "Remix this trip for an adrenaline seeker. Look for exciting experiences such as rafting, ziplining, climbing, mountain biking, off-road adventures, intense hikes, amusement rides, water sports, or other high-energy activities appropriate to the destination.",

  nightlife:
    "Remix this trip to include nightlife. Favor lively entertainment districts, live music, evening attractions, late-night food, comedy, dancing, bars or lounges when appropriate, and safe realistic evening transportation.",

  theArts:
    "Remix this trip around arts and culture. Favor museums, art galleries, live theater, architecture, public art, cultural districts, local music, artist communities, historic venues, and art festivals when available.",
};

 const instruction =
  remixTypes
    .map((type) => remixInstructions[type])
    .filter(Boolean)
    .join("\n\n") || "Create a fresh variation of this trip.";

 try {
  setIsRemixing(remixTypes.join(","));
  setSaveMessage("");
  setError("");
    const remixRequest = `
Starting Location: ${start || "Current location"}
Budget: ${budget}
Time Available: ${time}
Travelers: ${travelers}

Trip Request:
Remix my existing TrippinDays adventure.

Current Destination:
${destination}

REMIX STYLE:
${instruction}

IMPORTANT REMIX RULES:
You MUST noticeably change this itinerary based on every selected remix style.
Do not simply repeat the current itinerary.
Replace or modify several stops, activities, meals, timing, or routing when appropriate.
The new itinerary must clearly feel different while still respecting the original starting location, budget, travelers, and available time.

CURRENT ITINERARY:
${aiPlan}

Important:
Keep the trip realistic for the stated starting location, budget, travelers,
and available time.

Return a complete replacement itinerary with realistic driving times,
distances, costs, food, activities, parking, weather considerations,
return time, and RoadTunes music suggestions.
    `.trim();

    const response = await fetch("/api/plan", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tripRequest: remixRequest,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Could not remix your trip.");
    }

    setAiPlan(data.plan || aiPlan);
    setTripTitle(data.title || tripTitle);
    setDestination(data.destination || destination);
    setSummary(data.summary || summary);

    setRoundTripMiles(
      typeof data.roundTripMiles === "number"
        ? data.roundTripMiles
        : roundTripMiles
    );

    setWhySelected(
      Array.isArray(data.whySelected)
        ? data.whySelected
        : whySelected
    );

    setAdventures(
      Array.isArray(data.adventures)
        ? data.adventures
        : adventures
    );

    setMusicSuggestions(
      Array.isArray(data.musicSuggestions)
        ? data.musicSuggestions
        : musicSuggestions
    );

    setLiveChecks(data.liveChecks || liveChecks);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });

    setSaveMessage("✨ Your trip has been remixed!");
  } catch (err) {
    setSaveMessage(
      err instanceof Error
        ? err.message
        : "Could not remix your trip."
    );
  } finally {
    setIsRemixing("");
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
    {user ? (
  <button
    type="button"
    onClick={() => void saveTrip()}
    disabled={isSaving}
    className="rounded-2xl bg-emerald-500 px-6 py-4 font-black hover:bg-emerald-400 disabled:opacity-50"
  >
    {isSaving ? "Saving..." : "Create Account To Save"}
  </button>
) : (
  <button
    type="button"
 onClick={() => void saveTrip()}
    className="rounded-2xl bg-emerald-500 px-6 py-4 font-black hover:bg-emerald-400"
  >
    👤 Create Account to Save
  </button>
)}
              </div>
            </section>

            <section className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <SummaryCard icon="🏁" label="Starting Point" value={start || "Current location"} />
              <SummaryCard icon="💵" label="Budget" value={budget} />
              <SummaryCard icon="⏱️" label="Time Available" value={time} />
              <SummaryCard icon="👥" label="Travelers" value={travelers} />
              <SummaryCard
  icon="🚗"
  label="Round Trip"
  value={roundTripMiles !== null ? `${Math.round(roundTripMiles)} mi` : "—"}
/>
            </section>
 <section className="mt-8 rounded-3xl border border-amber-400/30 bg-amber-400/10 p-6">
  <div className="flex flex-col gap-4">
    <div>
      <p className="text-sm font-black uppercase tracking-widest text-amber-300">
        ⭐ Premium Adventure Builder
      </p>

      <h2 className="mt-2 text-2xl font-black">
        Remix My Trip
      </h2>

      <p className="mt-2 text-white/70">
        Change the style of your adventure without starting over.
        Choose one or more.
      </p>
    </div>

    <div
  className={`mx-auto grid w-full max-w-5xl grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 ${
    !isPremium ? "pointer-events-none opacity-40" : ""
  }`}
>

      <button
        type="button"
        onClick={() => toggleRemix("cheaper")}
        className={`min-h-[60px] w-full rounded-2xl border p-3 text-center font-bold ${
          selectedRemixes.includes("cheaper")
            ? "border-amber-300 bg-amber-400/20"
            : "border-white/10 bg-white/5 hover:bg-white/10"
        }`}
      >
        💰 Make It Cheaper
      </button>

      <button
        type="button"
        onClick={() => toggleRemix("romantic")}
        className={`min-h-[60px] w-full rounded-2xl border p-3 text-center font-bold ${
          selectedRemixes.includes("romantic")
            ? "border-amber-300 bg-amber-400/20"
            : "border-white/10 bg-white/5 hover:bg-white/10"
        }`}
      >
        💕 Romantic
      </button>

      <button
        type="button"
        onClick={() => toggleRemix("hiddenGems")}
        className={`min-h-[60px] w-full rounded-2xl border p-3 text-center font-bold ${
          selectedRemixes.includes("hiddenGems")
            ? "border-amber-300 bg-amber-400/20"
            : "border-white/10 bg-white/5 hover:bg-white/10"
        }`}
      >
        💎 Hidden Gems
      </button>

      <button
        type="button"
        onClick={() => toggleRemix("adventure")}
        className={`min-h-[60px] w-full rounded-2xl border p-3 text-center font-bold ${
          selectedRemixes.includes("adventure")
            ? "border-amber-300 bg-amber-400/20"
            : "border-white/10 bg-white/5 hover:bg-white/10"
        }`}
      >
        🧭 More Adventure
      </button>

      <button
        type="button"
        onClick={() => toggleRemix("rainyDay")}
        className={`min-h-[60px] w-full rounded-2xl border p-3 text-center font-bold ${
          selectedRemixes.includes("rainyDay")
            ? "border-amber-300 bg-amber-400/20"
            : "border-white/10 bg-white/5 hover:bg-white/10"
        }`}
      >
        🌧️ Rainy Day
      </button>

      <button
        type="button"
        onClick={() => toggleRemix("familyFriendly")}
        className={`min-h-[60px] w-full rounded-2xl border p-3 text-center font-bold ${
          selectedRemixes.includes("familyFriendly")
            ? "border-amber-300 bg-amber-400/20"
            : "border-white/10 bg-white/5 hover:bg-white/10"
        }`}
      >
        👨‍👩‍👧 Family Friendly
      </button>

      <button
        type="button"
        onClick={() => toggleRemix("petFriendly")}
        className={`min-h-[60px] w-full rounded-2xl border p-3 text-center font-bold ${
          selectedRemixes.includes("petFriendly")
            ? "border-amber-300 bg-amber-400/20"
            : "border-white/10 bg-white/5 hover:bg-white/10"
        }`}
      >
        🐾 Pet Friendly
      </button>

      <button
        type="button"
        onClick={() => toggleRemix("adrenalineJunkie")}
        className={`min-h-[60px] w-full rounded-2xl border p-3 text-center font-bold ${
          selectedRemixes.includes("adrenalineJunkie")
            ? "border-amber-300 bg-amber-400/20"
            : "border-white/10 bg-white/5 hover:bg-white/10"
        }`}
      >
        ⚡ Adrenaline Junkie
      </button>

      <button
        type="button"
        onClick={() => toggleRemix("nightlife")}
        className={`min-h-[60px] w-full rounded-2xl border p-3 text-center font-bold ${
          selectedRemixes.includes("nightlife")
            ? "border-amber-300 bg-amber-400/20"
            : "border-white/10 bg-white/5 hover:bg-white/10"
        }`}
      >
        🌙 Nightlife
      </button>

      <button
        type="button"
        onClick={() => toggleRemix("theArts")}
        className={`min-h-[60px] w-full rounded-2xl border p-3 text-center font-bold ${
          selectedRemixes.includes("theArts")
            ? "border-amber-300 bg-amber-400/20"
            : "border-white/10 bg-white/5 hover:bg-white/10"
        }`}
      >
        🎨 The Arts
      </button>

    </div>

    <button
      type="button"
      onClick={() => void remixTrip(selectedRemixes)}
      disabled={!isPremium || selectedRemixes.length === 0 || Boolean(isRemixing)}
      className="mx-auto mt-2 w-full max-w-5xl rounded-2xl bg-amber-400 px-6 py-4 font-black text-slate-950 hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {isRemixing ? "✨ Remixing Trip..." : "✨ Remix Selected Options"}
    </button>
    {!isPremium && (
  <div className="mt-3 text-center">
    <p className="font-bold text-amber-200">
      🔒 Remix My Trip is a Premium feature
    </p>

   <button
  type="button"
  onClick={async () => {
    const response = await fetch("/api/checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        plan: "yearly",
      }),
    });

    const data = await response.json();

    if (data.url) {
      window.location.href = data.url;
    }
  }}
  className="mt-2 inline-block rounded-xl bg-amber-400 px-5 py-3 font-black text-slate-950 hover:bg-amber-300"
>
  ⭐ Upgrade to Premium
</button>
  </div>
)}
  </div>
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
onClick={() => {
  window.location.assign("/login?mode=signup&redirect=/trip");
}}
  disabled={isSaving}
  className="rounded-2xl bg-emerald-500 px-6 py-4 font-black hover:bg-emerald-400 disabled:opacity-50"
>
  {isSaving
    ? "Saving..."
    : user
      ? "💾 Save Trip"
      : "👤 Create Account to Save"}
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
  <div className="mx-auto mt-5 max-w-3xl rounded-2xl bg-amber-500/15 p-4 text-center font-bold text-amber-200 break-words">
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
