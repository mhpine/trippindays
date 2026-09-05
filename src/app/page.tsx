"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type TripCard = {
  label: string;
  title: string;
  description: string;
  duration: string;
  distance: string;
  cost: string;
  image: string;
  prompt: string;
};

const tripCards: TripCard[] = [
  {
    label: "DAY TRIP",
    title: "Waterfalls & Burgers",
    description:
      "Scenic waterfalls, short hikes, and a great local meal.",
    duration: "6 hrs",
    distance: "92 mi",
    cost: "~$78",
    image:
      "https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?auto=format&fit=crop&w=1200&q=85",
    prompt:
      "Plan me a day trip with waterfalls, short hikes, scenic views, and a great local burger.",
  },
  {
    label: "OVERNIGHT",
    title: "Coastal Escape",
    description:
      "Ocean views, fresh seafood, and unforgettable sunsets.",
    duration: "2 days",
    distance: "160 mi",
    cost: "~$196",
    image:
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=85",
    prompt:
      "Plan me an overnight coastal escape with ocean scenery, seafood, and a beautiful sunset.",
  },
  {
    label: "ADVENTURE",
    title: "Hike & Scenic Drive",
    description:
      "Big views, fresh air, and an easy escape from home.",
    duration: "5 hrs",
    distance: "60 mi",
    cost: "~$40",
    image:
      "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=85",
    prompt:
      "Plan me a scenic drive with a beautiful hike, mountain views, and outdoor stops.",
  },
  {
    label: "FAMILY FUN",
    title: "Family Adventure Day",
    description:
      "Kid-friendly stops, easy hikes, and places everyone loves.",
    duration: "8 hrs",
    distance: "110 mi",
    cost: "~$124",
    image:
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=85",
    prompt:
      "Plan a family-friendly day adventure with easy outdoor activities, scenic stops, and food.",
  },
];

