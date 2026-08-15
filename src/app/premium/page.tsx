"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import SiteHeader from "@/components/SiteHeader";
export default function PremiumPage() {
  const [signedIn, setSignedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
const [selectedPlan, setSelectedPlan] = useState<"monthly" | "yearly">("yearly");
  useEffect(() => {
    const supabase = createClient();

    async function checkUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setSignedIn(!!user);
      setLoading(false);
    }

    void checkUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(!!session?.user);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function logOut() {
    const supabase = createClient();

    await supabase.auth.signOut();

    setSignedIn(false);
    window.location.href = "/";
  }

  const features = [
    {
      icon: "🤖",
      title: "Advanced AI Planning",
      text: "More detailed, personalized trip planning built around your budget, time, interests, and travel style.",
    },
    {
      icon: "📘",
      title: "Custom Passport Stamps",
      text: "Create, customize, and collect your own TrippinDays passport stamps.",
    },
    {
      icon: "🌎",
      title: "Publish Your Adventures",
      text: "Share trips and photos with the TrippinDays community.",
    },
    {
      icon: "👥",
      title: "Social Travel Community",
      text: "Connect through trips, photos, likes, comments, and shared travel experiences.",
    },
    {
      icon: "🎵",
      title: "RoadTunes+",
      text: "Connect supported music services and build road-trip music around your adventure.",
    },
    {
      icon: "🗣️",
      title: "AI Travel Translator",
      text: "Voice translation, camera translation, conversation mode, phrasebook help, cultural assistance, and emergency translation.",
      comingSoon: true,
    },
    {
      icon: "✈️",
      title: "Travel Booking",
      text: "Flights, trains, rental cars, cruises, and lodging integrations.",
      comingSoon: true,
    },
    {
      icon: "⭐",
      title: "Premium Extras",
      text: "Premium profile status, exclusive features, and early access to new TrippinDays tools.",
    },
  ];
async function startCheckout() {
  try {
    const response = await fetch("/api/checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        plan: selectedPlan,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.url) {
      throw new Error(data.error || "Unable to start checkout.");
    }

    window.location.href = data.url;
  } catch (error) {
    console.error("Checkout error:", error);
    alert("Unable to start Premium checkout. Please try again.");
  }
}
  return (
    <main className="min-h-screen bg-[#061426] text-white">
      {/* HEADER */}
      <SiteHeader />

      {/* TOP 1/3 HERO */}
      <section
        className="relative min-h-[520px] overflow-hidden sm:min-h-[620px]"
        style={{
          backgroundImage: "url('/images/premium.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/45 to-black/10" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#061426] via-transparent to-transparent" />

        <div className="relative mx-auto flex min-h-[520px] max-w-7xl items-end px-6 pb-12 sm:min-h-[620px] sm:pb-16">
          <div className="max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[0.3em] text-amber-300">
              TrippinDays Premium
            </p>

            <h1 className="mt-4 text-5xl font-black leading-tight sm:text-7xl">
              Make every trip
              <span className="block text-cyan-300">more yours.</span>
            </h1>

            <p className="mt-5 max-w-2xl text-lg leading-8 text-white/85 sm:text-xl">
              Unlock advanced planning, custom passport stamps, social travel
              features, music connections, and the next generation of
              TrippinDays tools.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <a
                href="#premium-features"
                className="rounded-2xl bg-amber-400 px-6 py-4 font-black text-slate-950 hover:bg-amber-300"
              >
                ⭐ Explore Premium
              </a>

              <a
                href="#compare"
                className="rounded-2xl border border-white/25 bg-black/20 px-6 py-4 font-black backdrop-blur-sm hover:bg-white/10"
              >
                Compare Plans
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* PREMIUM FEATURES */}
      <section
        id="premium-features"
        className="mx-auto max-w-7xl px-6 py-14 sm:py-18"
      >
        <div className="max-w-3xl">
          <p className="text-sm font-black uppercase tracking-[0.3em] text-cyan-300">
            Premium Features
          </p>

          <h2 className="mt-3 text-4xl font-black sm:text-5xl">
            More ways to plan, explore, share, and remember.
          </h2>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {features.map((feature) => (
            <article
              key={feature.title}
              className="relative rounded-3xl border border-white/10 bg-white/5 p-6"
            >
              {feature.comingSoon && (
                <span className="absolute right-4 top-4 rounded-full bg-amber-400/15 px-3 py-1 text-xs font-black uppercase tracking-wider text-amber-200">
                  Coming Soon
                </span>
              )}

              <div className="text-4xl">{feature.icon}</div>

              <h3 className="mt-4 pr-16 text-xl font-black">
                {feature.title}
              </h3>

              <p className="mt-3 leading-7 text-white/65">
                {feature.text}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* FREE VS PREMIUM */}
      <section
        id="compare"
        className="border-y border-white/10 bg-white/[0.03]"
      >
        <div className="mx-auto max-w-7xl px-6 py-14">
          <p className="text-sm font-black uppercase tracking-[0.3em] text-cyan-300">
            Free vs Premium
          </p>

          <h2 className="mt-3 text-4xl font-black sm:text-5xl">
            Start free. Upgrade when you want more.
          </h2>

          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-7">
              <p className="text-sm font-black uppercase tracking-widest text-white/45">
                Free
              </p>

              <h3 className="mt-3 text-3xl font-black">
                Start your adventure
              </h3>

              <div className="mt-6 space-y-4 text-white/75">
                <p>✓ AI trip planning</p>
                <p>✓ Itinerary creation</p>
                <p>✓ Live travel checks</p>
                <p>✓ Standard passport features</p>
                <p>✓ Community browsing</p>
                <p>✓ RoadTunes suggestions</p>
              </div>
            </div>

            <div className="relative rounded-3xl border border-amber-300/40 bg-amber-400/10 p-7">
              <span className="absolute right-5 top-5 rounded-full bg-amber-400 px-3 py-1 text-xs font-black text-slate-950">
                PREMIUM
              </span>

              <p className="text-sm font-black uppercase tracking-widest text-amber-300">
                TrippinDays Premium
              </p>

              <h3 className="mt-3 text-3xl font-black">
                Go further
              </h3>

              <div className="mt-6 space-y-4 text-white/80">
                <p>✓ Advanced AI planning</p>
                <p>✓ Custom passport stamps</p>
                <p>✓ Publish trips and photos</p>
                <p>✓ Social travel features</p>
                <p>✓ Music service connections</p>
                <p>✓ Premium profile features</p>
                <p>✓ Early access to new tools</p>
                <p>✓ Future translator and booking features</p>
              </div>
            </div>
          </div>
        </div>
      </section>
{/* UPGRADE CTA */}
<section className="mx-auto max-w-5xl px-6 py-16 text-center">
  <div className="rounded-[2rem] border border-amber-300/30 bg-gradient-to-br from-amber-400/10 to-sky-500/10 p-8 sm:p-12">
    
    <div className="text-5xl">⭐</div>

    <p className="mt-4 text-sm font-black uppercase tracking-[0.3em] text-amber-300">
      TrippinDays Premium
    </p>

    <h2 className="mt-3 text-4xl font-black">
      Unlock the Full Adventure
    </h2>

    <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-white/70">
      Get more from every trip with Premium planning tools,
      customization, community features, and more.
    </p>

    {/* PRICING */}
    <div className="mx-auto mt-10 grid max-w-2xl gap-4 sm:grid-cols-2">
      
      {/* MONTHLY */}
      <div
  onClick={() => setSelectedPlan("monthly")}
  className={`cursor-pointer rounded-3xl border p-6 transition ${
    selectedPlan === "monthly"
      ? "border-sky-400 bg-sky-500/15 ring-2 ring-sky-400/40"
      : "border-white/15 bg-black/20"
  }`}
>
        <p className="text-sm font-black uppercase tracking-widest text-sky-300">
          Monthly
        </p>

        <div className="mt-3">
          <span className="text-5xl font-black">$4.99</span>
          <span className="text-white/60"> / month</span>
        </div>
      </div>

      {/* YEARLY */}
      <div
  onClick={() => setSelectedPlan("yearly")}
  className={`relative cursor-pointer rounded-3xl border p-6 transition ${
    selectedPlan === "yearly"
      ? "border-amber-300 bg-amber-400/15 ring-2 ring-amber-300/40"
      : "border-white/15 bg-black/20"
  }`}
>
        
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-amber-300 px-4 py-1 text-xs font-black text-slate-950">
          BEST VALUE
        </div>

        <p className="text-sm font-black uppercase tracking-widest text-amber-300">
          Yearly
        </p>

        <div className="mt-3">
          <span className="text-5xl font-black">$49.99</span>
          <span className="text-white/60"> / year</span>
        </div>

        <p className="mt-2 text-sm font-bold text-emerald-300">
          Save about $10 per year
        </p>
      </div>
    </div>

  <button
  type="button"
  onClick={() => void startCheckout()}
  className="mt-8 rounded-2xl bg-amber-400 px-8 py-4 text-lg font-black text-slate-950 hover:bg-amber-300"
>
  ⭐ Upgrade to Premium
</button>
    <p className="mt-4 text-sm text-white/50">
      Cancel anytime.
    </p>

  </div>
</section>

      <footer className="border-t border-white/10 px-6 py-8 text-center text-sm text-white/40">
        TrippinDays — Plan. Pack. Go.
      </footer>
    </main>
  );
}