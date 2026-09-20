"use client";

type WaterActivity = {
  name: string;
  label: string;
  icon: string;
  image: string;
  text: string;
};

const WATER_ACTIVITIES: WaterActivity[] = [
  {
    name: "Surfing",
    label: "Surfing",
    icon: "🌊",
    text: "Chase the best waves",
    image:
      "https://images.unsplash.com/photo-1502680390469-be75c86b636f?auto=format&fit=crop&w=1200&q=85",
  },
  {
    name: "Personal Water Craft",
    label: "PWC / Jet Ski",
    icon: "💨",
    text: "Find smooth water",
    image:
      "https://images.unsplash.com/photo-1567899378494-47b22a2ae96a?auto=format&fit=crop&w=1200&q=85",
  },
  {
    name: "Fishing",
    label: "Fishing",
    icon: "🎣",
    text: "Find the best bite",
    image:
      "https://images.unsplash.com/photo-1541742425281-c1d3fc8aff96?auto=format&fit=crop&w=1200&q=85",
  },
  {
    name: "Kayak / Paddle",
    label: "Kayak / Paddle",
    icon: "🛶",
    text: "Find calm water",
    image:
      "https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=1200&q=85",
  },
  {
    name: "Sailing",
    label: "Sailing",
    icon: "⛵",
    text: "Find the wind",
    image:
      "https://images.unsplash.com/photo-1540946485063-a40da27545f8?auto=format&fit=crop&w=1200&q=85",
  },
];

export default function OnTheWaterHero() {
  function chooseActivity(name: string) {
    /*
      The planner already listens for this event and
      fills the matching Water activity.
    */
    window.dispatchEvent(
      new CustomEvent(
        "trippindays:water-activity",
        {
          detail: name,
        }
      )
    );

    window.setTimeout(() => {
      document
        .getElementById(
          "water-planner"
        )
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
    }, 75);
  }

  return (
    <>
      {/* =====================================================
          WATER HERO ONLY
      ===================================================== */}

      <section
className="relative min-h-[310px] overflow-hidden bg-[#062b35] text-white sm:min-h-[370px] lg:min-h-[420px]"
style={{
  backgroundImage:
    "linear-gradient(90deg, rgba(3,31,51,.72) 0%, rgba(3,31,51,.42) 48%, rgba(3,31,51,.10) 100%), url('/images/onthewater.png')",
  backgroundPosition: "center",
  backgroundSize: "cover",
  backgroundRepeat: "no-repeat",
}}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/30" />

        <div className="relative mx-auto flex min-h-[310px] max-w-[1500px] items-center px-4 py-10 sm:min-h-[370px] sm:px-6 sm:py-14 lg:min-h-[420px] lg:px-8">
          <div className="max-w-[820px]">

            

            <h1 className="mt-5 text-5xl font-black italic leading-none drop-shadow-lg sm:text-6xl lg:text-7xl">
              On the{" "}
              <span className="text-cyan-300">
                Water
              </span>
            </h1>

            

            
           
          </div>
        </div>
      </section>

      {/* =====================================================
          WATER ACTIVITY TILES

          Same setup as In the Air:
          Hero
          ↓
          Activity tiles
          ↓
          Planner
      ===================================================== */}

      <section className="border-b border-slate-200 bg-slate-50 py-7 sm:py-9">
        <div className="mx-auto max-w-[1500px] px-4 sm:px-6 lg:px-8">

          {/* HEADING */}

          <div className="mb-5">

            <div className="text-xs font-black uppercase tracking-[0.2em] text-cyan-700">
              Choose Your Adventure
            </div>

            <h2 className="mt-1 text-2xl font-black text-[#092530] sm:text-3xl">
              What do you want to do?
            </h2>

            <p className="mt-1 text-sm font-medium text-slate-500">
              Pick a water adventure and we&apos;ll load it into the planner below.
            </p>

          </div>

          {/* =================================================
              RESPONSIVE ACTIVITY GRID

              PHONE: 2 across
              TABLET: 3 across
              DESKTOP: 5 across
          ================================================= */}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">

            {WATER_ACTIVITIES.map(
              (activity) => (
                <button
                  key={activity.name}
                  type="button"
                  onClick={() =>
                    chooseActivity(
                      activity.name
                    )
                  }
                  className="group relative min-h-[165px] overflow-hidden rounded-2xl border border-slate-200 bg-[#062b35] text-left shadow-md transition duration-200 hover:-translate-y-1 hover:border-cyan-400 hover:shadow-xl sm:min-h-[185px]"
                >

                  {/* IMAGE FAILURE FALLBACK */}

                  <div className="absolute inset-0 bg-gradient-to-br from-[#087b9b] via-[#075571] to-[#062b35]" />

                  {/* PHOTO */}

                  <img
                    src={activity.image}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    onError={(event) => {
                      event.currentTarget.style.display =
                        "none";
                    }}
                  />

                  {/* DARK OVERLAY */}

                  <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/25 to-black/5" />

                  {/* TILE TEXT */}

                  <div className="absolute inset-x-0 bottom-0 p-4 text-white">

                    <div className="text-2xl drop-shadow-md">
                      {activity.icon}
                    </div>

                    <div className="mt-2 text-base font-black leading-tight drop-shadow sm:text-lg">
                      {activity.label}
                    </div>

                    <div className="mt-1 text-xs font-bold text-cyan-100 drop-shadow">
                      {activity.text}
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