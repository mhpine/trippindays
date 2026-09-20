import "server-only";

import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* =========================================================
   CONFIG
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
] as const;

const FREE_MAX_RADIUS = 100;
const PREMIUM_MAX_RADIUS = 250;

const FREE_RESULT_LIMIT = 3;
const PREMIUM_RESULT_LIMIT = 10;

/* =========================================================
   TYPES
========================================================= */

type PremiumAccess = {
  isPremium: boolean;
  userId: string | null;
};

type Origin = {
  name: string;
  region?: string;
  label: string;
  latitude: number;
  longitude: number;
};

type DiscoveredPlace = {
  name: string;
  geocodeName: string;
  category?: string;
  description?: string;
};

type Candidate = {
  name: string;
  region?: string;
  category: string;
  description?: string | null;

  latitude: number;
  longitude: number;

  distanceMiles: number;
};

type AirWeather = {
  temperatureF: number | null;

  windSpeedMph: number | null;
  windGustMph: number | null;
  windDirection: number | null;

  visibilityMiles: number | null;

  cloudCoverPct: number | null;
  cloudCeilingFt: number | null;

  precipitationChancePct: number | null;
};

type AirResult = {
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
   GENERAL HELPERS
========================================================= */

function numberOrNull(value: unknown) {
  const n = Number(value);

  return Number.isFinite(n)
    ? n
    : null;
}

function clamp(
  value: number,
  min: number,
  max: number
) {
  return Math.max(
    min,
    Math.min(
      max,
      value
    )
  );
}

function safeSlug(value: string) {
  return value
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      "-"
    )
    .replace(
      /^-+|-+$/g,
      ""
    );
}

function haversineMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const earthRadiusMiles =
    3958.7613;

  const toRadians = (
    value: number
  ) =>
    (value * Math.PI) /
    180;

  const dLat =
    toRadians(
      lat2 - lat1
    );

  const dLon =
    toRadians(
      lon2 - lon1
    );

  const a =
    Math.sin(
      dLat / 2
    ) **
      2 +
    Math.cos(
      toRadians(lat1)
    ) *
      Math.cos(
        toRadians(lat2)
      ) *
      Math.sin(
        dLon / 2
      ) **
        2;

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(
        1 - a
      )
    );

  return (
    earthRadiusMiles *
    c
  );
}

