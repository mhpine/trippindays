"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function SiteHeader() {
  const [signedIn, setSignedIn] = useState(false);
  const [loading, setLoading] = useState(true);

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

  return (
    <header className="bg-slate-950 text-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">

        {/* TRIPPINDAYS LOGO */}
        <a
          href="/"
          className="shrink-0 text-2xl font-black tracking-tight"
        >
          <span className="text-white">Trippin</span>
          <span className="text-cyan-400">Days</span>
        </a>

        {/* NAVIGATION */}
        <nav className="flex flex-wrap items-center gap-2">

          {/* ANDROID APP DOWNLOAD */}
          <a
            href="/downloads/TrippinDays.apk"
            download
            className="relative -left-20 rounded-full bg-sky-500 px-4 py-2 font-bold text-white hover:bg-sky-400"
          >
            📱 Get App
          </a>

          <a
            href="/"
            className="rounded-full px-4 py-2 font-bold hover:bg-white/10"
          >
            Home
          </a>

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
      </div>
    </header>
  );
}