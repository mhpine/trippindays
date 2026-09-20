"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

type AirActivity = {
  name: string;
  icon: string;
  image: string;
  text: string;
};

const ALL_ACTIVITIES: AirActivity[] = [
  {
    name: "Paragliding",
    icon: "🪂",
    text: "Find the right wind",
    image:
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=85",
  },
  {
    name: "Skydiving",
    icon: "🪂",
    text: "Find a jump day",
    image:
      "https://images.unsplash.com/photo-1521673252667-e05da380b252?auto=format&fit=crop&w=1200&q=85",
  },
  {
    name: "Hot-Air Ballooning",
    icon: "🎈",
    text: "Find calm air",
    image:
      "https://images.unsplash.com/photo-1507608616759-54f48f0af0ee?auto=format&fit=crop&w=1200&q=85",
  },
  {
    name: "Scenic Flights",
    icon: "✈️",
    text: "Find clear skies",
    image:
      "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=1200&q=85",
  },
  {
    name: "Helicopter Tours",
    icon: "🚁",
    text: "Find aerial tours",
    image:
      "https://images.unsplash.com/photo-1674821179056-bce199c805f8?auto=format&fit=crop&w=1200&q=85",
  },
  {
    name: "Airshows",
    icon: "🛩️",
    text: "Find aviation events",
    image:
      "https://images.unsplash.com/photo-1712107653092-0659136a321e?auto=format&fit=crop&w=1200&q=85",
  },
  {
    name: "Ziplining",
    icon: "🧗",
    text: "Find a high ride",
    image:
      "https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=1200&q=85",
  },
  {
    name: "Hang Gliding",
    icon: "🪽",
    text: "Find the lift",
    image:
      "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1200&q=85",
  },
  {
    name: "Glider Flights",
    icon: "🛩️",
    text: "Find soaring weather",
    image:
      "https://images.unsplash.com/photo-1483450388369-9ed95738483c?auto=format&fit=crop&w=1200&q=85",
  },
  {
    name: "Parasailing",
    icon: "🪂",
    text: "Find coastal air",
    image:
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=85",
  },
  {
    name: "Bungee Jumping",
    icon: "🤸",
    text: "Find the big drop",
    image:
      "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=85",
  },
];

