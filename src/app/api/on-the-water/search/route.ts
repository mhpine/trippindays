import OpenAI from "openai";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

/* ======================================================
   PREMIUM ACCESS — SERVER VERIFIED
====================================================== */

type PremiumAccess = {
  isPremium: boolean;
  userId: string | null;
};

async function getPremiumAccess(
  request: Request
): Promise<PremiumAccess> {
  const authHeader =
    request.headers.get("authorization") || "";

  if (
    !authHeader
      .toLowerCase()
      .startsWith("bearer ")
  ) {
    return {
      isPremium: false,
      userId: null,
    };
  }

  const accessToken =
    authHeader.slice(7).trim();

  if (!accessToken) {
    return {
      isPremium: false,
      userId: null,
    };
  }

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const serverKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY;

  /*
    Premium access must fail CLOSED.
    If the secure server configuration is missing,
    the request still works as Free instead of
    accidentally exposing paid features.
  */
  if (!supabaseUrl || !serverKey) {
    console.error(
      "On the Water Premium verification is not configured."
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
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

  const {
    data: { user },
    error: userError,
  } =
    await supabase.auth.getUser(
      accessToken
    );

  if (userError || !user) {
    return {
      isPremium: false,
      userId: null,
    };
  }

  const {
    data: profile,
    error: profileError,
  } =
    await supabase
      .from("profiles")
      .select("is_premium")
      .eq("id", user.id)
      .maybeSingle();

  if (profileError) {
    console.error(
      "On the Water Premium profile check failed:",
      profileError
    );

    return {
      isPremium: false,
      userId: user.id,
    };
  }

  return {
    isPremium:
      profile?.is_premium === true,
    userId: user.id,
  };
}

function freeResult(
  result: Result
): Result {
  /*
    Free users still get the useful basic
    conditions card, but the hourly Water Table
    remains a paid feature.
  */
  return {
    ...result,
    hourly: [],
  };
}

type WaterPlace = {
  name: string;
  geocodeName: string;
  kind: string;
  waterType: "Freshwater" | "Saltwater";
  popularity?: "Popular" | "Local Favorite" | "Hidden Gem";
  fishingAccess?: string[];
  targetSpecies?: string[];
  seasonalStatus?: string;
  seasonalNote?: string;
  publicAccess?: string;
  rulesNote?: string;
};

type Candidate = {
  name: string;
  kind: string;
  waterType: "Freshwater" | "Saltwater";
  latitude: number;
  longitude: number;
  distanceMiles: number;
  popularity?: "Popular" | "Local Favorite" | "Hidden Gem";
  fishingAccess?: string[];
  targetSpecies?: string[];
  seasonalStatus?: string;
  seasonalNote?: string;
  publicAccess?: string;
  rulesNote?: string;
};

type HourlyPoint = {
  time: string;
  score: number;
  wind: number | null;
  gust: number | null;
  wave: number | null;
  period: number | null;
  swell: number | null;
  swellPeriod: number | null;
  waterTemp: number | null;
};

type Result = Candidate & {
  score: number;
  label: string;
  bestTime: string;
  wind: number | null;
  gust: number | null;
  wave: number | null;
  period: number | null;
  swell: number | null;
  swellPeriod: number | null;
  waterTemp: number | null;
  marineAvailable: boolean;
  hourly: HourlyPoint[];
};

/* ======================================================
   BASIC HELPERS
====================================================== */

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function getDistanceMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const earthRadius = 3958.8;

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return (
    2 *
    earthRadius *
    Math.asin(Math.sqrt(a))
  );
}

function clamp(
  value: number,
  min = 0,
  max = 1
) {
  return Math.max(
    min,
    Math.min(max, value)
  );
}

function lowIsGood(
  value: number | null,
  good: number,
  bad: number
) {
  if (value == null) {
    return 0.6;
  }

  if (value <= good) {
    return 1;
  }

  if (value >= bad) {
    return 0;
  }

  return clamp(
    1 -
      (value - good) /
        (bad - good)
  );
}

function rangeIsGood(
  value: number | null,
  idealMin: number,
  idealMax: number,
  hardMin: number,
  hardMax: number
) {
  if (value == null) {
    return 0.5;
  }

  if (
    value >= idealMin &&
    value <= idealMax
  ) {
    return 1;
  }

  if (value <= hardMin) {
    return 0;
  }

  if (value >= hardMax) {
    return 0;
  }

  if (value < idealMin) {
    return clamp(
      (value - hardMin) /
        (idealMin - hardMin)
    );
  }

  return clamp(
    1 -
      (value - idealMax) /
        (hardMax - idealMax)
  );
}

function celsiusToFahrenheit(
  value: number | null
) {
  if (value == null) {
    return null;
  }

  return Math.round(
    value * (9 / 5) + 32
  );
}

function conditionLabel(
  score: number
) {
  if (score >= 90) {
    return "Excellent Conditions";
  }

  if (score >= 80) {
    return "Great Conditions";
  }

  if (score >= 70) {
    return "Good Conditions";
  }

  if (score >= 55) {
    return "Fair Conditions";
  }

  return "Poor Conditions";
}

/* ======================================================
   SCORE CONDITIONS
====================================================== */

function scoreConditions({
  activity,
  skill,
  wind,
  gust,
  wave,
  period,
  rain,
  marineAvailable,
}: {
  activity: string;
  skill: string;
  wind: number | null;
  gust: number | null;
  wave: number | null;
  period: number | null;
  rain: number | null;
  marineAvailable: boolean;
}) {
  /*
    Surfing MUST have real
    nearby marine forecast data.
  */
  if (
    activity === "Surfing" &&
    !marineAvailable
  ) {
    return -1;
  }

  if (activity === "Surfing") {
    let idealWaveMin = 2;
    let idealWaveMax = 6;

    if (skill === "Beginner") {
      idealWaveMin = 1;
      idealWaveMax = 4;
    }

    if (skill === "Advanced") {
      idealWaveMin = 3;
      idealWaveMax = 8;
    }

    if (skill === "Expert") {
      idealWaveMin = 4;
      idealWaveMax = 12;
    }

    const score =
      rangeIsGood(
        wave,
        idealWaveMin,
        idealWaveMax,
        0.5,
        14
      ) *
        40 +
      rangeIsGood(
        period,
        8,
        16,
        4,
        22
      ) *
        25 +
      lowIsGood(
        wind,
        7,
        22
      ) *
        25 +
      lowIsGood(
        gust,
        14,
        32
      ) *
        10;

    return Math.round(score);
  }

  if (
    activity ===
    "Personal Water Craft"
  ) {
    return Math.round(
      lowIsGood(
        wind,
        8,
        20
      ) *
        40 +
        lowIsGood(
          gust,
          14,
          30
        ) *
          30 +
        lowIsGood(
          wave,
          1,
          5
        ) *
          20 +
        lowIsGood(
          rain,
          0,
          3
        ) *
          10
    );
  }

  if (activity === "Fishing") {
    return Math.round(
      lowIsGood(
        wind,
        10,
        24
      ) *
        45 +
        lowIsGood(
          gust,
          16,
          32
        ) *
          30 +
        lowIsGood(
          rain,
          0,
          4
        ) *
          25
    );
  }

  if (
    activity ===
    "Kayak / Paddle"
  ) {
    return Math.round(
      lowIsGood(
        wind,
        6,
        18
      ) *
        50 +
        lowIsGood(
          gust,
          10,
          25
        ) *
          35 +
        lowIsGood(
          rain,
          0,
          3
        ) *
          15
    );
  }

  if (activity === "Sailing") {
    return Math.round(
      rangeIsGood(
        wind,
        8,
        18,
        2,
        30
      ) *
        60 +
        lowIsGood(
          gust,
          22,
          38
        ) *
          30 +
        lowIsGood(
          rain,
          0,
          4
        ) *
          10
    );
  }

  return 50;
}

/* ======================================================
   GEOCODE STARTING LOCATION
====================================================== */

async function findOrigin(
  location: string,
  latitude?: number,
  longitude?: number
) {
  if (
    typeof latitude === "number" &&
    typeof longitude === "number"
  ) {
    return {
      latitude,
      longitude,
      label:
        location ||
        "Current Location",
    };
  }

  if (!location.trim()) {
    throw new Error(
      "Enter a starting location."
    );
  }

  const params =
    new URLSearchParams({
      name: location.trim(),
      count: "5",
      language: "en",
      format: "json",
    });

  const response = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?${params.toString()}`,
    {
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error(
      "Unable to locate your starting location."
    );
  }

  const data =
    await response.json();

  const result =
    data?.results?.[0];

  if (!result) {
    throw new Error(
      "Starting location was not found."
    );
  }

  return {
    latitude:
      Number(
        result.latitude
      ),

    longitude:
      Number(
        result.longitude
      ),

    label: [
      result.name,
      result.admin1,
    ]
      .filter(Boolean)
      .join(", "),
  };
}

/* ======================================================
   AI DESTINATION DISCOVERY
====================================================== */

async function findWaterPlaces(
  startingLocation: string,
  activity: string,
  radiusMiles: number,
  requestedWaterType: "Freshwater" | "Saltwater" | "Either",
  recentDestinations: string[],
  fishingAccess: string,
  targetSpecies: string,
  fishingAdventure: string
): Promise<WaterPlace[]> {
  const apiKey =
    process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is missing from .env.local."
    );
  }

  const openai =
    new OpenAI({
      apiKey,
    });

  const prompt = `
You are the regional destination discovery engine for TrippinDays On the Water.

STARTING LOCATION:
${startingLocation}

ACTIVITY:
${activity}

SEARCH RADIUS:
${radiusMiles} miles

WATER TYPE PREFERENCE:
${requestedWaterType}

TODAY:
${new Date().toISOString().slice(0, 10)}

FISHING ACCESS PREFERENCE:
${fishingAccess}

TARGET FISH / SPECIES:
${targetSpecies}

FISHING ADVENTURE LEVEL:
${fishingAdventure}

Return up to 20 REAL water recreation destinations that fit this activity, water preference, and requested driving radius.

RECENTLY SHOWN AS THE LEAD RESULT:
${recentDestinations.length ? recentDestinations.join(", ") : "None"}

VARIETY RULES:
- Search broadly across the entire allowed radius instead of defaulting to the most famous nearby place.
- Include multiple distinct destination areas and different directions from the starting point when real options exist.
- Do not fill the list with several access points from the same town or immediate shoreline cluster.
- Prefer at least 8 geographically distinct destination areas when the region supports them.
- A recently shown lead destination may still be returned when it has strong conditions, but make sure comparable alternatives are also returned.
- Do not automatically put a recently shown destination first just because it is well known.

WATER TYPE RULES:
- If WATER TYPE PREFERENCE is Freshwater, return ONLY freshwater destinations: lakes, reservoirs, rivers, or Great Lakes locations. Do not return ocean, saltwater bays, estuaries, or coastal ocean locations.
- If WATER TYPE PREFERENCE is Saltwater, return ONLY saltwater destinations: ocean, coast, saltwater bays, sounds, or estuaries. Do not return inland lakes, reservoirs, or freshwater rivers.
- If WATER TYPE PREFERENCE is Either, freshwater and saltwater are both allowed.
- Every returned place MUST include a waterType value of exactly "Freshwater" or "Saltwater".

ACTIVITY RULES:

If activity is Surfing:
- For Saltwater, return genuine ocean surfing locations. Beaches, surf areas and coastal towns are allowed.
- For Freshwater, only return genuine freshwater surf locations such as Great Lakes surf beaches.
- Do NOT return ordinary inland lakes or rivers that are not real surfing destinations.

If activity is Personal Water Craft:
- Return real lakes, reservoirs, large rivers, bays or coastal riding areas.
- Prefer locations with public recreational access.

If activity is Fishing:
- Return real fishing locations with practical PUBLIC access: lakes, rivers, reservoirs, bays, coastal areas, beaches, piers, jetties, marinas, boat launches, fishing towns, and appropriate offshore departure areas.
- Make the species and fishing opportunity REGIONAL. Use the starting location, water type, and TODAY to identify species that are normally present, migrating, running, or seasonally targeted in that region.
- For Freshwater, include seasonal river/lake opportunities such as salmon, steelhead, trout, bass, walleye or other species ONLY where regionally appropriate.
- For Saltwater, include regional coastal/offshore opportunities such as salmon, halibut, lingcod/rockfish, tuna, tarpon, cobia, snook, redfish, mahi, snapper or other species ONLY where regionally appropriate.
- If TARGET FISH / SPECIES is not "Anything Active Now", strongly prefer destinations appropriate for that requested target and water type.
- Respect FISHING ACCESS PREFERENCE. If it is Bank / Shore, Pier / Jetty, Boat, Kayak, or Wade, only return places where that access method is realistically appropriate.
- Respect FISHING ADVENTURE LEVEL:
  * Easy Access = favor obvious public access, piers, launches, parks and easy bank/shore access.
  * A Little Exploring = include local-favorite public access that may require a walk or less-obvious access.
  * Find Me a Hidden Gem = prioritize lesser-known legal PUBLIC access, but never secret spawning areas, private property, closed waters, or sensitive habitat.
  * Either = intentionally mix Popular, Local Favorite, and Hidden Gem spots when real options exist.
- When possible, return a BALANCED MIX of Popular, Local Favorite, and Hidden Gem locations instead of only famous destinations.
- Hidden Gem means lesser-known LEGAL PUBLIC fishing access, never a protected or sensitive fish location.
- For every fishing place return:
  * popularity: exactly "Popular", "Local Favorite", or "Hidden Gem"
  * fishingAccess: one or more of "Bank / Shore", "Pier / Jetty", "Boat", "Kayak", "Wade"
  * targetSpecies: 1 to 4 regionally appropriate species
  * seasonalStatus: one of "Peak", "Active", "Building", "Coming Soon", "Declining", "Year-round", or "Unknown"
  * seasonalNote: a short note based on TYPICAL seasonal patterns. Never claim a live fish count or confirmed run strength unless a live source was actually checked.
  * publicAccess: short practical description such as "Public bank access", "Public boat launch", or "Public pier"
  * rulesNote: exactly "Check current official regulations before fishing."
- Do NOT claim that a fishery is currently open, that retention is legal, or that a run is strong based only on seasonal knowledge. Current regulations, emergency closures, limits and gear rules must be checked separately.

If activity is Kayak / Paddle:
- Return real lakes, rivers, reservoirs, bays and protected coastal areas.

If activity is Sailing:
- Return real bays, large lakes, sailing areas, coastal towns or marina areas.

IMPORTANT:
- Do not invent any place.
- Do not return the starting location simply because it is nearby.
- Prefer recognizable named destinations.
- Results may be towns when the town is the practical access point to the water.
- "geocodeName" should normally be a city/town/location that a geocoder can find easily.
- Include the state in geocodeName.
- Do not include explanations outside the JSON.

Return ONLY this JSON structure:

{
  "places": [
    {
      "name": "Westport",
      "geocodeName": "Westport, Washington",
      "kind": "Coastal Surf Town",
      "waterType": "Saltwater",
      "popularity": "Popular",
      "fishingAccess": [],
      "targetSpecies": [],
      "seasonalStatus": "Unknown",
      "seasonalNote": "",
      "publicAccess": "",
      "rulesNote": ""
    }
  ]
}
`.trim();

  const response =
    await openai.responses.create({
      model: "gpt-5.6-luna",

      reasoning: {
        effort: "none",
      },

      text: {
        verbosity: "low",
      },

      input: prompt,
    });

  const output =
    response.output_text || "";

  const firstBrace =
    output.indexOf("{");

  const lastBrace =
    output.lastIndexOf("}");

  if (
    firstBrace === -1 ||
    lastBrace === -1
  ) {
    throw new Error(
      "Destination search did not return valid data."
    );
  }

  const jsonText =
    output
      .slice(
        firstBrace,
        lastBrace + 1
      )
      .replace(
        /,\s*}/g,
        "}"
      )
      .replace(
        /,\s*]/g,
        "]"
      );

  const parsed =
    JSON.parse(jsonText);

  if (
    !Array.isArray(
      parsed?.places
    )
  ) {
    return [];
  }

  return parsed.places
    .filter(
      (place: any) =>
        typeof place?.name ===
          "string" &&
        typeof place
          ?.geocodeName ===
          "string" &&
        (place?.waterType ===
          "Freshwater" ||
          place?.waterType ===
            "Saltwater")
    )
    .map((place: any): WaterPlace => ({
      name: place.name,
      geocodeName: place.geocodeName,
      kind:
        typeof place.kind === "string"
          ? place.kind
          : "Water Destination",
      waterType: place.waterType,
      popularity:
        place.popularity === "Popular" ||
        place.popularity === "Local Favorite" ||
        place.popularity === "Hidden Gem"
          ? place.popularity
          : undefined,
      fishingAccess: Array.isArray(place.fishingAccess)
        ? place.fishingAccess
            .filter((value: unknown): value is string =>
              typeof value === "string"
            )
            .slice(0, 5)
        : [],
      targetSpecies: Array.isArray(place.targetSpecies)
        ? place.targetSpecies
            .filter((value: unknown): value is string =>
              typeof value === "string"
            )
            .slice(0, 4)
        : [],
      seasonalStatus:
        typeof place.seasonalStatus === "string"
          ? place.seasonalStatus
          : undefined,
      seasonalNote:
        typeof place.seasonalNote === "string"
          ? place.seasonalNote
          : undefined,
      publicAccess:
        typeof place.publicAccess === "string"
          ? place.publicAccess
          : undefined,
      rulesNote:
        activity === "Fishing"
          ? "Check current official regulations before fishing."
          : undefined,
    }))
    .filter(
      (place: WaterPlace) =>
        requestedWaterType ===
          "Either" ||
        place.waterType ===
          requestedWaterType
    )
    .slice(0, 20);
}

/* ======================================================
   VERIFY CANDIDATES AND DISTANCE
====================================================== */

async function geocodePlace(
  place: WaterPlace
) {
  const params =
    new URLSearchParams({
      name:
        place.geocodeName,
      count: "5",
      language: "en",
      format: "json",
    });

  try {
    const response =
      await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?${params.toString()}`,
        {
          cache:
            "no-store",
        }
      );

    if (!response.ok) {
      return [];
    }

    const data =
      await response.json();

    return (
      data?.results || []
    );
  } catch {
    return [];
  }
}

