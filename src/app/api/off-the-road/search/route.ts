import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

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
      `nwr${around}["leisure"="nature_reserve"]["name"];`,
      `nwr${around}["boundary"="national_park"]["name"];`,
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
      `nwr${around}["highway"="track"]["atv"~"yes|designated"]["name"];`,
    ];
  } else if (activity === "Dirt Bikes") {
    lines = [
      `nwr${around}["motorcycle"~"yes|designated"]["name"];`,
      `nwr${around}["sport"="motocross"]["name"];`,
      `nwr${around}["highway"="raceway"]["name"];`,
      `nwr${around}["highway"="track"]["motorcycle"~"yes|designated"]["name"];`,
    ];
  } else if (
    activity === "4x4 / Off-Road" ||
    activity === "Overlanding"
  ) {
    lines = [
      `nwr${around}["4wd_only"="yes"]["name"];`,
      `nwr${around}["highway"="track"]["4wd_only"="yes"]["name"];`,
      `nwr${around}["highway"="track"]["motor_vehicle"~"yes|designated"]["name"];`,
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
      `nwr${around}["highway"="track"]["snowmobile"~"yes|designated"]["name"];`,
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
[out:json][timeout:20];
(
${lines.join("\n")}
);
out tags center 100;
`;
}

async function queryOverpass(query: string) {
  /*
    Overpass is now a SECONDARY discovery source.
    Keep timeouts short so a slow public instance does not
    make the whole TrippinDays search feel broken.
  */
  const endpoints = [
    "https://overpass.private.coffee/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass-api.de/api/interpreter",
  ];

  const errors: string[] = [];

  for (const endpoint of endpoints) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded;charset=UTF-8",
          Accept: "application/json",
          "User-Agent": "TrippinDays/1.0 (https://trippindays.com)",
        },
        body: "data=" + encodeURIComponent(query),
        signal: controller.signal,
        cache: "no-store",
      });

      if (response.status === 429) {
        const message = `${endpoint} returned HTTP 429`;
        errors.push(message);
        console.warn("OVERPASS RATE LIMITED:", endpoint);
        continue;
      }

      if (!response.ok) {
        const message = `${endpoint} returned HTTP ${response.status}`;
        errors.push(message);
        console.warn("OVERPASS FAILED:", message);
        continue;
      }

      const data = await response.json();

      if (!Array.isArray(data?.elements)) {
        const message = `${endpoint} returned invalid data`;
        errors.push(message);
        console.warn("OVERPASS INVALID RESPONSE:", endpoint);
        continue;
      }

      console.log(
        "OVERPASS SUCCESS:",
        endpoint,
        data.elements.length,
        "elements"
      );

      return data;
    } catch (error) {
      const aborted =
        error instanceof Error &&
        (error.name === "AbortError" ||
          error.message.toLowerCase().includes("aborted"));

      const message = aborted
        ? `${endpoint} timed out`
        : error instanceof Error
          ? `${endpoint}: ${error.message}`
          : `${endpoint}: unknown error`;

      errors.push(message);
      console.warn("OVERPASS ERROR:", message);
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error(errors.join(" | "));
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

type PhotonFeature = {
  geometry?: {
    type?: string;
    coordinates?: number[];
  };
  properties?: {
    name?: string;
    state?: string;
    county?: string;
    city?: string;
    country?: string;
    osm_key?: string;
    osm_value?: string;
  };
};

function photonSearchTerm(activity: string) {
  const terms: Record<string, string> = {
    Hiking: "trail",
    Backpacking: "trail",
    "Trail Running": "trail",
    "Dog-Friendly Trails": "trail",

    "Mountain Biking": "mountain bike trail",
    "Gravel Biking": "bike trail",
    "Fat-Tire Biking": "bike trail",

    "ATV / UTV": "ATV trail",
    "Dirt Bikes": "motocross",
    "4x4 / Off-Road": "off road",
    Overlanding: "campground",

    "Horseback Riding": "equestrian",

    "Caving / Spelunking": "cave",
    Mountaineering: "mountain",
    "Rock Climbing": "climbing",
    Bouldering: "bouldering",

    "Downhill Skiing": "ski",
    Snowboarding: "ski",
    "Cross-Country Skiing": "nordic ski",
    Snowshoeing: "snowshoe",
    Snowmobiling: "snowmobile",
    "Sledding / Tubing": "sledding",

    "Seasonal Picks": "park",
    "Surprise Me": "park",
  };

  return terms[activity] || activity;
}

function photonBoundingBox(
  latitude: number,
  longitude: number,
  radiusMiles: number
) {
  const latDelta = radiusMiles / 69;
  const cosLat = Math.max(
    0.2,
    Math.cos(toRad(latitude))
  );
  const lonDelta =
    radiusMiles / (69 * cosLat);

  return {
    minLon: longitude - lonDelta,
    minLat: latitude - latDelta,
    maxLon: longitude + lonDelta,
    maxLat: latitude + latDelta,
  };
}

async function discoverPhotonCandidates(
  originLat: number,
  originLon: number,
  radiusMiles: number,
  activity: string
): Promise<Candidate[]> {
  const box = photonBoundingBox(
    originLat,
    originLon,
    radiusMiles
  );

  const params = new URLSearchParams({
    q: photonSearchTerm(activity),
    lat: String(originLat),
    lon: String(originLon),
    bbox: [
      box.minLon,
      box.minLat,
      box.maxLon,
      box.maxLat,
    ].join(","),
    limit: "20",
    lang: "en",
    dedupe: "0",
  });

  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    8000
  );

  try {
    const response = await fetch(
      `https://photon.komoot.io/api/?${params.toString()}`,
      {
        headers: {
          Accept: "application/json",
          "User-Agent":
            "TrippinDays/1.0 (https://trippindays.com)",
        },
        signal: controller.signal,
        cache: "no-store",
      }
    );

    if (!response.ok) {
      console.warn(
        "PHOTON FAILED:",
        response.status
      );
      return [];
    }

    const data = await response.json();
    const features: PhotonFeature[] =
      Array.isArray(data?.features)
        ? data.features
        : [];

    const seen = new Set<string>();
    const candidates: Candidate[] = [];

    for (const feature of features) {
      const coordinates =
        feature?.geometry?.coordinates;

      if (
        !Array.isArray(coordinates) ||
        coordinates.length < 2
      ) {
        continue;
      }

      const longitude = Number(
        coordinates[0]
      );
      const latitude = Number(
        coordinates[1]
      );

      if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude)
      ) {
        continue;
      }

      const name =
        feature?.properties?.name?.trim();

      if (!name) continue;

      const distance = distanceMiles(
        originLat,
        originLon,
        latitude,
        longitude
      );

      if (distance > radiusMiles) {
        continue;
      }

      const key =
        `${name.toLowerCase()}:` +
        `${latitude.toFixed(3)}:` +
        `${longitude.toFixed(3)}`;

      if (seen.has(key)) continue;
      seen.add(key);

      const region = [
        feature?.properties?.city,
        feature?.properties?.county,
        feature?.properties?.state,
      ]
        .filter(Boolean)
        .join(", ");

      candidates.push({
        name,
        region: region || undefined,
        latitude,
        longitude,
        kind: kindForActivity(activity),
        distanceMiles:
          Math.round(distance * 10) / 10,
        priority: 1,
        elevationFeet: null,
        difficulty: "Varies",
        accessNote:
          "Verify current access, closures, permits and activity rules before leaving.",
      });
    }

    console.log(
      "PHOTON CANDIDATES:",
      candidates.length
    );

    return candidates
      .sort(
        (a, b) =>
          a.distanceMiles -
          b.distanceMiles
      )
      .slice(0, 16);
  } catch (error) {
    console.warn(
      "PHOTON ERROR:",
      error instanceof Error
        ? error.message
        : error
    );

    return [];
  } finally {
    clearTimeout(timer);
  }
}


