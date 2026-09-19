"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import SiteHeader from "@/components/SiteHeader";

type BillingInterval = "monthly" | "yearly";
type MembershipTier = "single" | "ultra";
type PlannerAccess =
  | "trip_planner"
  | "on_the_water"
  | "off_the_road"
  | "in_the_air";

const planners: Array<{
  id: PlannerAccess;
  icon: string;
  name: string;
  description: string;
}> = [
  {
    id: "trip_planner",
    icon: "🚗",
    name: "Trip Planner",
    description: "Road trips, day trips, weekends, itineraries, budgets, and live travel checks.",
  },
  {
    id: "on_the_water",
    icon: "🌊",
    name: "On the Water",
    description: "Boating, fishing, paddling, marine conditions, launches, access, and water adventures.",
  },
  {
    id: "off_the_road",
    icon: "🏔️",
    name: "Off the Road",
    description: "Trails, OHV, hunting, climbing, winter adventures, access, conditions, and backcountry tools.",
  },
  {
    id: "in_the_air",
    icon: "🪂",
    name: "In the Air",
    description: "Air-adventure planning for activities available in your region.",
  },
];

const features = [
  {
    icon: "🤖",
    title: "Advanced AI Planning",
    text: "Detailed planning built around your budget, time, interests, location, and travel style.",
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
    text: "Voice, camera, conversation, phrasebook, cultural, and emergency translation tools.",
    comingSoon: true,
  },
  {
    icon: "✈️",
    title: "Travel Booking",
    text: "Flights, trains, rental cars, cruises, and lodging integrations.",
    
  },
  {
    icon: "⭐",
    title: "Ultra Extras",
    text: "All planners plus cross-site premium tools, exclusive features, and early access.",
  },
];