export default function InTheAirHero() {
  const [
    availableActivities,
    setAvailableActivities,
  ] =
    useState<
      string[] | null
    >(null);

  /* =========================================================
     REGIONAL ACTIVITY AVAILABILITY

     Before search:
     Show every In the Air category.

     After regional availability comes back:
     Show the categories known to be available nearby.

     If the API sends an empty array, keep the complete set
     visible rather than leaving this section blank.
  ========================================================= */

  useEffect(() => {
    function handleAvailability(
      event: Event
    ) {
      const customEvent =
        event as CustomEvent<
          string[]
        >;

      if (
        Array.isArray(
          customEvent.detail
        )
      ) {
        setAvailableActivities(
          customEvent.detail
        );
      }
    }

    window.addEventListener(
      "trippindays:air-availability",
      handleAvailability
    );

    return () => {
      window.removeEventListener(
        "trippindays:air-availability",
        handleAvailability
      );
    };
  }, []);

  const activities =
    useMemo(() => {
      /*
        No regional search yet:
        show the whole activity catalog.
      */

      if (
        !availableActivities ||
        availableActivities.length ===
          0
      ) {
        return ALL_ACTIVITIES;
      }

      const available =
        new Set(
          availableActivities
        );

      const regional =
        ALL_ACTIVITIES.filter(
          (activity) =>
            available.has(
              activity.name
            )
        );

      /*
        Safety fallback:
        never render an empty activity section.
      */

      return regional.length >
        0
        ? regional
        : ALL_ACTIVITIES;
    }, [
      availableActivities,
    ]);

  /* =========================================================
     CHOOSE ACTIVITY
  ========================================================= */

  function chooseActivity(
    name: string
  ) {
    window.dispatchEvent(
      new CustomEvent(
        "trippindays:air-activity",
        {
          detail: name,
        }
      )
    );

    window.setTimeout(
      () => {
        document
          .getElementById(
            "air-planner"
          )
          ?.scrollIntoView({
            behavior:
              "smooth",

            block:
              "start",
          });
      },
      75
    );
  }

  return (
    <>
      {/* =====================================================
          HERO

          HERO ENDS BEFORE THE ACTIVITY CARDS.
      ===================================================== */}

      <section
        className="relative min-h-[310px] overflow-hidden bg-[#062b35] text-white sm:min-h-[370px] lg:min-h-[420px]"
        style={{
          backgroundImage:
            "linear-gradient(90deg, rgba(3,31,51,.90) 0%, rgba(3,31,51,.66) 48%, rgba(3,31,51,.25) 100%), url('https://images.unsplash.com/photo-1507608616759-54f48f0af0ee?auto=format&fit=crop&w=2200&q=88')",

          backgroundPosition:
            "center",

          backgroundSize:
            "cover",

          backgroundRepeat:
            "no-repeat",
        }}
      >
        {/* EXTRA HERO SHADING */}

        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/30" />

        <div className="relative mx-auto flex min-h-[310px] max-w-[1500px] items-center px-4 py-10 sm:min-h-[370px] sm:px-6 sm:py-14 lg:min-h-[420px] lg:px-8">

          <div className="max-w-[820px]">


            <h1 className="mt-5 text-5xl font-black italic leading-none drop-shadow-lg sm:text-6xl lg:text-7xl">
              In the{" "}
              <span className="text-cyan-300">
                Air
              </span>
            </h1>

            

          </div>

        </div>
      </section>

      {/* =====================================================
          AIR ACTIVITIES

          THIS NOW SITS UNDER THE HERO
          AND DIRECTLY ABOVE THE PLANNER.
      ===================================================== */}

      <section className="border-b border-slate-200 bg-slate-50 py-7 sm:py-9">

        <div className="mx-auto max-w-[1500px] px-4 sm:px-6 lg:px-8">

          {/* SECTION HEADING */}

          <div className="mb-5">

            <div className="text-xs font-black uppercase tracking-[0.2em] text-cyan-700">
              Choose Your Adventure
            </div>

            <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">

              <div>

                <h2 className="text-2xl font-black text-[#092530] sm:text-3xl">
                  What do you want to do?
                </h2>

                <p className="mt-1 text-sm font-medium text-slate-500">
                  Pick an air adventure and we&apos;ll load it into the planner below.
                </p>

              </div>

              {availableActivities &&
                availableActivities.length >
                  0 && (
                  <div className="rounded-full bg-emerald-50 px-3 py-2 text-[11px] font-black uppercase tracking-wide text-emerald-700">
                    ✓ Showing regional activities
                  </div>
                )}

            </div>

          </div>

          {/* =================================================
              ACTIVITY GRID

              PHONE:   2 across
              SMALL:   3 across
              DESKTOP: 5 across
              WIDE:    6 across
          ================================================= */}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">

            {activities.map(
              (activity) => (
                <button
                  key={
                    activity.name
                  }
                  type="button"
                  onClick={() =>
                    chooseActivity(
                      activity.name
                    )
                  }
                  className="group relative min-h-[165px] overflow-hidden rounded-2xl border border-slate-200 bg-[#062b35] text-left shadow-md transition duration-200 hover:-translate-y-1 hover:border-cyan-400 hover:shadow-xl sm:min-h-[185px]"
                >
                  {/* FALLBACK IF IMAGE FAILS */}

                  <div className="absolute inset-0 bg-gradient-to-br from-[#0a7196] via-[#075071] to-[#062b35]" />

                  {/* ACTIVITY PHOTO */}

                  <img
                    src={
                      activity.image
                    }
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    onError={(
                      event
                    ) => {
                      event.currentTarget.style.display =
                        "none";
                    }}
                  />

                  {/* DARK IMAGE OVERLAY */}

                  <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/25 to-black/5" />

                  {/* CARD CONTENT */}

                  <div className="absolute inset-x-0 bottom-0 p-4 text-white">

                    <div className="text-2xl drop-shadow-md">
                      {
                        activity.icon
                      }
                    </div>

                    <div className="mt-2 text-base font-black leading-tight drop-shadow sm:text-lg">
                      {
                        activity.name
                      }
                    </div>

                    <div className="mt-1 text-xs font-bold text-cyan-100 drop-shadow">
                      {
                        activity.text
                      }
                    </div>

                  </div>

                </button>
              )
            )}

          </div>

        </div>

      </section>
    </>
  );
}