type AiOffRoadPlace = {
  name: string;
  geocodeName?: string;
  region?: string;
  kind?: string;
  latitude?: number;
  longitude?: number;
  difficulty?: string;
  accessNote?: string;
};

async function findAiOffRoadPlaces(
  startingLocation: string,
  startingLatitude: number,
  startingLongitude: number,
  activity: string,
  radiusMiles: number,
  skill: string,
  when: string,
  minDistanceMiles = 0,
  maxDistanceMiles = radiusMiles,
  requestedCount = 12
): Promise<AiOffRoadPlace[]> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is missing from .env.local."
    );
  }

  const openai = new OpenAI({
    apiKey,
  });

  const prompt = `
You are the regional destination discovery engine for TrippinDays Off the Road.

STARTING LOCATION:
${startingLocation}

AUTHORITATIVE STARTING GPS:
Latitude: ${startingLatitude}
Longitude: ${startingLongitude}

ACTIVITY:
${activity}

SEARCH RADIUS:
${radiusMiles} miles

SKILL / DIFFICULTY:
${skill}

WHEN:
${when}

TODAY:
${new Date().toISOString().slice(0, 10)}

GOAL:
Return up to ${requestedCount} REAL, NAMED outdoor recreation destinations that fit the selected activity.

REQUIRED DISTANCE BAND:
- Every returned destination should be approximately ${minDistanceMiles} to ${maxDistanceMiles} miles from the authoritative starting GPS.
- This is a REQUIRED search band, not merely a maximum.
- Do not fill this response with closer destinations when minDistanceMiles is greater than 0.
- Search the full compass around the starting point: north, south, east, and west when geography allows.
- If there are fewer real matching destinations in this exact band, return fewer rather than inventing places.
- The server will independently calculate straight-line distance from the returned coordinates and reject places outside this band.
- SEARCH RADIUS (${radiusMiles} miles) remains the overall absolute maximum.

LOCATION RULES:
- Treat the GPS coordinates as the authoritative starting point.
- If STARTING LOCATION says "Current Location", do NOT interpret those words as a geographic place.
- Search the real surrounding region from the GPS coordinates.
- Do not return the starting town merely because it is nearby.
- Prefer recognizable named destinations, trail systems, recreation areas, parks, forests, resorts, OHV areas, climbing areas, caves, peaks, or practical access areas.
- Do NOT invent a place.
- Return approximate decimal latitude and longitude for the actual recreation destination or practical access area.
- Do not intentionally return a destination outside the requested radius.
- Never claim a road, trail, park, cave, slope, riding area, or hunting area is currently open unless live official information was actually checked.
- accessNote must be cautious. Use language such as "Verify current access, closures, permits and activity rules before leaving."
- If exact difficulty varies by route, return "Varies".

ACTIVITY-SPECIFIC RULES:

Hiking:
- Return genuine hiking destinations, trail systems, trailheads, parks, forests, preserves, or named hiking areas.

Backpacking:
- Prefer areas with real multi-mile or overnight backcountry trail opportunities.

Trail Running:
- Return real trail systems or parks suitable for trail running.

Dog-Friendly Trails:
- Return real trail areas where dogs are commonly allowed or where dog access can reasonably be verified before leaving.
- Never promise dogs are permitted; note that current rules should be checked.

Mountain Biking:
- Return real mountain-bike trail systems, parks, forests, or riding areas.

Gravel Biking:
- Return real gravel-road, forest-road, rail-trail, or mixed-surface cycling areas.

Fat-Tire Biking:
- Return real areas used for fat-tire riding, snow riding, beaches, or soft-surface riding where regionally appropriate.

ATV / UTV:
- Return genuine OHV/ORV parks, state-forest motorized trail systems, designated ATV/UTV areas, or legal motorized recreation areas.
- Do not return a generic park just because it is outdoors.

Dirt Bikes:
- Return genuine dirt-bike, motorcycle-OHV, motocross, ORV, or motorized trail destinations.
- Prefer named ORV parks, motocross facilities, state-forest motorized trail systems, or designated motorcycle riding areas.
- Do NOT return generic hiking trails, city parks, ordinary roads, or non-motorized recreation areas.
- Do not claim dirt-bike access is legal today; tell the user to verify current motorized-use rules and closures.

4x4 / Off-Road:
- Return genuine 4x4, ORV, Jeep, forest-road, or designated motorized route systems.
- Avoid ordinary paved-road destinations.

Overlanding:
- Return practical backcountry driving areas, forest-road systems, public-land corridors, or camping-oriented motorized destinations.

Horseback Riding:
- Return equestrian trail systems, horse camps, public riding areas, or guided trail-riding destinations.

Caving / Spelunking:
- Return genuine caves, cave parks, permitted cave systems, or established cave-tour areas.
- Never imply unrestricted wild-cave access.

Mountaineering:
- Return real mountains, alpine routes, climbing areas, or mountaineering destinations appropriate to the region.

Rock Climbing:
- Return genuine crags, climbing parks, climbing areas, cliffs, or established rock-climbing destinations.

Bouldering:
- Return genuine bouldering areas, boulder fields, climbing parks, or established climbing destinations with bouldering.

Downhill Skiing:
- Return real ski resorts or lift-served downhill ski areas.

Snowboarding:
- Return real ski resorts or snowboard areas.

Cross-Country Skiing:
- Return real Nordic centers, groomed Nordic systems, or established cross-country ski areas.

Snowshoeing:
- Return real winter trail systems or recreation areas commonly used for snowshoeing.

Snowmobiling:
- Return genuine designated snowmobile trail systems, sno-parks, or motorized winter recreation areas.

Sledding / Tubing:
- Return genuine tubing parks, sledding hills, ski-area tubing operations, or established winter recreation areas.

Seasonal Picks:
- Return outdoor destinations that make practical seasonal sense for the selected region and date.

Surprise Me:
- Return a varied mix of real regional Off the Road destinations.

OUTPUT RULES:
- Return JSON only.
- No markdown.
- No explanation outside JSON.
- Every place must have a name, latitude, and longitude.
- kind should describe the destination type, such as "ORV Park", "Motorized Trail System", "Trail System", "Climbing Area", "Ski Area", etc.
- region should be a useful city/county/state or regional label when known.
- difficulty must be one of "Beginner", "Intermediate", "Advanced", "Expert", or "Varies".
- accessNote should be concise and cautious.

Return exactly this shape:

{
  "places": [
    {
      "name": "Example Recreation Area",
      "geocodeName": "Example Recreation Area, Washington",
      "region": "Washington",
      "kind": "Motorized Trail System",
      "latitude": 46.0000,
      "longitude": -123.0000,
      "difficulty": "Varies",
      "accessNote": "Verify current access, closures, permits and activity rules before leaving."
    }
  ]
}
`.trim();

  const response = await openai.responses.create({
    model: "gpt-5.6-luna",
    reasoning: {
      effort: "none",
    },
    text: {
      verbosity: "low",
    },
    input: prompt,
  });

  const output = response.output_text || "";
  const firstBrace = output.indexOf("{");
  const lastBrace = output.lastIndexOf("}");

  if (
    firstBrace === -1 ||
    lastBrace === -1
  ) {
    throw new Error(
      "Off the Road destination discovery did not return valid data."
    );
  }

  const jsonText = output
    .slice(firstBrace, lastBrace + 1)
    .replace(/,\s*}/g, "}")
    .replace(/,\s*]/g, "]");

  const parsed = JSON.parse(jsonText);

  if (!Array.isArray(parsed?.places)) {
    return [];
  }

  return parsed.places
    .filter(
      (place: any) =>
        typeof place?.name === "string" &&
        Number.isFinite(Number(place?.latitude)) &&
        Number.isFinite(Number(place?.longitude))
    )
    .map(
      (place: any): AiOffRoadPlace => ({
        name: place.name.trim(),
        geocodeName:
          typeof place.geocodeName === "string"
            ? place.geocodeName.trim()
            : undefined,
        region:
          typeof place.region === "string"
            ? place.region.trim()
            : undefined,
        kind:
          typeof place.kind === "string"
            ? place.kind.trim()
            : undefined,
        latitude: Number(place.latitude),
        longitude: Number(place.longitude),
        difficulty:
          place.difficulty === "Beginner" ||
          place.difficulty === "Intermediate" ||
          place.difficulty === "Advanced" ||
          place.difficulty === "Expert" ||
          place.difficulty === "Varies"
            ? place.difficulty
            : "Varies",
        accessNote:
          typeof place.accessNote === "string" &&
          place.accessNote.trim()
            ? place.accessNote.trim()
            : "Verify current access, closures, permits and activity rules before leaving.",
      })
    )
    .slice(0, requestedCount);
}

