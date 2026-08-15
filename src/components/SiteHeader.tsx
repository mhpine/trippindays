"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function SiteHeader() {
  const [signedIn, setSignedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

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
    alert(
      "The TrippinDays iPhone app is coming soon. For now, use TrippinDays in Safari and add it to your Home Screen."
    );
    return;
  }

  window.location.href = "/downloads/TrippinDays.apk";
}
  return (
    <header className="border-b border-white/10 bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-3">

        {/* TOP ROW */}
        <div className="flex items-center justify-between gap-3">
          {/* LOGO */}
          <a
            href="/"
            className="shrink-0 text-xl font-black tracking-tight sm:text-2xl"
          >
            <span className="text-white">Trippin</span>
            <span className="text-cyan-400">Days</span>
          </a>

          {/* DESKTOP NAV */}
          <nav className="hidden items-center gap-2 md:flex">
            <a
              href="/downloads/TrippinDays.apk"
              download
              className="rounded-full bg-sky-500 px-4 py-2 font-bold text-white hover:bg-sky-400"
            >
              📱 Get App
            </a>

            <a
              href="/"
              className="rounded-full px-4 py-2 font-bold hover:bg-white/10"
            >
              Home
            </a>
{signedIn && (
  <>
            <a
              href="/passport"
              className="rounded-full px-4 py-2 font-bold hover:bg-white/10"
            >
              Passport
              
            </a>

            <a
              href="/journal"
              className="rounded-full px-4 py-2 font-bold hover:bg-white/10"
            >
              Journal
            </a>

            <a
              href="/community"
              className="rounded-full px-4 py-2 font-bold hover:bg-white/10"
            >
              Community
            </a>

            <a
              href="/feedback"
              className="rounded-full px-4 py-2 font-bold hover:bg-white/10"
            >
              Feedback
            </a>
<a
  href="/premium"
  className="rounded-xl bg-amber-400 px-4 py-3 font-black text-slate-950 hover:bg-amber-300"
>
    Premium
  </a>
</>
)}

{!loading && !signedIn && (
              <a
                href="/login"
                className="rounded-full border border-white/20 px-4 py-2 font-bold hover:bg-white/10"
              >
                Log In
              </a>
            )}

            {!loading && signedIn && (
              <>
                <a
                  href="/profile"
                  className="rounded-full border border-sky-400/40 px-4 py-2 font-bold text-sky-300 hover:bg-sky-400/10"
                >
                  My Account
                </a>

                <button
                  type="button"
                  onClick={() => void logOut()}
                  className="rounded-full border border-white/20 px-4 py-2 font-bold hover:bg-white/10"
                >
                  Log Out
                </button>
              </>
            )}
          </nav>

          {/* MOBILE CONTROLS */}
          <div className="flex items-center gap-2 md:hidden">
           <button
  type="button"
  onClick={handleGetApp}
  className="rounded-full bg-sky-500 px-3 py-2 text-sm font-bold text-white"
>
  📱 Get App
</button>

            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className="rounded-full border border-white/20 px-3 py-2 text-xl font-bold"
              aria-label="Open navigation menu"
              aria-expanded={menuOpen}
            >
              ☰
            </button>
          </div>
        </div>

        {/* MOBILE MENU */}
        {menuOpen && (
          <nav className="mt-3 grid gap-2 border-t border-white/10 pt-3 md:hidden">
            <a
              href="/"
              onClick={() => setMenuOpen(false)}
              className="rounded-xl px-4 py-3 font-bold hover:bg-white/10"
            >
              Home
            </a>

            <a
              href="/passport"
              onClick={() => setMenuOpen(false)}
              className="rounded-xl px-4 py-3 font-bold hover:bg-white/10"
            >
              Passport
            </a>

            <a
              href="/journal"
              onClick={() => setMenuOpen(false)}
              className="rounded-xl px-4 py-3 font-bold hover:bg-white/10"
            >
              Journal
            </a>

            <a
              href="/community"
              onClick={() => setMenuOpen(false)}
              className="rounded-xl px-4 py-3 font-bold hover:bg-white/10"
            >
              Community
            </a>

            <a
              href="/feedback"
              onClick={() => setMenuOpen(false)}
              className="rounded-xl px-4 py-3 font-bold hover:bg-white/10"
            >
              Feedback
            </a>
            <a
  href="/premium"
  className="rounded-full bg-amber-400 px-4 py-2 font-black text-slate-950 hover:bg-amber-300"
>
  Premium
</a>

            {!loading && !signedIn && (
              <a
                href="/login"
                onClick={() => setMenuOpen(false)}
                className="rounded-xl px-4 py-3 font-bold hover:bg-white/10"
              >
                Log In
              </a>
            )}

            {!loading && signedIn && (
              <>
                <a
                  href="/profile"
                  onClick={() => setMenuOpen(false)}
                  className="rounded-xl px-4 py-3 font-bold text-sky-300 hover:bg-white/10"
                >
                  My Account
                </a>

                <button
                  type="button"
                  onClick={() => void logOut()}
                  className="rounded-xl px-4 py-3 text-left font-bold hover:bg-white/10"
                >
                  Log Out
                </button>
              </>
            )}
          </nav>
        )}
      </div>
    </header>
  );
}