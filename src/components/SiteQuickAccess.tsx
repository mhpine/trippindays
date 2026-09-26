"use client";

import { usePathname } from "next/navigation";

type QuickAccessItem = {
  key:
    | "road-trip"
    | "water"
    | "off-road"
    | "air"
    | "passport"
    | "journal"
    | "community";
  href: string;
  icon: string;
  label: string;
  group: "planner" | "always";
};

const ITEMS: QuickAccessItem[] = [
  {
    key: "road-trip",
    href: "/#planner",
    icon: "🚗",
    label: "Road Trip",
    group: "planner",
  },
  {
    key: "water",
    href: "/on-the-water",
    icon: "🌊",
    label: "On the Water",
    group: "planner",
  },
  {
    key: "off-road",
    href: "/off-the-road",
    icon: "🥾",
    label: "Off the Road",
    group: "planner",
  },
  {
    key: "air",
    href: "/in-the-air",
    icon: "✈️",
    label: "In the Air",
    group: "planner",
  },
  {
    key: "passport",
    href: "/passport",
    icon: "📘",
    label: "Passport",
    group: "always",
  },
  {
    key: "journal",
    href: "/journal",
    icon: "📖",
    label: "Journal",
    group: "always",
  },
  {
    key: "community",
    href: "/community",
    icon: "👥",
    label: "Community",
    group: "always",
  },
];

export default function SiteQuickAccess() {
  const pathname = usePathname();

  const activePlannerKey: QuickAccessItem["key"] | null =
    pathname === "/" ||
    pathname === "/trip" ||
    pathname.startsWith("/trip/")
      ? "road-trip"
      : pathname === "/on-the-water" ||
          pathname.startsWith("/on-the-water/")
        ? "water"
        : pathname === "/off-the-road" ||
            pathname.startsWith("/off-the-road/")
          ? "off-road"
          : pathname === "/in-the-air" ||
              pathname.startsWith("/in-the-air/")
            ? "air"
            : null;

  const activeUtilityKey: QuickAccessItem["key"] | null =
    pathname === "/passport" ||
    pathname.startsWith("/passport/")
      ? "passport"
      : pathname === "/journal" ||
          pathname.startsWith("/journal/")
        ? "journal"
        : pathname === "/community" ||
            pathname.startsWith("/community/")
          ? "community"
          : null;

  const visibleItems = ITEMS.filter((item) => {
    if (item.group === "planner") {
      return item.key !== activePlannerKey;
    }

    return item.key !== activeUtilityKey;
  });

  return (
    <section
      className="border-y border-slate-200 bg-white"
      aria-label="Quick access"
    >
      <div className="mx-auto flex max-w-[1300px] flex-wrap items-center justify-center gap-x-5 gap-y-4 px-4 py-5 sm:gap-x-9">
        {visibleItems.map((item) => (
          <a
            key={item.key}
            href={item.href}
            aria-label={item.label}
            className="group flex min-w-[110px] flex-col items-center justify-center text-center"
          >
            <span
              className="text-3xl transition-transform group-hover:scale-110"
              aria-hidden="true"
            >
              {item.icon}
            </span>

            <span className="mt-2 text-sm font-black text-slate-800 transition group-hover:text-orange-600 sm:text-base">
              {item.label}
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}
