"use client";

import dynamic from "next/dynamic";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import useTrippinDaysLocation from "@/hooks/useTrippinDaysLocation";
import { createClient } from "@/lib/supabase/client";

const InTheAirMap = dynamic(
  () =>
    import(
      "@/components/in-the-air/InTheAirMap"
    ),
  {
    ssr: false,

    loading: () => (
      <div className="flex h-[420px] items-center justify-center rounded-2xl bg-cyan-50 font-bold text-cyan-800">
        Loading interactive map...
      </div>
    ),
  }
);

/* =========================================================
   TYPES
========================================================= */

type AirLocation = {
  name: string;
  region?: string;

  latitude: number;
  longitude: number;

  source: "gps" | "search";
};

type AirWeather = {
  temperatureF?: number | null;

  windSpeedMph?: number | null;
  windGustMph?: number | null;
  windDirection?: string | null;

  visibilityMiles?: number | null;

  cloudCoverPct?: number | null;
  cloudCeilingFt?: number | null;

  precipitationChancePct?: number | null;
};

export type AirResult = {
  id: string;
  rank: number;

  name: string;
  region?: string;

  category: string;

  latitude: number;
  longitude: number;

  distanceMiles: number;

  score: number;
  label: string;

  bestTime?: string | null;

  description?: string | null;

  operatorName?: string | null;
  bookingUrl?: string | null;

  priceFrom?: number | null;
  currency?: string | null;

  imageUrl?: string | null;

  reasons?: string[];
  warnings?: string[];

  weather?: AirWeather | null;

  eventStartDate?: string | null;
  eventEndDate?: string | null;
  eventStartTime?: string | null;

  venueName?: string | null;
  airportName?: string | null;

  officialUrl?: string | null;
  ticketUrl?: string | null;
};

/* =========================================================
   ACTIVITIES
========================================================= */

const AIR_ACTIVITIES = [
  "Paragliding",
  "Skydiving",
  "Hot-Air Ballooning",
  "Scenic Flights",
  "Helicopter Tours",
  "Airshows",
  "Ziplining",
  "Hang Gliding",
  "Glider Flights",
  "Parasailing",
  "Bungee Jumping",
];

const WHEN_OPTIONS = [
  "Today",
  "Tomorrow",
  "This Weekend",
  "Next 7 Days",
  "Next 30 Days",
];

const FREE_RADIUS_OPTIONS = [
  25,
  50,
  75,
  100,
];

const PREMIUM_RADIUS_OPTIONS = [
  25,
  50,
  75,
  100,
  150,
  250,
];

/* =========================================================
   HELPERS
========================================================= */

function safeNumber(
  value: unknown,
  fallback = 0
) {
  const number =
    Number(value);

  return Number.isFinite(
    number
  )
    ? number
    : fallback;
}

function formatEventDate(
  value?: string | null
) {
  if (!value) {
    return "";
  }

  if (
    /^\d{4}-\d{2}-\d{2}$/.test(
      value
    )
  ) {
    const [
      year,
      month,
      day,
    ] = value
      .split("-")
      .map(Number);

    const date =
      new Date(
        year,
        month - 1,
        day,
        12
      );

    return new Intl.DateTimeFormat(
      "en-US",
      {
        month: "short",
        day: "numeric",
        year: "numeric",
      }
    ).format(date);
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    }
  ).format(date);
}

function formatMoney(
  amount?: number | null,
  currency?: string | null
) {
  if (
    amount == null
  ) {
    return null;
  }

  try {
    return new Intl.NumberFormat(
      "en-US",
      {
        style: "currency",
        currency:
          currency || "USD",
        maximumFractionDigits: 0,
      }
    ).format(amount);
  } catch {
    return `$${Math.round(
      amount
    )}`;
  }
}

function buildLocationLabel(
  location:
    | {
        shortLabel?: string;
        label?: string;
        city?: string;
        state?: string;
      }
    | null
    | undefined
) {
  if (!location) {
    return "Current Location";
  }

  if (
    location.shortLabel
  ) {
    return location.shortLabel;
  }

  if (
    location.label
  ) {
    return location.label;
  }

  return (
    [
      location.city,
      location.state,
    ]
      .filter(Boolean)
      .join(", ") ||
    "Current Location"
  );
}

/* =========================================================
   PREMIUM CARD
========================================================= */

function PremiumAirCard({
  icon,
  title,
  description,
  buttonLabel,
  disabled,
  onClick,
}: {
  icon: string;
  title: string;
  description: string;
  buttonLabel: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <article className="flex min-h-[260px] flex-col rounded-3xl border border-white/10 bg-white/10 p-5 backdrop-blur">

      <div className="text-4xl">
        {icon}
      </div>

      <h3 className="mt-4 text-lg font-black">
        {title}
      </h3>

      <p className="mt-2 flex-1 text-sm font-semibold leading-6 text-cyan-50/80">
        {description}
      </p>

      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className="mt-5 w-full rounded-2xl bg-white px-4 py-3 text-xs font-black text-[#063e5b] transition hover:bg-cyan-100 disabled:cursor-wait disabled:opacity-60"
      >
        {disabled
          ? "CHECKING ACCESS..."
          : buttonLabel}
      </button>

    </article>
  );
}

/* =========================================================
   COMPONENT
========================================================= */

