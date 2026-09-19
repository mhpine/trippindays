"use client";

import { useState } from "react";

const links = [
  { label: "Plan Trip", href: "/#planner", icon: "🗺️" },
  { label: "On the Water", href: "/on-the-water", icon: "🌊" },
  { label: "Off the Road", href: "/off-the-road", icon: "🏔️", active: true },
  { label: "Destinations", href: "/#ideas", icon: "📍" },
  { label: "Passport", href: "/passport", icon: "🛂" },
  { label: "Journal", href: "/journal", icon: "📖" },
  { label: "Community", href: "/community", icon: "🌎" },
  { label: "My Trips", href: "/saved-trips", icon: "🧳" },
];

export default function OffTheRoadHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="absolute inset-x-0 top-0 z-[9990] border-b border-white/10 bg-[#20291b]/85 text-white shadow-lg backdrop-blur-md">
      <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <a href="/" className="shrink-0">
          <div className="text-2xl font-black italic leading-none text-white sm:text-3xl">
            TrippinDays
          </div>
          <div className="mt-1 text-[11px] font-black text-orange-400 sm:text-xs">
            Plan. Pack. Go.
          </div>
        </a>

        <nav
          className="hidden items-center gap-3 text-sm font-bold xl:flex"
          aria-label="Main navigation"
        >
          {links.map((link) => (
            <a
              key={link.href + link.label}
              href={link.href}
              aria-current={link.active ? "page" : undefined}
              className={
                link.active
                  ? "rounded-xl bg-[#718653]/35 px-3 py-2 text-[#e9f2d9] ring-1 ring-[#a5bd7d]/60"
                  : link.label === "On the Water"
                    ? "rounded-xl px-2 py-2 transition hover:bg-cyan-500/15 hover:text-cyan-200"
                    : "rounded-xl px-2 py-2 transition hover:bg-white/10 hover:text-orange-300"
              }
            >
              {link.label}
            </a>
          ))}

          <a
            href="/premium"
            className="rounded-xl bg-orange-500 px-3 py-2 font-black text-white transition hover:bg-orange-600"
          >
            Premium
          </a>
        </nav>

        <div className="flex items-center gap-2">
          <a
            href="/account"
            className="hidden rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-xs font-black text-white transition hover:bg-white/20 sm:inline-flex"
          >
            👤 Account
          </a>

          <button
            type="button"
            onClick={() => setMobileOpen((open) => !open)}
            aria-label="Open navigation"
            aria-expanded={mobileOpen}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#718653] text-xl font-black text-white shadow lg:h-11 lg:w-11 xl:hidden"
          >
            {mobileOpen ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-white/10 bg-[#20291b]/98 px-4 pb-4 xl:hidden sm:px-6">
          <nav
            className="mx-auto grid max-w-[1500px] grid-cols-1 gap-1 pt-3 text-sm font-bold sm:grid-cols-2"
            aria-label="Mobile navigation"
          >
            {links.map((link) => (
              <a
                key={link.href + link.label}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                aria-current={link.active ? "page" : undefined}
                className={
                  link.active
                    ? "flex items-center gap-3 rounded-xl bg-[#718653]/35 px-4 py-3 text-[#e9f2d9] ring-1 ring-[#a5bd7d]/50"
                    : "flex items-center gap-3 rounded-xl px-4 py-3 transition hover:bg-white/10"
                }
              >
                <span aria-hidden="true">{link.icon}</span>
                <span>{link.label}</span>
              </a>
            ))}

            <a
              href="/premium"
              onClick={() => setMobileOpen(false)}
              className="mt-1 flex items-center gap-3 rounded-xl bg-orange-500 px-4 py-3 font-black text-white sm:mt-0"
            >
              <span aria-hidden="true">⭐</span>
              <span>Premium</span>
            </a>

            <a
              href="/account"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-3 rounded-xl border border-white/15 bg-white/5 px-4 py-3"
            >
              <span aria-hidden="true">👤</span>
              <span>Account</span>
            </a>
          </nav>
        </div>
      )}
    </header>
  );
}