function aiPlacesToCandidates(
  places: AiOffRoadPlace[],
  originLat: number,
  originLon: number,
  radiusMiles: number,
  activity: string
): Candidate[] {
  const seen = new Set<string>();
  const candidates: Candidate[] = [];

  for (const place of places) {
    const latitude = Number(place.latitude);
    const longitude = Number(place.longitude);

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      continue;
    }

    const distance = distanceMiles(
      originLat,
      originLon,
      latitude,
      longitude
    );

    /*
      Keep a very small coordinate tolerance because model-provided
      coordinates may represent the center of a large trail system.
    */
    if (distance > radiusMiles + 5) {
      continue;
    }

    const key =
      `${place.name.toLowerCase()}:` +
      `${latitude.toFixed(3)}:` +
      `${longitude.toFixed(3)}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);

    candidates.push({
      name: place.name,
      region: place.region,
      latitude,
      longitude,
      kind:
        place.kind ||
        kindForActivity(activity),
      distanceMiles:
        Math.round(distance * 10) / 10,
      priority: 0,
      elevationFeet: null,
      difficulty:
        place.difficulty || "Varies",
      accessNote:
        place.accessNote ||
        "Verify current access, closures, permits and activity rules before leaving.",
    });
  }

  return candidates
    .sort(
      (a, b) =>
        a.distanceMiles -
        b.distanceMiles
    )
    .slice(0, 16);
}


function selectAcrossRadius(
  candidates: Candidate[],
  radiusMiles: number,
  limit = 18
): Candidate[] {
  if (!candidates.length) {
    return [];
  }

  const innerEnd = radiusMiles / 3;
  const middleEnd = (radiusMiles * 2) / 3;

  const inner = candidates
    .filter(
      (item) =>
        item.distanceMiles <= innerEnd
    )
    .sort(
      (a, b) =>
        a.distanceMiles -
        b.distanceMiles
    );

  const middle = candidates
    .filter(
      (item) =>
        item.distanceMiles > innerEnd &&
        item.distanceMiles <= middleEnd
    )
    .sort(
      (a, b) =>
        a.distanceMiles -
        b.distanceMiles
    );

  const outer = candidates
    .filter(
      (item) =>
        item.distanceMiles > middleEnd &&
        item.distanceMiles <= radiusMiles + 5
    )
    .sort(
      (a, b) =>
        b.distanceMiles -
        a.distanceMiles
    );

  /*
    Reserve space for all three distance bands.
    This prevents a 250-mile search from becoming
    "the 18 closest places."
  */
  const targetPerBand = Math.max(
    1,
    Math.floor(limit / 3)
  );

  const selected: Candidate[] = [];

  selected.push(
    ...inner.slice(0, targetPerBand)
  );
  selected.push(
    ...middle.slice(0, targetPerBand)
  );
  selected.push(
    ...outer.slice(0, targetPerBand)
  );

  const selectedKeys = new Set(
    selected.map(
      (item) =>
        `${item.name.toLowerCase()}:${item.latitude.toFixed(3)}:${item.longitude.toFixed(3)}`
    )
  );

  const leftovers = candidates
    .filter((item) => {
      const key =
        `${item.name.toLowerCase()}:${item.latitude.toFixed(3)}:${item.longitude.toFixed(3)}`;

      return !selectedKeys.has(key);
    })
    .sort(
      (a, b) =>
        a.distanceMiles -
        b.distanceMiles
    );

  for (const item of leftovers) {
    if (selected.length >= limit) {
      break;
    }

    selected.push(item);
  }

  return selected;
}

async function discoverCandidates(
  originLat: number,
  originLon: number,
  radiusMiles: number,
  activity: string,
  startingLocation: string,
  skill: string,
  when: string
) {
  console.log("OFF ROAD SEARCH START:", {
    activity,
    originLat,
    originLon,
    radiusMiles,
    startingLocation,
    skill,
    when,
  });

  /*
    PRIMARY DISCOVERY:
    Search distance BANDS separately. A single broad AI request
    tended to cluster around familiar nearby destinations even
    when the user selected 150 or 250 miles.

    For larger searches we make three focused discovery calls:
    inner third, middle third, outer third. Returned coordinates
    are then measured by the server and must actually fall inside
    the requested band.
  */
  try {
    const bandSpecs =
      radiusMiles >= 120
        ? [
            {
              label: "inner",
              min: 0,
              max: Math.round(radiusMiles / 3),
              count: 8,
            },
            {
              label: "middle",
              min: Math.round(radiusMiles / 3),
              max: Math.round((radiusMiles * 2) / 3),
              count: 8,
            },
            {
              label: "outer",
              min: Math.round((radiusMiles * 2) / 3),
              max: radiusMiles,
              count: 10,
            },
          ]
        : [
            {
              label: "full",
              min: 0,
              max: radiusMiles,
              count: 16,
            },
          ];

    const discoveredBands =
      await Promise.all(
        bandSpecs.map(async (band) => {
          try {
            const places =
              await findAiOffRoadPlaces(
                startingLocation,
                originLat,
                originLon,
                activity,
                radiusMiles,
                skill,
                when,
                band.min,
                band.max,
                band.count
              );

            const candidates =
              aiPlacesToCandidates(
                places,
                originLat,
                originLon,
                radiusMiles,
                activity
              ).filter((candidate) => {
                /*
                  Enforce the requested band ourselves.
                  Give model coordinates a small 5-mile tolerance
                  at the band boundaries, but never beyond the
                  overall selected radius.
                */
                const bandMin =
                  Math.max(0, band.min - 5);

                const bandMax =
                  Math.min(
                    radiusMiles + 5,
                    band.max + 5
                  );

                return (
                  candidate.distanceMiles >=
                    bandMin &&
                  candidate.distanceMiles <=
                    bandMax
                );
              });

            console.log(
              `OFF ROAD AI ${band.label.toUpperCase()} BAND:`,
              {
                requested:
                  `${band.min}-${band.max}`,
                found:
                  candidates.map((item) => ({
                    name: item.name,
                    miles:
                      item.distanceMiles,
                  })),
              }
            );

            return candidates;
          } catch (error) {
            console.error(
              `OFF ROAD AI ${band.label.toUpperCase()} BAND ERROR:`,
              error
            );

            return [];
          }
        })
      );

    const combined =
      discoveredBands.flat();

    const seen = new Set<string>();
    const uniqueAiCandidates: Candidate[] =
      [];

    for (const candidate of combined) {
      const key =
        `${candidate.name.toLowerCase()}:` +
        `${candidate.latitude.toFixed(3)}:` +
        `${candidate.longitude.toFixed(3)}`;

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      uniqueAiCandidates.push(candidate);
    }

    if (uniqueAiCandidates.length) {
      const balanced =
        selectAcrossRadius(
          uniqueAiCandidates,
          radiusMiles,
          20
        );

      console.log(
        "OFF ROAD SEGMENTED AI CANDIDATES:",
        balanced.map((item) => ({
          name: item.name,
          miles: item.distanceMiles,
        }))
      );

      return balanced;
    }
  } catch (error) {
    console.error(
      "OFF ROAD SEGMENTED AI DISCOVERY ERROR:",
      error
    );
  }

  /*
    SECONDARY FALLBACK:
    Keep Photon/Overpass available only if AI discovery fails.
    A public map provider outage should no longer be the normal
    path for every Find My Best search.
  */
  try {
    const photonCandidates =
      await discoverPhotonCandidates(
        originLat,
        originLon,
        radiusMiles,
        activity
      );

    if (photonCandidates.length) {
      return selectAcrossRadius(
        photonCandidates,
        radiusMiles,
        18
      );
    }
  } catch (error) {
    console.warn(
      "OFF ROAD PHOTON FALLBACK ERROR:",
      error
    );
  }

  try {
    const radiusMeters = Math.round(
      radiusMiles * 1609.344
    );

    const query = buildOverpassQuery(
      activity,
      originLat,
      originLon,
      radiusMeters
    );

    const data = await queryOverpass(query);

    const elements: OverpassElement[] =
      Array.isArray(data?.elements)
        ? data.elements
        : [];

    const overpassCandidates =
      elementsToCandidates(
        elements,
        originLat,
        originLon,
        radiusMiles,
        activity
      );

    if (overpassCandidates.length) {
      return selectAcrossRadius(
        overpassCandidates,
        radiusMiles,
        18
      );
    }
  } catch (error) {
    console.warn(
      "OFF ROAD OVERPASS FALLBACK ERROR:",
      error
    );
  }

  return [];
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


type ScoredCandidate = Candidate & {
  score: number;
  label: string;
  bestTime?: string;
  temperatureF: number | null;
  wind: number | null;
  gust: number | null;
  precipitation: number | null;
  snowfall: number | null;
  snowDepth: number | null;
};

function chooseFinalResults(
  scored: ScoredCandidate[],
  radiusMiles: number,
  limit = 8
) {
  const ranked = [...scored].sort(
    (a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      return (
        a.distanceMiles -
        b.distanceMiles
      );
    }
  );

  if (
    radiusMiles < 75 ||
    ranked.length <= limit
  ) {
    return ranked.slice(0, limit);
  }

  const innerEnd = radiusMiles / 3;
  const middleEnd = (radiusMiles * 2) / 3;

  const inner = ranked.filter(
    (item) =>
      item.distanceMiles <= innerEnd
  );

  const middle = ranked.filter(
    (item) =>
      item.distanceMiles > innerEnd &&
      item.distanceMiles <= middleEnd
  );

  const outer = ranked.filter(
    (item) =>
      item.distanceMiles > middleEnd
  );

  const chosen: ScoredCandidate[] = [];

  /*
    For larger radii, guarantee visible radius coverage
    when real scored options exist:
    - up to 2 strong inner options
    - up to 3 middle options
    - up to 3 outer-radius options

    This keeps a 250-mile search from looking like a
    100-mile search whenever real outer-band matches exist.
  */
  chosen.push(...inner.slice(0, 2));
  chosen.push(...middle.slice(0, 3));
  chosen.push(...outer.slice(0, 3));

  const keys = new Set(
    chosen.map(
      (item) =>
        `${item.name.toLowerCase()}:${item.latitude.toFixed(3)}:${item.longitude.toFixed(3)}`
    )
  );

  for (const item of ranked) {
    if (chosen.length >= limit) {
      break;
    }

    const key =
      `${item.name.toLowerCase()}:${item.latitude.toFixed(3)}:${item.longitude.toFixed(3)}`;

    if (keys.has(key)) {
      continue;
    }

    keys.add(key);
    chosen.push(item);
  }

  return chosen
    .slice(0, limit)
    .sort(
      (a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }

        return (
          a.distanceMiles -
          b.distanceMiles
        );
      }
    );
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
    const skill = String(body?.skill || "Any");

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
      activity,
      origin.label || location || "Current Location",
      skill,
      when
    );

    const scored = (
      await Promise.all(
        candidates
          .slice(0, 20)
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

    const selectedResults =
      chooseFinalResults(
        scored as ScoredCandidate[],
        radius,
        8
      );

    const results = selectedResults
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