export default function InTheAirPlanner() {
  const [
    activity,
    setActivity,
  ] =
    useState(
      "Paragliding"
    );

  const [
    startingLocation,
    setStartingLocation,
  ] =
    useState("");

  const [
    when,
    setWhen,
  ] =
    useState(
      "This Weekend"
    );

  const [
    radius,
    setRadius,
  ] =
    useState("100");

  const {
    location:
      deviceLocation,

    findingLocation,

    error:
      deviceLocationError,

    useCurrentLocation,
  } =
    useTrippinDaysLocation({
      autoRefreshIfGranted:
        true,
    });

  const [
    usingDeviceLocation,
    setUsingDeviceLocation,
  ] =
    useState(true);

  const [
    location,
    setLocation,
  ] =
    useState<AirLocation | null>(
      null
    );

  const [
    results,
    setResults,
  ] =
    useState<AirResult[]>(
      []
    );

  const [
    selectedId,
    setSelectedId,
  ] =
    useState<
      string | null
    >(null);

  const [
    searching,
    setSearching,
  ] =
    useState(false);

  const [
    message,
    setMessage,
  ] =
    useState("");

  const [
    regionalActivities,
    setRegionalActivities,
  ] =
    useState<string[]>(
      []
    );

  /* =========================================================
     PREMIUM ACCESS
  ========================================================= */

  const [
    signedIn,
    setSignedIn,
  ] =
    useState(false);

  const [
    isPremium,
    setIsPremium,
  ] =
    useState(false);

  const [
    premiumLoading,
    setPremiumLoading,
  ] =
    useState(true);

  const [
    intelligenceOpen,
    setIntelligenceOpen,
  ] =
    useState(false);

  useEffect(() => {
    const supabase =
      createClient();

    let mounted =
      true;

    async function loadPremiumAccess(
      userId?: string | null
    ) {
      if (!mounted) {
        return;
      }

      if (!userId) {
        setSignedIn(
          false
        );

        setIsPremium(
          false
        );

        setPremiumLoading(
          false
        );

        return;
      }

      setSignedIn(
        true
      );

      setPremiumLoading(
        true
      );

      const {
        data: profile,
        error,
      } =
        await supabase
          .from(
            "profiles"
          )
          .select(
            "is_premium"
          )
          .eq(
            "id",
            userId
          )
          .maybeSingle();

      if (!mounted) {
        return;
      }

      if (error) {
        console.error(
          "In the Air Premium access check failed:",
          error
        );

        setIsPremium(
          false
        );
      } else {
        setIsPremium(
          profile?.is_premium ===
            true
        );
      }

      setPremiumLoading(
        false
      );
    }

    async function loadSession() {
      const {
        data: {
          user,
        },
      } =
        await supabase.auth.getUser();

      await loadPremiumAccess(
        user?.id ??
          null
      );
    }

    void loadSession();

    const {
      data: {
        subscription,
      },
    } =
      supabase.auth.onAuthStateChange(
        (
          _event,
          session
        ) => {
          void loadPremiumAccess(
            session
              ?.user
              ?.id ??
              null
          );
        }
      );

    return () => {
      mounted = false;

      subscription.unsubscribe();
    };
  }, []);

  /* =========================================================
     FREE RADIUS LOCK
  ========================================================= */

  useEffect(() => {
    if (
      premiumLoading
    ) {
      return;
    }

    if (
      !isPremium &&
      Number(radius) >
        100
    ) {
      setRadius(
        "100"
      );
    }
  }, [
    isPremium,
    premiumLoading,
    radius,
  ]);

  const radiusOptions =
    isPremium
      ? PREMIUM_RADIUS_OPTIONS
      : FREE_RADIUS_OPTIONS;

  /* =========================================================
     DEVICE LOCATION
  ========================================================= */

  useEffect(() => {
    if (
      !deviceLocation ||
      !usingDeviceLocation
    ) {
      return;
    }

    setLocation({
      name:
        buildLocationLabel(
          deviceLocation
        ),

      region:
        deviceLocation.state ||
        "",

      latitude:
        deviceLocation.latitude,

      longitude:
        deviceLocation.longitude,

      source:
        "gps",
    });

    setStartingLocation(
      "Current Location"
    );
  }, [
    deviceLocation,
    usingDeviceLocation,
  ]);

  /* =========================================================
     HERO ACTIVITY CLICK
  ========================================================= */

  useEffect(() => {
    function handleActivity(
      event: Event
    ) {
      const customEvent =
        event as CustomEvent<string>;

      const next =
        customEvent.detail;

      if (
        !next ||
        !AIR_ACTIVITIES.includes(
          next
        )
      ) {
        return;
      }

      setActivity(
        next
      );

      setResults([]);

      setSelectedId(
        null
      );

      setMessage("");

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
        50
      );
    }

    window.addEventListener(
      "trippindays:air-activity",
      handleActivity
    );

    return () => {
      window.removeEventListener(
        "trippindays:air-activity",
        handleActivity
      );
    };
  }, []);

  /* =========================================================
     SELECTED RESULT
  ========================================================= */

  const selectedPlace =
    useMemo(
      () =>
        results.find(
          (
            item
          ) =>
            item.id ===
            selectedId
        ) ||
        results[0] ||
        null,
      [
        results,
        selectedId,
      ]
    );

  const mapPlaces =
    useMemo(
      () =>
        results.map(
          (
            item
          ) => ({
            id:
              item.id,

            rank:
              item.rank,

            name:
              item.name,

            region:
              item.region,

            category:
              item.category,

            latitude:
              item.latitude,

            longitude:
              item.longitude,

            distanceMiles:
              item.distanceMiles,

            score:
              item.score,

            label:
              item.label,

            bestTime:
              item.bestTime ||
              undefined,
          })
        ),
      [results]
    );

  /* =========================================================
     LOCATION
  ========================================================= */

  async function handleUseMyLocation() {
    setMessage("");

    setUsingDeviceLocation(
      true
    );

    const current =
      await useCurrentLocation();

    if (!current) {
      setMessage(
        deviceLocationError ||
          "We couldn't access your location. Allow location access or enter a city, state or ZIP code."
      );

      return;
    }

    setLocation({
      name:
        buildLocationLabel(
          current
        ),

      region:
        current.state ||
        "",

      latitude:
        current.latitude,

      longitude:
        current.longitude,

      source:
        "gps",
    });

    setStartingLocation(
      "Current Location"
    );

    setResults([]);

    setSelectedId(
      null
    );
  }

  /* =========================================================
     AUTH HEADER
  ========================================================= */

  async function getAuthHeaders() {
    const supabase =
      createClient();

    const {
      data: {
        session,
      },
    } =
      await supabase.auth.getSession();

    const headers:
      Record<
        string,
        string
      > = {
      "Content-Type":
        "application/json",
    };

    if (
      session?.access_token
    ) {
      headers.Authorization =
        `Bearer ${session.access_token}`;
    }

    return headers;
  }

  /* =========================================================
     SEARCH
  ========================================================= */

  async function searchAirAdventures(
    searchWhen =
      when
  ): Promise<
    AirResult[]
  > {
    if (
      !startingLocation.trim() &&
      !location &&
      !deviceLocation
    ) {
      setMessage(
        "Enter a starting location or use your current location."
      );

      return [];
    }

    setSearching(
      true
    );

    setMessage("");

    setResults([]);

    setSelectedId(
      null
    );

    try {
      const headers =
        await getAuthHeaders();

      const response =
        await fetch(
          "/api/in-the-air/search",
          {
            method:
              "POST",

            headers,

            cache:
              "no-store",

            body:
              JSON.stringify({
                activity,

                startingLocation,

                location:
                  startingLocation,

                when:
                  searchWhen,

                radiusMiles:
                  Number(
                    radius
                  ),

                radius:
                  Number(
                    radius
                  ),

                latitude:
                  location
                    ?.latitude ??
                  deviceLocation
                    ?.latitude,

                longitude:
                  location
                    ?.longitude ??
                  deviceLocation
                    ?.longitude,
              }),
          }
        );

      let data: any =
        null;

      try {
        data =
          await response.json();
      } catch {
        data =
          null;
      }

      if (
        !response.ok ||
        !data?.success
      ) {
        throw new Error(
          data?.error ||
            data?.message ||
            "Unable to search air adventures."
        );
      }

      const incoming =
        Array.isArray(
          data?.results
        )
          ? data.results
          : [];

      const cleaned: AirResult[] =
        incoming
          .map(
            (
              item: any,
              index: number
            ) => ({
              id:
                String(
                  item?.id ||
                    `air-${
                      index +
                      1
                    }`
                ),

              rank:
                safeNumber(
                  item?.rank,
                  index + 1
                ),

              name:
                String(
                  item?.name ||
                    "Air Adventure"
                ),

              region:
                item?.region
                  ? String(
                      item.region
                    )
                  : "",

              category:
                String(
                  item?.category ||
                    activity
                ),

              latitude:
                safeNumber(
                  item?.latitude,
                  Number.NaN
                ),

              longitude:
                safeNumber(
                  item?.longitude,
                  Number.NaN
                ),

              distanceMiles:
                safeNumber(
                  item?.distanceMiles
                ),

              score:
                safeNumber(
                  item?.score
                ),

              label:
                String(
                  item?.label ||
                    "Available"
                ),

              bestTime:
                item?.bestTime ??
                null,

              description:
                item?.description ??
                null,

              operatorName:
                item?.operatorName ??
                null,

              bookingUrl:
                item?.bookingUrl ??
                null,

              priceFrom:
                typeof item
                  ?.priceFrom ===
                "number"
                  ? item.priceFrom
                  : null,

              currency:
                item?.currency ??
                null,

              imageUrl:
                item?.imageUrl ??
                null,

              reasons:
                Array.isArray(
                  item?.reasons
                )
                  ? item.reasons
                  : [],

              warnings:
                Array.isArray(
                  item?.warnings
                )
                  ? item.warnings
                  : [],

              weather:
                item?.weather ??
                null,

              eventStartDate:
                item?.eventStartDate ??
                null,

              eventEndDate:
                item?.eventEndDate ??
                null,

              eventStartTime:
                item?.eventStartTime ??
                null,

              venueName:
                item?.venueName ??
                null,

              airportName:
                item?.airportName ??
                null,

              officialUrl:
                item?.officialUrl ??
                null,

              ticketUrl:
                item?.ticketUrl ??
                null,
            })
          )
          .filter(
            (
              item: AirResult
            ) =>
              Number.isFinite(
                item.latitude
              ) &&
              Number.isFinite(
                item.longitude
              )
          );

      const available =
        Array.isArray(
          data
            ?.availableActivities
        )
          ? data.availableActivities
              .map(
                (
                  item: unknown
                ) =>
                  String(
                    item
                  )
              )
              .filter(
                Boolean
              )
          : [];

      setRegionalActivities(
        available
      );

      window.dispatchEvent(
        new CustomEvent(
          "trippindays:air-availability",
          {
            detail:
              available,
          }
        )
      );

      if (
        Number.isFinite(
          Number(
            data?.origin
              ?.latitude
          )
        ) &&
        Number.isFinite(
          Number(
            data?.origin
              ?.longitude
          )
        )
      ) {
        setLocation({
          name:
            data.origin
              .name ||
            data.origin
              .label ||
            startingLocation ||
            "Starting Location",

          region:
            data.origin
              .region ||
            "",

          latitude:
            Number(
              data.origin
                .latitude
            ),

          longitude:
            Number(
              data.origin
                .longitude
            ),

          source:
            usingDeviceLocation
              ? "gps"
              : "search",
        });
      }

      setResults(
        cleaned
      );

      setSelectedId(
        cleaned[0]?.id ||
          null
      );

      if (
        cleaned.length >
        0
      ) {
        setMessage(
          searchWhen ===
            "Next 7 Days" &&
          isPremium
            ? `Premium Best Day Finder ranked ${cleaned.length} results across the next 7 days.`
            : activity ===
                "Airshows"
              ? `${cleaned.length} aviation event${
                  cleaned.length ===
                  1
                    ? ""
                    : "s"
                } found within ${data.radiusMiles ?? radius} miles.`
              : `${cleaned.length} ${activity.toLowerCase()} result${
                  cleaned.length ===
                  1
                    ? ""
                    : "s"
                } found within ${data.radiusMiles ?? radius} miles.`
        );
      } else {
        setMessage(
          data?.message ||
            `No ${activity.toLowerCase()} results were found.`
        );
      }

      if (
        cleaned.length >
        0
      ) {
        window.setTimeout(
          () => {
            document
              .getElementById(
                "air-results"
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

      return cleaned;
    } catch (
      error
    ) {
      setMessage(
        error instanceof
          Error
          ? error.message
          : "Unable to search air adventures."
      );

      return [];
    } finally {
      setSearching(
        false
      );
    }
  }

  /* =========================================================
     SELECT RESULT
  ========================================================= */

  function selectResult(
    place: AirResult
  ) {
    setSelectedId(
      place.id
    );

    window.dispatchEvent(
      new CustomEvent(
        "trippindays:air-destination",
        {
          detail: {
            name:
              place.name,

            region:
              place.region,

            latitude:
              place.latitude,

            longitude:
              place.longitude,

            activity:
              place.category,
          },
        }
      )
    );
  }

  /* =========================================================
     PREMIUM
  ========================================================= */

  function openPremiumUpgrade() {
    if (!signedIn) {
      window.location.href =
        "/login?redirect=/premium";

      return;
    }

    window.location.href =
      "/premium";
  }

  function requirePremium() {
    if (
      premiumLoading
    ) {
      setMessage(
        "Checking your Premium access..."
      );

      return false;
    }

    if (
      !signedIn ||
      !isPremium
    ) {
      openPremiumUpgrade();

      return false;
    }

    return true;
  }

  function requireSelectedResult() {
    if (
      !selectedPlace
    ) {
      setMessage(
        "Search first and select an air adventure before using this Premium feature."
      );

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

      return false;
    }

    return true;
  }

  function openAirIntelligence() {
    if (
      !requirePremium() ||
      !requireSelectedResult() ||
      !selectedPlace
    ) {
      return;
    }

    setIntelligenceOpen(
      true
    );

    selectResult(
      selectedPlace
    );
  }

  async function runBestDayFinder() {
    if (
      !requirePremium()
    ) {
      return;
    }

    setWhen(
      "Next 7 Days"
    );

    const found =
      await searchAirAdventures(
        "Next 7 Days"
      );

    if (
      found.length >
      0
    ) {
      setSelectedId(
        found[0].id
      );

      setMessage(
        `⭐ Best Day Finder selected ${found[0].name}. Best forecast window: ${found[0].bestTime || "check the ranked conditions below"}.`
      );
    }
  }

  function sendPremiumTripRequest(
    requestText: string
  ) {
    try {
      localStorage.setItem(
        "trippindays-request",
        requestText
      );

      sessionStorage.setItem(
        "trippindays-request",
        requestText
      );

      window.location.assign(
        "/trip"
      );
    } catch {
      window.location.assign(
        `/trip?request=${encodeURIComponent(
          requestText
        )}`
      );
    }
  }

  function buildPremiumAdventure() {
    if (
      !requirePremium() ||
      !requireSelectedResult() ||
      !selectedPlace
    ) {
      return;
    }

    const place =
      selectedPlace;

    const startingGps =
      location
        ? `
AUTHORITATIVE STARTING GPS:
Latitude: ${location.latitude}
Longitude: ${location.longitude}
`
        : "";

    const destinationGps = `
DESTINATION GPS:
Latitude: ${place.latitude}
Longitude: ${place.longitude}
`;

    const eventInfo =
      place.category ===
      "Airshows"
        ? `
AIRSHOW / AVIATION EVENT:
Date: ${place.eventStartDate || "Check official event information"}
Time: ${place.eventStartTime || "Check official event information"}
Venue: ${place.venueName || place.airportName || "Check official event information"}
Official / Ticket URL: ${place.ticketUrl || place.officialUrl || "Not supplied"}
`
        : "";

    const requestText = `
Starting Location:
${startingLocation || "Current Location"}

${startingGps}

Destination:
${place.name}

Region:
${place.region || ""}

${destinationGps}

Activity:
${place.category}

Distance:
Approximately ${place.distanceMiles} miles from the starting location.

Best Forecast Window:
${place.bestTime || "Use current reliable forecast information."}

Current Planning Score:
${place.score}/100 — ${place.label}

${eventInfo}

TRIP REQUEST:
IN THE AIR PREMIUM — FULL AIR ADVENTURE.

Build a complete TrippinDays itinerary around this exact air adventure.

Include:
- realistic departure and arrival schedule
- realistic drive time and mileage
- fuel and transportation costs
- parking
- food stops
- lodging when the timing requires it
- activity or event costs when verified
- operator, venue or airport information when verified
- wind, gust, visibility, clouds, precipitation and weather considerations
- best practical time window
- required clothing and gear
- age, weight, waiver or experience requirements when verified
- nearby attractions or useful stops
- a backup plan if weather or operating conditions cancel the air activity
- estimated overall trip budget
- final Check Before Leaving section

For an airshow, use the actual event date and venue and build the trip around that scheduled event.

Do not invent operator availability, event dates, ticket prices, aviation conditions, business hours or reservations.

The pilot, operator, instructor or guide always makes the final go/no-go decision.
`.trim();

    setMessage(
      `Building your Premium ${place.category} adventure to ${place.name}...`
    );

    sendPremiumTripRequest(
      requestText
    );
  }

  /* =========================================================
     NORMAL PLAN TRIP
  ========================================================= */

  function planTrip(
    place: AirResult
  ) {
    const prompt = [
      `Plan a complete TrippinDays air adventure to ${place.name}.`,

      place.region
        ? `Location: ${place.region}.`
        : "",

      `Activity: ${place.category}.`,

      `Distance: approximately ${place.distanceMiles} miles.`,

      place.bestTime
        ? `Best conditions window: ${place.bestTime}.`
        : "",

      place.eventStartDate
        ? `Event date: ${formatEventDate(
            place.eventStartDate
          )}.`
        : "",

      place.eventStartTime
        ? `Event time: ${place.eventStartTime}.`
        : "",

      place.venueName
        ? `Venue: ${place.venueName}.`
        : "",

      "Include drive time, fuel, food, parking, weather, costs, nearby attractions and a Check Before Leaving section.",

      "Do not invent current operator availability, event schedules, closures, prices or business hours.",
    ]
      .filter(Boolean)
      .join("\n");

    sendPremiumTripRequest(
      prompt
    );
  }

  /* =========================================================
     MAP
  ========================================================= */

  const mapLatitude =
    location?.latitude ??
    deviceLocation
      ?.latitude ??
    39.8283;

  const mapLongitude =
    location?.longitude ??
    deviceLocation
      ?.longitude ??
    -98.5795;

  const mapLabel =
    location?.name ||
    buildLocationLabel(
      deviceLocation
    ) ||
    "Starting Location";

  return (
    <section
      id="air-planner"
      className="scroll-mt-24 bg-slate-50 py-10 sm:py-14"
    >
      <div className="mx-auto max-w-[1500px] px-4 sm:px-6 lg:px-8">

        {/* ===================================================
            PLANNER
        =================================================== */}

        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">

          <div className="border-b border-slate-200 bg-gradient-to-r from-cyan-50 to-white p-5 sm:p-7">

            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

              <div>

                <div className="text-xs font-black uppercase tracking-[0.18em] text-cyan-700">
                  ✈️ Air Planner
                </div>

                <h2 className="mt-2 text-3xl font-black text-[#092530] sm:text-4xl">
                  Plan Your Air Adventure
                </h2>

                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
                  Find regional air adventures, aviation events and the best available conditions.
                </p>

              </div>

              <button
                type="button"
                onClick={() =>
                  void handleUseMyLocation()
                }
                disabled={
                  findingLocation
                }
                className="rounded-xl border border-cyan-200 bg-white px-4 py-3 text-sm font-black text-cyan-800 shadow-sm hover:bg-cyan-50 disabled:opacity-60"
              >
                {findingLocation
                  ? "📍 Finding Location..."
                  : "📍 Use My Location"}
              </button>

            </div>

          </div>

          <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-7 lg:grid-cols-4">

            <label>

              <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                Activity
              </span>

              <select
                value={
                  activity
                }
                onChange={(
                  event
                ) => {
                  setActivity(
                    event.target.value
                  );

                  setResults([]);

                  setSelectedId(
                    null
                  );
                }}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold text-[#092530]"
              >
                {AIR_ACTIVITIES.map(
                  (
                    item
                  ) => (
                    <option
                      key={
                        item
                      }
                    >
                      {item}
                    </option>
                  )
                )}
              </select>

            </label>

            <label>

              <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                Starting Location
              </span>

              <input
                value={
                  startingLocation
                }
                onChange={(
                  event
                ) => {
                  setStartingLocation(
                    event.target.value
                  );

                  setUsingDeviceLocation(
                    false
                  );
                }}
                placeholder="City, state or ZIP"
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold text-[#092530]"
              />

            </label>

            <label>

              <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                When
              </span>

              <select
                value={
                  when
                }
                onChange={(
                  event
                ) =>
                  setWhen(
                    event.target.value
                  )
                }
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold text-[#092530]"
              >
                {WHEN_OPTIONS.map(
                  (
                    item
                  ) => (
                    <option
                      key={
                        item
                      }
                    >
                      {item}
                    </option>
                  )
                )}
              </select>

            </label>

            <label>

              <div className="flex items-center justify-between">

                <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Travel Radius
                </span>

                <span className="text-[10px] font-black uppercase text-cyan-700">
                  {premiumLoading
                    ? ""
                    : isPremium
                      ? "Premium • 250 mi"
                      : "Free • 100 mi"}
                </span>

              </div>

              <select
                value={
                  radius
                }
                onChange={(
                  event
                ) =>
                  setRadius(
                    event.target.value
                  )
                }
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold text-[#092530]"
              >
                {radiusOptions.map(
                  (
                    miles
                  ) => (
                    <option
                      key={
                        miles
                      }
                      value={
                        String(
                          miles
                        )
                      }
                    >
                      Within{" "}
                      {miles}{" "}
                      miles
                    </option>
                  )
                )}
              </select>

            </label>

          </div>

          {!premiumLoading &&
            !isPremium && (
              <div className="mx-5 mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:mx-7">

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

                  <div>

                    <div className="font-black text-amber-950">
                      ⭐ Premium expands In the Air to 250 miles
                    </div>

                    <div className="mt-1 text-xs font-semibold text-amber-800">
                      Plus Air Intelligence, Best Day Finder and complete Premium air itineraries.
                    </div>

                  </div>

                  <button
                    type="button"
                    onClick={
                      openPremiumUpgrade
                    }
                    className="rounded-xl bg-amber-500 px-4 py-3 text-xs font-black text-white hover:bg-amber-600"
                  >
                    View Premium
                  </button>

                </div>

              </div>
            )}

          <div className="px-5 pb-6 sm:px-7">

            <button
              type="button"
              onClick={() =>
                void searchAirAdventures()
              }
              disabled={
                searching
              }
              className="w-full rounded-2xl bg-[#078dcf] px-5 py-4 text-base font-black text-white shadow-lg transition hover:bg-[#067bb5] disabled:opacity-70"
            >
              {searching
                ? "Searching..."
                : activity ===
                    "Airshows"
                  ? "🛩️ Find Airshows Near Me →"
                  : "✈️ Find My Best Air Adventures →"}
            </button>

            {message && (
              <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-600">
                {message}
              </div>
            )}

            {regionalActivities.length >
              0 && (
                <div className="mt-3 text-xs font-semibold text-slate-500">
                  Regional availability:{" "}
                  {regionalActivities.join(
                    " • "
                  )}
                </div>
              )}

          </div>

        </div>

        {/* ===================================================
            RESULTS
        =================================================== */}

        <div
          id="air-results"
          className="mt-8 scroll-mt-24 grid gap-6 xl:grid-cols-[1.08fr_.92fr]"
        >

          <div>

            <h3 className="mb-3 text-2xl font-black text-[#092530]">
              Regional Air Adventure Map
            </h3>

            <InTheAirMap
              startLatitude={
                mapLatitude
              }
              startLongitude={
                mapLongitude
              }
              startLabel={
                mapLabel
              }
              showStartMarker={
                Boolean(
                  location ||
                    deviceLocation
                )
              }
              places={
                mapPlaces
              }
              selectedId={
                selectedId
              }
              onSelect={(
                id
              ) => {
                const place =
                  results.find(
                    (
                      item
                    ) =>
                      item.id ===
                      id
                  );

                if (
                  place
                ) {
                  selectResult(
                    place
                  );
                }
              }}
              onPlanTrip={(
                mapPlace
              ) => {
                const place =
                  results.find(
                    (
                      item
                    ) =>
                      item.id ===
                      mapPlace.id
                  );

                if (
                  place
                ) {
                  planTrip(
                    place
                  );
                }
              }}
            />

          </div>

          <div>

            <h3 className="text-2xl font-black text-[#092530]">
              {activity ===
              "Airshows"
                ? "Airshows Near You"
                : `${activity} Near You`}
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Ranked regional results inside your search radius.
            </p>

            <div className="mt-4 space-y-4">

              {results.length ===
                0 && (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">

                    <div className="text-4xl">
                      {activity ===
                      "Airshows"
                        ? "🛩️"
                        : "✈️"}
                    </div>

                    <div className="mt-3 font-black text-[#092530]">
                      Ready to search
                    </div>

                    <p className="mt-2 text-sm text-slate-500">
                      Choose an activity and hit Find My Best.
                    </p>

                  </div>
                )}

              {results.map(
                (
                  place
                ) => {
                  const selected =
                    selectedId ===
                    place.id;

                  return (
                    <article
                      key={
                        place.id
                      }
                      className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${
                        selected
                          ? "border-cyan-400 ring-2 ring-cyan-100"
                          : "border-slate-200"
                      }`}
                    >

                      {place.imageUrl && (
                        <img
                          src={
                            place.imageUrl
                          }
                          alt={
                            place.name
                          }
                          className="h-44 w-full object-cover"
                        />
                      )}

                      <div className="p-5">

                        <button
                          type="button"
                          onClick={() =>
                            selectResult(
                              place
                            )
                          }
                          className="w-full text-left"
                        >

                          <div className="flex items-start justify-between gap-4">

                            <div>

                              <div className="text-xs font-black uppercase tracking-wide text-cyan-700">
                                #
                                {place.rank}{" "}
                                •{" "}
                                {place.category}
                              </div>

                              <div className="mt-1 text-xl font-black text-[#092530]">
                                {place.name}
                              </div>

                              {place.region && (
                                <div className="mt-1 text-sm font-bold text-slate-500">
                                  📍{" "}
                                  {place.region}
                                </div>
                              )}

                            </div>

                            <div className="rounded-xl bg-cyan-50 px-3 py-2 text-center">

                              <div className="text-lg font-black text-cyan-800">
                                {place.score}
                              </div>

                              <div className="text-[10px] font-black uppercase text-cyan-600">
                                Score
                              </div>

                            </div>

                          </div>

                        </button>

                        {place.category ===
                          "Airshows" && (
                            <div className="mt-4 rounded-xl bg-sky-50 p-3 text-sm text-slate-700">

                              {place.eventStartDate && (
                                <div className="font-black">
                                  📅{" "}
                                  {formatEventDate(
                                    place.eventStartDate
                                  )}
                                </div>
                              )}

                              {place.eventStartTime && (
                                <div className="mt-1">
                                  🕐{" "}
                                  {place.eventStartTime}
                                </div>
                              )}

                              {(place.airportName ||
                                place.venueName) && (
                                  <div className="mt-1">
                                    🛩️{" "}
                                    {place.airportName ||
                                      place.venueName}
                                  </div>
                                )}

                              {place.priceFrom !=
                                null && (
                                  <div className="mt-1">
                                    🎟️ From{" "}
                                    {formatMoney(
                                      place.priceFrom,
                                      place.currency
                                    )}
                                  </div>
                                )}

                            </div>
                          )}

                        <div className="mt-4 flex flex-wrap gap-2 text-xs font-black">

                          <span className="rounded-full bg-slate-100 px-3 py-1.5">
                            📍{" "}
                            {place.distanceMiles}{" "}
                            mi
                          </span>

                          <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700">
                            {place.label}
                          </span>

                          {place.bestTime && (
                            <span className="rounded-full bg-amber-50 px-3 py-1.5 text-amber-700">
                              ☀️{" "}
                              {place.bestTime}
                            </span>
                          )}

                        </div>

                        <div className="mt-5 grid gap-3 sm:grid-cols-2">

                          {place.category ===
                            "Airshows" &&
                            (place.ticketUrl ||
                              place.officialUrl) && (
                              <a
                                href={
                                  place.ticketUrl ||
                                  place.officialUrl ||
                                  "#"
                                }
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center rounded-xl bg-cyan-600 px-4 py-3 text-sm font-black text-white"
                              >
                                🎟️ Airshow Info / Tickets
                              </a>
                            )}

                          <button
                            type="button"
                            onClick={() =>
                              planTrip(
                                place
                              )
                            }
                            className="rounded-xl bg-orange-500 px-4 py-3 text-sm font-black text-white hover:bg-orange-600"
                          >
                            Plan This Trip →
                          </button>

                        </div>

                      </div>

                    </article>
                  );
                }
              )}

            </div>

          </div>

        </div>

        {/* ===================================================
            PREMIUM AIR INTELLIGENCE PANEL
        =================================================== */}

        {intelligenceOpen &&
          selectedPlace &&
          isPremium && (
            <section className="mt-8 rounded-3xl border border-cyan-200 bg-white p-5 shadow-lg sm:p-7">

              <div className="flex items-start justify-between gap-4">

                <div>

                  <div className="text-xs font-black uppercase tracking-[0.2em] text-cyan-700">
                    ⭐ Premium Air Intelligence
                  </div>

                  <h3 className="mt-2 text-2xl font-black text-[#092530]">
                    {selectedPlace.name}
                  </h3>

                  <p className="mt-2 text-sm text-slate-600">
                    Advanced planning snapshot for your selected air adventure.
                  </p>

                </div>

                <button
                  type="button"
                  onClick={() =>
                    setIntelligenceOpen(
                      false
                    )
                  }
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 font-black"
                >
                  ×
                </button>

              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">

                <MiniStat
                  label="Score"
                  value={`${selectedPlace.score}/100`}
                />

                <MiniStat
                  label="Wind"
                  value={
                    selectedPlace
                      .weather
                      ?.windSpeedMph !=
                    null
                      ? `${selectedPlace.weather.windSpeedMph} mph`
                      : "—"
                  }
                />

                <MiniStat
                  label="Gusts"
                  value={
                    selectedPlace
                      .weather
                      ?.windGustMph !=
                    null
                      ? `${selectedPlace.weather.windGustMph} mph`
                      : "—"
                  }
                />

                <MiniStat
                  label="Visibility"
                  value={
                    selectedPlace
                      .weather
                      ?.visibilityMiles !=
                    null
                      ? `${selectedPlace.weather.visibilityMiles} mi`
                      : "—"
                  }
                />

                <MiniStat
                  label="Clouds"
                  value={
                    selectedPlace
                      .weather
                      ?.cloudCoverPct !=
                    null
                      ? `${selectedPlace.weather.cloudCoverPct}%`
                      : "—"
                  }
                />

                <MiniStat
                  label="Best Window"
                  value={
                    selectedPlace.bestTime ||
                    "Verify operator"
                  }
                />

              </div>

              {selectedPlace.reasons &&
                selectedPlace.reasons.length >
                  0 && (
                  <div className="mt-5 rounded-2xl bg-cyan-50 p-4">

                    <div className="font-black text-[#092530]">
                      Why this ranks well
                    </div>

                    {selectedPlace.reasons.map(
                      (
                        reason,
                        index
                      ) => (
                        <div
                          key={
                            index
                          }
                          className="mt-2 text-sm text-slate-700"
                        >
                          ✓ {reason}
                        </div>
                      )
                    )}

                  </div>
                )}

              {selectedPlace.warnings &&
                selectedPlace.warnings.length >
                  0 && (
                  <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">

                    <div className="font-black text-amber-950">
                      Check Before Going
                    </div>

                    {selectedPlace.warnings.map(
                      (
                        warning,
                        index
                      ) => (
                        <div
                          key={
                            index
                          }
                          className="mt-2 text-sm text-amber-900"
                        >
                          ⚠️ {warning}
                        </div>
                      )
                    )}

                  </div>
                )}

            </section>
          )}

        {/* ===================================================
            PREMIUM SECTION
        =================================================== */}

        <section
          id="air-premium"
          className="mt-10 overflow-hidden rounded-3xl border border-cyan-900/20 bg-[#063e5b] text-white shadow-xl"
        >

          <div className="border-b border-white/10 p-6 sm:p-8">

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">

              <div>

                <div className="text-xs font-black uppercase tracking-[0.22em] text-cyan-200">
                  ⭐ TrippinDays Premium
                </div>

                <h2 className="mt-2 text-3xl font-black">
                  Take In the Air Further
                </h2>

                <p className="mt-2 max-w-3xl text-sm leading-6 text-cyan-50/80">
                  Advanced conditions, longer-range discovery and complete air-adventure planning.
                </p>

              </div>

              {isPremium && (
                <div className="rounded-full bg-emerald-400/15 px-4 py-2 text-xs font-black text-emerald-200 ring-1 ring-emerald-300/30">
                  ✓ PREMIUM ACTIVE
                </div>
              )}

            </div>

          </div>

          <div className="grid gap-4 p-5 sm:p-7 lg:grid-cols-3">

            <PremiumAirCard
              icon="🌤️"
              title="Air Intelligence+"
              description="Get the detailed planning picture for your selected adventure: wind, gusts, visibility, clouds, precipitation, ranking reasons and condition warnings."
              buttonLabel={
                isPremium
                  ? "VIEW AIR INTELLIGENCE →"
                  : "🔒 PREMIUM"
              }
              disabled={
                premiumLoading
              }
              onClick={() =>
                isPremium
                  ? openAirIntelligence()
                  : openPremiumUpgrade()
              }
            />

            <PremiumAirCard
              icon="🗓️"
              title="Best Day Finder+"
              description="Search the upcoming week and let TrippinDays rank the strongest forecast windows for the activity and region you selected."
              buttonLabel={
                isPremium
                  ? "FIND MY BEST DAY →"
                  : "🔒 PREMIUM"
              }
              disabled={
                premiumLoading ||
                searching
              }
              onClick={() =>
                isPremium
                  ? void runBestDayFinder()
                  : openPremiumUpgrade()
              }
            />

            <PremiumAirCard
              icon="✈️"
              title="Full Air Adventure+"
              description="Turn the selected flight, jump, balloon ride, airshow or aerial adventure into a complete itinerary with route, food, fuel, lodging, costs, weather and a backup plan."
              buttonLabel={
                isPremium
                  ? "BUILD FULL ADVENTURE →"
                  : "🔒 PREMIUM"
              }
              disabled={
                premiumLoading
              }
              onClick={() =>
                isPremium
                  ? buildPremiumAdventure()
                  : openPremiumUpgrade()
              }
            />

          </div>

          <div className="border-t border-white/10 px-6 py-4 text-xs font-semibold text-cyan-100/70 sm:px-8">
            Premium search radius: up to 250 miles. Free search radius: up to 100 miles.
          </div>

        </section>

        {/* ===================================================
            SAFETY
        =================================================== */}

        <div className="mt-6 rounded-2xl border border-cyan-100 bg-white p-5 shadow-sm">

          <div className="font-black text-[#092530]">
            ✈️ Air Adventure Safety
          </div>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            Conditions can change rapidly. TrippinDays helps with planning, but the operator, pilot, instructor or guide always makes the final go/no-go decision.
          </p>

        </div>

      </div>
    </section>
  );
}

/* =========================================================
   MINI STAT
========================================================= */

function MiniStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">

      <div className="text-[10px] font-black uppercase tracking-wide text-slate-400">
        {label}
      </div>

      <div className="mt-1 text-xs font-black text-[#092530]">
        {value}
      </div>

    </div>
  );
}