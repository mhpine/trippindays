"use client";

const activities = [
  {
    title: "Surfing",
    subtitle: "Chase the best waves",
    icon: "🌊",
    image: "/images/surfing.jpg",
  },
  {
    title: "Personal Water Craft",
    subtitle: "Find the action",
    icon: "🚤",
    image: "/images/seadoo.png",
  },
  {
    title: "Fishing",
    subtitle: "Find the best bites",
    icon: "🎣",
    image: "/images/fishing1.png",
  },
  {
    title: "Kayak / Paddle",
    subtitle: "Find calm water",
    icon: "🛶",
    image: "/images/paddleboard.png",
  },
  {
    title: "Sailing",
    subtitle: "Find the wind",
    icon: "⛵",
    image: "/images/sailing.png",
  },
];

export default function OnTheWaterHero() {
  function chooseActivity(activity: string) {
    window.dispatchEvent(
      new CustomEvent("trippindays:water-activity", {
        detail: activity,
      })
    );

    document.getElementById("water-planner")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  return (
    <>
      <section className="relative overflow-hidden bg-[#064a6c]">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=2000&q=90')",
          }}
        />

        <div className="absolute inset-0 bg-gradient-to-r from-[#04324c]/95 via-[#075473]/75 to-[#075473]/20" />

        <div className="relative mx-auto max-w-[1500px] px-5 py-12 sm:px-8 lg:px-10">
          <div className="max-w-[800px] py-8">
            <p className="mb-2 text-2xl font-medium italic text-white">
              Find Your Adventure
            </p>

            <h1 className="text-5xl font-black tracking-tight text-white sm:text-6xl lg:text-7xl">
              On the{" "}
              <span className="text-[#27e1dc]">
                Water
              </span>
            </h1>

            <p className="mt-3 text-xl font-bold text-white">
              Real conditions. Better days. Bigger adventures.
            </p>

            <p className="mt-3 max-w-[720px] text-base leading-relaxed text-slate-100 sm:text-lg">
              Surf. Play. Fish. Paddle. Sail. On the Water finds
              the best conditions near you and helps plan the
              perfect trip around them.
            </p>
          </div>

          {/* ACTIVITY CARDS */}

          <div className="grid gap-3 pb-8 sm:grid-cols-2 lg:grid-cols-5">
            {activities.map((activity) => (
              <button
                key={activity.title}
                type="button"
                onClick={() =>
                  chooseActivity(activity.title)
                }
                className="group relative min-h-[220px] overflow-hidden rounded-xl border border-white/30 bg-slate-900 text-left shadow-xl transition hover:-translate-y-1"
              >
                <img
                  src={activity.image}
                  alt={activity.title}
                  className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-[#042e47] via-[#042e47]/25 to-transparent" />

                <div className="absolute inset-x-0 bottom-0 p-4 text-center text-white">
                  <div className="text-3xl">
                    {activity.icon}
                  </div>

                  <h2 className="mt-2 text-lg font-black">
                    {activity.title}
                  </h2>

                  <p className="mt-1 text-xs text-slate-100">
                    {activity.subtitle}
                  </p>
                </div>
              </button>
            ))}
          </div>

          {/* MESSAGE */}

          <div className="mb-6 rounded-2xl bg-[#063b59]/90 p-5 text-white shadow-lg sm:max-w-[420px]">
            <p className="text-2xl font-black leading-tight">
              Check Conditions.
              <br />
              Plan. Pack. Go.
              <br />
              <span className="text-[#27e1dc]">
                
              </span>
            </p>
          </div>
        </div>
      </section>
    </>
  );
}