"use client";

import { useEffect, useRef, useState } from "react";
import AuthButton from "@/components/AuthButton";
import SiteHeader from "@/components/SiteHeader";
import { createClient } from "@/lib/supabase/client";
interface SpeechRecognitionResultItem {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  0: SpeechRecognitionResultItem;
}

interface SpeechRecognitionEventLike extends Event {
  results: {
    0: SpeechRecognitionResultLike;
  };
}

interface SpeechRecognitionErrorEventLike extends Event {
  error: string;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}


function CalendarPicker({
  value,
  onChange,
  accent = "sky",
}: {
  value: string;
  onChange: (value: string) => void;
  accent?: "sky" | "cyan";
}) {
  const todayDate = new Date();
  const todayY = todayDate.getFullYear();
  const todayM = todayDate.getMonth();
  const todayD = todayDate.getDate();

  const selectedParts = value
    ? value.split("-").map(Number)
    : [todayY, todayM + 1, todayD];

  const [viewYear, setViewYear] = useState(selectedParts[0]);
  const [viewMonth, setViewMonth] = useState(selectedParts[1] - 1);
  const [open, setOpen] = useState(false);

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const weekdayNames = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const pad = (n: number) => String(n).padStart(2, "0");

  const selectedDateString =
    value ||
    `${todayY}-${pad(todayM + 1)}-${pad(todayD)}`;

  const formatDisplay = (dateString: string) => {
    const [y, m, d] = dateString.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, {
      weekday: "short",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const isPast = (day: number) => {
    const candidate = new Date(viewYear, viewMonth, day);
    const todayOnly = new Date(todayY, todayM, todayD);
    return candidate < todayOnly;
  };

  const previousMonth = () => {
    const prev = new Date(viewYear, viewMonth - 1, 1);
    const thisMonthStart = new Date(todayY, todayM, 1);
    if (prev < thisMonthStart) return;
    setViewYear(prev.getFullYear());
    setViewMonth(prev.getMonth());
  };

  const nextMonth = () => {
    const next = new Date(viewYear, viewMonth + 1, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  };

  const chooseDay = (day: number) => {
    if (isPast(day)) return;
    const selected = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`;
    onChange(selected);
    setOpen(false);
  };

  const borderClass =
    accent === "cyan"
      ? "focus:border-cyan-400 border-cyan-300/20"
      : "focus:border-sky-400 border-sky-300/20";

  const selectedClass =
    accent === "cyan"
      ? "bg-cyan-400 text-slate-950"
      : "bg-sky-400 text-slate-950";

  const canGoPrevious =
    new Date(viewYear, viewMonth, 1) >
    new Date(todayY, todayM, 1);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`flex w-full items-center justify-between rounded-xl border bg-slate-950/60 p-3.5 text-left text-white outline-none ${borderClass}`}
      >
        <span>
          📅 {value ? formatDisplay(value) : `Today — ${formatDisplay(selectedDateString)}`}
        </span>
        <span className="text-white/60">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="mt-2 mx-auto max-w-[280px] rounded-xl border border-white/15 bg-slate-950 p-2.5 shadow-2xl">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={previousMonth}
              disabled={!canGoPrevious}
              className="h-8 w-8 rounded-lg bg-white/10 text-lg disabled:opacity-25"
              aria-label="Previous month"
            >
              ‹
            </button>

            <p className="font-black">
              {monthNames[viewMonth]} {viewYear}
            </p>

            <button
              type="button"
              onClick={nextMonth}
              className="h-8 w-8 rounded-lg bg-white/10 text-lg"
              aria-label="Next month"
            >
              ›
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5 text-center">
            {weekdayNames.map((day) => (
              <div key={day} className="py-1 text-[10px] font-bold text-white/45">
                {day}
              </div>
            ))}

            {Array.from({ length: firstDay }).map((_, index) => (
              <div key={`blank-${index}`} />
            ))}

            {Array.from({ length: daysInMonth }, (_, index) => index + 1).map(
              (day) => {
                const dateString = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`;
                const selected = dateString === selectedDateString;
                const past = isPast(day);

                return (
                  <button
                    key={day}
                    type="button"
                    disabled={past}
                    onClick={() => chooseDay(day)}
                    className={`aspect-square rounded-md text-xs font-bold transition ${
                      selected
                        ? selectedClass
                        : past
                          ? "cursor-not-allowed text-white/20"
                          : "bg-white/5 text-white hover:bg-white/15"
                    }`}
                  >
                    {day}
                  </button>
                );
              }
            )}
          </div>

          <div className="mt-2 flex gap-1.5">
            <button
              type="button"
              onClick={() => {
                onChange("");
                setViewYear(todayY);
                setViewMonth(todayM);
                setOpen(false);
              }}
              className="flex-1 rounded-lg bg-white/10 px-2 py-1.5 text-xs font-bold"
            >
              Use Today
            </button>

            {value && (
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
                className="flex-1 rounded-lg bg-white/10 px-2 py-1.5 text-xs font-bold"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const [tripRequest, setTripRequest] = useState("");
  const [startingLocation, setStartingLocation] = useState("");
  const [budget, setBudget] = useState("");
  const [tripDate, setTripDate] = useState("");
  const [roadTripStartDate, setRoadTripStartDate] = useState("");
  const [timeAvailable, setTimeAvailable] = useState("Full Day");
  const [traveler, setTraveler] = useState("Just Me");
  const [isListening, setIsListening] = useState(false);
const [signedIn, setSignedIn] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [roadTripMode, setRoadTripMode] = useState(false);
  const [roadTripDestination, setRoadTripDestination] = useState("");
  const [roadTripDays, setRoadTripDays] = useState("3 Days");
  const [maxDailyDriving, setMaxDailyDriving] = useState("6 Hours");
  const [routeStyle, setRouteStyle] = useState("More Attractions");
  const [roadTripMessage, setRoadTripMessage] = useState("");
  const [message, setMessage] = useState(
    "Tap the microphone and tell me what kind of adventure you want."
  );
const [customTime, setCustomTime] = useState("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const now = new Date();
  const today =
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate()
    ).padStart(2, "0")}`;

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
  function startListening() {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setMessage(
        "Voice recognition is not supported in this browser. Try Chrome or Edge, or type your request."
      );
      return;
    }

    const recognition = new SpeechRecognition();

    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
      setMessage("I'm listening... tell me everything you want.");
    };

    recognition.onresult = (event) => {
      const spokenText = event.results[0][0].transcript;

      setTripRequest(spokenText);
      setMessage("Got it! Review your request, then plan your adventure.");
    };

    recognition.onerror = (event) => {
      setIsListening(false);

      if (event.error === "not-allowed") {
        setMessage(
          "Microphone permission was blocked. Allow microphone access and try again."
        );
        return;
      }

      setMessage(
        "I couldn't hear that clearly. Tap the microphone and try again."
      );
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setIsListening(false);
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
      window.location.href = "/login?mode=signup&redirect=/";
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

Travelers: ${traveler}

Maximum Daily Driving: ${maxDailyDriving}

Route Style: ${routeStyle}

Trip Request:
EPIC ROAD TRIP — PREMIUM LONG-DISTANCE MODE.

Build a complete multi-day road trip from the starting location to the destination.

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
    window.location.href = `/trip?request=${encodeURIComponent(roadTripRequest)}`;
  }

  function takeMeSomewhere() {
    if (!startingLocation.trim()) {
      setMessage("Please tell me where you're starting.");
      return;
    }

    if (!budget.trim()) {
      setMessage("Please enter your budget.");
      return;
    }

    if (!signedIn) {
      window.location.href = "/login?mode=signup&redirect=/";
      return;
    }

    if (!isPremium) {
      window.location.href = "/premium";
      return;
    }

    const finalTime =
      timeAvailable === "Custom" ? customTime.trim() : timeAvailable;

    if (!finalTime) {
      setMessage("Please tell me how much time you have.");
      return;
    }

    const surpriseRequest = `
Starting Location: ${startingLocation}

Budget: $${budget}

Trip Date: ${tripDate || today}

Time Available: ${finalTime}

Travelers: ${traveler}

Trip Request:
TAKE ME SOMEWHERE — PREMIUM SURPRISE TRIP.

The traveler does not want to choose the destination. You choose it.

Build the strongest complete TrippinDays adventure possible from the starting
location while staying realistic for the available time, travelers, and total
budget.

Choose a destination that feels worthwhile and memorable rather than simply
the nearest obvious option.

Include:
- a creative trip title
- the chosen destination and why it was selected
- realistic drive time and mileage
- a complete timed itinerary
- memorable attractions and hidden gems
- worthwhile roadside stops when they fit naturally
- food recommendations
- realistic fuel, food, parking, admission, and activity costs
- weather considerations
- a realistic return-home time
- RoadTunes music suggestions

Do not ask the traveler to choose a destination. Make the decision for them.
    `.trim();

    setMessage("✨ TrippinDays is choosing your surprise adventure...");
    window.location.href = `/trip?request=${encodeURIComponent(surpriseRequest)}`;
  }

  function planAdventure() {
    if (!startingLocation.trim()) {
      setMessage("Please tell me where you're starting.");
      return;
    }

    if (!budget.trim()) {
      setMessage("Please enter your budget.");
      return;
    }

    if (!tripRequest.trim()) {
      setMessage("Tell me what kind of adventure you're looking for.");
      return;
    }

    const finalTime =
      timeAvailable === "Custom" ? customTime.trim() : timeAvailable;

    if (!finalTime) {
      setMessage("Please tell me how much time you have.");
      return;
    }

    const fullRequest = `
Starting Location: ${startingLocation}

Budget: $${budget}

Trip Date: ${tripDate || today}

Time Available: ${finalTime}

Travelers: ${traveler}

Trip Request:
${tripRequest}
    `.trim();

    try {
      localStorage.setItem("trippindays-request", fullRequest);
    } catch (error) {
      console.warn("Could not cache trip request:", error);
    }

    setMessage("✨ Building your TrippinDays adventure...");

    // Normal planner is intentionally separate from Epic Road Trip.
    const tripUrl = `/trip?request=${encodeURIComponent(fullRequest)}`;
    window.location.assign(tripUrl);
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <SiteHeader />

      {/* TOP BANNER — ABOUT ONE THIRD OF THE SCREEN */}
      <section
        className="relative h-[42vh] min-h-[360px] max-h-[520px] bg-cover bg-no-repeat"
        style={{
          backgroundImage:
            "linear-gradient(90deg, rgba(5,15,35,.85), rgba(5,15,35,.15)), url('/images/explorer.png')",
          backgroundPosition: "75% center",
        }}
      >
        <div className="mx-auto flex h-full max-w-7xl items-center px-6">
          <div className="max-w-xl">
            

            <h1 className="text-5xl font-black leading-none sm:text-6xl lg:text-7xl">
  <span className="block text-white">
    PLAN.
  </span>

  <span className="mt-2 ml-10 block text-sky-400">
    PACK.
  </span>

 <span className="mt-2 ml-28 md:ml-40 block text-cyan-300">
  GO.
</span>
</h1>

            <p className="mt-4 max-w-lg text-base leading-7 text-white/85 sm:text-lg">
              Personalized road trips built around your location, budget,
              time, and interests.
            </p>
          </div>
        </div>
      </section>

      {/* TRIP PLANNER */}
      <section
        id="features"
        className="bg-gradient-to-b from-sky-950 via-blue-950 to-slate-950 px-6 py-12"
      >
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-2">
          <div>
            <div className="rounded-3xl border border-white/15 bg-white/10 p-5 shadow-2xl backdrop-blur-md">
              <p className="mb-2 text-center text-xl font-bold">
                What kind of TrippinDays do you feel like?
              </p>

              <p className="mb-5 min-h-6 text-center text-sm text-sky-200">
                {message}
              </p>

              <button
                type="button"
                onClick={isListening ? stopListening : startListening}
                aria-label={
                  isListening
                    ? "Stop listening"
                    : "Speak your adventure request"
                }
                className={`mx-auto flex h-24 w-24 items-center justify-center rounded-full text-4xl shadow-lg transition hover:scale-105 ${
                  isListening
                    ? "animate-pulse bg-red-500 shadow-red-500/40"
                    : "bg-sky-500 shadow-sky-500/40 hover:bg-sky-400"
                }`}
              >
                {isListening ? "⏹️" : "🎤"}
              </button>

              <div className="my-5 flex items-center gap-3 text-sm text-white/50">
                <div className="h-px flex-1 bg-white/20" />
                or type it
                <div className="h-px flex-1 bg-white/20" />
              </div>

              <input
                type="text"
                value={startingLocation}
                onChange={(event) =>
                  setStartingLocation(event.target.value)
                }
                placeholder="📍 Where are you starting?"
                className="mb-4 w-full rounded-2xl border border-white/15 bg-slate-950/60 p-4 text-white outline-none placeholder:text-white/40 focus:border-sky-400"
              />

              <input
                type="text"
                inputMode="numeric"
                value={budget}
                onChange={(event) => setBudget(event.target.value)}
                placeholder="💰 What's your budget?"
                className="mb-4 w-full rounded-2xl border border-white/15 bg-slate-950/60 p-4 text-white outline-none placeholder:text-white/40 focus:border-sky-400"
              />

              <div className="mb-4">
                <label className="mb-2 block text-sm font-bold text-sky-100">
                  📅 Trip Date <span className="font-normal text-white/45">(optional)</span>
                </label>
                <CalendarPicker
                  value={tripDate}
                  onChange={setTripDate}
                  accent="sky"
                />
                <p className="mt-1.5 text-xs text-white/45">
                  Leave it on Today, or open the calendar and choose another date.
                </p>
              </div>

              <div className="mb-4 grid gap-4 sm:grid-cols-2">
            <select
  value={timeAvailable}
  onChange={(event) => setTimeAvailable(event.target.value)}
  className="w-full rounded-2xl border border-white/15 bg-slate-950/60 p-4 text-white outline-none focus:border-sky-400"
>
  <option>2 Hours</option>
  <option>Half Day</option>
  <option>Full Day</option>
  <option>Weekend</option>
  <option>Custom</option>
  
</select>
{timeAvailable === "Custom" && (
  <input
    type="text"
    value={customTime}
    onChange={(event) => setCustomTime(event.target.value)}
    placeholder="Example: 3 days, 1 week, or August 22–28"
    className="mt-3 w-full rounded-2xl border border-white/15 bg-slate-950/60 p-4 text-white outline-none placeholder:text-white/40 focus:border-sky-400"
  />
)}
                <select
                  value={traveler}
                  onChange={(event) => setTraveler(event.target.value)}
                  className="w-full rounded-2xl border border-white/15 bg-slate-950/60 p-4 text-white outline-none focus:border-sky-400"
                >
                  <option>Just Me</option>
                  <option>Couple</option>
                  <option>Family</option>
                  <option>Friends</option>
                  <option>Me and My Dog</option>
                  <option>2 Adults, 1 Dog</option>
                </select>
              </div>

              <textarea
                value={tripRequest}
                onChange={(event) => setTripRequest(event.target.value)}
                placeholder="Example: Waterfalls and good food within 120 miles, with easy walking and dog-friendly stops."
                className="min-h-32 w-full resize-none rounded-2xl border border-white/15 bg-slate-950/60 p-4 text-white outline-none placeholder:text-white/40 focus:border-sky-400"
              />

              <button
                type="button"
                onClick={planAdventure}
                className="relative z-50 mt-4 w-full touch-manipulation pointer-events-auto rounded-2xl bg-sky-500 px-6 py-4 text-lg font-black transition hover:bg-sky-400"
              >
                ✨ Plan My Adventure
              </button>

              <div className="mt-5 rounded-3xl border border-white/15 bg-white/10 p-4 shadow-xl backdrop-blur-md">
                <div className="mb-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-lg font-black text-white">
                        ⭐ Premium Adventure Tools
                      </p>
                      <p className="mt-1 text-sm text-white/60">
                        Let TrippinDays do more of the planning for you.
                      </p>
                    </div>

                    <span className="shrink-0 rounded-full bg-amber-300 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-slate-950">
                      Premium
                    </span>
                  </div>
                </div>

                <div className="grid gap-3">
                  <button
                    type="button"
                    onClick={takeMeSomewhere}
                    className="rounded-2xl border border-amber-300/25 bg-gradient-to-r from-amber-500/20 to-orange-500/20 p-4 text-left transition hover:bg-amber-400/20"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black text-amber-200">
                          🪄 Take Me Somewhere
                        </p>
                        <p className="mt-1 text-sm text-white/65">
                          Give us your time and budget. TrippinDays chooses the destination.
                        </p>
                      </div>

                      <span className="text-xl">→</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (!signedIn) {
                        window.location.href = "/login?mode=signup&redirect=/";
                        return;
                      }

                      if (!isPremium) {
                        window.location.href = "/premium";
                        return;
                      }

                      setRoadTripMode((current) => !current);
                    }}
                    className="rounded-2xl border border-cyan-300/25 bg-gradient-to-r from-cyan-500/15 to-blue-500/20 p-4 text-left transition hover:bg-cyan-400/20"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black text-cyan-200">
                          🛣️ Epic Road Trip Builder
                        </p>
                        <p className="mt-1 text-sm text-white/65">
                          Build multi-day routes with roadside attractions and smarter daily driving.
                        </p>
                      </div>

                      <span className="text-xl">
                        {roadTripMode ? "▲" : "→"}
                      </span>
                    </div>
                  </button>

                  {roadTripMode && (
                    <div className="rounded-2xl border border-cyan-300/20 bg-slate-950/40 p-4">
                      <div className="space-y-3">
                        <input
                          type="text"
                          value={startingLocation}
                          onChange={(event) => {
                            setStartingLocation(event.target.value);
                            setRoadTripMessage("");
                          }}
                          placeholder="📍 Starting location"
                          className="w-full rounded-xl border border-white/15 bg-slate-950/60 p-3.5 text-white outline-none placeholder:text-white/40 focus:border-cyan-400"
                        />

                        <input
                          type="text"
                          inputMode="numeric"
                          value={budget}
                          onChange={(event) => {
                            setBudget(event.target.value);
                            setRoadTripMessage("");
                          }}
                          placeholder="💰 Total road-trip budget"
                          className="w-full rounded-xl border border-white/15 bg-slate-950/60 p-3.5 text-white outline-none placeholder:text-white/40 focus:border-cyan-400"
                        />

                        <input
                          type="text"
                          value={roadTripDestination}
                          onChange={(event) => {
                            setRoadTripDestination(event.target.value);
                            setRoadTripMessage("");
                          }}
                          placeholder="🏁 Where do you want to end up?"
                          className="w-full rounded-xl border border-white/15 bg-slate-950/60 p-3.5 text-white outline-none placeholder:text-white/40 focus:border-cyan-400"
                        />

                        <div>
                          <label className="mb-2 block text-sm font-bold text-cyan-100">
                            📅 Start Date <span className="font-normal text-white/45">(optional)</span>
                          </label>
                          <CalendarPicker
                            value={roadTripStartDate}
                            onChange={(value) => {
                              setRoadTripStartDate(value);
                              setRoadTripMessage("");
                            }}
                            accent="cyan"
                          />
                          <p className="mt-1.5 text-xs text-white/45">
                            Leave it on Today, or open the calendar and choose another date.
                          </p>
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-bold text-cyan-100">
                            👥 Travelers
                          </label>
                          <select
                            value={traveler}
                            onChange={(event) => {
                              setTraveler(event.target.value);
                              setRoadTripMessage("");
                            }}
                            className="w-full rounded-xl border border-white/15 bg-slate-950/60 p-3.5 text-white outline-none focus:border-cyan-400"
                          >
                            <option>Just Me</option>
                            <option>Couple</option>
                            <option>Family</option>
                            <option>Friends</option>
                            <option>Me and My Dog</option>
                            <option>2 Adults, 1 Dog</option>
                          </select>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <select
                            value={roadTripDays}
                            onChange={(event) => setRoadTripDays(event.target.value)}
                            className="w-full rounded-xl border border-white/15 bg-slate-950/60 p-3.5 text-white outline-none focus:border-cyan-400"
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
                            value={maxDailyDriving}
                            onChange={(event) =>
                              setMaxDailyDriving(event.target.value)
                            }
                            className="w-full rounded-xl border border-white/15 bg-slate-950/60 p-3.5 text-white outline-none focus:border-cyan-400"
                          >
                            <option>4 Hours</option>
                            <option>5 Hours</option>
                            <option>6 Hours</option>
                            <option>8 Hours</option>
                          </select>
                        </div>

                        <select
                          value={routeStyle}
                          onChange={(event) => setRouteStyle(event.target.value)}
                          className="w-full rounded-xl border border-white/15 bg-slate-950/60 p-3.5 text-white outline-none focus:border-cyan-400"
                        >
                          <option>Fastest</option>
                          <option>Scenic</option>
                          <option>More Attractions</option>
                          <option>Surprise Me</option>
                        </select>

                        {roadTripMessage && (
                          <div className="rounded-xl border border-amber-300/25 bg-amber-400/10 px-4 py-3 text-sm font-bold text-amber-100">
                            {roadTripMessage}
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={planEpicRoadTrip}
                          className="w-full rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-6 py-3.5 font-black text-white shadow-lg shadow-cyan-500/10 transition hover:scale-[1.01]"
                        >
                          🚗 Make the Drive the Adventure
                        </button>
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    disabled
                    className="cursor-not-allowed rounded-2xl border border-violet-300/20 bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 p-4 text-left opacity-70"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black text-violet-200">
                          🚨 Trip Rescue
                        </p>
                        <p className="mt-1 text-sm text-white/55">
                          Rebuild your trip when weather, closures, delays, or plans change.
                        </p>
                      </div>

                      <span className="shrink-0 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-white/70">
                        Coming Soon
                      </span>
                    </div>
                  </button>
                </div>

                {!isPremium && (
                  <p className="mt-3 text-center text-xs text-white/45">
                    Premium membership required to use these tools.
                  </p>
                )}
              </div>
            </div>
          </div>

      <div className="space-y-6">

  {/* Featured Adventure */}
  <div className="rounded-3xl border border-white/15 bg-white/10 p-6 backdrop-blur-md shadow-xl">
    <img
  src="/images/banner.png"
  alt="Featured Adventure"
  className="mb-4 h-64 w-full rounded-2xl bg-black/20 object-cover object-[40%_25%]"
/>

    <h2 className="text-2xl font-black">
      ⭐ Featured Roadtrips
    </h2>

    <p className="mt-2 text-white/70">
      Discover today's hand-picked adventure chosen by TrippinDays.
    </p>

    <a
 href={signedIn ? "/featured" : "/login?mode=signup&redirect=/featured"}
  className="mt-6 flex h-14 items-center justify-center rounded-2xl bg-gradient-to-r from-cyan-400 to-sky-500 font-black text-white transition hover:scale-[1.02]"
>
  Explore Adventure →
</a>
  </div>

  {/* Travel Journal */}
  <div className="rounded-3xl border border-white/15 bg-white/10 p-6 backdrop-blur-md shadow-xl">

    <h2 className="text-2xl font-black">
      📖 Travel Journal
    </h2>

    <p className="mt-2 text-white/70">
      Save memories, photos, notes and print a beautiful keepsake after every trip.
    </p>
<a
href={signedIn ? "/journal" : "/login?mode=signup&redirect=/journal"}
  className="mt-5 block w-full rounded-xl bg-emerald-500 py-3 text-center font-bold hover:bg-emerald-400"
>
  View Journal
</a>
    
  </div>

  {/* Passport */}
  <div className="rounded-3xl border border-white/15 bg-white/10 p-6 backdrop-blur-md shadow-xl">

    <h2 className="text-2xl font-black">
      🛂 Adventure Passport
    </h2>

    <p className="mt-2 text-white/70">
      Collect digital passport stamps at every destination. Premium members can even create custom stamps for others to collect.
    </p>

    <a
  href={signedIn ? "/passport" : "/login?mode=signup&redirect=/passport"}
  className="mt-5 block w-full rounded-xl bg-amber-500 py-3 text-center font-bold transition hover:bg-amber-400"
>
  View Passport
</a>
  </div>

          </div>
        </div>
      </section>

      <section
        id="how-it-works"
        className="border-t border-white/10 bg-white px-6 py-20 text-slate-900"
      >
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-4xl font-black">
            How TrippinDays Works
          </h2>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              {
                icon: "🎤",
                title: "Tell Us What You Want",
                text: "Speak or type your starting location, budget, travel range, and interests.",
              },
              {
                icon: "🧠",
                title: "AI Builds Your Day",
                text: "TrippinDays organizes destinations, food, activities, costs, and timing.",
              },
              {
                icon: "🗺️",
                title: "Plan. Pack. Go",
                text: "Review your itinerary, check weather, open maps, and hit the road.",
              },
            ].map((item) => (
              <article
                key={item.title}
                className="rounded-3xl border border-slate-200 bg-slate-50 p-7 shadow-sm"
              >
                <div className="text-4xl">{item.icon}</div>

                <h3 className="mt-4 text-xl font-black">
                  {item.title}
                </h3>

                <p className="mt-3 leading-7 text-slate-600">
                  {item.text}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}