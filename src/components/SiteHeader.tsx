"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function SiteHeader() {
  const [signedIn, setSignedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
const [isPremium, setIsPremium] = useState(false);
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

  const navLink = "transition hover:text-orange-300 whitespace-nowrap";

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

        <nav className="hidden items-center gap-5 text-sm font-black xl:flex" aria-label="Primary navigation">
          <a href="/#planner" className={navLink}>
  Road Trip
</a>

<a href="/on-the-water" className={navLink}>
  On the Water
</a>

<a href="/off-the-road" className={navLink}>
  Off the Road
</a>

<a href="/in-the-air" className={navLink}>
  In the Air
</a>
          {!isPremium && (
  <a
    href="/premium"
    className="rounded-xl bg-orange-500 px-5 py-3 font-black text-white"
  >
    Premium
  </a>
)}
          <a href="/saved-trips" className={navLink}>My Trips</a>
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
            <a href="/login" className="rounded-xl border border-white/70 bg-black/15 px-3 py-2 text-xs font-bold text-white transition hover:bg-white/10">
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
        <nav className="border-t border-white/10 bg-[#062b35] px-4 pb-4 pt-3 xl:hidden" aria-label="Mobile navigation">
          <div className="mx-auto grid max-w-[1500px] gap-1">
            <a href="/#planner" onClick={() => setMenuOpen(false)} className="rounded-xl px-4 py-3 font-bold hover:bg-white/10">
              Plan a Trip
            </a>
            <a href="/on-the-water" onClick={() => setMenuOpen(false)} className="rounded-xl px-4 py-3 font-bold hover:bg-white/10">
              🌊 On the Water
            </a>
            <a href="/off-the-road" onClick={() => setMenuOpen(false)} className="rounded-xl px-4 py-3 font-bold hover:bg-white/10">
              🥾 Off the Road
            </a>
            <div className="flex items-center justify-between rounded-xl px-4 py-3 font-bold text-white/60">
              <a
  href="/in-the-air"
  onClick={() => setMenuOpen(false)}
  className="rounded-xl px-4 py-3 font-bold hover:bg-white/10"
>
  ✈️ In the Air
</a>
            </div>
            <a href="/premium" onClick={() => setMenuOpen(false)} className="rounded-xl bg-orange-500 px-4 py-3 font-black text-white">
              ⭐ Premium
            </a>
            <a href="/saved-trips" onClick={() => setMenuOpen(false)} className="rounded-xl px-4 py-3 font-bold hover:bg-white/10">
              🧳 My Trips
            </a>

            {!loading && !signedIn && (
              <a href="/login" onClick={() => setMenuOpen(false)} className="rounded-xl px-4 py-3 font-bold hover:bg-white/10">
                Sign In
              </a>
            )}

            {!loading && signedIn && (
              <button type="button" onClick={() => void logOut()} className="rounded-xl px-4 py-3 text-left font-bold hover:bg-white/10">
                Sign Out
              </button>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
