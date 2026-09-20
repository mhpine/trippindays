"use client";

import { useEffect, useMemo, useState } from "react";
import useTrippinDaysLocation from "@/hooks/useTrippinDaysLocation";

type ToolkitTab =
  | "conditions"
  | "window"
  | "operator"
  | "gear"
  | "safety";

type AirConditions = {
  temperatureF: number | null;
  windSpeedMph: number | null;
  windGustMph: number | null;
  windDirection: string | null;
  visibilityMiles: number | null;
  cloudCoverPct: number | null;
  precipitationChancePct: number | null;
};

function ToolCard({
  icon,
  title,
  children,
}: {
  icon: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="text-2xl">{icon}</div>

        <div className="font-black text-[#092530]">
          {title}
        </div>
      </div>

      <div className="mt-3 text-sm leading-6 text-slate-600">
        {children}
      </div>
    </div>
  );
}

export default function AirToolkit() {
  const [open, setOpen] = useState(false);

  const [tab, setTab] =
    useState<ToolkitTab>("conditions");

  const [status, setStatus] =
    useState("");

  const [loadingConditions, setLoadingConditions] =
    useState(false);

  const [conditions, setConditions] =
    useState<AirConditions | null>(null);

  const {
    location,
    findingLocation,
    error: locationError,
    useCurrentLocation,
  } = useTrippinDaysLocation({
    autoRefreshIfGranted: true,
  });

  /* =========================================================
     ESC CLOSE
  ========================================================= */

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener(
      "keydown",
      handleKey
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKey
      );
    };
  }, []);

  /* =========================================================
     OPEN TOOLKIT EVENT
  ========================================================= */

  useEffect(() => {
    function handleOpen(event: Event) {
      const customEvent =
        event as CustomEvent<{
          tab?: ToolkitTab;
        }>;

      if (customEvent.detail?.tab) {
        setTab(customEvent.detail.tab);
      }

      setOpen(true);
    }

    window.addEventListener(
      "trippindays:open-air-toolkit",
      handleOpen
    );

    return () => {
      window.removeEventListener(
        "trippindays:open-air-toolkit",
        handleOpen
      );
    };
  }, []);

  /* =========================================================
     CONDITIONS
  ========================================================= */

  async function loadConditions() {
    if (!location) {
      setStatus(
        "Use your current location first."
      );

      return;
    }

    setLoadingConditions(true);
    setStatus("");

    try {
      const params =
        new URLSearchParams({
          latitude:
            String(
              location.latitude
            ),

          longitude:
            String(
              location.longitude
            ),

          current: [
            "temperature_2m",
            "wind_speed_10m",
            "wind_gusts_10m",
            "wind_direction_10m",
            "cloud_cover",
          ].join(","),

          hourly: [
            "visibility",
            "precipitation_probability",
          ].join(","),

          temperature_unit:
            "fahrenheit",

          wind_speed_unit:
            "mph",

          timezone:
            "auto",

          forecast_days:
            "1",
        });

      const response =
        await fetch(
          `https://api.open-meteo.com/v1/forecast?${params.toString()}`,
          {
            cache: "no-store",
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          "Unable to load air conditions."
        );
      }

      const visibilityMeters =
        Array.isArray(
          data?.hourly?.visibility
        )
          ? data.hourly.visibility[0]
          : null;

      const precipitationChance =
        Array.isArray(
          data?.hourly
            ?.precipitation_probability
        )
          ? data.hourly
              .precipitation_probability[0]
          : null;

      setConditions({
        temperatureF:
          typeof data?.current
            ?.temperature_2m === "number"
            ? data.current
                .temperature_2m
            : null,

        windSpeedMph:
          typeof data?.current
            ?.wind_speed_10m === "number"
            ? data.current
                .wind_speed_10m
            : null,

        windGustMph:
          typeof data?.current
            ?.wind_gusts_10m === "number"
            ? data.current
                .wind_gusts_10m
            : null,

        windDirection:
          typeof data?.current
            ?.wind_direction_10m === "number"
            ? `${Math.round(
                data.current
                  .wind_direction_10m
              )}°`
            : null,

        visibilityMiles:
          typeof visibilityMeters ===
          "number"
            ? Math.round(
                (visibilityMeters /
                  1609.344) *
                  10
              ) / 10
            : null,

        cloudCoverPct:
          typeof data?.current
            ?.cloud_cover === "number"
            ? data.current.cloud_cover
            : null,

        precipitationChancePct:
          typeof precipitationChance ===
          "number"
            ? precipitationChance
            : null,
      });
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Unable to load air conditions."
      );
    } finally {
      setLoadingConditions(false);
    }
  }

  useEffect(() => {
    if (
      open &&
      location &&
      tab === "conditions"
    ) {
      void loadConditions();
    }
  }, [
    open,
    tab,
    location?.latitude,
    location?.longitude,
  ]);

  /* =========================================================
     BEST WINDOW SUMMARY
  ========================================================= */

  const bestWindow =
    useMemo(() => {
      if (!conditions) {
        return "Load current conditions";
      }

      const wind =
        conditions.windSpeedMph ??
        0;

      const gust =
        conditions.windGustMph ??
        wind;

      const visibility =
        conditions.visibilityMiles ??
        0;

      const precipitation =
        conditions
          .precipitationChancePct ??
        0;

      if (
        wind <= 10 &&
        gust <= 16 &&
        visibility >= 8 &&
        precipitation <= 20
      ) {
        return "Conditions look favorable for checking operator availability.";
      }

      if (
        gust >= 30 ||
        precipitation >= 50
      ) {
        return "Conditions may be less favorable. Recheck with the operator.";
      }

      return "Mixed conditions. Verify the latest operator or pilot decision.";
    }, [conditions]);

  /* =========================================================
     LOCATION
  ========================================================= */

  async function handleUseLocation() {
    setStatus("");

    const result =
      await useCurrentLocation();

    if (!result) {
      setStatus(
        locationError ||
          "Unable to access your location."
      );
    }
  }

  return (
    <>
      {/* =====================================================
          FLOATING BUTTON
      ===================================================== */}

      {!open && (
        <button
          type="button"
          onClick={() =>
            setOpen(true)
          }
          className="fixed bottom-5 right-5 z-[99980] flex items-center gap-3 rounded-full bg-[#063e5b] px-5 py-4 font-black text-white shadow-2xl transition hover:scale-105 hover:bg-[#075b80]"
          aria-label="Open Air Toolkit"
        >
          <span className="text-2xl">
            🧭
          </span>

          <span className="hidden sm:inline">
            Air Toolkit
          </span>
        </button>
      )}

      {/* =====================================================
          BACKDROP
      ===================================================== */}

      {open && (
        <button
          type="button"
          aria-label="Close Air Toolkit"
          onClick={() =>
            setOpen(false)
          }
          className="fixed inset-0 z-[99990] bg-slate-950/40 backdrop-blur-[1px]"
        />
      )}

      {/* =====================================================
          DRAWER
      ===================================================== */}

      <aside
        className={`fixed inset-y-0 right-0 z-[99999] w-full max-w-[470px] transform overflow-y-auto bg-[#eef7fa] shadow-2xl transition-transform duration-300 ${
          open
            ? "translate-x-0"
            : "translate-x-full"
        }`}
      >
        {/* ===================================================
            HEADER
        =================================================== */}

        <div className="sticky top-0 z-10 bg-[#063e5b] px-5 pb-4 pt-5 text-white shadow-md">

          <div className="flex items-start justify-between gap-4">

            <div>

              <div className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">
                TrippinDays
              </div>

              <h2 className="mt-1 text-2xl font-black">
                ✈️ Air Toolkit
              </h2>

              <p className="mt-1 text-sm text-cyan-100">
                Flight conditions, planning tools and adventure safety.
              </p>

            </div>

            <button
              type="button"
              onClick={() =>
                setOpen(false)
              }
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-xl font-black hover:bg-white/20"
              aria-label="Close Air Toolkit"
            >
              ×
            </button>

          </div>

          {/* LOCATION */}

          <div className="mt-4 rounded-xl bg-white/10 p-3">

            <div className="text-xs font-black uppercase tracking-wider text-cyan-200">
              Current Toolkit Location
            </div>

            {location ? (
              <>
                <div className="mt-1 font-black">
                  📍{" "}
                  {location.shortLabel ||
                    location.label ||
                    "Current Location"}
                </div>

                <div className="mt-1 text-xs text-cyan-100">
                  {location.latitude.toFixed(
                    5
                  )}
                  ,{" "}
                  {location.longitude.toFixed(
                    5
                  )}
                </div>
              </>
            ) : (
              <div className="mt-1 text-sm text-cyan-100">
                GPS not loaded
              </div>
            )}

            <button
              type="button"
              onClick={() =>
                void handleUseLocation()
              }
              disabled={
                findingLocation
              }
              className="mt-3 rounded-lg bg-white px-3 py-2 text-xs font-black text-[#063e5b] disabled:opacity-60"
            >
              {findingLocation
                ? "Finding Location..."
                : "📍 Use Current GPS"}
            </button>

          </div>

          {/* ===================================================
              TABS
          =================================================== */}

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">

            {[
              [
                "conditions",
                "Conditions",
              ],

              [
                "window",
                "Best Window",
              ],

              [
                "operator",
                "Operators",
              ],

              [
                "gear",
                "Gear",
              ],

              [
                "safety",
                "Safety",
              ],
            ].map(
              ([
                value,
                label,
              ]) => (
                <button
                  key={
                    value
                  }
                  type="button"
                  onClick={() =>
                    setTab(
                      value as ToolkitTab
                    )
                  }
                  className={`whitespace-nowrap rounded-full px-3 py-2 text-xs font-black transition ${
                    tab === value
                      ? "bg-white text-[#063e5b]"
                      : "bg-white/10 text-white hover:bg-white/20"
                  }`}
                >
                  {label}
                </button>
              )
            )}

          </div>

        </div>

        {/* =====================================================
            BODY
        ===================================================== */}

        <div className="space-y-4 p-4">

          {status && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900">
              {status}
            </div>
          )}

          {/* ===================================================
              CONDITIONS
          =================================================== */}

          {tab ===
            "conditions" && (
            <>

              <div className="flex items-center justify-between">

                <div>

                  <h3 className="text-xl font-black text-[#092530]">
                    Flight Conditions
                  </h3>

                  <p className="mt-1 text-xs text-slate-500">
                    Current planning conditions near you.
                  </p>

                </div>

                <button
                  type="button"
                  onClick={() =>
                    void loadConditions()
                  }
                  disabled={
                    loadingConditions
                  }
                  className="rounded-xl bg-cyan-600 px-3 py-2 text-xs font-black text-white disabled:opacity-60"
                >
                  {loadingConditions
                    ? "Loading..."
                    : "Refresh"}
                </button>

              </div>

              <div className="grid grid-cols-2 gap-3">

                <ToolCard
                  icon="💨"
                  title="Wind"
                >
                  {conditions
                    ?.windSpeedMph !=
                  null
                    ? `${conditions.windSpeedMph} mph`
                    : "—"}
                </ToolCard>

                <ToolCard
                  icon="🌬️"
                  title="Gusts"
                >
                  {conditions
                    ?.windGustMph !=
                  null
                    ? `${conditions.windGustMph} mph`
                    : "—"}
                </ToolCard>

                <ToolCard
                  icon="🧭"
                  title="Direction"
                >
                  {conditions
                    ?.windDirection ||
                    "—"}
                </ToolCard>

                <ToolCard
                  icon="👁️"
                  title="Visibility"
                >
                  {conditions
                    ?.visibilityMiles !=
                  null
                    ? `${conditions.visibilityMiles} mi`
                    : "—"}
                </ToolCard>

                <ToolCard
                  icon="☁️"
                  title="Cloud Cover"
                >
                  {conditions
                    ?.cloudCoverPct !=
                  null
                    ? `${conditions.cloudCoverPct}%`
                    : "—"}
                </ToolCard>

                <ToolCard
                  icon="🌧️"
                  title="Rain Chance"
                >
                  {conditions
                    ?.precipitationChancePct !=
                  null
                    ? `${conditions.precipitationChancePct}%`
                    : "—"}
                </ToolCard>

              </div>

              <ToolCard
                icon="🌡️"
                title="Temperature"
              >
                {conditions
                  ?.temperatureF !=
                null
                  ? `${conditions.temperatureF}°F`
                  : "—"}
              </ToolCard>

            </>
          )}

          {/* ===================================================
              BEST WINDOW
          =================================================== */}

          {tab === "window" && (
            <>

              <h3 className="text-xl font-black text-[#092530]">
                Best Flight Window
              </h3>

              <ToolCard
                icon="☀️"
                title="Planning Window"
              >
                {bestWindow}
              </ToolCard>

              <ToolCard
                icon="🎈"
                title="Ballooning"
              >
                Favor calm surface winds, low gust spread and stable early-morning conditions.
              </ToolCard>

              <ToolCard
                icon="🪂"
                title="Paragliding / Hang Gliding"
              >
                Wind direction, gust spread, launch exposure and local terrain are critical.
              </ToolCard>

              <ToolCard
                icon="✈️"
                title="Scenic Flights / Gliders"
              >
                Visibility, ceiling, precipitation and operator flight status matter most.
              </ToolCard>

              <ToolCard
                icon="🛩️"
                title="Airshows"
              >
                Check the event schedule, venue, weather, official announcements and demonstration status.
              </ToolCard>

            </>
          )}

          {/* ===================================================
              OPERATORS
          =================================================== */}

          {tab ===
            "operator" && (
            <>

              <h3 className="text-xl font-black text-[#092530]">
                Operator Finder
              </h3>

              <ToolCard
                icon="🔎"
                title="Find Nearby Operators"
              >
                Use the In the Air planner to search the activity and radius you want. Results can surface nearby operating areas and planning matches.
              </ToolCard>

              <ToolCard
                icon="📞"
                title="Confirm Before Leaving"
              >
                Verify operating status, reservations, weather cancellation policies, age limits, weight limits and waiver requirements directly with the provider.
              </ToolCard>

              <a
                href="#air-planner"
                onClick={() =>
                  setOpen(false)
                }
                className="block rounded-2xl bg-[#078dcf] px-4 py-4 text-center text-sm font-black text-white hover:bg-[#067bb5]"
              >
                Search Air Adventures →
              </a>

            </>
          )}

          {/* ===================================================
              GEAR
          =================================================== */}

          {tab === "gear" && (
            <>

              <h3 className="text-xl font-black text-[#092530]">
                What to Bring
              </h3>

              <ToolCard
                icon="🧥"
                title="Clothing"
              >
                Dress for the activity and altitude. Layers, closed-toe shoes, sun protection and weather-appropriate clothing are good defaults.
              </ToolCard>

              <ToolCard
                icon="🕶️"
                title="Sun & Eye Protection"
              >
                Sunglasses, sunscreen and a hat are useful for ballooning, airshows and exposed aviation areas.
              </ToolCard>

              <ToolCard
                icon="📱"
                title="Phone & Power"
              >
                Charge your phone before leaving and carry backup power when practical.
              </ToolCard>

              <ToolCard
                icon="🎫"
                title="Tickets & Documents"
              >
                Bring required identification, booking confirmations, waivers, tickets and any operator-requested documents.
              </ToolCard>

            </>
          )}

          {/* ===================================================
              SAFETY
          =================================================== */}

          {tab ===
            "safety" && (
            <>

              <h3 className="text-xl font-black text-[#092530]">
                Air Adventure Safety
              </h3>

              <ToolCard
                icon="⚠️"
                title="Final Go / No-Go"
              >
                TrippinDays helps with planning, but the operator, pilot, instructor or guide always makes the final go/no-go decision.
              </ToolCard>

              <ToolCard
                icon="🌦️"
                title="Weather Changes"
              >
                Wind, visibility, thunderstorms, cloud cover and precipitation can change rapidly. Recheck shortly before departure.
              </ToolCard>

              <ToolCard
                icon="📋"
                title="Requirements"
              >
                Confirm age, weight, health, experience, waiver and equipment requirements before booking or traveling.
              </ToolCard>

              <div className="rounded-2xl border border-red-200 bg-red-50 p-4">

                <div className="font-black text-red-900">
                  Emergency Reminder
                </div>

                <p className="mt-2 text-sm leading-6 text-red-800">
                  TrippinDays is a planning tool and is not an aviation navigation system, emergency service, flight-control system or substitute for professional instruction.
                </p>

              </div>

            </>
          )}

        </div>

      </aside>
    </>
  );
}