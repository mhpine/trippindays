"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SiteHeader() {
  const pathname = usePathname();

  const [signedIn, setSignedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [hash, setHash] = useState("");

  useEffect(() => {
    function syncHash() {
      setHash(window.location.hash);
    }

    syncHash();
    window.addEventListener("hashchange", syncHash);

    return () => {
      window.removeEventListener("hashchange", syncHash);
    };
  }, []);

  useEffect(() => {
    const supabase = createClient();

    async function checkUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setSignedIn(!!user);

      if (!user) {
        setIsPremium(false);
        setLoading(false);
        return;
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("is_premium")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Could not check Premium status:", error);
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

  async function logOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setSignedIn(false);
    setIsPremium(false);
    window.location.href = "/";
  }

  function handleGetApp() {
    const ua = navigator.userAgent.toLowerCase();
    const isAndroid = ua.includes("android");
    const isIOS =
      /iphone|ipad|ipod/.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

    if (isAndroid) {
      window.location.href = "/downloads/TrippinDays.apk";
      return;
    }

    if (isIOS) {
      alert("For now, open TrippinDays in Safari and use Add to Home Screen.");
      return;
    }

    window.location.href = "/downloads/TrippinDays.apk";
  }

  const isLandingPage =
    pathname === "/" &&
    hash !== "#planner";

  const isRoadTripPage =
    (pathname === "/" && hash === "#planner") ||
    pathname === "/trip" ||
    pathname.startsWith("/trip/");

  const isWaterPage =
    pathname === "/on-the-water" ||
    pathname.startsWith("/on-the-water/");

  const isOffRoadPage =
    pathname === "/off-the-road" ||
    pathname.startsWith("/off-the-road/");

  const isAirPage =
    pathname === "/in-the-air" ||
    pathname.startsWith("/in-the-air/");

  const isPremiumPage =
    pathname === "/premium" ||
    pathname.startsWith("/premium/");

  const isSavedTripsPage =
    pathname === "/saved-trips" ||
    pathname.startsWith("/saved-trips/");

  const navLink =
    "transition hover:text-orange-300 whitespace-nowrap";

  const mobileLink =
    "rounded-xl px-4 py-3 font-bold hover:bg-white/10";

  return (
    <header className="sticky top-0 z-[1000] w-full border-b border-white/10 bg-[#062b35] text-white shadow-lg">
      <div className="mx-auto flex min-h-[76px] max-w-[1500px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <a href="/" className="shrink-0" aria-label="TrippinDays home">
          <div className="text-2xl font-black italic leading-none sm:text-3xl">
            <span className="text-white">Trippin</span>
            <span className="text-cyan-400">Days</span>
          </div>
          <div className="mt-1 text-[11px] font-black text-orange-400 sm:text-xs">
            Plan. Pack. Go.
          </div>
        </a>

        <nav
          className="hidden items-center gap-5 text-sm font-black xl:flex"
          aria-label="Primary navigation"
        >
        
          {!isRoadTripPage && (
            <a href="/#planner" className={navLink}>
              Road Trip
            </a>
          )}

          {!isWaterPage && (
            <a href="/on-the-water" className={navLink}>
              On the Water
            </a>
          )}

          {!isOffRoadPage && (
            <a href="/off-the-road" className={navLink}>
              Off the Road
            </a>
          )}

          {!isAirPage && (
            <a href="/in-the-air" className={navLink}>
              In the Air
            </a>
          )}

          {!isPremium && !isPremiumPage && (
            <a
              href="/premium"
              className="rounded-xl bg-orange-500 px-5 py-3 font-black text-white transition hover:bg-orange-600"
            >
              Premium
            </a>
          )}

          {!isSavedTripsPage && (
            <a href="/saved-trips" className={navLink}>
              My Trips
            </a>
          )}
        </nav>

        <div className="hidden items-center gap-2 xl:flex">
          <button
            type="button"
            onClick={handleGetApp}
            className="rounded-xl bg-white/15 px-3 py-2 text-xs font-black text-white ring-1 ring-white/30 transition hover:bg-white/20"
          >
            📲 Get App
          </button>

          {!loading && !signedIn && (
            <a
              href="/login"
              className="rounded-xl border border-white/70 bg-black/15 px-3 py-2 text-xs font-bold text-white transition hover:bg-white/10"
            >
              Sign In
            </a>
          )}

          {!loading && signedIn && (
            <button
              type="button"
              onClick={() => void logOut()}
              className="rounded-xl border border-white/70 bg-black/15 px-3 py-2 text-xs font-bold text-white transition hover:bg-white/10"
            >
              Sign Out
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 xl:hidden">
          <button
            type="button"
            onClick={handleGetApp}
            className="rounded-xl bg-white/15 px-3 py-2 text-xs font-black text-white ring-1 ring-white/30"
          >
            📲 App
          </button>

          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/30 bg-black/15 text-xl font-black"
            aria-label="Open navigation menu"
            aria-expanded={menuOpen}
          >
            {menuOpen ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav
          className="border-t border-white/10 bg-[#062b35] px-4 pb-4 pt-3 xl:hidden"
          aria-label="Mobile navigation"
        >
          <div className="mx-auto grid max-w-[1500px] gap-1">
            {!isLandingPage && (
              <a
                href="/"
                onClick={() => setMenuOpen(false)}
                className={mobileLink}
              >
                🏠 Home
              </a>
            )}

            {!isRoadTripPage && (
              <a
                href="/#planner"
                onClick={() => setMenuOpen(false)}
                className={mobileLink}
              >
                🚗 Road Trip
              </a>
            )}

            {!isWaterPage && (
              <a
                href="/on-the-water"
                onClick={() => setMenuOpen(false)}
                className={mobileLink}
              >
                🌊 On the Water
              </a>
            )}

            {!isOffRoadPage && (
              <a
                href="/off-the-road"
                onClick={() => setMenuOpen(false)}
                className={mobileLink}
              >
                🥾 Off the Road
              </a>
            )}

            {!isAirPage && (
              <a
                href="/in-the-air"
                onClick={() => setMenuOpen(false)}
                className={mobileLink}
              >
                ✈️ In the Air
              </a>
            )}

            {!isPremium && !isPremiumPage && (
              <a
                href="/premium"
                onClick={() => setMenuOpen(false)}
                className="rounded-xl bg-orange-500 px-4 py-3 font-black text-white transition hover:bg-orange-600"
              >
                ⭐ Premium
              </a>
            )}

            {!isSavedTripsPage && (
              <a
                href="/saved-trips"
                onClick={() => setMenuOpen(false)}
                className={mobileLink}
              >
                🧳 My Trips
              </a>
            )}

            {!loading && !signedIn && (
              <a
                href="/login"
                onClick={() => setMenuOpen(false)}
                className={mobileLink}
              >
                Sign In
              </a>
            )}

            {!loading && signedIn && (
              <button
                type="button"
                onClick={() => void logOut()}
                className="rounded-xl px-4 py-3 text-left font-bold hover:bg-white/10"
              >
                Sign Out
              </button>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
