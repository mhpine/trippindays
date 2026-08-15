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

export default function Home() {
  const [tripRequest, setTripRequest] = useState("");
  const [startingLocation, setStartingLocation] = useState("");
  const [budget, setBudget] = useState("");
  const [timeAvailable, setTimeAvailable] = useState("Full Day");
  const [traveler, setTraveler] = useState("Just Me");
  const [isListening, setIsListening] = useState(false);
const [signedIn, setSignedIn] = useState(false);
  const [message, setMessage] = useState(
    "Tap the microphone and tell me what kind of adventure you want."
  );

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
useEffect(() => {
  const supabase = createClient();

  supabase.auth.getUser().then(({ data: { user } }) => {
    setSignedIn(!!user);
  });
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

    const fullRequest = `
Starting Location: ${startingLocation}

Budget: $${budget}

Time Available: ${timeAvailable}

Travelers: ${traveler}

Trip Request:
${tripRequest}
    `.trim();

    localStorage.setItem("trippindays-request", fullRequest);

    window.location.href = "/trip";
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

              <div className="mb-4 grid gap-4 sm:grid-cols-2">
                <select
                  value={timeAvailable}
                  onChange={(event) =>
                    setTimeAvailable(event.target.value)
                  }
                  className="w-full rounded-2xl border border-white/15 bg-slate-950/60 p-4 text-white outline-none focus:border-sky-400"
                >
                  <option>2 Hours</option>
                  <option>Half Day</option>
                  <option>Full Day</option>
                  <option>Weekend</option>
                </select>

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
                className="mt-4 w-full rounded-2xl bg-sky-500 px-6 py-4 text-lg font-black transition hover:bg-sky-400"
              >
                ✨ Plan My Adventure
              </button>
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