async function verifyCandidates(
  places: WaterPlace[],
  originLat: number,
  originLon: number,
  radiusMiles: number
): Promise<Candidate[]> {
  const verified =
    await Promise.all(
      places.map(
        async (place) => {
          const locations =
            await geocodePlace(
              place
            );

          let best:
            | Candidate
            | null = null;

          for (
            const location of locations
          ) {
            const latitude =
              Number(
                location.latitude
              );

            const longitude =
              Number(
                location.longitude
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

            const distance =
              getDistanceMiles(
                originLat,
                originLon,
                latitude,
                longitude
              );

            /*
              Give geocoder center-points
              a small tolerance.
            */
            if (
              distance >
              radiusMiles + 10
            ) {
              continue;
            }

            const candidate: Candidate =
              {
                name:
                  place.name,

                kind:
                  place.kind ||
                  "Water Destination",

                // Preserve the fishing metadata returned by the
                // regional discovery step. Without carrying these
                // fields through geocoding, the planner only saw
                // generic condition cards and the seasonal/run
                // information disappeared.
                waterType:
                  place.waterType,

                popularity:
                  place.popularity,

                fishingAccess:
                  place.fishingAccess,

                targetSpecies:
                  place.targetSpecies,

                seasonalStatus:
                  place.seasonalStatus,

                seasonalNote:
                  place.seasonalNote,

                publicAccess:
                  place.publicAccess,

                rulesNote:
                  place.rulesNote,

                latitude,

                longitude,

                distanceMiles:
                  Math.round(
                    distance *
                      10
                  ) / 10,
              };

            if (
              !best ||
              candidate.distanceMiles <
                best.distanceMiles
            ) {
              best =
                candidate;
            }
          }

          return best;
        }
      )
    );

  const seen =
    new Set<string>();

  return verified
    .filter(
      (
        item
      ): item is Candidate =>
        item !== null
    )
    .filter((item) => {
      const key =
        item.name
          .trim()
          .toLowerCase();

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);

      return true;
    });
}

