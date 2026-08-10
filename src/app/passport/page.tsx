"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import StampGrid from "@/components/passport/StampGrid";
import StampModal from "@/components/passport/StampModal";
import SiteHeader from "@/components/SiteHeader";

import type {
  EarnedStamp,
  PassportStamp,
} from "@/lib/passportTypes";

export default function PassportPage() {
  const [passportStamps, setPassportStamps] = useState<PassportStamp[]>([]);
  const [earnedStamps, setEarnedStamps] = useState<EarnedStamp[]>([]);
  const [showAllStamps, setShowAllStamps] = useState(false);

  const [selectedStamp, setSelectedStamp] =
    useState<PassportStamp | null>(null);

  const [selectedPhotoUrl, setSelectedPhotoUrl] =
    useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    void loadPassport();
  }, []);

  async function loadPassport() {
    try {
      setLoading(true);
      setErrorMessage("");

      const supabase = createClient();

      const {
        data: catalog,
        error: catalogError,
      } = await supabase
        .from("stamps")
        .select(
          `
          id,
          slug,
          name,
          location,
          category,
          image_url,
          prompt,
          status,
          latitude,
          longitude,
          unlock_radius,
          state,
          country,
          description,
          difficulty,
          featured,
          created_at,
          updated_at
        `
        )
        .eq("status", "approved")
        .order("featured", {
          ascending: false,
        })
        .order("name", {
          ascending: true,
        });

      if (catalogError) {
        throw catalogError;
      }

      setPassportStamps(
        (catalog ?? []) as PassportStamp[]
      );

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        setSignedIn(false);
        setEarnedStamps([]);
        return;
      }

      setSignedIn(true);

      const {
        data: earned,
        error: earnedError,
      } = await supabase
        .from("user_stamps")
        .select(
          `
          stamp_slug,
          earned_at,
          verification_photo_path
        `
        )
        .eq("user_id", user.id)
        .order("earned_at", {
          ascending: false,
        });

      if (earnedError) {
        throw earnedError;
      }

      setEarnedStamps(
        (earned ?? []) as EarnedStamp[]
      );
    } catch (error) {
      console.error(
        "Passport load error:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The passport could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }

  const unlockedSlugs = useMemo(
    () =>
      earnedStamps.map(
        (stamp) => stamp.stamp_slug
      ),
    [earnedStamps]
  );

  const visibleStamps = useMemo(
    () =>
      showAllStamps
        ? passportStamps
        : passportStamps.slice(0, 10),
    [passportStamps, showAllStamps]
  );

  const selectedEarnedStamp =
    selectedStamp
      ? earnedStamps.find(
          (stamp) =>
            stamp.stamp_slug ===
            selectedStamp.slug
        ) ?? null
      : null;

  const collectedCount =
    unlockedSlugs.length;

  const lockedCount = Math.max(
    passportStamps.length - collectedCount,
    0
  );

  const completionPercent =
    passportStamps.length === 0
      ? 0
      : Math.round(
          (collectedCount /
            passportStamps.length) *
            100
        );

  const passportLevel =
    collectedCount >= 25
      ? "Road Legend"
      : collectedCount >= 10
      ? "Trailblazer"
      : collectedCount >= 5
      ? "Explorer"
      : "Rookie";

  async function openUnlockedStamp(
    stamp: PassportStamp
  ) {
    setSelectedStamp(stamp);
    setSelectedPhotoUrl(null);

    const earned = earnedStamps.find(
      (item) =>
        item.stamp_slug === stamp.slug
    );

    if (
      !earned?.verification_photo_path
    ) {
      return;
    }

    const supabase = createClient();

    const {
      data,
      error,
    } = await supabase.storage
      .from("stamp-verification-photos")
      .createSignedUrl(
        earned.verification_photo_path,
        60 * 10
      );

    if (!error && data) {
      setSelectedPhotoUrl(
        data.signedUrl
      );
    }
  }

  return (
    <main className="min-h-screen bg-[#061426] text-white">
      <SiteHeader />

      {/* PASSPORT HERO / BANNER */}
      <section
        className="relative min-h-[380px] overflow-hidden border-b border-white/10"
        style={{
          backgroundImage:
            "url('/images/passport1.png')",
          backgroundSize: "cover",
          backgroundPosition: "center 5%",
          backgroundRepeat: "no-repeat",
        }}
      >
        {/* Dark overlay so text stays readable */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/35 to-[#061426]/95" />

        <div className="relative mx-auto max-w-7xl px-6 py-16">
          <p className="text-sm font-black uppercase tracking-[0.28em] text-cyan-300">
            Your Travel Log
          </p>

          <h1 className="mt-5 text-5xl font-black drop-shadow-lg sm:text-6xl">
            My Passport
          </h1>

          <p className="mt-5 max-w-2xl text-xl leading-8 text-white/90 drop-shadow">
            Visit destinations, verify
            your location, add a photo,
            and collect a stamp. 
            Collect them all.
            
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard
              label="Available"
              value={
                passportStamps.length
              }
            />

            <StatCard
              label="Collected"
              value={
                loading
                  ? "…"
                  : collectedCount
              }
            />

            <StatCard
              label="Locked"
              value={
                loading
                  ? "…"
                  : lockedCount
              }
            />

            <StatCard
              label="Complete"
              value={`${completionPercent}%`}
            />

            <StatCard
              label="Level"
              value={passportLevel}
            />
          </div>

          <div className="mt-6 h-3 overflow-hidden rounded-full bg-white/15 backdrop-blur-sm">
            <div
              className="h-full rounded-full bg-cyan-400 transition-all duration-500"
              style={{
                width: `${completionPercent}%`,
              }}
            />
          </div>
        </div>
      </section>

      {/* PASSPORT CONTENT */}
      <section className="mx-auto max-w-7xl px-6 py-10 pb-28">
        {!signedIn && !loading && (
          <div className="mb-6 rounded-3xl border border-amber-300/20 bg-amber-400/10 p-6">
            <h2 className="text-2xl font-black">
              Sign in to collect stamps
            </h2>

            <p className="mt-2 text-white/65">
              You may browse available
              stamps, but earned stamps are
              saved to your TrippinDays
              account.
            </p>

            <a
              href="/login?redirect=/passport"
              className="mt-5 inline-flex rounded-2xl bg-amber-400 px-5 py-3 font-black text-slate-950 transition hover:bg-amber-300"
            >
              Sign In
            </a>
          </div>
        )}

        {errorMessage && (
          <div className="mb-6 rounded-3xl border border-red-400/20 bg-red-500/10 p-6">
            <h2 className="text-xl font-black text-red-200">
              Passport Error
            </h2>

            <p className="mt-2 text-red-100/75">
              {errorMessage}
            </p>

            <button
              type="button"
              onClick={() =>
                void loadPassport()
              }
              className="mt-5 rounded-2xl bg-red-400 px-5 py-3 font-black text-slate-950 transition hover:bg-red-300"
            >
              Try Again
            </button>
          </div>
        )}

        <section className="rounded-[2rem] border border-white/10 bg-[#102b4a]/90 p-6 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-black uppercase tracking-widest text-cyan-300">
                Collection
              </p>

              <h2 className="mt-2 text-3xl font-black">
                Passport Stamps
              </h2>
            </div>

            {passportStamps.length >
              10 && (
              <button
                type="button"
                onClick={() =>
                  setShowAllStamps(
                    (current) =>
                      !current
                  )
                }
                className="rounded-full border border-cyan-300/30 px-5 py-2 font-bold text-cyan-300 transition hover:bg-cyan-400/10"
              >
                {showAllStamps
                  ? "Show Less"
                  : `View All ${passportStamps.length} Stamps`}
              </button>
            )}
          </div>

          {loading ? (
            <div className="py-20 text-center">
              <div className="text-5xl">
                🛂
              </div>

              <p className="mt-4 font-bold text-white/60">
                Loading your passport...
              </p>
            </div>
          ) : passportStamps.length ===
            0 ? (
            <div className="py-20 text-center">
              <div className="text-5xl">
                📭
              </div>

              <p className="mt-4 font-bold text-white/60">
                No approved stamps are
                available yet.
              </p>
            </div>
          ) : (
            <StampGrid
              stamps={visibleStamps}
              unlockedSlugs={
                unlockedSlugs
              }
              onOpenUnlocked={(
                stamp
              ) =>
                void openUnlockedStamp(
                  stamp
                )
              }
            />
          )}
        </section>
      </section>

      <StampModal
        stamp={selectedStamp}
        earnedAt={
          selectedEarnedStamp
            ?.earned_at ?? null
        }
        photoUrl={selectedPhotoUrl}
        onClose={() => {
          setSelectedStamp(null);
          setSelectedPhotoUrl(null);
        }}
      />
    </main>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-3xl border border-white/20 bg-black/30 p-5 shadow-lg backdrop-blur-md">
      <p className="text-sm font-bold text-white/60">
        {label}
      </p>

      <p className="mt-2 text-3xl font-black text-white">
        {value}
      </p>
    </div>
  );
}