import OpenAI from "openai";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type WaterPlace = {
  name: string;
  geocodeName: string;
  kind: string;
};

type Candidate = {
  name: string;
  kind: string;
  latitude: number;
  longitude: number;
  distanceMiles: number;
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
  radiusMiles: number
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

Return up to 15 REAL water recreation destinations that fit this activity and are reasonably within the requested driving radius.

ACTIVITY RULES:

If activity is Surfing:
- Return genuine ocean surfing locations.
- Beaches, surf areas and coastal towns are allowed.
- Examples of valid result types: beach, surf beach, coastal town.
- Do NOT return inland lakes, inland cities or rivers.

If activity is Personal Water Craft:
- Return real lakes, reservoirs, large rivers, bays or coastal riding areas.
- Prefer locations with public recreational access.

If activity is Fishing:
- Return real lakes, rivers, reservoirs, bays, coastal areas or fishing towns.

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
      "kind": "Coastal Surf Town"
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
          "string"
    )
    .slice(0, 15);
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

        waterTemp:
          celsiusToFahrenheit(
            waterC
          ),
      };
    }
  }

  if (!best) {
    return null;
  }

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
  };
}

/* ======================================================
   API POST
====================================================== */

export async function POST(
  request: Request
) {
  try {
    const body =
      await request.json();

    const activity =
      typeof body.activity ===
      "string"
        ? body.activity
        : "Surfing";

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

    const radiusMiles =
      Math.max(
        10,
        Math.min(
          Number(
            body.radius
          ) || 100,
          250
        )
      );

    /*
      1. Determine user's
      actual starting point.
    */

    const origin =
      await findOrigin(
        body.location || "",
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
        radiusMiles
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
        skill,
        when,
        radiusMiles,

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
          .slice(0, 10)
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

    const results =
      forecastResults
        .filter(
          (
            item
          ): item is Result =>
            item !== null
        )
        .sort(
          (a, b) =>
            b.score -
            a.score
        )
        .slice(0, 6);

    return NextResponse.json({
      origin,

      activity,

      skill,

      when,

      radiusMiles,

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