/* ======================================================
   TIME WINDOW
====================================================== */

function isoDatePlusDays(
  dateString: string,
  days: number
) {
  const date =
    new Date(
      `${dateString}T12:00:00Z`
    );

  date.setUTCDate(
    date.getUTCDate() +
      days
  );

  return date
    .toISOString()
    .slice(0, 10);
}

function hourAllowed(
  timestamp: string,
  firstTimestamp: string,
  when: string
) {
  if (!timestamp) {
    return false;
  }

  const date =
    timestamp.slice(0, 10);

  const hour =
    Number(
      timestamp.slice(
        11,
        13
      )
    );

  /*
    Avoid middle-of-night
    recreation times.
  */
  if (
    hour < 5 ||
    hour > 21
  ) {
    return false;
  }

  const today =
    firstTimestamp.slice(
      0,
      10
    );

  if (when === "Today") {
    return date === today;
  }

  if (
    when === "Tomorrow"
  ) {
    return (
      date ===
      isoDatePlusDays(
        today,
        1
      )
    );
  }

  if (
    when ===
    "This Weekend"
  ) {
    const currentDate =
      new Date(
        `${today}T12:00:00Z`
      );

    const day =
      currentDate.getUTCDay();

    /*
      Saturday
    */
    if (day === 6) {
      return [
        today,
        isoDatePlusDays(
          today,
          1
        ),
      ].includes(date);
    }

    /*
      Sunday
    */
    if (day === 0) {
      return (
        date === today
      );
    }

    const untilSaturday =
      6 - day;

    const saturday =
      isoDatePlusDays(
        today,
        untilSaturday
      );

    const sunday =
      isoDatePlusDays(
        saturday,
        1
      );

    return [
      saturday,
      sunday,
    ].includes(date);
  }

  /*
    Next 7 Days
  */
  return true;
}