export default function TrippinDaysHomeV2() {
  const [startingLocation, setStartingLocation] =
    useState("Current Location");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [showInstallHelp, setShowInstallHelp] = useState(false);
  const [roadTripMode, setRoadTripMode] = useState(false);
  const [roadTripDestination, setRoadTripDestination] = useState("");
  const [roadTripTravelMode, setRoadTripTravelMode] = useState("Let TrippinDays Choose");
  const [roadTripDays, setRoadTripDays] = useState("3 Days");
  const [maxDailyDriving, setMaxDailyDriving] = useState("6 Hours");
  const [routeStyle, setRouteStyle] = useState("More Attractions");
  const [roadTripMessage, setRoadTripMessage] = useState("");
  const recognitionRef = useRef<any>(null);

  const [budget, setBudget] = useState("100");
  const [tripTime, setTripTime] = useState("8 hours");
  const [customDays, setCustomDays] = useState("3");
  const [travelers, setTravelers] = useState("2 people");
  const [travelMode, setTravelMode] = useState("Let TrippinDays Choose");
  const [tripDate, setTripDate] = useState("");
  const [roadTripStartDate, setRoadTripStartDate] = useState("");

  const [interests, setInterests] = useState(
    ""
  );

  const [prompt, setPrompt] = useState("");

  useEffect(() => {
    const supabase = createClient();

    async function loadAccess() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setSignedIn(!!user);

      if (!user) {
        setIsPremium(false);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("is_premium")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        console.error("Could not check Premium access:", profileError);
        setIsPremium(false);
        return;
      }

      setIsPremium(profile?.is_premium === true);
    }

    void loadAccess();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void loadAccess();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);
async function handleSignOut() {
  const supabase = createClient();

  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error("Could not sign out:", error);
    return;
  }

  setSignedIn(false);
  setIsPremium(false);
  window.location.replace("/");
}
  useEffect(() => {
    // Always start with Current Location. If permission is granted,
    // replace it with a readable city/state and keep the coordinates.
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;

          setLatitude(lat);
          setLongitude(lng);

          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`
            );

            if (!response.ok) {
              throw new Error("Unable to reverse-geocode location.");
            }

            const data = await response.json();

            const city =
              data.address?.city ||
              data.address?.town ||
              data.address?.village ||
              data.address?.municipality ||
              data.address?.county;

            const state =
              data.address?.state_code ||
              data.address?.state;

            if (city && state) {
              setStartingLocation(`${city}, ${state}`);
            } else if (data.display_name) {
              setStartingLocation(data.display_name);
            } else {
              setStartingLocation("Current Location");
            }
          } catch {
            setStartingLocation("Current Location");
          }
        },
        () => {
          setStartingLocation("Current Location");
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000,
        }
      );
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      return;
    }

    const recognition = new SpeechRecognition();

    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onresult = (event: any) => {
      const transcript =
        event.results[event.results.length - 1][0].transcript;

      setPrompt((current) =>
        current ? `${current} ${transcript}` : transcript
      );

      parseVoiceTripRequest(transcript);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.stop?.();
    };
  }, []);

  function parseVoiceTripRequest(text: string) {
    const lower = text.toLowerCase();

    // BUDGET
    const budgetMatch =
      lower.match(/\$\s?(\d+(?:\.\d{1,2})?)/) ||
      lower.match(/(\d+(?:\.\d{1,2})?)\s*dollars?/);

    if (budgetMatch) {
      setBudget(budgetMatch[1]);
    }

    // TRAVELERS
    const travelerMatch = lower.match(
      /(\d+)\s*(people|persons|travelers|travellers|adults)/
    );

    if (travelerMatch) {
      const count = Number(travelerMatch[1]);

      if (count === 1) {
        setTravelers("Just Me");
      } else if (count >= 5) {
        setTravelers("5+ people");
      } else {
        setTravelers(`${count} people`);
      }
    }

    if (
      lower.includes("just me") ||
      lower.includes("by myself") ||
      lower.includes("solo")
    ) {
      setTravelers("Just Me");
    }

    const spokenTravelerCounts: Record<string, number> = {
      one: 1,
      two: 2,
      three: 3,
      four: 4,
      five: 5,
      six: 6,
      seven: 7,
      eight: 8,
      nine: 9,
      ten: 10,
    };

    for (const [word, number] of Object.entries(spokenTravelerCounts)) {
      if (
        lower.includes(`${word} people`) ||
        lower.includes(`${word} travelers`) ||
        lower.includes(`${word} adults`)
      ) {
        if (number === 1) {
          setTravelers("Just Me");
        } else if (number >= 5) {
          setTravelers("5+ people");
        } else {
          setTravelers(`${number} people`);
        }
      }
    }

    // TIME - HOURS
    const hourMatch = lower.match(/(\d+)\s*hours?/);

    if (hourMatch) {
      const hours = Number(hourMatch[1]);

      if (hours <= 4) {
        setTripTime("4 hours");
      } else if (hours <= 6) {
        setTripTime("6 hours");
      } else if (hours <= 8) {
        setTripTime("8 hours");
      } else {
        setTripTime("1 day");
      }
    }

    // WEEKEND
    if (
      lower.includes("weekend") ||
      lower.includes("saturday and sunday")
    ) {
      setTripTime("Weekend");
    }

    // TIME - DAYS
    const dayMatch = lower.match(/(\d+)\s*days?/);

    if (dayMatch) {
      const days = Number(dayMatch[1]);

      if (days === 1) {
        setTripTime("1 day");
      } else {
        setTripTime("Custom");
        setCustomDays(String(Math.min(Math.max(days, 2), 30)));
      }
    }

    const spokenDays: Record<string, number> = {
      one: 1,
      two: 2,
      three: 3,
      four: 4,
      five: 5,
      six: 6,
      seven: 7,
      eight: 8,
      nine: 9,
      ten: 10,
      eleven: 11,
      twelve: 12,
      thirteen: 13,
      fourteen: 14,
    };

    for (const [word, number] of Object.entries(spokenDays)) {
      if (lower.includes(`${word} day`) || lower.includes(`${word} days`)) {
        if (number === 1) {
          setTripTime("1 day");
        } else {
          setTripTime("Custom");
          setCustomDays(String(number));
        }
      }
    }

    // INTERESTS
    const detectedInterests: string[] = [];

    const interestMap: Record<string, string[]> = {
      Waterfalls: ["waterfall", "waterfalls"],
      Hiking: ["hike", "hiking", "trail", "trails"],
      Food: [
        "food",
        "restaurant",
        "restaurants",
        "burger",
        "burgers",
        "seafood",
        "dinner",
        "lunch",
        "breakfast",
      ],
      Nature: [
        "nature",
        "forest",
        "forests",
        "mountain",
        "mountains",
        "lake",
        "lakes",
      ],
      Beaches: [
        "beach",
        "beaches",
        "ocean",
        "coast",
        "coastal",
      ],
      Camping: ["camping", "campground", "campgrounds"],
      Wildlife: ["wildlife", "animals"],
      "National Parks": ["national park", "national parks"],
      "State Parks": ["state park", "state parks"],
      "Scenic Drives": [
        "scenic drive",
        "scenic drives",
        "scenery",
        "scenic",
      ],
      Adventure: [
        "adventure",
        "adrenaline",
        "rafting",
        "kayaking",
        "climbing",
        "zipline",
      ],
      Nightlife: ["nightlife", "bars", "clubs"],
      Arts: ["art", "arts", "museum", "museums", "theater"],
      "Amusement Parks": [
        "amusement park",
        "amusement parks",
        "theme park",
        "theme parks",
        "roller coaster",
      ],
      Zoos: ["zoo", "zoos"],
      Aquariums: ["aquarium", "aquariums"],
      History: ["history", "historic", "historical"],
      Shopping: ["shopping", "shops", "outlets"],
      "Pet Friendly": ["pet friendly", "dog friendly", "bring my dog"],
    };

    Object.entries(interestMap).forEach(([interest, keywords]) => {
      if (keywords.some((keyword) => lower.includes(keyword))) {
        detectedInterests.push(interest);
      }
    });

    if (detectedInterests.length > 0) {
      setInterests([...new Set(detectedInterests)].join(", "));
    }
  }

  function startListening() {
    if (!recognitionRef.current) {
      alert(
        "Voice input is not supported in this browser. Try Chrome or another browser with speech recognition support."
      );
      return;
    }

    try {
      recognitionRef.current.start();
    } catch {
      // Ignore duplicate-start errors if the microphone is already listening.
    }
  }

  const now = new Date();
  const today =
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate()
    ).padStart(2, "0")}`;

  function scrollToPlanner() {
    document.getElementById("planner")?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }

  function openPremiumUpgrade() {
    window.location.href = "/premium";
  }

  function openEpicRoadTrip() {
    if (!signedIn) {
      window.location.href = "/login?mode=signup&redirect=/";
      return;
    }

    if (!isPremium) {
      openPremiumUpgrade();
      return;
    }

    setRoadTripMode(true);

    window.setTimeout(() => {
      document.getElementById("epic-road-trip-builder")?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 50);
  }

  function planEpicRoadTrip() {
    if (!startingLocation.trim()) {
      setRoadTripMessage("Enter your starting location.");
      return;
    }

    if (!budget.trim()) {
      setRoadTripMessage("Enter your total road-trip budget.");
      return;
    }

    if (!roadTripDestination.trim()) {
      setRoadTripMessage("Enter where you want the road trip to end.");
      return;
    }

    if (!signedIn) {
      window.location.href =
        "/login?mode=signup&redirect=/";
      return;
    }

    if (!isPremium) {
      window.location.href = "/premium";
      return;
    }

    const roadTripRequest = `
Starting Location: ${startingLocation}

Destination: ${roadTripDestination}

Start Date: ${roadTripStartDate || today}

Budget: $${budget}

Time Available: ${roadTripDays}

Travelers: ${travelers}

Transportation Preference: ${roadTripTravelMode}

Maximum Daily Driving: ${maxDailyDriving}

Route Style: ${routeStyle}

Trip Request:
EPIC ROAD TRIP — PREMIUM LONG-DISTANCE MODE.

TRANSPORTATION MODE:
${roadTripTravelMode}

Honor the selected transportation mode throughout the itinerary.
- If Drive: build the trip primarily around driving.
- If Fly: use flights for the major long-distance legs when practical, then use realistic local transportation at the destination.
- If Train: use rail as the primary long-distance mode where realistic and identify practical station transfers or short local connections.
- If Mixed: combine driving, flights, trains, or buses when that creates the strongest realistic trip.
- If Let TrippinDays Choose: choose the most practical transportation mix for the time, budget, and destination.
- Apply Maximum Daily Driving only to portions of the itinerary that are actually driven.

Build a complete multi-day trip from the starting location to the destination.

Use the supplied Start Date as Day 1. Label each day with its real calendar date.

Make the drive part of the adventure, not just transportation.

Break the route into realistic daily legs based on the maximum daily driving time.

HARD DRIVING-TIME RULE:
- Never plan more than 8 hours of actual driving in any single day.
- The traveler's selected Maximum Daily Driving time is the preferred daily ceiling.
- If the selected ceiling is less than 8 hours, do not exceed the selected ceiling.
- Driving time means time behind the wheel only; meals, fuel stops, sightseeing, hikes, attractions, and other stops are additional time.
- Choose a logical overnight stop before the daily driving limit is exceeded.
- If reaching the requested destination within the available number of days would require exceeding the daily driving limit, do not create an unsafe or unrealistic schedule. Explain that more days are needed and adjust the itinerary accordingly.

For every day include:
- morning departure
- realistic driving time and mileage
- famous or iconic roadside attractions when available
- unusual or weird roadside stops when worthwhile
- scenic viewpoints and photo stops
- historic landmarks or local-interest stops
- good food stops
- practical fuel/rest stops
- a logical overnight city when needed
- estimated daily costs
- arrival time

Route Style:
${routeStyle}

If Route Style is Fastest, minimize detours.
If Route Style is Scenic, favor beautiful roads and viewpoints where reasonable.
If Route Style is More Attractions, include worthwhile attractions even when they require modest detours.
If Route Style is Surprise Me, choose the most memorable balance of route, scenery, food, and unusual stops.

Stay within the total stated budget as closely as realistically possible.

Clearly identify attractions as:
ICONIC STOP
WEIRD ROADSIDE STOP
SCENIC STOP
PHOTO STOP
FAMOUS FOOD STOP
HISTORIC STOP

For noteworthy detours, include a short "Worth the Detour?" note with the approximate extra time or distance.

Include a complete return/ending summary, estimated total mileage, estimated total cost, and RoadTunes music suggestions.

Do not invent current prices, operating hours, closures, or availability. When those facts are uncertain, say the traveler should verify before leaving.
    `.trim();

    setRoadTripMessage("🛣️ Building your epic road trip...");
    openTripWithRequest(roadTripRequest);
  }

  function runAiPick() {
    if (!startingLocation.trim()) {
      alert("Please tell me where you're starting.");
      return;
    }

    if (!budget.trim()) {
      alert("Please enter your budget.");
      return;
    }

    const finalTime =
      tripTime === "Custom"
        ? `${customDays} days`
        : tripTime;

    if (!finalTime.trim()) {
      alert("Please tell me how much time you have.");
      return;
    }

    const surpriseRequest = `
Starting Location: ${startingLocation}

Budget: $${budget}

Trip Date: ${tripDate || today}

Time Available: ${finalTime}

Travelers: ${travelers}

Trip Request:
TAKE ME SOMEWHERE — AI PICK.

The traveler does not want to choose the destination. You choose it.

Build the strongest complete TrippinDays adventure possible from the starting
location while staying realistic for the available time, travelers, and total
budget.

Choose a destination that feels worthwhile and memorable rather than simply
the nearest obvious option.

Include:
- a creative trip title
- the chosen destination and why it was selected
- realistic travel time and mileage
- a complete timed itinerary
- memorable attractions and hidden gems
- worthwhile roadside stops when they fit naturally
- food recommendations
- realistic fuel, food, parking, admission, and activity costs
- weather considerations
- a realistic return-home time
- RoadTunes music suggestions

Premium-only enhancements may be layered onto this experience for Premium
members, but AI Pick itself is available to everyone.

Do not ask the traveler to choose a destination. Make the decision for them.
    `.trim();

    openTripWithRequest(surpriseRequest);
  }

  function surpriseMePremium() {
    if (!signedIn) {
      window.location.href =
        "/login?mode=signup&redirect=/";
      return;
    }

    if (!isPremium) {
      window.location.href = "/premium";
      return;
    }

    runAiPick();
  }
function useTripCard(trip: TripCard) {
  if (!startingLocation.trim()) {
    alert("Please enter your starting location first.");
    return;
  }

  const viewTripRequest = `
Starting Location: ${startingLocation}

Trip Request:
${trip.prompt}
  `.trim();

  openTripWithRequest(viewTripRequest);
}

  function openTripWithRequest(requestText: string) {
  try {
    localStorage.setItem("trippindays-request", requestText);
    sessionStorage.setItem("trippindays-request", requestText);

    window.location.assign("/trip");
    return;
  } catch (error) {
    console.warn(
      "Trip request storage was blocked. Using URL fallback.",
      error
    );

    window.location.assign(
      `/trip?request=${encodeURIComponent(requestText)}`
    );
  }
}

  function planAdventure() {
    if (!startingLocation.trim()) {
      alert("Please tell me where you're starting.");
      return;
    }

    if (!budget.trim()) {
      alert("Please enter your budget.");
      return;
    }

    const finalTime =
      tripTime === "Custom"
        ? `${customDays} days`
        : tripTime;

    if (!finalTime.trim()) {
      alert("Please tell me how much time you have.");
      return;
    }

    const combinedTripRequest = [interests.trim(), prompt.trim()]
      .filter(Boolean)
      .join(". ");

    if (!combinedTripRequest) {
      alert("Tell me what kind of adventure you're looking for.");
      return;
    }

    const fullRequest = `
Starting Location: ${startingLocation}

Budget: $${budget}

Trip Date: ${tripDate || today}

Time Available: ${finalTime}

Travelers: ${travelers}

Transportation Preference: ${travelMode}

Transportation Instructions:
${
  travelMode === "Let TrippinDays Choose"
    ? `Choose the most practical transportation for this trip based on the traveler's starting location, available time, total budget, destination, and requested activities.

Consider driving, flying, train travel, or a realistic combination.

Do not automatically choose driving just because the trip starts from a physical location.

Explain briefly why the selected transportation makes sense.`
    : travelMode === "Mixed"
      ? `Use a realistic combination of transportation when appropriate, such as driving plus flying, driving plus train, or another practical combination.

Keep the total transportation plan realistic for the traveler's available time and budget.`
      : `The traveler prefers to ${travelMode.toLowerCase()}.

Build the trip around this transportation preference unless it is clearly unrealistic for the available time, budget, or requested adventure.

If it is unrealistic, explain why and recommend the closest practical alternative.`
}

Trip Request:
${combinedTripRequest}
    `.trim();

    openTripWithRequest(fullRequest);
  }

  return (
    <main className="min-h-screen bg-[#f5efe4] text-[#092530]">
      {/* HEADER */}
      <header className="absolute inset-x-0 top-0 z-50 border-b border-white/10 bg-[#062b35]/75 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <a href="/" className="shrink-0">
            <div className="text-2xl font-black italic text-white sm:text-3xl">
              TrippinDays
            </div>

            <div className="text-xs font-black text-orange-500 sm:text-sm">
              Plan. Pack. Go.
            </div>
          </a>

          <nav className="hidden items-center gap-4 text-sm font-bold text-white xl:flex">
            <button
              onClick={scrollToPlanner}
              className="transition hover:text-orange-400"
            >
              Plan a Trip
            </button>

            <button
              onClick={runAiPick}
              className="transition hover:text-orange-400"
            >
              AI Pick
            </button>

            <a
              href="#ideas"
              className="transition hover:text-orange-400"
            >
              Destinations
            </a>

            <a
              href="/passport"
              className="transition hover:text-orange-400"
            >
              Passport
            </a>

            <a
              href="/journal"
              className="transition hover:text-orange-400"
            >
              Journal
            </a>

            <a
              href="/community"
              className="transition hover:text-orange-400"
            >
              Community
            </a>

            <a
              href="/premium"
              className="rounded-lg bg-orange-500 px-3 py-2 font-black text-white transition hover:bg-orange-600"
            >
              Premium
            </a>

            <a
              href="/saved-trips"
              className="transition hover:text-orange-400"
            >
              My Trips
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowInstallHelp(true)}
              className="rounded-xl bg-white/15 px-2.5 py-2 text-[11px] font-black text-white ring-1 ring-white/30 backdrop-blur transition hover:bg-white/20 sm:px-4 sm:text-sm"
            >
              📲 Get App
            </button>

          {signedIn ? (
  <button
    type="button"
    onClick={() => void handleSignOut()}
    className="rounded-xl border border-white/70 bg-black/15 px-3 py-2 text-xs font-bold text-white backdrop-blur"
  >
    Sign Out
  </button>
) : (
  <a
    href="/login"
    className="rounded-xl border border-white/70 bg-black/15 px-3 py-2 text-xs font-bold text-white backdrop-blur"
  >
    Sign In
  </a>
)}
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden bg-[#062b35] text-white">
        <div className="relative h-[530px] sm:h-[670px] lg:h-[750px]">
          <img
            src="/images/trippindays-couple-hero.png"
            alt="Couple and Great Pyrenees overlooking a mountain lake"
            className="h-full w-full object-cover object-center"
          />

          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/10 via-transparent to-black/35" />

          <div className="absolute inset-0 mx-auto flex max-w-[1500px] items-start justify-end px-5 pt-24 sm:px-8 sm:pt-28 lg:px-12 lg:pt-28">
            <div className="w-full max-w-[650px] text-right">
              <div
                className="text-5xl font-black italic leading-[0.9] tracking-[-0.04em] text-white drop-shadow-[0_4px_4px_rgba(0,0,0,0.75)] sm:text-6xl lg:text-7xl"
                style={{
                  fontFamily:
                    "'Arial Black', 'Arial Narrow', Impact, Haettenschweiler, sans-serif",
                }}
              >
                Get Away
              </div>

              <div className="mt-3 flex items-baseline justify-end gap-3 sm:gap-4">
                <span
                  className="text-2xl font-black italic text-white drop-shadow-[0_3px_3px_rgba(0,0,0,0.8)] sm:text-3xl lg:text-4xl"
                  style={{
                    fontFamily:
                      "'Arial Black', Impact, Haettenschweiler, sans-serif",
                  }}
                >
                  with
                </span>

                <span
                  className="text-4xl font-black italic leading-none tracking-[-0.04em] text-orange-500 drop-shadow-[0_4px_4px_rgba(0,0,0,0.75)] sm:text-5xl lg:text-6xl"
                  style={{
                    fontFamily:
                      "'Arial Black', 'Arial Narrow', Impact, Haettenschweiler, sans-serif",
                  }}
                >
                  TrippinDays
                </span>
              </div>

              <div className="mt-6">
                <p className="text-base font-black text-white drop-shadow-[0_3px_4px_rgba(0,0,0,0.9)] sm:text-lg lg:text-xl">
                  Tell us what you&apos;ve got.
                </p>

                <p className="mt-1 text-base font-black text-white drop-shadow-[0_3px_4px_rgba(0,0,0,0.9)] sm:text-lg lg:text-xl">
                  We&apos;ll figure out where to go.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PLANNER */}
      <section className="relative z-30 -mt-10 px-4 sm:-mt-12 sm:px-5 lg:-mt-14 lg:px-8">
        <div
          id="planner"
          className="mx-auto w-full max-w-[1320px] rounded-[28px] bg-white/95 p-5 text-[#092530] shadow-2xl backdrop-blur-md sm:p-7"
        >
          <h1 className="text-center text-2xl font-black sm:text-3xl">
            Where should we send you?
          </h1>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <PlannerField
              icon="📍"
              label="Starting Location"
            >
              <input
                value={startingLocation}
                onChange={(e) =>
                  setStartingLocation(e.target.value)
                }
                onFocus={(e) => e.currentTarget.select()}
                onClick={(e) => e.currentTarget.select()}
                className="w-full bg-transparent font-black outline-none"
              />
            </PlannerField>

            <PlannerField icon="💲" label="Budget">
              <div className="flex items-center gap-1">
                <span className="font-black text-green-600">
                  $
                </span>

                <input
                  value={budget}
                  onChange={(e) =>
                    setBudget(e.target.value)
                  }
                  onFocus={(e) => e.currentTarget.select()}
                  onClick={(e) => e.currentTarget.select()}
                  inputMode="numeric"
                  className="w-full bg-transparent font-black outline-none"
                />
              </div>
            </PlannerField>

            <PlannerField icon="🕒" label="Time">
              <select
                value={tripTime}
                onChange={(e) =>
                  setTripTime(e.target.value)
                }
                className="w-full bg-transparent font-black outline-none"
              >
                <option value="4 hours">
                  4 hours
                </option>

                <option value="6 hours">
                  6 hours
                </option>

                <option value="8 hours">
                  8 hours
                </option>

                <option value="1 day">
                  1 day
                </option>

                <option value="Weekend">
                  Weekend
                </option>

                <option value="Custom">
                  Custom Trip
                </option>

                <option
                  value="Epic Road Trip"
                  disabled
                >
                  ⭐ Epic Road Trip — Premium
                </option>
              </select>
            </PlannerField>

            <PlannerField icon="👤" label="Travelers">
              <select
                value={travelers}
                onChange={(e) =>
                  setTravelers(e.target.value)
                }
                className="w-full bg-transparent font-black outline-none"
              >
                <option>Just Me</option>
                <option>2 people</option>
                <option>3 people</option>
                <option>4 people</option>
                <option>5+ people</option>
              </select>
            </PlannerField>

            <PlannerField
              icon="❤️"
              label="What sounds good?"
            >
            <input
  value={interests}
  onChange={(e) => {
    setInterests(e.target.value);
  }}
  placeholder="Waterfalls, scenic drives, great food, hiking, hidden gems..."
  onFocus={(e) => e.currentTarget.select()}
  onClick={(e) => e.currentTarget.select()}
  className="w-full bg-transparent font-black outline-none"
/>
            </PlannerField>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <PlannerField icon="📅" label="Trip Date">
              <input
                type="date"
                min={today}
                value={tripDate}
                onChange={(e) => setTripDate(e.target.value)}
                className="w-full bg-transparent font-black outline-none"
              />
            </PlannerField>

            <PlannerField icon="🚦" label="Travel Mode">
              <select
                value={travelMode}
                onChange={(e) => setTravelMode(e.target.value)}
                className="w-full bg-transparent font-black outline-none"
              >
                <option>Let TrippinDays Choose</option>
                <option>Drive</option>
                <option>Fly</option>
                <option>Train</option>
                <option>Mixed</option>
              </select>
            </PlannerField>
          </div>

          {/* CUSTOM TRIP LENGTH */}
          {tripTime === "Custom" && (
            <div className="mt-3 rounded-2xl border border-orange-200 bg-orange-50 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-black text-[#092530]">
                    How many days do you have?
                  </p>

                  <p className="mt-1 text-sm text-slate-600">
                    Set the length of your trip.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="2"
                    max="30"
                    value={customDays}
                    onChange={(e) =>
                      setCustomDays(e.target.value)
                    }
                    onFocus={(e) => e.currentTarget.select()}
                    onClick={(e) => e.currentTarget.select()}
                    className="w-24 rounded-xl border border-slate-300 bg-white px-4 py-3 text-center font-black outline-none focus:border-orange-500"
                  />

                  <span className="font-black">
                    days
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* NATURAL LANGUAGE */}
                    {roadTripMode && (
            <div
              id="epic-road-trip-builder"
              className="mt-6 rounded-3xl border border-cyan-300/30 bg-cyan-50/70 p-5 shadow-sm"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-black text-[#092530]">
                    🛣️ Epic Road Trip Builder
                  </h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Build a multi-day route with smarter daily driving, roadside stops, and a complete long-distance itinerary.
                  </p>
                </div>
                <span className="rounded-full bg-amber-300 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-slate-950">
                  Premium
                </span>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <input
                  type="text"
                  value={roadTripDestination}
                  onChange={(event) => {
                    setRoadTripDestination(event.target.value);
                    setRoadTripMessage("");
                  }}
                  placeholder="🏁 Where do you want to end up?"
                  className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-[#092530] outline-none placeholder:text-slate-400 focus:border-cyan-400"
                />

                <input
                  type="date"
                  min={today}
                  value={roadTripStartDate}
                  onChange={(event) => setRoadTripStartDate(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-[#092530] outline-none focus:border-cyan-400"
                />

                <select
                  value={roadTripDays}
                  onChange={(event) => setRoadTripDays(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-[#092530] outline-none focus:border-cyan-400"
                >
                  <option>2 Days</option>
                  <option>3 Days</option>
                  <option>4 Days</option>
                  <option>5 Days</option>
                  <option>7 Days</option>
                  <option>10 Days</option>
                  <option>14 Days</option>
                </select>

                <select
                  value={roadTripTravelMode}
                  onChange={(event) => setRoadTripTravelMode(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-[#092530] outline-none focus:border-cyan-400"
                >
                  <option>Let TrippinDays Choose</option>
                  <option>Drive</option>
                  <option>Fly</option>
                  <option>Train</option>
                  <option>Mixed</option>
                </select>

                <select
                  value={maxDailyDriving}
                  onChange={(event) => setMaxDailyDriving(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-[#092530] outline-none focus:border-cyan-400"
                >
                  <option>4 Hours</option>
                  <option>5 Hours</option>
                  <option>6 Hours</option>
                  <option>7 Hours</option>
                  <option>8 Hours</option>
                </select>

                <select
                  value={routeStyle}
                  onChange={(event) => setRouteStyle(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-[#092530] outline-none focus:border-cyan-400 sm:col-span-2"
                >
                  <option>Fastest</option>
                  <option>Scenic</option>
                  <option>More Attractions</option>
                  <option>Surprise Me</option>
                </select>
              </div>

              {roadTripMessage && (
                <div className="mt-4 rounded-2xl border border-amber-300/40 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">
                  {roadTripMessage}
                </div>
              )}

              <button
                type="button"
                onClick={planEpicRoadTrip}
                className="mt-4 w-full rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-4 font-black text-white transition hover:scale-[1.01]"
              >
                🚗 Make the Drive the Adventure
              </button>
            </div>
          )}

<div className="mt-3 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
            <span className="text-xl text-orange-500">
              ✨
            </span>

            <input
              value={prompt}
              onChange={(e) =>
                setPrompt(e.target.value)
              }
              placeholder="Or tell us in your own words... Example: I have $100 and Saturday. I want waterfalls and good food."
              className="w-full bg-transparent text-sm outline-none sm:text-base"
            />

            <button
              type="button"
              onClick={startListening}
              title="Tell TrippinDays what kind of trip you want"
              aria-label={
                isListening
                  ? "Listening for trip details"
                  : "Speak your trip details"
              }
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl transition ${
                isListening
                  ? "animate-pulse bg-red-500 text-white"
                  : "bg-orange-100 text-orange-600 hover:bg-orange-200"
              }`}
            >
              {isListening ? "🔴" : "🎙️"}
            </button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <button
              type="button"
              onClick={planAdventure}
              className="rounded-2xl bg-orange-500 px-6 py-5 text-base font-black text-white shadow-lg transition hover:bg-orange-600 sm:text-lg"
            >
              ✨ PLAN MY ADVENTURE
            </button>

            <button
              type="button"
              onClick={surpriseMePremium}
              className={`rounded-2xl border-2 px-6 py-5 text-base font-black transition sm:text-lg ${
                isPremium
                  ? "border-slate-200 bg-white text-[#092530] hover:border-orange-400 hover:bg-orange-50"
                  : "border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100"
              }`}
              title={
                isPremium
                  ? "Surprise Me"
                  : "Surprise Me is a Premium feature"
              }
            >
              {isPremium
                ? "🎲 SURPRISE ME"
                : "🔒 SURPRISE ME — PREMIUM"}
            </button>

            <button
              type="button"
              onClick={openEpicRoadTrip}
              className={`rounded-2xl border-2 px-6 py-5 text-base font-black transition sm:text-lg ${
                isPremium
                  ? "border-cyan-300 bg-cyan-50 text-cyan-800 hover:bg-cyan-100"
                  : "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
              }`}
              title={
                isPremium
                  ? "Open Epic Road Trip Builder"
                  : "Epic Road Trip Builder is a Premium feature"
              }
            >
              {isPremium
                ? "🛣️ EPIC ROAD TRIP"
                : "🔒 EPIC ROAD TRIP — PREMIUM"}
            </button>
          </div>

          <div className="mt-5 flex flex-wrap justify-center gap-x-8 gap-y-2 text-xs font-bold sm:text-sm">
            <span>✓ Free to plan</span>
            <span>✓ No credit card required</span>
            <span>✓ Save and share trips</span>
          </div>
        </div>
      </section>

      {/* QUICK ACCESS */}
      <section className="mx-auto max-w-[1320px] px-4 pb-3 pt-8 sm:px-5 lg:px-8">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <QuickLink
            href="/passport"
            icon="🛂"
            title="Passport"
            text="Collect your travel memories."
          />

          <QuickLink
            href="/journal"
            icon="📖"
            title="Journal"
            text="Save the story of every trip."
          />

          <QuickLink
            href="/community"
            icon="🌎"
            title="Community"
            text="See and share adventures."
          />

          <QuickLink
            href="/premium"
            icon="⭐"
            title="Premium"
            text="Unlock smarter planning tools."
            premium
          />

          <QuickLink
            href="/saved-trips"
            icon="🧳"
            title="My Trips"
            text="Return to saved adventures."
          />
        </div>
      </section>

      {/* ADVENTURES NEAR YOU */}
      <section
        id="ideas"
        className="mx-auto max-w-[1500px] px-5 py-12 lg:px-8"
      >
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-black uppercase tracking-[.35em]">
              Need Ideas?
            </p>

            <h2 className="mt-1 text-4xl font-black italic tracking-[-0.03em] sm:text-5xl">
              Adventures Near You
            </h2>

            <div className="mt-2 h-1 w-48 rounded-full bg-orange-500" />
          </div>

          <button
            onClick={scrollToPlanner}
            className="text-left font-black text-orange-600 sm:text-right"
          >
            View More Destinations →
          </button>
        </div>

        <div className="mt-8 flex snap-x gap-5 overflow-x-auto pb-4 lg:grid lg:grid-cols-4 lg:overflow-visible">
          {tripCards.map((trip) => (
            <article
              key={trip.title}
              className="min-w-[285px] snap-start overflow-hidden rounded-2xl bg-white shadow-lg transition hover:-translate-y-1 hover:shadow-2xl lg:min-w-0"
            >
              <div className="relative h-48">
                <img
                  src={trip.image}
                  alt={trip.title}
                  className="h-full w-full object-cover"
                />

                <span className="absolute left-3 top-3 rounded-full bg-orange-500 px-3 py-1 text-xs font-black text-white shadow">
                  {trip.label}
                </span>

                <div className="absolute inset-x-0 bottom-0 bg-black/85 px-4 py-2 text-xs font-black text-white">
                  <div className="flex justify-between gap-3">
                    <span>
                      ◷ {trip.duration}
                    </span>

                    <span>
                      🚗 {trip.distance}
                    </span>

                    <span>
                      💲 {trip.cost}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-4">
                <h3 className="text-xl font-black">
                  {trip.title}
                </h3>

                <p className="mt-2 min-h-[48px] text-sm leading-6 text-slate-700">
                  {trip.description}
                </p>

                <button
                  onClick={() =>
                    useTripCard(trip)
                  }
                  className="mt-4 w-full rounded-xl bg-orange-500 py-3 font-black text-white transition hover:bg-orange-600"
                >
                  View Trip →
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* PREMIUM */}
      <section className="bg-[#fff7eb] px-5 py-16">
        <div className="mx-auto max-w-[1320px] overflow-hidden rounded-[32px] border border-orange-200 bg-gradient-to-br from-[#082b36] via-[#0b3a47] to-[#082b36] p-8 text-white shadow-2xl md:p-12">
          <div className="grid gap-8 lg:grid-cols-[1.2fr_.8fr] lg:items-center">
            <div>
              <div className="inline-flex rounded-full bg-orange-500/15 px-4 py-2 text-sm font-black text-orange-300 ring-1 ring-orange-400/30">
                ⭐ TRIPPINDAYS PREMIUM
              </div>

              <h2 className="mt-5 text-3xl font-black sm:text-4xl">
                Make every adventure smarter.
              </h2>

              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-200">
                Premium gives you deeper AI planning and
                personalization so TrippinDays can help
                shape a better trip around the way you
                actually travel.
              </p>

              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                <PremiumBenefit text="Smarter AI trip planning" />
                <PremiumBenefit text="Premium Trip Remix" />
                <PremiumBenefit text="Epic Road Trip planner" />
                <PremiumBenefit text="Advanced personalization" />
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href="/premium"
                  className="rounded-2xl bg-orange-500 px-7 py-4 font-black text-white shadow-lg transition hover:bg-orange-600"
                >
                  Explore Premium →
                </a>

                <button
                  onClick={scrollToPlanner}
                  className="rounded-2xl border border-white/30 bg-white/10 px-7 py-4 font-black text-white transition hover:bg-white/15"
                >
                  Keep Planning Free
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/10 p-6 backdrop-blur">
              <p className="text-sm font-black uppercase tracking-[.25em] text-orange-300">
                Go Further
              </p>

              <p className="mt-4 text-2xl font-black">
                Better planning. Better adventures.
              </p>

              <p className="mt-4 leading-7 text-slate-200">
                Premium adds smarter AI planning,
                Trip Remix, Epic Road Trips, and more
                advanced travel tools.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* MORE THAN A TRIP PLANNER */}
      <section
        className="bg-cover bg-center text-white"
        style={{
          backgroundImage:
            "linear-gradient(rgba(5,38,45,.92),rgba(5,38,45,.94)), url('https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1800&q=80')",
        }}
      >
        <div className="mx-auto grid max-w-[1500px] gap-8 px-5 py-14 sm:grid-cols-2 lg:grid-cols-5 lg:px-8">
          <div>
            <p className="text-4xl font-black italic leading-tight tracking-[-0.03em]">
              More Than
              <br />
              a Trip Planner
            </p>

            <div className="mt-3 h-1 w-32 bg-orange-500" />
          </div>

          <Feature
            icon="🗺️"
            title="Plan"
            text="Build an adventure around your budget, time, travelers, and interests."
          />

          <Feature
            icon="🎲"
            title="Discover"
            text="Let AI Pick help when you want to get away but don't know where."
          />

          <Feature
            icon="📖"
            title="Remember"
            text="Collect Passport stamps and keep the story of every adventure in your Journal."
          />

          <Feature
            icon="🌎"
            title="Community"
            text="Share trips, photos, and adventures with other TrippinDays travelers."
          />
        </div>
      </section>

      {/* PASSPORT / JOURNAL / COMMUNITY */}
      <section className="bg-white">
        <div className="mx-auto max-w-[1400px] px-5 py-16 lg:px-8">
          <div className="text-center">
            <p className="text-sm font-black uppercase tracking-[.3em] text-orange-600">
              Your Adventures Live On
            </p>

            <h2 className="mt-2 text-3xl font-black sm:text-4xl">
              Go somewhere. Remember it. Share it.
            </h2>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-3">
            <BigFeatureCard
              href="/passport"
              icon="🛂"
              title="TrippinDays Passport"
              text="Collect stamps from the places you explore and build a visual record of where you've been."
              button="Open Passport"
            />

            <BigFeatureCard
              href="/journal"
              icon="📖"
              title="Trip Journal"
              text="Turn your itinerary, memories, and photos into the story of your adventure."
              button="Open Journal"
            />

            <BigFeatureCard
              href="/community"
              icon="🌎"
              title="Community"
              text="Discover trips from other travelers and share adventures that might inspire somebody else's next getaway."
              button="Explore Community"
            />
          </div>
        </div>
      </section>

      {showInstallHelp && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
          onClick={() => setShowInstallHelp(false)}
        >
          <div
            className="w-full max-w-lg rounded-[28px] bg-white p-5 text-left text-[#092530] shadow-2xl sm:p-7"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[.25em] text-orange-600">
                  TrippinDays App
                </p>
                <h2 className="mt-1 text-2xl font-black sm:text-3xl">
                  Put TrippinDays on your Home Screen
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  It works like an app and opens straight from your phone.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowInstallHelp(false)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xl font-black text-slate-700 hover:bg-slate-200"
                aria-label="Close app instructions"
              >
                ×
              </button>
            </div>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🍎</span>
                <h3 className="text-lg font-black">iPhone / iPad</h3>
              </div>

              <ol className="mt-3 space-y-3 text-sm leading-6 text-slate-700">
                <li><span className="font-black text-[#092530]">1.</span> Open <span className="font-black">TrippinDays.com</span> in Safari.</li>
                <li><span className="font-black text-[#092530]">2.</span> Tap the <span className="font-black">Share</span> button.</li>
                <li><span className="font-black text-[#092530]">3.</span> Scroll down and tap <span className="font-black">Add to Home Screen</span>.</li>
                <li><span className="font-black text-[#092530]">4.</span> Tap <span className="font-black">Add</span>.</li>
              </ol>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🤖</span>
                <h3 className="text-lg font-black">Android</h3>
              </div>

              <p className="mt-3 text-sm leading-6 text-slate-700">
                Download the TrippinDays Android app directly to your phone.
              </p>

              <a
                href="/downloads/TrippinDays.apk"
                download
                className="mt-4 flex w-full items-center justify-center rounded-2xl bg-[#062b35] px-5 py-3.5 text-center font-black text-white transition hover:bg-[#0a3d49]"
              >
                📲 Download TrippinDays for Android
              </a>

              <p className="mt-3 text-xs leading-5 text-slate-500">
                After downloading, open the APK on your Android device and follow the install prompts.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowInstallHelp(false)}
              className="mt-6 w-full rounded-2xl bg-orange-500 px-6 py-4 font-black text-white transition hover:bg-orange-600"
            >
              Got It
            </button>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer className="relative overflow-hidden bg-[#062832] px-5 py-12 text-center text-white">
        <div className="relative">
          <p className="text-4xl font-black italic text-orange-500 sm:text-5xl">
            Plan. Pack. Go.
          </p>

          <p className="mt-4 text-xs font-black tracking-[.35em] sm:text-sm">
            TRIPPINDAYS.COM
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-3 text-sm font-bold text-slate-300">
            <a
              href="/passport"
              className="hover:text-white"
            >
              Passport
            </a>

            <a
              href="/journal"
              className="hover:text-white"
            >
              Journal
            </a>

            <a
              href="/community"
              className="hover:text-white"
            >
              Community
            </a>

            <a
              href="/premium"
              className="font-black text-orange-400 hover:text-orange-300"
            >
              Premium
            </a>

            <a
              href="/saved-trips"
              className="hover:text-white"
            >
              My Trips
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}

function PlannerField({
  icon,
  label,
  children,
}: {
  icon: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="mb-1 flex items-center gap-2">
        <span>{icon}</span>

        <span className="text-xs font-bold text-slate-500">
          {label}
        </span>
      </div>

      {children}
    </label>
  );
}

function QuickLink({
  href,
  icon,
  title,
  text,
  premium = false,
}: {
  href: string;
  icon: string;
  title: string;
  text: string;
  premium?: boolean;
}) {
  return (
    <a
      href={href}
      className={`rounded-2xl border p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-lg ${
        premium
          ? "border-orange-300 bg-orange-50"
          : "border-slate-200 bg-white"
      }`}
    >
      <div className="text-2xl">
        {icon}
      </div>

      <h3
        className={`mt-2 font-black ${
          premium
            ? "text-orange-600"
            : ""
        }`}
      >
        {title}
      </h3>

      <p className="mt-1 text-xs leading-5 text-slate-600">
        {text}
      </p>
    </a>
  );
}

function PremiumBenefit({
  text,
}: {
  text: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3">
      <span className="text-orange-400">
        ✓
      </span>

      <span className="font-bold">
        {text}
      </span>
    </div>
  );
}

function Feature({
  icon,
  title,
  text,
}: {
  icon: string;
  title: string;
  text: string;
}) {
  return (
    <div className="text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-orange-500 text-3xl shadow-xl">
        {icon}
      </div>

      <h3 className="mt-4 text-xl font-black">
        {title}
      </h3>

      <p className="mx-auto mt-2 max-w-[230px] text-sm leading-6 text-slate-200">
        {text}
      </p>
    </div>
  );
}

function BigFeatureCard({
  href,
  icon,
  title,
  text,
  button,
}: {
  href: string;
  icon: string;
  title: string;
  text: string;
  button: string;
}) {
  return (
    <a
      href={href}
      className="group rounded-3xl border border-slate-200 bg-[#f8f5ef] p-7 shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#062b35] text-3xl shadow-lg">
        {icon}
      </div>

      <h3 className="mt-5 text-2xl font-black">
        {title}
      </h3>

      <p className="mt-3 min-h-[72px] leading-6 text-slate-600">
        {text}
      </p>

      <div className="mt-6 font-black text-orange-600">
        {button} →
      </div>
    </a>
  );
}