export default function PremiumPage() {
  const [signedIn, setSignedIn] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const [selectedTier, setSelectedTier] =
    useState<MembershipTier>("single");
  const [selectedBilling, setSelectedBilling] =
    useState<BillingInterval>("yearly");
  const [selectedPlanner, setSelectedPlanner] =
    useState<PlannerAccess>("trip_planner");

  useEffect(() => {
    const supabase = createClient();

    async function checkUser() {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setSignedIn(false);
        setIsPremium(false);
        setLoading(false);
        return;
      }

      setSignedIn(true);

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("is_premium")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        console.error("Membership check failed:", profileError);
        setIsPremium(false);
      } else {
        setIsPremium(profile?.is_premium === true);
      }

      setLoading(false);
    }

    void checkUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void checkUser();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const selectedPlan =
    `${selectedTier}-${selectedBilling}` as
      | "single-monthly"
      | "single-yearly"
      | "ultra-monthly"
      | "ultra-yearly";

  const selectedPrice =
    selectedTier === "single"
      ? selectedBilling === "monthly"
        ? "$4.99"
        : "$49.99"
      : selectedBilling === "monthly"
        ? "$9.99"
        : "$99.99";

  const selectedPeriod =
    selectedBilling === "monthly" ? "/ month" : "/ year";

  async function startCheckout() {
    if (checkoutLoading) return;

    if (!signedIn) {
      const redirect = encodeURIComponent("/premium");
      window.location.href = `/login?redirect=${redirect}`;
      return;
    }

    if (isPremium) {
      alert(
        "Your account already has an active Premium membership. We will add plan changes and upgrades through membership management next."
      );
      return;
    }

    try {
      setCheckoutLoading(true);

      const payload: {
        plan: typeof selectedPlan;
        planner?: PlannerAccess;
      } = {
        plan: selectedPlan,
      };

      if (selectedTier === "single") {
        payload.planner = selectedPlanner;
      }

      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.status === 401) {
        const redirect = encodeURIComponent("/premium");
        window.location.href = `/login?redirect=${redirect}`;
        return;
      }

      if (!response.ok || !data.url) {
        throw new Error(data.error || "Unable to start checkout.");
      }

      window.location.href = data.url;
    } catch (error) {
      console.error("Checkout error:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Unable to start membership checkout. Please try again."
      );
    } finally {
      setCheckoutLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#061426] text-white">
      <SiteHeader />

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
              TrippinDays Memberships
            </p>

            <h1 className="mt-4 text-5xl font-black leading-tight sm:text-7xl">
              Pick your adventure.
              <span className="block text-cyan-300">
                Unlock more of TrippinDays.
              </span>
            </h1>

            <p className="mt-5 max-w-2xl text-lg leading-8 text-white/85 sm:text-xl">
              Choose one complete planner with Single Planner, or unlock every
              planner and the full premium experience with Ultra.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <a
                href="#plans"
                className="rounded-2xl bg-amber-400 px-6 py-4 font-black text-slate-950 hover:bg-amber-300"
              >
                ⭐ See Memberships
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

      <section
        id="premium-features"
        className="mx-auto max-w-7xl px-6 py-14 sm:py-18"
      >
        <div className="max-w-3xl">
          <p className="text-sm font-black uppercase tracking-[0.3em] text-cyan-300">
            More TrippinDays
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

      <section
        id="compare"
        className="border-y border-white/10 bg-white/[0.03]"
      >
        <div className="mx-auto max-w-7xl px-6 py-14">
          <p className="text-sm font-black uppercase tracking-[0.3em] text-cyan-300">
            Compare Memberships
          </p>

          <h2 className="mt-3 text-4xl font-black sm:text-5xl">
            Free, one planner, or everything.
          </h2>

          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-7">
              <p className="text-sm font-black uppercase tracking-widest text-white/45">
                Free
              </p>

              <h3 className="mt-3 text-3xl font-black">
                Start exploring
              </h3>

              <div className="mt-6 space-y-4 text-white/75">
                <p>✓ Free TrippinDays features</p>
                <p>✓ Standard trip planning</p>
                <p>✓ Itinerary creation</p>
                <p>✓ Live travel checks</p>
                <p>✓ Standard passport features</p>
                <p>✓ Community browsing</p>
              </div>
            </div>

            <div className="relative rounded-3xl border border-cyan-300/40 bg-cyan-400/10 p-7">
              <span className="absolute right-5 top-5 rounded-full bg-cyan-300 px-3 py-1 text-xs font-black text-slate-950">
                CHOOSE ONE
              </span>

              <p className="text-sm font-black uppercase tracking-widest text-cyan-300">
                Single Planner
              </p>

              <h3 className="mt-3 text-3xl font-black">
                One complete planner
              </h3>

              <div className="mt-6 space-y-4 text-white/80">
                <p>✓ Choose any one planner</p>
                <p>✓ Full access to that planner</p>
                <p>✓ Monthly or yearly membership</p>
                <p>✓ Change/upgrade options can be added through account management</p>
              </div>

              <p className="mt-7 text-2xl font-black">
                $4.99
                <span className="text-sm font-bold text-white/55">
                  {" "}
                  / month
                </span>
              </p>
            </div>

            <div className="relative rounded-3xl border border-amber-300/40 bg-amber-400/10 p-7">
              <span className="absolute right-5 top-5 rounded-full bg-amber-400 px-3 py-1 text-xs font-black text-slate-950">
                EVERYTHING
              </span>

              <p className="text-sm font-black uppercase tracking-widest text-amber-300">
                Ultra
              </p>

              <h3 className="mt-3 text-3xl font-black">
                The full adventure
              </h3>

              <div className="mt-6 space-y-4 text-white/80">
                <p>✓ Trip Planner</p>
                <p>✓ On the Water</p>
                <p>✓ Off the Road</p>
                <p>✓ In the Air</p>
                <p>✓ Cross-site Ultra features</p>
                <p>✓ Premium extras and early access</p>
              </div>

              <p className="mt-7 text-2xl font-black">
                $9.99
                <span className="text-sm font-bold text-white/55">
                  {" "}
                  / month
                </span>
              </p>
            </div>
          </div>
        </div>
      </section>

      <section
        id="plans"
        className="mx-auto max-w-6xl px-6 py-16"
      >
        <div className="rounded-[2rem] border border-amber-300/30 bg-gradient-to-br from-amber-400/10 to-sky-500/10 p-7 sm:p-10">
          <div className="text-center">
            <div className="text-5xl">⭐</div>

            <p className="mt-4 text-sm font-black uppercase tracking-[0.3em] text-amber-300">
              Choose Your Membership
            </p>

            <h2 className="mt-3 text-4xl font-black">
              How do you want to TrippinDays?
            </h2>

            <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-white/70">
              Single Planner gives you one complete planner. Ultra unlocks all
              four planners plus the full premium experience.
            </p>
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-2">
            <button
              type="button"
              onClick={() => setSelectedTier("single")}
              className={`rounded-3xl border p-7 text-left transition ${
                selectedTier === "single"
                  ? "border-cyan-300 bg-cyan-400/15 ring-2 ring-cyan-300/40"
                  : "border-white/15 bg-black/20 hover:border-white/30"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-black uppercase tracking-widest text-cyan-300">
                    Single Planner
                  </p>
                  <h3 className="mt-2 text-3xl font-black">
                    Pick one complete planner
                  </h3>
                </div>

                <div className="text-3xl">🧭</div>
              </div>

              <p className="mt-4 text-white/65">
                Choose Trip Planner, On the Water, Off the Road, or In the Air.
              </p>

              <div className="mt-6">
                <span className="text-4xl font-black">
                  {selectedBilling === "monthly" ? "$4.99" : "$49.99"}
                </span>
                <span className="text-white/55">
                  {selectedBilling === "monthly" ? " / month" : " / year"}
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setSelectedTier("ultra")}
              className={`relative rounded-3xl border p-7 text-left transition ${
                selectedTier === "ultra"
                  ? "border-amber-300 bg-amber-400/15 ring-2 ring-amber-300/40"
                  : "border-white/15 bg-black/20 hover:border-white/30"
              }`}
            >
              <div className="absolute -top-3 right-6 rounded-full bg-amber-300 px-4 py-1 text-xs font-black text-slate-950">
                ALL FOUR PLANNERS
              </div>

              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-black uppercase tracking-widest text-amber-300">
                    Ultra
                  </p>
                  <h3 className="mt-2 text-3xl font-black">
                    Unlock everything
                  </h3>
                </div>

                <div className="text-3xl">⭐</div>
              </div>

              <p className="mt-4 text-white/65">
                All four planners plus premium features across TrippinDays.
              </p>

              <div className="mt-6">
                <span className="text-4xl font-black">
                  {selectedBilling === "monthly" ? "$9.99" : "$99.99"}
                </span>
                <span className="text-white/55">
                  {selectedBilling === "monthly" ? " / month" : " / year"}
                </span>
              </div>
            </button>
          </div>

          <div className="mx-auto mt-8 grid max-w-2xl gap-4 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setSelectedBilling("monthly")}
              className={`rounded-3xl border p-5 transition ${
                selectedBilling === "monthly"
                  ? "border-sky-400 bg-sky-500/15 ring-2 ring-sky-400/40"
                  : "border-white/15 bg-black/20 hover:border-white/30"
              }`}
            >
              <p className="text-sm font-black uppercase tracking-widest text-sky-300">
                Monthly
              </p>
              <p className="mt-2 font-bold text-white/65">
                Pay month to month
              </p>
            </button>

            <button
              type="button"
              onClick={() => setSelectedBilling("yearly")}
              className={`relative rounded-3xl border p-5 transition ${
                selectedBilling === "yearly"
                  ? "border-amber-300 bg-amber-400/15 ring-2 ring-amber-300/40"
                  : "border-white/15 bg-black/20 hover:border-white/30"
              }`}
            >
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-amber-300 px-4 py-1 text-xs font-black text-slate-950">
                BEST VALUE
              </div>

              <p className="text-sm font-black uppercase tracking-widest text-amber-300">
                Yearly
              </p>
              <p className="mt-2 font-bold text-emerald-300">
                {selectedTier === "single"
                  ? "Save about $10 per year"
                  : "Save about $20 per year"}
              </p>
            </button>
          </div>

          {selectedTier === "single" && (
            <div className="mt-10">
              <div className="text-center">
                <p className="text-sm font-black uppercase tracking-[0.25em] text-cyan-300">
                  Choose Your Planner
                </p>
                <h3 className="mt-2 text-2xl font-black">
                  Which planner do you want?
                </h3>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {planners.map((planner) => (
                  <button
                    key={planner.id}
                    type="button"
                    onClick={() => setSelectedPlanner(planner.id)}
                    className={`rounded-3xl border p-5 text-left transition ${
                      selectedPlanner === planner.id
                        ? "border-cyan-300 bg-cyan-400/15 ring-2 ring-cyan-300/40"
                        : "border-white/15 bg-black/20 hover:border-white/30"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{planner.icon}</span>
                      <span className="text-xl font-black">
                        {planner.name}
                      </span>
                    </div>

                    <p className="mt-3 text-sm leading-6 text-white/60">
                      {planner.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedTier === "ultra" && (
            <div className="mt-10 rounded-3xl border border-amber-300/25 bg-amber-400/10 p-6">
              <p className="font-black text-amber-200">
                Ultra includes all four planners:
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {planners.map((planner) => (
                  <div
                    key={planner.id}
                    className="rounded-2xl border border-white/10 bg-black/15 p-4 text-center"
                  >
                    <div className="text-3xl">{planner.icon}</div>
                    <div className="mt-2 font-black">{planner.name}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-10 text-center">
            <div className="text-sm font-black uppercase tracking-widest text-white/45">
              Your selection
            </div>

            <div className="mt-2 text-2xl font-black">
              {selectedTier === "single"
                ? `Single Planner — ${
                    planners.find(
                      (planner) => planner.id === selectedPlanner
                    )?.name ?? "Planner"
                  }`
                : "TrippinDays Ultra"}
            </div>

            <div className="mt-2">
              <span className="text-4xl font-black">{selectedPrice}</span>
              <span className="text-white/55"> {selectedPeriod}</span>
            </div>

            <button
              type="button"
              onClick={() => void startCheckout()}
              disabled={loading || checkoutLoading || isPremium}
              className="mt-7 rounded-2xl bg-amber-400 px-8 py-4 text-lg font-black text-slate-950 transition hover:bg-amber-300 disabled:cursor-default disabled:opacity-70"
            >
              {loading
                ? "Checking Membership..."
                : checkoutLoading
                  ? "Opening Secure Checkout..."
                  : isPremium
                    ? "✓ Membership Active"
                    : selectedTier === "single"
                      ? "Choose Single Planner"
                      : "Go Ultra"}
            </button>

            {!signedIn && !loading && (
              <p className="mt-4 text-sm text-cyan-200">
                You will be asked to sign in before checkout.
              </p>
            )}

            {isPremium && (
              <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-white/55">
                This account already has active Premium access. We will connect
                upgrades and plan changes to membership management after the new
                entitlement fields are added.
              </p>
            )}

            <p className="mt-4 text-sm text-white/50">
              Cancel anytime. Secure checkout powered by Stripe.
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 px-6 py-8 text-center text-sm text-white/40">
        TrippinDays — Plan. Pack. Go.
      </footer>
    </main>
  );
}