/* ======================================================
   FORECAST ONE DESTINATION
====================================================== */

async function getForecast(
  candidate: Candidate,
  activity: string,
  skill: string,
  when: string
): Promise<Result | null> {
  const weatherParams =
    new URLSearchParams({
      latitude:
        String(
          candidate.latitude
        ),

      longitude:
        String(
          candidate.longitude
        ),

      hourly:
        "wind_speed_10m,wind_gusts_10m,precipitation,visibility",

      timezone: "auto",

      forecast_days: "8",

      wind_speed_unit:
        "mph",
    });

  const marineParams =
    new URLSearchParams({
      latitude:
        String(
          candidate.latitude
        ),

      longitude:
        String(
          candidate.longitude
        ),

      hourly:
        "wave_height,wave_period,swell_wave_height,swell_wave_period,sea_surface_temperature",

      timezone: "auto",

      forecast_days: "8",

      length_unit:
        "imperial",

      cell_selection:
        "sea",
    });

  const [
    weatherResponse,
    marineResponse,
  ] =
    await Promise.all([
      fetch(
        `https://api.open-meteo.com/v1/forecast?${weatherParams.toString()}`,
        {
          cache:
            "no-store",
        }
      ),

      fetch(
        `https://marine-api.open-meteo.com/v1/marine?${marineParams.toString()}`,
        {
          cache:
            "no-store",
        }
      ).catch(
        () => null
      ),
    ]);

  if (
    !weatherResponse.ok
  ) {
    return null;
  }

  const weather =
    await weatherResponse.json();

  let marine: any =
    null;

  if (
    marineResponse &&
    marineResponse.ok
  ) {
    try {
      marine =
        await marineResponse.json();
    } catch {
      marine = null;
    }
  }

  let marineAvailable =
    false;

  /*
    Make sure Open-Meteo did
    not select ocean hundreds
    of miles from an inland spot.
  */
  if (
    marine &&
    typeof marine.latitude ===
      "number" &&
    typeof marine.longitude ===
      "number"
  ) {
    const marineDistance =
      getDistanceMiles(
        candidate.latitude,
        candidate.longitude,
        marine.latitude,
        marine.longitude
      );

    marineAvailable =
      marineDistance <=
      (activity === "Surfing"
        ? 20
        : 30);
  }

  const times:
    string[] =
    weather?.hourly
      ?.time || [];

  if (!times.length) {
    return null;
  }

  const marineTimes:
    string[] =
    marine?.hourly
      ?.time || [];

  const marineIndexMap =
    new Map<
      string,
      number
    >();

  marineTimes.forEach(
    (
      timestamp,
      index
    ) => {
      marineIndexMap.set(
        timestamp,
        index
      );
    }
  );

  const firstTimestamp =
    times[0];

  const hourlyPoints: HourlyPoint[] = [];

  let best:
    | {
        score: number;
        timestamp: string;
        wind:
          | number
          | null;
        gust:
          | number
          | null;
        wave:
          | number
          | null;
        period:
          | number
          | null;
        swell:
          | number
          | null;
        swellPeriod:
          | number
          | null;
        waterTemp:
          | number
          | null;
      }
    | null = null;

  for (
    let i = 0;
    i < times.length;
    i++
  ) {
    const timestamp =
      times[i];

    if (
      !hourAllowed(
        timestamp,
        firstTimestamp,
        when
      )
    ) {
      continue;
    }

    const marineIndex =
      marineAvailable
        ? marineIndexMap.get(
            timestamp
          ) ?? -1
        : -1;

    const wind =
      weather?.hourly
        ?.wind_speed_10m?.[
        i
      ] ?? null;

    const gust =
      weather?.hourly
        ?.wind_gusts_10m?.[
        i
      ] ?? null;

    const rain =
      weather?.hourly
        ?.precipitation?.[
        i
      ] ?? null;

    const wave =
      marineIndex >= 0
        ? marine?.hourly
            ?.wave_height?.[
            marineIndex
          ] ?? null
        : null;

    const period =
      marineIndex >= 0
        ? marine?.hourly
            ?.wave_period?.[
            marineIndex
          ] ?? null
        : null;

    const swell =
      marineIndex >= 0
        ? marine?.hourly
            ?.swell_wave_height?.[
            marineIndex
          ] ?? null
        : null;

    const swellPeriod =
      marineIndex >= 0
        ? marine?.hourly
            ?.swell_wave_period?.[
            marineIndex
          ] ?? null
        : null;

    const waterC =
      marineIndex >= 0
        ? marine?.hourly
            ?.sea_surface_temperature?.[
            marineIndex
          ] ?? null
        : null;

    const score =
      scoreConditions({
        activity,
        skill,
        wind,
        gust,
        wave,
        period,
        rain,
        marineAvailable,
      });

    if (score < 0) {
      continue;
    }

    const waterTemp =
      celsiusToFahrenheit(
        waterC
      );

    hourlyPoints.push({
      time: timestamp,
      score,
      wind:
        wind == null
          ? null
          : Math.round(wind * 10) / 10,
      gust:
        gust == null
          ? null
          : Math.round(gust * 10) / 10,
      wave:
        wave == null
          ? null
          : Math.round(wave * 10) / 10,
      period:
        period == null
          ? null
          : Math.round(period * 10) / 10,
      swell:
        swell == null
          ? null
          : Math.round(swell * 10) / 10,
      swellPeriod:
        swellPeriod == null
          ? null
          : Math.round(swellPeriod * 10) / 10,
      waterTemp:
        waterTemp == null
          ? null
          : Math.round(waterTemp),
    });

    if (
      !best ||
      score > best.score
    ) {
      best = {
        score,

        timestamp,

        wind,

        gust,

        wave,

        period,

        swell,

        swellPeriod,

        waterTemp,
      };
    }
  }

  if (!best) {
    return null;
  }

  const bestIndex =
    Math.max(
      0,
      hourlyPoints.findIndex(
        (point) =>
          point.time ===
          best?.timestamp
      )
    );

  const tableStart =
    Math.max(
      0,
      Math.min(
        bestIndex - 4,
        Math.max(
          0,
          hourlyPoints.length - 12
        )
      )
    );

  const hourly =
    hourlyPoints.slice(
      tableStart,
      tableStart + 12
    );

  return {
    ...candidate,

    score:
      best.score,

    label:
      conditionLabel(
        best.score
      ),

    bestTime:
      best.timestamp,

    wind:
      best.wind == null
        ? null
        : Math.round(
            best.wind * 10
          ) / 10,

    gust:
      best.gust == null
        ? null
        : Math.round(
            best.gust * 10
          ) / 10,

    wave:
      best.wave == null
        ? null
        : Math.round(
            best.wave * 10
          ) / 10,

    period:
      best.period == null
        ? null
        : Math.round(
            best.period * 10
          ) / 10,

    swell:
      best.swell == null
        ? null
        : Math.round(
            best.swell * 10
          ) / 10,

    swellPeriod:
      best.swellPeriod ==
      null
        ? null
        : Math.round(
            best.swellPeriod *
              10
          ) / 10,

    waterTemp:
      best.waterTemp,

    marineAvailable,

    hourly,
  };
}

