import { NextRequest, NextResponse } from "next/server";

type Candidate = {
  name: string;
  region?: string;
  latitude: number;
  longitude: number;
  kind: string;
  distanceMiles: number;
  priority: number;
  elevationFeet: number | null;
  difficulty?: string;
  accessNote?: string;
};

type OverpassElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: {
    lat: number;
    lon: number;
  };
  tags?: Record<string, string>;
};

function toRad(value: number) {
  return (value * Math.PI) / 180;
}

function distanceMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const earthRadiusMiles = 3958.8;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return 2 * earthRadiusMiles * Math.asin(Math.sqrt(a));
}

function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function labelForScore(score: number) {
  if (score >= 90) return "Excellent Match";
  if (score >= 80) return "Great Match";
  if (score >= 70) return "Good Match";
  if (score >= 55) return "Fair Match";
  return "Possible Match";
}

function roundOne(value: number | null) {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.round(value * 10) / 10;
}

async function findOrigin(
  location: string,
  latitude?: number,
  longitude?: number
) {
  if (
    typeof latitude === "number" &&
    Number.isFinite(latitude) &&
    typeof longitude === "number" &&
    Number.isFinite(longitude)
  ) {
    return {
      latitude,
      longitude,
      label: location || "Current Location",
    };
  }

  if (!location.trim()) {
    throw new Error("Enter a starting location.");
  }

  const params = new URLSearchParams({
    name: location,
    count: "1",
    language: "en",
    format: "json",
  });

  const response = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?${params.toString()}`,
    { cache: "no-store" }
  );

  if (!response.ok) {
    throw new Error("Could not find that location.");
  }

  const data = await response.json();
  const result = data?.results?.[0];

  if (!result) {
    throw new Error("Could not find that location.");
  }

  return {
    latitude: Number(result.latitude),
    longitude: Number(result.longitude),
    label: [result.name, result.admin1, result.country_code]
      .filter(Boolean)
      .join(", "),
  };
}

function buildOverpassQuery(
  activity: string,
  latitude: number,
  longitude: number,
  radiusMeters: number
) {
  const around = `(around:${radiusMeters},${latitude},${longitude})`;
  let lines: string[] = [];

  if (
    activity === "Hiking" ||
    activity === "Backpacking" ||
    activity === "Trail Running" ||
    activity === "Seasonal Picks" ||
    activity === "Surprise Me"
  ) {
    lines = [
      `nwr${around}["route"="hiking"]["name"];`,
      `nwr${around}["route"="foot"]["name"];`,
      `nwr${around}["information"="trailhead"]["name"];`,
      `nwr${around}["natural"="peak"]["name"];`,
    ];
  } else if (activity === "Dog-Friendly Trails") {
    lines = [
      `nwr${around}["highway"~"path|footway"]["dog"~"yes|leashed|designated"]["name"];`,
      `nwr${around}["route"="hiking"]["name"];`,
      `nwr${around}["information"="trailhead"]["name"];`,
    ];
  } else if (
    activity === "Mountain Biking" ||
    activity === "Gravel Biking" ||
    activity === "Fat-Tire Biking"
  ) {
    lines = [
      `nwr${around}["route"="mtb"]["name"];`,
      `nwr${around}["sport"="cycling"]["name"];`,
      `nwr${around}["sport"="mountain_biking"]["name"];`,
      `nwr${around}["information"="trailhead"]["name"];`,
    ];
  } else if (activity === "ATV / UTV") {
    lines = [
      `nwr${around}["atv"~"yes|designated"]["name"];`,
      `nwr${around}["route"="atv"]["name"];`,
      `nwr${around}["sport"="motocross"]["name"];`,
      `nwr${around}["highway"="track"]["name"];`,
    ];
  } else if (activity === "Dirt Bikes") {
    lines = [
      `nwr${around}["motorcycle"~"yes|designated"]["name"];`,
      `nwr${around}["sport"="motocross"]["name"];`,
      `nwr${around}["highway"="raceway"]["name"];`,
      `nwr${around}["highway"="track"]["name"];`,
    ];
  } else if (
    activity === "4x4 / Off-Road" ||
    activity === "Overlanding"
  ) {
    lines = [
      `nwr${around}["highway"="track"]["name"];`,
      `nwr${around}["4wd_only"="yes"]["name"];`,
      `nwr${around}["route"="road"]["name"];`,
      `nwr${around}["tourism"="camp_site"]["name"];`,
    ];
  } else if (activity === "Horseback Riding") {
    lines = [
      `nwr${around}["route"="horse"]["name"];`,
      `nwr${around}["horse"~"yes|designated"]["name"];`,
      `nwr${around}["sport"="equestrian"]["name"];`,
      `nwr${around}["information"="trailhead"]["name"];`,
    ];
  } else if (activity === "Caving / Spelunking") {
    lines = [
      `nwr${around}["natural"="cave_entrance"]["name"];`,
      `nwr${around}["tourism"="attraction"]["cave"="yes"]["name"];`,
    ];
  } else if (activity === "Mountaineering") {
    lines = [
      `nwr${around}["natural"="peak"]["name"];`,
      `nwr${around}["sport"="mountaineering"]["name"];`,
      `nwr${around}["route"="hiking"]["name"];`,
    ];
  } else if (activity === "Rock Climbing") {
    lines = [
      `nwr${around}["sport"="climbing"]["name"];`,
      `nwr${around}["climbing"="crag"]["name"];`,
      `nwr${around}["natural"="cliff"]["name"];`,
    ];
  } else if (activity === "Bouldering") {
    lines = [
      `nwr${around}["sport"="climbing"]["climbing:boulder"="yes"]["name"];`,
      `nwr${around}["climbing:boulder"="yes"]["name"];`,
      `nwr${around}["sport"="climbing"]["name"];`,
      `nwr${around}["natural"="rock"]["name"];`,
    ];
  } else if (
    activity === "Downhill Skiing" ||
    activity === "Snowboarding"
  ) {
    lines = [
      `nwr${around}["landuse"="winter_sports"]["name"];`,
      `nwr${around}["piste:type"="downhill"]["name"];`,
      `nwr${around}["aerialway"]["name"];`,
    ];
  } else if (activity === "Cross-Country Skiing") {
    lines = [
      `nwr${around}["piste:type"="nordic"]["name"];`,
      `nwr${around}["route"="ski"]["name"];`,
      `nwr${around}["landuse"="winter_sports"]["name"];`,
    ];
  } else if (activity === "Snowshoeing") {
    lines = [
      `nwr${around}["snowshoe"~"yes|designated"]["name"];`,
      `nwr${around}["piste:type"="hike"]["name"];`,
      `nwr${around}["route"="hiking"]["name"];`,
    ];
  } else if (activity === "Snowmobiling") {
    lines = [
      `nwr${around}["snowmobile"~"yes|designated"]["name"];`,
      `nwr${around}["route"="snowmobile"]["name"];`,
      `nwr${around}["highway"="track"]["name"];`,
    ];
  } else if (activity === "Sledding / Tubing") {
    lines = [
      `nwr${around}["piste:type"="sled"]["name"];`,
      `nwr${around}["sport"~"toboggan|luge"]["name"];`,
      `nwr${around}["landuse"="winter_sports"]["name"];`,
    ];
  } else {
    lines = [
      `nwr${around}["information"="trailhead"]["name"];`,
      `nwr${around}["route"="hiking"]["name"];`,
      `nwr${around}["natural"="peak"]["name"];`,
    ];
  }

  return `
[out:json][timeout:18];
(
${lines.join("\n")}
);
out tags center 120;
`;
}

async function queryOverpass(query: string) {
  const endpoints = [
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass-api.de/api/interpreter",
  ];

  for (const endpoint of endpoints) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 22000);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded;charset=UTF-8",
          Accept: "application/json",
        },
        body: new URLSearchParams({ data: query }).toString(),
        signal: controller.signal,
        cache: "no-store",
      });

      if (!response.ok) continue;

      return await response.json();
    } catch (error) {
      console.error("Off the Road Overpass error:", error);
    } finally {
      clearTimeout(timer);
    }
  }

  return null;
}

function kindForActivity(activity: string) {
  if (activity.includes("Ski") || activity === "Snowboarding") {
    return "Winter Sports";
  }
  if (activity.includes("Bike") || activity.includes("Biking")) {
    return "Bike Trail";
  }
  if (
    activity === "ATV / UTV" ||
    activity === "Dirt Bikes" ||
    activity === "4x4 / Off-Road" ||
    activity === "Overlanding"
  ) {
    return "Off-Road Route";
  }
  if (activity === "Horseback Riding") return "Equestrian";
  if (activity === "Caving / Spelunking") return "Cave";
  if (activity === "Mountaineering") return "Mountain Route";
  if (activity === "Rock Climbing") return "Climbing Area";
  if (activity === "Bouldering") return "Bouldering Area";
  return activity;
}

function difficultyFromTags(tags: Record<string, string>) {
  const sac = tags.sac_scale || "";
  const mtb = tags.mtb_scale || "";
  const piste = tags["piste:difficulty"] || "";

  if (
    sac.includes("demanding") ||
    sac.includes("alpine") ||
    mtb === "4" ||
    mtb === "5" ||
    piste === "expert" ||
    piste === "freeride"
  ) {
    return "Advanced";
  }

  if (
    sac.includes("mountain_hiking") ||
    mtb === "2" ||
    mtb === "3" ||
    piste === "advanced"
  ) {
    return "Intermediate";
  }

  if (
    mtb === "0" ||
    mtb === "1" ||
    piste === "easy" ||
    piste === "novice"
  ) {
    return "Beginner";
  }

  return "Varies";
}

function accessNoteFromTags(tags: Record<string, string>) {
  const notes: string[] = [];

  if (tags.access === "private" || tags.access === "no") {
    notes.push("Access may be restricted.");
  } else if (tags.access === "permit") {
    notes.push("Permit access.");
  }

  if (tags.fee === "yes") notes.push("Fee may be required.");
  if (tags.seasonal === "yes") notes.push("Seasonal access.");
  if (tags["opening_hours"]) {
    notes.push(`Hours: ${tags["opening_hours"]}.`);
  }

  return notes.join(" ") || undefined;
}

function elementsToCandidates(
  elements: OverpassElement[],
  originLat: number,
  originLon: number,
  radiusMiles: number,
  activity: string
) {
  const seen = new Set<string>();
  const candidates: Candidate[] = [];

  for (const element of elements) {
    const tags = element.tags || {};
    const name = tags.name?.trim();

    if (!name) continue;

    const latitude = element.lat ?? element.center?.lat;
    const longitude = element.lon ?? element.center?.lon;

    if (
      typeof latitude !== "number" ||
      typeof longitude !== "number"
    ) {
      continue;
    }

    const distance = distanceMiles(
      originLat,
      originLon,
      latitude,
      longitude
    );

    if (distance > radiusMiles) continue;

    const key =
      `${name.toLowerCase()}:` +
      `${latitude.toFixed(3)}:` +
      `${longitude.toFixed(3)}`;

    if (seen.has(key)) continue;
    seen.add(key);

    const eleMeters = Number(tags.ele);
    const elevationFeet = Number.isFinite(eleMeters)
      ? eleMeters * 3.28084
      : null;

    candidates.push({
      name,
      region:
        tags["addr:state"] ||
        tags["is_in:state"] ||
        tags["is_in"] ||
        undefined,
      latitude,
      longitude,
      kind: kindForActivity(activity),
      priority:
        tags.tourism ||
        tags.route ||
        tags.sport ||
        tags["piste:type"]
          ? 1
          : 2,
      distanceMiles: Math.round(distance * 10) / 10,
      elevationFeet,
      difficulty: difficultyFromTags(tags),
      accessNote: accessNoteFromTags(tags),
    });
  }

  return candidates
    .sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return a.distanceMiles - b.distanceMiles;
    })
    .slice(0, 16);
}

async function discoverCandidates(
  originLat: number,
  originLon: number,
  radiusMiles: number,
  activity: string
) {
  const requestedRadii = [
    Math.min(radiusMiles, 50),
    Math.min(radiusMiles, 100),
    radiusMiles,
  ];

  const uniqueRadii = Array.from(
    new Set(
      requestedRadii
        .map((value) => Math.max(10, Math.round(value)))
        .filter((value) => value <= radiusMiles)
    )
  );

  const allElements: OverpassElement[] = [];
  const elementKeys = new Set<string>();

  for (const searchRadius of uniqueRadii) {
    const query = buildOverpassQuery(
      activity,
      originLat,
      originLon,
      Math.round(searchRadius * 1609.344)
    );

    const data = await queryOverpass(query);
    const elements: OverpassElement[] = data?.elements || [];

    for (const element of elements) {
      const key = `${element.type}:${element.id}`;
      if (elementKeys.has(key)) continue;
      elementKeys.add(key);
      allElements.push(element);
    }

    if (allElements.length >= 20) break;
  }

  return elementsToCandidates(
    allElements,
    originLat,
    originLon,
    radiusMiles,
    activity
  );
}

async function fetchForecast(candidate: Candidate) {
  const params = new URLSearchParams({
    latitude: String(candidate.latitude),
    longitude: String(candidate.longitude),
    hourly:
      "temperature_2m,wind_speed_10m,wind_gusts_10m,precipitation,snowfall,snow_depth,visibility",
    forecast_days: "7",
    timezone: "auto",
    temperature_unit: "fahrenheit",
    wind_speed_unit: "mph",
    precipitation_unit: "inch",
  });

  const response = await fetch(
    `https://api.open-meteo.com/v1/forecast?${params.toString()}`,
    { cache: "no-store" }
  );

  if (!response.ok) return null;
  return response.json();
}

