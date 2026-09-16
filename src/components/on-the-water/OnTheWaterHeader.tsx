"use client";

import { useState } from "react";

export default function OnTheWaterHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLink =
    "transition-colors duration-200 hover:text-cyan-300";

  return (
    <header className="sticky top-0 z-[1000] w-full bg-[#061a34] text-white shadow-lg">
      <div className="mx-auto flex min-h-[76px] max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        {/* BRAND */}
        <a
          href="/"
          className="flex shrink-0 items-center gap-3"
          aria-label="TrippinDays home"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/20 text-2xl">
            🌊
          </div>

          <div className="leading-tight">
            <div className="text-xl font-black tracking-tight sm:text-2xl">
              TrippinDays
            </div>

            <div className="text-[10px] font-medium text-cyan-100 sm:text-xs">
              Plan. Pack. Go.
            </div>
          </div>
        </a>

        {/* DESKTOP NAV */}
        <nav
          className="hidden items-center gap-7 text-sm font-bold lg:flex xl:gap-9"
          aria-label="Primary navigation"
        >
          <a href="/" className={navLink}>
           Plan Road Trip
          </a>

          

          <a href="/passport" className={navLink}>
            Passport
          </a>

          <a href="/journal" className={navLink}>
            Journal
          </a>

          <a href="/community" className={navLink}>
            Community
          </a>
        </nav>

        {/* DESKTOP ACTIONS */}
        <div className="hidden items-center gap-3 lg:flex">
          <a
            href="#water-planner"
            aria-label="Search water adventures"
            title="Search water adventures"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-lg text-white transition hover:bg-cyan-500/30"
          >
            🔍
          </a>

          <a
            href="/account"
            aria-label="Profile"
            title="Profile"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-cyan-500 text-lg font-black text-[#061a34] transition hover:bg-cyan-300"
          >
            👤
          </a>
        </div>

        {/* MOBILE ACTIONS */}
        <div className="flex items-center gap-2 lg:hidden">
          <a
            href="#water-planner"
            aria-label="Search water adventures"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10"
          >
            🔍
          </a>

          <button
            type="button"
            onClick={() => setMobileOpen((current) => !current)}
            aria-label="Open navigation"
            aria-expanded={mobileOpen}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-500 text-xl font-black text-[#061a34]"
          >
            {mobileOpen ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {/* MOBILE MENU */}
      {mobileOpen && (
        <div className="border-t border-white/10 bg-[#061a34] px-4 pb-4 lg:hidden">
          <nav
            className="mx-auto grid max-w-[1600px] gap-1 pt-3 text-sm font-bold"
            aria-label="Mobile navigation"
          >
            <a
              href="/"
              onClick={() => setMobileOpen(false)}
              className="rounded-xl px-4 py-3 hover:bg-white/10"
            >
              Trips
            </a>

            <a
              href="/on-the-water"
              onClick={() => setMobileOpen(false)}
              className="rounded-xl bg-cyan-500/15 px-4 py-3 text-cyan-200"
              aria-current="page"
            >
              On the Water
            </a>

            <a
              href="/passport"
              onClick={() => setMobileOpen(false)}
              className="rounded-xl px-4 py-3 hover:bg-white/10"
            >
              Passport
            </a>

            <a
              href="/journal"
              onClick={() => setMobileOpen(false)}
              className="rounded-xl px-4 py-3 hover:bg-white/10"
            >
              Journal
            </a>

            <a
              href="/community"
              onClick={() => setMobileOpen(false)}
              className="rounded-xl px-4 py-3 hover:bg-white/10"
            >
              Community
            </a>

            <a
              href="/account"
              onClick={() => setMobileOpen(false)}
              className="mt-2 rounded-xl border border-cyan-400/40 bg-cyan-500/10 px-4 py-3 text-cyan-100"
            >
              👤 Account
            </a>
          </nav>
        </div>
      )}
    </header>
  );
}