/* ======================================================
   BALANCED RESULT SELECTION
====================================================== */

function normalizePlaceName(value: string) {
  return value.trim().toLowerCase();
}

function selectBalancedResults(
  items: Result[],
  recentDestinations: string[],
  limit = 6
) {
  if (!items.length) {
    return [];
  }

  const recent = new Set(
    recentDestinations.map(normalizePlaceName)
  );

  const sorted = [...items].sort(
    (a, b) =>
      b.score - a.score ||
      a.distanceMiles - b.distanceMiles
  );

  const absoluteBest = sorted[0];

  /*
    Keep conditions honest: if a different destination is
    within 7 points of the best score, prefer a place that
    has not recently been the lead result. If the old winner
    is clearly better, it stays first.
  */
  const freshComparable = sorted.find(
    (item) =>
      !recent.has(normalizePlaceName(item.name)) &&
      absoluteBest.score - item.score <= 7
  );

  const selected: Result[] = [
    freshComparable || absoluteBest,
  ];

  /*
    Build the rest of the list from geographically different
    areas first. This prevents one town/coast cluster from
    taking every slot.
  */
  for (const candidate of sorted) {
    if (selected.length >= limit) break;

    if (
      selected.some(
        (item) =>
          normalizePlaceName(item.name) ===
          normalizePlaceName(candidate.name)
      )
    ) {
      continue;
    }

    const separatedEnough = selected.every(
      (item) =>
        getDistanceMiles(
          item.latitude,
          item.longitude,
          candidate.latitude,
          candidate.longitude
        ) >= 15
    );

    if (separatedEnough) {
      selected.push(candidate);
    }
  }

  /*
    If geography filtering left open slots, fill them with the
    next-best real forecasts so we never hide useful options.
  */
  for (const candidate of sorted) {
    if (selected.length >= limit) break;

    if (
      !selected.some(
        (item) =>
          normalizePlaceName(item.name) ===
          normalizePlaceName(candidate.name)
      )
    ) {
      selected.push(candidate);
    }
  }

  return selected.slice(0, limit);
}