function addDays(dateString: string, days: number) {
  const date = new Date(`${dateString}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function weekendDates(baseDate: string) {
  const date = new Date(`${baseDate}T12:00:00Z`);
  const day = date.getUTCDay();
  const daysUntilSaturday = day === 6 ? 0 : (6 - day + 7) % 7;
  const saturday = addDays(baseDate, daysUntilSaturday);
  return [saturday, addDays(saturday, 1)];
}

function allowedTime(
  time: string,
  firstTime: string,
  when: string
) {
  const date = time.slice(0, 10);
  const hour = Number(time.slice(11, 13));

  if (hour < 6 || hour > 20) return false;

  const baseDate = firstTime.slice(0, 10);

  if (when === "Today") return date === baseDate;
  if (when === "Tomorrow") return date === addDays(baseDate, 1);
  if (when === "This Weekend") {
    return weekendDates(baseDate).includes(date);
  }

  return true;
}

function weatherScore(
  activity: string,
  temp: number | null,
  wind: number | null,
  gust: number | null,
  rain: number | null,
  snowfall: number | null,
  snowDepth: number | null
) {
  const safeTemp = temp ?? 55;
  const safeWind = wind ?? 6;
  const safeGust = gust ?? safeWind;
  const safeRain = rain ?? 0;
  const safeSnow = snowfall ?? 0;
  const safeDepth = snowDepth ?? 0;

  const winter =
    activity === "Downhill Skiing" ||
    activity === "Snowboarding" ||
    activity === "Cross-Country Skiing" ||
    activity === "Snowshoeing" ||
    activity === "Snowmobiling" ||
    activity === "Sledding / Tubing" ||
    activity === "Fat-Tire Biking";

  let score = 80;

  if (safeWind > 25) score -= 25;
  else if (safeWind > 18) score -= 12;

  if (safeGust > 35) score -= 18;

  if (!winter) {
    if (safeRain > 0.25) score -= 22;
    else if (safeRain > 0.08) score -= 10;

    if (safeTemp < 28 || safeTemp > 98) score -= 15;
  } else {
    if (safeSnow > 0) score += 8;
    if (safeDepth > 0.1) score += 5;
    if (safeTemp > 45) score -= 16;
  }

  if (
    activity === "Mountaineering" ||
    activity === "Rock Climbing" ||
    activity === "Bouldering"
  ) {
    if (safeWind > 15) score -= 10;
    if (safeRain > 0.05) score -= 14;
  }

  return Math.round(clamp(score, 25, 98));
}

async function scoreCandidate(
  candidate: Candidate,
  activity: string,
  when: string
) {
  const weather = await fetchForecast(candidate);
  const times: string[] = weather?.hourly?.time || [];

  if (!times.length) {
    const score = Math.max(
      50,
      Math.round(90 - candidate.distanceMiles / 5)
    );

    return {
      ...candidate,
      score,
      label: labelForScore(score),
      bestTime: undefined,
      temperatureF: null,
      wind: null,
      gust: null,
      precipitation: null,
      snowfall: null,
      snowDepth: null,
    };
  }

  const firstTime = times[0];
  let best:
    | {
        score: number;
        time: string;
        temperatureF: number | null;
        wind: number | null;
        gust: number | null;
        precipitation: number | null;
        snowfall: number | null;
        snowDepth: number | null;
      }
    | undefined;

  times.forEach((time, index) => {
    if (!allowedTime(time, firstTime, when)) return;

    const temperatureF =
      weather?.hourly?.temperature_2m?.[index] ?? null;
    const wind =
      weather?.hourly?.wind_speed_10m?.[index] ?? null;
    const gust =
      weather?.hourly?.wind_gusts_10m?.[index] ?? null;
    const precipitation =
      weather?.hourly?.precipitation?.[index] ?? null;
    const snowfall =
      weather?.hourly?.snowfall?.[index] ?? null;
    const snowDepthMeters =
      weather?.hourly?.snow_depth?.[index] ?? null;
    const snowDepth =
      snowDepthMeters == null
        ? null
        : Number(snowDepthMeters) * 39.3701;

    const conditions = weatherScore(
      activity,
      temperatureF,
      wind,
      gust,
      precipitation,
      snowfall,
      snowDepth
    );

    const distanceBonus = Math.max(
      0,
      12 - candidate.distanceMiles / 12
    );

    const score = Math.round(
      clamp(conditions + distanceBonus, 0, 100)
    );

    if (!best || score > best.score) {
      best = {
        score,
        time,
        temperatureF,
        wind,
        gust,
        precipitation,
        snowfall,
        snowDepth,
      };
    }
  });

  if (!best) return null;

  return {
    ...candidate,
    score: best.score,
    label: labelForScore(best.score),
    bestTime: best.time,
    temperatureF: roundOne(best.temperatureF),
    wind: roundOne(best.wind),
    gust: roundOne(best.gust),
    precipitation: roundOne(best.precipitation),
    snowfall: roundOne(best.snowfall),
    snowDepth: roundOne(best.snowDepth),
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const activity = String(body?.activity || "Hiking");
    const location = String(body?.location || "");
    const radius = Math.min(
      Math.max(Number(body?.radius) || 100, 10),
      250
    );
    const when = String(body?.when || "This Weekend");

    /*
      Hunting is deliberately not treated like a generic trail search.
      Live hunting needs official jurisdiction-specific season, unit,
      license/tag/stamp, bag-limit, shooting-hours and closure sources.
    */
    if (activity === "Hunting") {
      return NextResponse.json({
        results: [],
        message:
          "The Hunting category is built into the Off the Road interface. Connect the official wildlife-agency data layer next so TrippinDays can safely filter by species, season, unit, license/tag/stamp requirements, bag limits, shooting hours and closures.",
      });
    }

    const origin = await findOrigin(
      location,
      typeof body?.latitude === "number"
        ? body.latitude
        : undefined,
      typeof body?.longitude === "number"
        ? body.longitude
        : undefined
    );

    const candidates = await discoverCandidates(
      origin.latitude,
      origin.longitude,
      radius,
      activity
    );

    const scored = (
      await Promise.all(
        candidates
          .slice(0, 10)
          .map((candidate) =>
            scoreCandidate(candidate, activity, when)
          )
      )
    ).filter(Boolean) as Array<
      Candidate & {
        score: number;
        label: string;
        bestTime?: string;
        temperatureF: number | null;
        wind: number | null;
        gust: number | null;
        precipitation: number | null;
        snowfall: number | null;
        snowDepth: number | null;
      }
    >;

    const results = scored
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.distanceMiles - b.distanceMiles;
      })
      .slice(0, 8)
      .map((item, index) => ({
        id: `${item.name}-${item.latitude}-${item.longitude}`,
        rank: index + 1,
        name: item.name,
        region: item.region,
        category: item.kind,
        latitude: item.latitude,
        longitude: item.longitude,
        distanceMiles: item.distanceMiles,
        score: item.score,
        label: item.label,
        bestTime: item.bestTime,
        temperatureF: item.temperatureF,
        wind: item.wind,
        gust: item.gust,
        precipitation: item.precipitation,
        snowfall: item.snowfall,
        snowDepth: item.snowDepth,
        elevationFeet: item.elevationFeet,
        difficulty: item.difficulty,
        accessNote: item.accessNote,
      }));

    return NextResponse.json({
      origin,
      results,
      message:
        results.length === 0
          ? `No matching ${activity.toLowerCase()} locations were found within ${radius} miles. Try a larger radius.`
          : undefined,
    });
  } catch (error) {
    console.error("OFF THE ROAD SEARCH ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Off the Road search failed.",
      },
      { status: 500 }
    );
  }
}