function parseJsonText(
  text: string
) {
  const cleaned =
    text
      .trim()
      .replace(
        /^```json\s*/i,
        ""
      )
      .replace(
        /^```\s*/,
        ""
      )
      .replace(
        /```$/,
        ""
      )
      .trim();

  return JSON.parse(
    cleaned
  );
}

/* =========================================================
   SERVER-SIDE PREMIUM VERIFICATION

   IMPORTANT:
   Browser state does NOT decide Premium access.

   The Supabase access token is verified here on the server.
========================================================= */

async function getPremiumAccess(
  request: Request
): Promise<PremiumAccess> {
  const authHeader =
    request.headers.get(
      "authorization"
    ) || "";

  if (
    !authHeader
      .toLowerCase()
      .startsWith(
        "bearer "
      )
  ) {
    return {
      isPremium: false,
      userId: null,
    };
  }

  const accessToken =
    authHeader
      .slice(7)
      .trim();

  if (!accessToken) {
    return {
      isPremium: false,
      userId: null,
    };
  }

  const supabaseUrl =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL;

  const serverKey =
    process.env
      .SUPABASE_SERVICE_ROLE_KEY ||
    process.env
      .SUPABASE_SECRET_KEY;

  if (
    !supabaseUrl ||
    !serverKey
  ) {
    console.error(
      "In the Air Premium verification is not configured."
    );

    return {
      isPremium: false,
      userId: null,
    };
  }

  const supabase =
    createClient(
      supabaseUrl,
      serverKey,
      {
        auth: {
          persistSession:
            false,

          autoRefreshToken:
            false,
        },
      }
    );

  const {
    data: {
      user,
    },

    error:
      userError,
  } =
    await supabase.auth.getUser(
      accessToken
    );

  if (
    userError ||
    !user
  ) {
    return {
      isPremium: false,
      userId: null,
    };
  }

  const {
    data:
      profile,

    error:
      profileError,
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
        user.id
      )
      .maybeSingle();

  if (profileError) {
    console.error(
      "In the Air Premium profile check failed:",
      profileError
    );

    return {
      isPremium: false,
      userId: user.id,
    };
  }

  return {
    isPremium:
      profile
        ?.is_premium ===
      true,

    userId:
      user.id,
  };
}

/* =========================================================
   GEOCODING
========================================================= */

async function geocodeLocation(
  query: string
) {
  const url =
    new URL(
      "https://geocoding-api.open-meteo.com/v1/search"
    );

  url.searchParams.set(
    "name",
    query
  );

  url.searchParams.set(
    "count",
    "5"
  );

  url.searchParams.set(
    "language",
    "en"
  );

  url.searchParams.set(
    "format",
    "json"
  );

  /*
    In the Air currently focuses on
    United States adventures.
  */
  url.searchParams.set(
    "countryCode",
    "US"
  );

  const response =
    await fetch(
      url.toString(),
      {
        cache:
          "no-store",
      }
    );

  if (!response.ok) {
    return null;
  }

  const data =
    await response.json();

  const results =
    Array.isArray(
      data?.results
    )
      ? data.results
      : [];

  if (
    results.length ===
    0
  ) {
    return null;
  }

  const found =
    results[0];

  const latitude =
    Number(
      found.latitude
    );

  const longitude =
    Number(
      found.longitude
    );

  if (
    !Number.isFinite(
      latitude
    ) ||
    !Number.isFinite(
      longitude
    )
  ) {
    return null;
  }

  return {
    name:
      String(
        found.name ||
          query
      ),

    region:
      typeof found.admin1 ===
      "string"
        ? found.admin1
        : undefined,

    latitude,

    longitude,
  };
}

/* =========================================================
   RESOLVE STARTING LOCATION
========================================================= */

async function resolveOrigin(
  startingLocation: string,
  latitude?: unknown,
  longitude?: unknown
): Promise<Origin> {
  const suppliedLatitude =
    Number(latitude);

  const suppliedLongitude =
    Number(longitude);

  if (
    Number.isFinite(
      suppliedLatitude
    ) &&
    Number.isFinite(
      suppliedLongitude
    )
  ) {
    return {
      name:
        startingLocation.trim() ||
        "Current Location",

      label:
        startingLocation.trim() ||
        "Current Location",

      latitude:
        suppliedLatitude,

      longitude:
        suppliedLongitude,
    };
  }

  const query =
    startingLocation.trim();

  if (!query) {
    throw new Error(
      "Enter a starting location."
    );
  }

  const found =
    await geocodeLocation(
      query
    );

  if (!found) {
    throw new Error(
      "We couldn't find that starting location."
    );
  }

  return {
    ...found,

    label:
      [
        found.name,
        found.region,
      ]
        .filter(
          Boolean
        )
        .join(", "),
  };
}

/* =========================================================
   ACTIVITY DISCOVERY WITH OPENAI

   AI identifies known real-world activity areas.

   Every returned location is then geocoded and distance-
   checked before the user sees it.
========================================================= */

function activityInstructions(
  activity: string
) {
  switch (
    activity
  ) {
    case "Paragliding":
      return `
Find known paragliding launch areas, flying sites, mountains or established tandem-flight areas.
`;

case "Skydiving":
  return `
Find real established outdoor skydiving drop zones and skydiving centers.

IMPORTANT:
- "name" must be the actual skydiving center or drop-zone name.
- "geocodeName" MUST be the nearest CITY/TOWN AND STATE.
- Do NOT put the business name in geocodeName.
- Examples:
  {
    "name": "Skydive Toledo",
    "geocodeName": "Toledo, Washington"
  }
  {
    "name": "Kapowsin Air Sports",
    "geocodeName": "Shelton, Washington"
  }
- Prefer established tandem skydiving drop zones.
- Do not return indoor wind tunnels.
`;

    case "Hot-Air Ballooning":
      return `
Find areas known for commercial hot-air balloon rides or established ballooning activity.
`;

    case "Scenic Flights":
      return `
Find airports, aviation hubs or destinations known for scenic airplane flights.
`;

    case "Helicopter Tours":
      return `
Find destinations or aviation hubs where helicopter sightseeing tours are known to operate.
`;

    case "Ziplining":
      return `
Find established zipline parks, adventure parks or destinations known for commercial ziplining.
`;

    case "Hang Gliding":
      return `
Find known hang-gliding launch sites, flying areas or established tandem hang-gliding destinations.
`;

    case "Glider Flights":
      return `
Find glider airports, soaring centers or destinations known for recreational sailplane flights.
`;

    case "Parasailing":
      return `
Find coastal, lake or marina destinations known for commercial parasailing.
`;

    case "Bungee Jumping":
      return `
Find legal, established commercial bungee-jumping locations. Do not return unauthorized bridges, trespassing sites or informal jumping locations.
`;

    default:
      return `
Find established legal locations appropriate for this activity.
`;
  }
}

async function discoverActivityPlaces(
  origin: Origin,
  activity: string,
  radiusMiles: number
): Promise<
  DiscoveredPlace[]
> {
  const apiKey =
    process.env
      .OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not configured."
    );
  }

  const openai =
    new OpenAI({
      apiKey,
    });

  const prompt = `
You are helping TrippinDays discover real, legal air-adventure destinations.

Starting location label:
${origin.label}

Starting latitude:
${origin.latitude}

Starting longitude:
${origin.longitude}

Activity:
${activity}

Search radius:
${radiusMiles} miles

IMPORTANT:
- The latitude and longitude above are the authoritative search center.
- If the label says "Current Location", use the coordinates to determine the region.
- Search for real established ${activity} locations within ${radiusMiles} miles of those coordinates.
- Do not treat "Current Location" as a city name.

{
  "places": [
    {
      "name": "Display name",
      "geocodeName": "Geocodable location, State",
      "category": "${activity}",
      "description": "One short factual planning description"
    }
  ]
}
`;

  const response =
    await openai.responses.create(
      {
        model:
          "gpt-5.6-luna",

        reasoning: {
          effort:
            "none",
        },

        text: {
          verbosity:
            "low",
        },

        input:
          prompt,
      }
    );

  const rawText =
    response.output_text ||
    "";

  if (!rawText.trim()) {
    return [];
  }

  let parsed: any;

  try {
    parsed =
      parseJsonText(
        rawText
      );
  } catch (
    error
  ) {
    console.error(
      "In the Air AI JSON parse failed:",
      error
    );

    return [];
  }

  const places =
    Array.isArray(
      parsed?.places
    )
      ? parsed.places
      : [];

  return places
    .filter(
      (
        place: any
      ) =>
        typeof place
          ?.name ===
          "string" &&
        typeof place
          ?.geocodeName ===
          "string"
    )
    .slice(
      0,
      12
    )
    .map(
      (
        place: any
      ) => ({
        name:
          place.name.trim(),

        geocodeName:
          place.geocodeName.trim(),

        category:
          typeof place
            .category ===
          "string"
            ? place.category.trim()
            : activity,

        description:
          typeof place
            .description ===
          "string"
            ? place.description.trim()
            : undefined,
      })
    );
}

/* =========================================================
   VERIFY AI CANDIDATES

   This prevents a result outside the requested radius from
   slipping through.
========================================================= */

async function verifyCandidates(
  places: DiscoveredPlace[],
  origin: Origin,
  radiusMiles: number,
  activity: string
): Promise<Candidate[]> {
  const checked = await Promise.all(
    places.map(async (place) => {
      try {
        const raw =
          String(place.geocodeName || "").trim();

        const pieces = raw
          .split(",")
          .map((part) => part.trim())
          .filter(Boolean);

        /*
          Open-Meteo is a geographic-place geocoder, not a
          business-directory geocoder.

          AI may return:
          "Skydive Toledo, Toledo, Washington"

          We therefore try:
          1. original value
          2. final city/state pair
          3. final city only
        */

        const cityState =
          pieces.length >= 2
            ? pieces.slice(-2).join(", ")
            : raw;

        const cityOnly =
          pieces.length >= 2
            ? pieces[pieces.length - 2]
            : raw;

        const queries = Array.from(
          new Set(
            [
              raw,
              cityState,
              cityOnly,
            ].filter(Boolean)
          )
        );

        let found:
          | Awaited<ReturnType<typeof geocodeLocation>>
          | null = null;

        for (const query of queries) {
          const result =
            await geocodeLocation(query);

          if (result) {
            found = result;
            break;
          }
        }

        if (!found) {
          console.warn(
            "AIR VERIFY GEOCODE FAILED",
            {
              activity,
              name: place.name,
              geocodeName:
                place.geocodeName,
              attemptedQueries:
                queries,
            }
          );

          return null;
        }

        const distanceMiles =
          haversineMiles(
            origin.latitude,
            origin.longitude,
            found.latitude,
            found.longitude
          );

        if (
          distanceMiles >
          radiusMiles
        ) {
          console.warn(
            "AIR VERIFY OUTSIDE RADIUS",
            {
              activity,
              name: place.name,
              distanceMiles,
              radiusMiles,
            }
          );

          return null;
        }

        return {
          name: place.name,

          region:
            found.region,

          category:
            activity,

          description:
            place.description ||
            null,

          latitude:
            found.latitude,

          longitude:
            found.longitude,

          distanceMiles:
            Math.round(
              distanceMiles * 10
            ) / 10,
        } satisfies Candidate;
      } catch (error) {
        console.error(
          "AIR VERIFY ERROR",
          {
            activity,
            place,
            error,
          }
        );

        return null;
      }
    })
  );

  const deduped =
    new Map<string, Candidate>();

  for (const candidate of checked) {
    if (!candidate) {
      continue;
    }

    const key =
      `${candidate.name}|${candidate.latitude.toFixed(
        3
      )}|${candidate.longitude.toFixed(
        3
      )}`.toLowerCase();

    if (!deduped.has(key)) {
      deduped.set(
        key,
        candidate
      );
    }
  }

  return Array.from(
    deduped.values()
  );
}

/* =========================================================
   WHEN FILTER
========================================================= */

function wantedDates(
  when: string
) {
  const now =
    new Date();

  const dates =
    new Set<string>();

  function addDate(
    date: Date
  ) {
    dates.add(
      date
        .toISOString()
        .slice(
          0,
          10
        )
    );
  }

  if (
    when ===
    "Today"
  ) {
    addDate(now);

    return dates;
  }

  if (
    when ===
    "Tomorrow"
  ) {
    const tomorrow =
      new Date(
        now
      );

    tomorrow.setDate(
      tomorrow.getDate() +
        1
    );

    addDate(
      tomorrow
    );

    return dates;
  }

  if (
    when ===
    "This Weekend"
  ) {
    const day =
      now.getDay();

    const daysUntilSaturday =
      (6 -
        day +
        7) %
      7;

    const saturday =
      new Date(
        now
      );

    saturday.setDate(
      saturday.getDate() +
        daysUntilSaturday
    );

    const sunday =
      new Date(
        saturday
      );

    sunday.setDate(
      sunday.getDate() +
        1
    );

    addDate(
      saturday
    );

    addDate(
      sunday
    );

    return dates;
  }

  const days =
    when ===
    "Next 30 Days"
      ? 30
      : 7;

  for (
    let i = 0;
    i < days;
    i += 1
  ) {
    const date =
      new Date(
        now
      );

    date.setDate(
      date.getDate() +
        i
    );

    addDate(
      date
    );
  }

  return dates;
}

/* =========================================================
   WEATHER SCORING
========================================================= */

function lowIsGood(
  value:
    number | null,
  goodMax: number,
  badMax: number
) {
  if (
    value == null
  ) {
    return 0.5;
  }

  if (
    value <=
    goodMax
  ) {
    return 1;
  }

  if (
    value >=
    badMax
  ) {
    return 0;
  }

  return (
    1 -
    (value -
      goodMax) /
      (badMax -
        goodMax)
  );
}

function rangeIsGood(
  value:
    number | null,
  idealMin: number,
  idealMax: number,
  outerMin: number,
  outerMax: number
) {
  if (
    value == null
  ) {
    return 0.5;
  }

  if (
    value >=
      idealMin &&
    value <=
      idealMax
  ) {
    return 1;
  }

  if (
    value <=
      outerMin ||
    value >=
      outerMax
  ) {
    return 0;
  }

  if (
    value <
    idealMin
  ) {
    return (
      (value -
        outerMin) /
      (idealMin -
        outerMin)
    );
  }

  return (
    (outerMax -
      value) /
    (outerMax -
      idealMax)
  );
}

function highIsGood(
  value:
    number | null,
  badMin: number,
  goodMin: number
) {
  if (
    value == null
  ) {
    return 0.5;
  }

  if (
    value >=
    goodMin
  ) {
    return 1;
  }

  if (
    value <=
    badMin
  ) {
    return 0;
  }

  return (
    (value -
      badMin) /
    (goodMin -
      badMin)
  );
}

function scoreConditions(
  activity: string,
  weather: AirWeather
) {
  const wind =
    weather.windSpeedMph;

  const gust =
    weather.windGustMph;

  const visibility =
    weather.visibilityMiles;

  const cloud =
    weather.cloudCoverPct;

  const rain =
    weather
      .precipitationChancePct;

  let score = 50;

  switch (
    activity
  ) {
    case "Hot-Air Ballooning":
      score =
        lowIsGood(
          wind,
          7,
          16
        ) *
          35 +
        lowIsGood(
          gust,
          10,
          22
        ) *
          30 +
        highIsGood(
          visibility,
          3,
          10
        ) *
          20 +
        lowIsGood(
          rain,
          10,
          60
        ) *
          15;

      break;

    case "Paragliding":
    case "Hang Gliding":
      score =
        rangeIsGood(
          wind,
          5,
          14,
          0,
          24
        ) *
          35 +
        lowIsGood(
          gust,
          18,
          32
        ) *
          30 +
        highIsGood(
          visibility,
          3,
          10
        ) *
          20 +
        lowIsGood(
          rain,
          10,
          60
        ) *
          15;

      break;

    case "Skydiving":
      score =
        lowIsGood(
          wind,
          14,
          26
        ) *
          30 +
        lowIsGood(
          gust,
          20,
          35
        ) *
          25 +
        lowIsGood(
          cloud,
          40,
          90
        ) *
          20 +
        highIsGood(
          visibility,
          4,
          10
        ) *
          15 +
        lowIsGood(
          rain,
          10,
          60
        ) *
          10;

      break;

    case "Scenic Flights":
    case "Helicopter Tours":
    case "Glider Flights":
      score =
        highIsGood(
          visibility,
          4,
          12
        ) *
          35 +
        lowIsGood(
          cloud,
          45,
          95
        ) *
          25 +
        lowIsGood(
          wind,
          18,
          35
        ) *
          20 +
        lowIsGood(
          gust,
          25,
          45
        ) *
          10 +
        lowIsGood(
          rain,
          15,
          70
        ) *
          10;

      break;

    case "Parasailing":
      score =
        rangeIsGood(
          wind,
          7,
          17,
          2,
          28
        ) *
          40 +
        lowIsGood(
          gust,
          22,
          36
        ) *
          25 +
        highIsGood(
          visibility,
          3,
          10
        ) *
          20 +
        lowIsGood(
          rain,
          10,
          60
        ) *
          15;

      break;

    case "Ziplining":
    case "Bungee Jumping":
      score =
        lowIsGood(
          wind,
          15,
          30
        ) *
          35 +
        lowIsGood(
          gust,
          22,
          38
        ) *
          30 +
        lowIsGood(
          rain,
          15,
          70
        ) *
          25 +
        highIsGood(
          visibility,
          2,
          8
        ) *
          10;

      break;

    default:
      score =
        lowIsGood(
          wind,
          15,
          30
        ) *
          40 +
        lowIsGood(
          gust,
          22,
          38
        ) *
          30 +
        highIsGood(
          visibility,
          3,
          10
        ) *
          20 +
        lowIsGood(
          rain,
          15,
          70
        ) *
          10;

      break;
  }

  return Math.round(
    clamp(
      score,
      0,
      100
    )
  );
}

function conditionLabel(
  score: number
) {
  if (
    score >=
    85
  ) {
    return "Excellent Conditions";
  }

  if (
    score >=
    70
  ) {
    return "Good Conditions";
  }

  if (
    score >=
    55
  ) {
    return "Fair Conditions";
  }

  return "Conditions Need Review";
}

/* =========================================================
   OPEN-METEO WEATHER
========================================================= */

async function getAirWeather(
  candidate: Candidate,
  activity: string,
  when: string
) {
  const url =
    new URL(
      "https://api.open-meteo.com/v1/forecast"
    );

  url.searchParams.set(
    "latitude",
    String(
      candidate.latitude
    )
  );

  url.searchParams.set(
    "longitude",
    String(
      candidate.longitude
    )
  );

  url.searchParams.set(
    "timezone",
    "auto"
  );

  url.searchParams.set(
    "temperature_unit",
    "fahrenheit"
  );

  url.searchParams.set(
    "wind_speed_unit",
    "mph"
  );

  url.searchParams.set(
    "forecast_days",
    "16"
  );

  url.searchParams.set(
    "hourly",
    [
      "temperature_2m",
      "precipitation_probability",
      "cloud_cover",
      "visibility",
      "wind_speed_10m",
      "wind_gusts_10m",
      "wind_direction_10m",
    ].join(",")
  );

  const response =
    await fetch(
      url.toString(),
      {
        cache:
          "no-store",
      }
    );

  if (!response.ok) {
    return null;
  }

  const data =
    await response.json();

  const times:
    string[] =
    Array.isArray(
      data?.hourly?.time
    )
      ? data.hourly.time
      : [];

  if (
    times.length ===
    0
  ) {
    return null;
  }

  const desiredDates =
    wantedDates(
      when
    );

  let best:
    | {
        score: number;
        time: string;
        weather: AirWeather;
      }
    | null =
    null;

  for (
    let index = 0;
    index <
    times.length;
    index += 1
  ) {
    const time =
      String(
        times[index] ||
          ""
      );

    const date =
      time.slice(
        0,
        10
      );

    if (
      !desiredDates.has(
        date
      )
    ) {
      continue;
    }

    const hour =
      Number(
        time.slice(
          11,
          13
        )
      );

    /*
      Focus on useful daytime planning windows.
    */
    if (
      Number.isFinite(
        hour
      ) &&
      (hour <
        6 ||
        hour >
        20)
    ) {
      continue;
    }

    const visibilityMeters =
      numberOrNull(
        data?.hourly
          ?.visibility?.[
          index
        ]
      );

    const weather:
      AirWeather = {
      temperatureF:
        numberOrNull(
          data?.hourly
            ?.temperature_2m?.[
            index
          ]
        ),

      windSpeedMph:
        numberOrNull(
          data?.hourly
            ?.wind_speed_10m?.[
            index
          ]
        ),

      windGustMph:
        numberOrNull(
          data?.hourly
            ?.wind_gusts_10m?.[
            index
          ]
        ),

      windDirection:
        numberOrNull(
          data?.hourly
            ?.wind_direction_10m?.[
            index
          ]
        ),

      visibilityMiles:
        visibilityMeters !=
        null
          ? Math.round(
              (visibilityMeters /
                1609.344) *
                10
            ) /
            10
          : null,

      cloudCoverPct:
        numberOrNull(
          data?.hourly
            ?.cloud_cover?.[
            index
          ]
        ),

      /*
        Open-Meteo forecast response used here
        does not provide a verified aviation ceiling.
        Do not invent one.
      */
      cloudCeilingFt:
        null,

      precipitationChancePct:
        numberOrNull(
          data?.hourly
            ?.precipitation_probability?.[
            index
          ]
        ),
    };

    const score =
      scoreConditions(
        activity,
        weather
      );

    if (
      !best ||
      score >
        best.score
    ) {
      best = {
        score,
        time,
        weather,
      };
    }
  }

  return best;
}

/* =========================================================
   BUILD NORMAL ACTIVITY RESULTS
========================================================= */

async function buildAirResults(
  candidates:
    Candidate[],
  activity: string,
  when: string,
  resultLimit: number
): Promise<
  AirResult[]
> {
  const forecasts =
    await Promise.all(
      candidates
        .slice(
          0,
          12
        )
        .map(
          async (
            candidate,
            index
          ) => {
            const forecast =
              await getAirWeather(
                candidate,
                activity,
                when
              );

            if (
              !forecast
            ) {
              return null;
            }

            const reasons:
              string[] = [];

            const warnings:
              string[] = [];

            if (
              forecast.weather
                .windSpeedMph !=
              null
            ) {
              reasons.push(
                `Forecast wind around ${forecast.weather.windSpeedMph} mph during the best modeled window.`
              );
            }

            if (
              forecast.weather
                .visibilityMiles !=
              null
            ) {
              reasons.push(
                `Modeled visibility around ${forecast.weather.visibilityMiles} miles.`
              );
            }

            if (
              forecast.weather
                .precipitationChancePct !=
              null
            ) {
              reasons.push(
                `Precipitation chance around ${forecast.weather.precipitationChancePct}%.`
              );
            }

            if (
              when ===
              "Next 30 Days"
            ) {
              warnings.push(
                "Detailed weather forecast coverage does not extend through the full 30-day search window."
              );
            }

            warnings.push(
              "Weather scoring is for trip planning only. The operator, pilot, instructor or guide makes the final go/no-go decision."
            );

            const id =
              `${safeSlug(
                candidate.name
              )}-${index + 1}`;

            return {
              id,

              rank: 0,

              name:
                candidate.name,

              region:
                candidate.region,

              category:
                activity,

              latitude:
                candidate.latitude,

              longitude:
                candidate.longitude,

              distanceMiles:
                candidate.distanceMiles,

              score:
                forecast.score,

              label:
                conditionLabel(
                  forecast.score
                ),

              bestTime:
                forecast.time,

              description:
                candidate.description ||
                null,

              operatorName:
                null,

              bookingUrl:
                null,

              priceFrom:
                null,

              currency:
                null,

              imageUrl:
                null,

              reasons,

              warnings,

              weather:
                forecast.weather,

              eventStartDate:
                null,

              eventEndDate:
                null,

              eventStartTime:
                null,

              venueName:
                null,

              airportName:
                null,

              officialUrl:
                null,

              ticketUrl:
                null,
            } satisfies AirResult;
          }
        )
    );

  const usable =
  forecasts.filter(
    (
      item
    ): item is NonNullable<
      (typeof forecasts)[number]
    > =>
      item !== null
  );

  /*
    Conditions matter most, but distance is used as a
    small tie-breaker.
  */
  usable.sort(
    (a, b) => {
      if (
        b.score !==
        a.score
      ) {
        return (
          b.score -
          a.score
        );
      }

      return (
        a.distanceMiles -
        b.distanceMiles
      );
    }
  );

  return usable
    .slice(
      0,
      resultLimit
    )
    .map(
      (
        item,
        index
      ) => ({
        ...item,

        rank:
          index + 1,
      })
    );
}

/* =========================================================
   AIRSHOW DATE RANGE
========================================================= */

function airshowDateRange(
  when: string
) {
  const now =
    new Date();

  let start =
    new Date(
      now
    );

  let end =
    new Date(
      now
    );

  if (
    when ===
    "Tomorrow"
  ) {
    start.setDate(
      start.getDate() +
        1
    );

    end =
      new Date(
        start
      );

    end.setDate(
      end.getDate() +
        1
    );
  } else if (
    when ===
    "This Weekend"
  ) {
    const daysUntilSaturday =
      (6 -
        now.getDay() +
        7) %
      7;

    start.setDate(
      start.getDate() +
        daysUntilSaturday
    );

    end =
      new Date(
        start
      );

    end.setDate(
      end.getDate() +
        2
    );
  } else if (
    when ===
    "Next 30 Days"
  ) {
    end.setDate(
      end.getDate() +
        30
    );
  } else if (
    when ===
    "Next 7 Days"
  ) {
    end.setDate(
      end.getDate() +
        7
    );
  } else {
    end.setDate(
      end.getDate() +
        1
    );
  }

  return {
    start,
    end,
  };
}

/* =========================================================
   AIRSHOW SEARCH

   Airshows are NOT invented by AI.

   Ticketmaster is queried for real current event listings.
========================================================= */

async function searchAirshows(
  origin: Origin,
  radiusMiles: number,
  resultLimit: number,
  when: string
): Promise<
  AirResult[]
> {
  const ticketmasterKey =
    process.env
      .TICKETMASTER_API_KEY;

  if (
    !ticketmasterKey
  ) {
    console.warn(
      "TICKETMASTER_API_KEY is not configured for In the Air airshows."
    );

    return [];
  }

  const {
    start,
    end,
  } =
    airshowDateRange(
      when
    );

  const keywords = [
    "air show",
    "airshow",
    "air fest",
    "aviation festival",
    "Blue Angels",
    "Thunderbirds",
    "warbird",
    "fly-in",
    "balloon festival",
  ];

  const searches =
    await Promise.all(
      keywords.map(
        async (
          keyword
        ) => {
          try {
            const url =
              new URL(
                "https://app.ticketmaster.com/discovery/v2/events.json"
              );

            url.searchParams.set(
              "apikey",
              ticketmasterKey
            );

            url.searchParams.set(
              "keyword",
              keyword
            );

            url.searchParams.set(
              "latlong",
              `${origin.latitude},${origin.longitude}`
            );

            url.searchParams.set(
              "radius",
              String(
                radiusMiles
              )
            );

            url.searchParams.set(
              "unit",
              "miles"
            );

            url.searchParams.set(
              "countryCode",
              "US"
            );

            url.searchParams.set(
              "startDateTime",
              start.toISOString()
            );

            url.searchParams.set(
              "endDateTime",
              end.toISOString()
            );

            url.searchParams.set(
              "size",
              "20"
            );

            url.searchParams.set(
              "sort",
              "date,asc"
            );

            const response =
              await fetch(
                url.toString(),
                {
                  cache:
                    "no-store",
                }
              );

            if (
              !response.ok
            ) {
              return [];
            }

            const data =
              await response.json();

            return Array.isArray(
              data?._embedded
                ?.events
            )
              ? data._embedded.events
              : [];
          } catch (
            error
          ) {
            console.error(
              "Ticketmaster airshow search failed:",
              error
            );

            return [];
          }
        }
      )
    );

  const rawEvents =
    searches.flat();

  const deduped =
    new Map<
      string,
      any
    >();

  for (
    const event of
    rawEvents
  ) {
    if (
      !event?.id
    ) {
      continue;
    }

    if (
      !deduped.has(
        String(
          event.id
        )
      )
    ) {
      deduped.set(
        String(
          event.id
        ),
        event
      );
    }
  }

  const results:
    AirResult[] = [];

  for (
    const event of
    deduped.values()
  ) {
    const venue =
      event?._embedded
        ?.venues?.[0];

    const latitude =
      Number(
        venue?.location
          ?.latitude
      );

    const longitude =
      Number(
        venue?.location
          ?.longitude
      );

    if (
      !Number.isFinite(
        latitude
      ) ||
      !Number.isFinite(
        longitude
      )
    ) {
      continue;
    }

    const distanceMiles =
      haversineMiles(
        origin.latitude,
        origin.longitude,
        latitude,
        longitude
      );

    /*
      Ticketmaster's radius is not our final authority.
      Enforce exact distance again.
    */
    if (
      distanceMiles >
      radiusMiles
    ) {
      continue;
    }

    const images =
      Array.isArray(
        event?.images
      )
        ? event.images
        : [];

    const image =
      images.find(
        (
          item: any
        ) =>
          typeof item
            ?.url ===
          "string"
      );

    const startDate =
      event?.dates?.start
        ?.localDate;

    const startTime =
      event?.dates?.start
        ?.localTime;

    const city =
      venue?.city?.name;

    const state =
      venue?.state
        ?.stateCode ||
      venue?.state?.name;

    const region =
      [
        city,
        state,
      ]
        .filter(
          Boolean
        )
        .join(", ");

    results.push({
      id:
        `airshow-${event.id}`,

      rank: 0,

      name:
        String(
          event.name ||
            "Airshow"
        ),

      region:
        region ||
        undefined,

      category:
        "Airshows",

      latitude,

      longitude,

      distanceMiles:
        Math.round(
          distanceMiles *
            10
        ) / 10,

      /*
        Airshows are events, not a weather suitability
        score. Use a neutral verified-listing score.
      */
      score: 75,

      label:
        "Verified Event Listing",

      bestTime:
        startTime ||
        null,

      description:
        venue?.name
          ? `Scheduled aviation event at ${venue.name}. Verify the latest event schedule before leaving.`
          : "Scheduled aviation event. Verify the latest event schedule before leaving.",

      operatorName:
        null,

      bookingUrl:
        event.url ||
        null,

      priceFrom:
        null,

      currency:
        null,

      imageUrl:
        image?.url ||
        null,

      reasons: [
        "Current event listing returned by Ticketmaster.",
        `${Math.round(
          distanceMiles
        )} miles from your starting point.`,
      ],

      warnings: [
        "Airshow dates, performers and schedules can change. Verify the official event information before traveling.",
      ],

      weather:
        null,

      eventStartDate:
        startDate ||
        null,

      eventEndDate:
        event?.dates?.end
          ?.localDate ||
        null,

      eventStartTime:
        startTime ||
        null,

      venueName:
        venue?.name ||
        null,

      airportName:
        null,

      officialUrl:
        event.url ||
        null,

      ticketUrl:
        event.url ||
        null,
    });
  }

  results.sort(
    (a, b) => {
      const dateA =
        a.eventStartDate ||
        "9999-12-31";

      const dateB =
        b.eventStartDate ||
        "9999-12-31";

      const dateCompare =
        dateA.localeCompare(
          dateB
        );

      if (
        dateCompare !==
        0
      ) {
        return dateCompare;
      }

      return (
        a.distanceMiles -
        b.distanceMiles
      );
    }
  );

  return results
    .slice(
      0,
      resultLimit
    )
    .map(
      (
        item,
        index
      ) => ({
        ...item,

        rank:
          index + 1,
      })
    );
}

/* =========================================================
   POST
========================================================= */

export async function POST(
  request: Request
) {
  try {
    const contentLength =
      Number(
        request.headers.get(
          "content-length"
        ) || 0
      );

    if (
      contentLength >
      20_000
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Request too large.",
        },
        {
          status: 413,
        }
      );
    }

    let body:
      any;

    try {
      body =
        await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid request body.",
        },
        {
          status: 400,
        }
      );
    }

    const activity =
      typeof body
        ?.activity ===
      "string"
        ? body.activity.trim()
        : "";

    if (
      !AIR_ACTIVITIES.includes(
        activity as
          (typeof AIR_ACTIVITIES)[number]
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Choose a valid In the Air activity.",
        },
        {
          status: 400,
        }
      );
    }

    const when =
      typeof body
        ?.when ===
      "string"
        ? body.when
        : "This Weekend";

    const startingLocation =
      typeof body
        ?.startingLocation ===
      "string"
        ? body.startingLocation
        : typeof body
            ?.location ===
          "string"
        ? body.location
        : "";

    /* =====================================================
       PREMIUM ACCESS
    ===================================================== */

    const {
      isPremium,
    } =
      await getPremiumAccess(
        request
      );

    /*
      User can REQUEST 250 miles in the browser.

      The server decides whether they actually get it.
    */
    const requestedRadius =
      clamp(
        Number(
          body?.radiusMiles ??
            body?.radius ??
            FREE_MAX_RADIUS
        ) ||
          FREE_MAX_RADIUS,

        10,

        PREMIUM_MAX_RADIUS
      );

    const radiusMiles =
      isPremium
        ? requestedRadius
        : Math.min(
            requestedRadius,
            FREE_MAX_RADIUS
          );

    const resultLimit =
      isPremium
        ? PREMIUM_RESULT_LIMIT
        : FREE_RESULT_LIMIT;

    /* =====================================================
       STARTING LOCATION
    ===================================================== */

    const origin =
      await resolveOrigin(
        startingLocation,
        body?.latitude,
        body?.longitude
      );

    /* =====================================================
       AIRSHOWS

       Real event data only.
    ===================================================== */

    if (
      activity ===
      "Airshows"
    ) {
      const results =
        await searchAirshows(
          origin,
          radiusMiles,
          resultLimit,
          when
        );

      return NextResponse.json({
        success: true,

        origin,

        activity,

        when,

        radiusMiles,

        access: {
          isPremium,

          maxRadiusMiles:
            isPremium
              ? PREMIUM_MAX_RADIUS
              : FREE_MAX_RADIUS,

          resultLimit,
        },

        /*
          Keep every activity tile visible after a search.
          Regional availability can be enhanced separately
          without hiding the other adventure categories.
        */
        availableActivities:
          [],

        results,

        message:
          results.length >
          0
            ? `Found ${results.length} airshow event${
                results.length ===
                1
                  ? ""
                  : "s"
              } within ${radiusMiles} miles.`
            : `No verified airshow events were found within ${radiusMiles} miles for the selected time.`,
      });
    }

    /* =====================================================
       DISCOVER REAL ACTIVITY AREAS
    ===================================================== */

  const places =
  await discoverActivityPlaces(
    origin,
    activity,
    radiusMiles
  );


const candidates =
  await verifyCandidates(
    places,
    origin,
    radiusMiles,
    activity
  );



    if (
      candidates.length ===
      0
    ) {
      return NextResponse.json({
        success: true,

        origin,

        activity,

        when,

        radiusMiles,

        access: {
          isPremium,

          maxRadiusMiles:
            isPremium
              ? PREMIUM_MAX_RADIUS
              : FREE_MAX_RADIUS,

          resultLimit,
        },

        availableActivities:
          [],

        results: [],

        message:
          `No verified ${activity.toLowerCase()} destinations were found within ${radiusMiles} miles of ${origin.label}.`,
      });
    }

    /* =====================================================
       WEATHER + RANKING
    ===================================================== */

    const results =
      await buildAirResults(
        candidates,
        activity,
        when,
        resultLimit
      );

    return NextResponse.json({
      success: true,

      origin,

      activity,

      when,

      radiusMiles,

      access: {
        isPremium,

        maxRadiusMiles:
          isPremium
            ? PREMIUM_MAX_RADIUS
            : FREE_MAX_RADIUS,

        resultLimit,
      },

      availableActivities:
        [],

      results,

      message:
        results.length >
        0
          ? `Found ${results.length} ${activity.toLowerCase()} option${
              results.length ===
              1
                ? ""
                : "s"
            } within ${radiusMiles} miles.`
          : `Destinations were found, but no usable forecast was available for ${activity.toLowerCase()} during the selected time.`,
    });
  } catch (
    error
  ) {
    console.error(
      "IN THE AIR SEARCH ERROR",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof
          Error
            ? error.message
            : "Unable to search air adventures.",
      },
      {
        status: 500,
      }
    );
  }
}