/* ======================================================
   API POST
====================================================== */

export async function POST(
  request: Request
) {
  try {
    const premiumAccess =
      await getPremiumAccess(
        request
      );

    const isPremium =
      premiumAccess.isPremium;

    const body =
      await request.json();

    const activity =
      typeof body.activity ===
      "string"
        ? body.activity
        : "Surfing";

    const waterType:
      | "Freshwater"
      | "Saltwater"
      | "Either" =
      body.waterType ===
        "Freshwater" ||
      body.waterType ===
        "Saltwater" ||
      body.waterType ===
        "Either"
        ? body.waterType
        : "Either";

    const recentDestinations =
      Array.isArray(body.recentDestinations)
        ? body.recentDestinations
            .filter(
              (item: unknown): item is string =>
                typeof item === "string" &&
                item.trim().length > 0
            )
            .slice(0, 5)
        : [];

    const fishingAccess =
      typeof body.fishingAccess === "string"
        ? body.fishingAccess
        : "Any";

    const targetSpecies =
      typeof body.targetSpecies === "string" &&
      body.targetSpecies.trim()
        ? body.targetSpecies.trim()
        : "Anything Active Now";

    const fishingAdventure =
      typeof body.fishingAdventure === "string"
        ? body.fishingAdventure
        : "Either";

    const skill =
      typeof body.skill ===
      "string"
        ? body.skill
        : "Intermediate";

    const when =
      typeof body.when ===
      "string"
        ? body.when
        : "This Weekend";

    const requestedRadiusMiles =
      Math.max(
        10,
        Math.min(
          Number(
            body.radiusMiles ??
              body.radius
          ) || 100,
          250
        )
      );

    /*
      Server-side entitlement enforcement:
      Free  = maximum 100-mile search
      Premium = maximum 250-mile search

      The browser cannot override this by
      manually calling the API.
    */
    const radiusMiles =
      isPremium
        ? requestedRadiusMiles
        : Math.min(
            requestedRadiusMiles,
            100
          );

    const resultLimit =
      isPremium ? 6 : 3;

    const forecastCandidateLimit =
      isPremium ? 14 : 10;

    /*
      1. Determine user's
      actual starting point.
    */

    const origin =
      await findOrigin(
        body.startingLocation ||
          body.location ||
          "",
        body.latitude,
        body.longitude
      );

    /*
      2. AI finds appropriate
      real water destinations.
    */

    const places =
      await findWaterPlaces(
        origin.label,
        activity,
        radiusMiles,
        waterType,
        recentDestinations,
        fishingAccess,
        targetSpecies,
        fishingAdventure
      );

    /*
      3. Geocoder verifies they
      exist and really fit within
      the search radius.
    */

    const candidates =
      await verifyCandidates(
        places,
        origin.latitude,
        origin.longitude,
        radiusMiles
      );

    if (
      candidates.length === 0
    ) {
      return NextResponse.json({
        origin,
        activity,
        waterType,
        skill,
        when,
        radiusMiles,

        access: {
          isPremium,
          resultLimit,
          maxRadiusMiles:
            isPremium ? 250 : 100,
          waterTable:
            isPremium,
        },

        results: [],

        message:
          `No verified ${activity.toLowerCase()} destinations were found within ${radiusMiles} miles of ${origin.label}.`,
      });
    }

    /*
      4. Fetch real forecasts
      for each verified location.
    */

    const forecastResults =
      await Promise.all(
        candidates
          .slice(
            0,
            forecastCandidateLimit
          )
          .map(
            (
              candidate
            ) =>
              getForecast(
                candidate,
                activity,
                skill,
                when
              )
          )
      );

    /*
      5. Remove unusable
      forecasts and rank best.
    */

    const usableResults =
      forecastResults.filter(
        (
          item
        ): item is Result =>
          item !== null
      );

    const rankedResults =
      selectBalancedResults(
        usableResults,
        recentDestinations,
        resultLimit
      );

    const results =
      isPremium
        ? rankedResults
        : rankedResults.map(
            freeResult
          );

    return NextResponse.json({
      origin,

      activity,

      waterType,

      skill,

      when,

      radiusMiles,

      access: {
        isPremium,
        resultLimit,
        maxRadiusMiles:
          isPremium ? 250 : 100,
        waterTable:
          isPremium,
      },

      searchMode:
        "balanced-conditions-and-variety",

      results,

      message:
        results.length > 0
          ? null
          : `Water destinations were found, but no usable ${activity.toLowerCase()} forecast was available for the selected time.`,
    });
  } catch (error) {
    console.error(
      "On the Water search-v2 error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof
          Error
            ? error.message
            : "Unable to search water conditions.",
      },
      {
        status: 500,
      }
    );
  }
}