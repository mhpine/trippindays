import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type ToolKey =
  | "weather"
  | "trail"
  | "snow"
  | "avalanche"
  | "terrain"
  | "bouldering"
  | "road"
  | "permits"
  | "vehicle"
  | "hunting"
  | "daylight"
  | "camping"
  | "fuel-food"
  | "navigation"
  | "safety";

type NearbyItem = {
  id: string;
  name: string;
  kind?: string;
  latitude: number;
  longitude: number;
  distanceMiles?: number;
  tags?: Record<string, string>;
  website?: string | null;
};

const VALID_TOOLS = new Set<ToolKey>([
  "weather",
  "trail",
  "snow",
  "avalanche",
  "terrain",
  "bouldering",
  "road",
  "permits",
  "vehicle",
  "hunting",
  "daylight",
  "camping",
  "fuel-food",
  "navigation",
  "safety",
]);

function kmToMiles(km: number) {
  return km * 0.621371;
}

function metersToFeet(meters: number) {
  return meters * 3.28084;
}

function cToF(c: number) {
  return (c * 9) / 5 + 32;
}

function mmToIn(mm: number) {
  return mm / 25.4;
}

function cmToIn(cm: number) {
  return cm / 2.54;
}

function mToMiles(m: number) {
  return m / 1609.344;
}

function finiteOrNull(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function haversineMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthMiles = 3958.7613;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return earthMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function fetchJson(
  url: string,
  options?: RequestInit,
  timeoutMs = 12000
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Request failed with ${response.status}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function getAreaLabel(lat: number, lon: number) {
  try {
    const url =
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2` +
      `&lat=${encodeURIComponent(String(lat))}` +
      `&lon=${encodeURIComponent(String(lon))}` +
      `&zoom=14&addressdetails=1`;

    const data = await fetchJson(
      url,
      {
        headers: {
          "User-Agent": "TrippinDays/1.0 (https://trippindays.com)",
          "Accept-Language": "en",
        },
      },
      9000
    );

    const address = data?.address ?? {};
    const city =
      address.city ||
      address.town ||
      address.village ||
      address.hamlet ||
      address.county ||
      "";

    const state = address.state || address.region || "";
    const country = address.country || "";
    const countryCode = String(address.country_code || "").toLowerCase();

    const label =
      [city, state, country].filter(Boolean).join(", ") ||
      data?.display_name ||
      `${lat.toFixed(5)}, ${lon.toFixed(5)}`;

    return {
      label,
      city,
      state,
      country,
      countryCode,
    };
  } catch {
    return {
      label: `${lat.toFixed(5)}, ${lon.toFixed(5)}`,
      city: "",
      state: "",
      country: "",
      countryCode: "",
    };
  }
}

async function getWeather(lat: number, lon: number) {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: [
      "temperature_2m",
      "apparent_temperature",
      "precipitation",
      "rain",
      "snowfall",
      "weather_code",
      "wind_speed_10m",
      "wind_gusts_10m",
      "visibility",
    ].join(","),
    hourly: "snow_depth",
    daily: [
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_sum",
      "snowfall_sum",
      "sunrise",
      "sunset",
    ].join(","),
    temperature_unit: "fahrenheit",
    wind_speed_unit: "mph",
    precipitation_unit: "inch",
    timezone: "auto",
    forecast_days: "3",
  });

  const data = await fetchJson(
    `https://api.open-meteo.com/v1/forecast?${params.toString()}`,
    undefined,
    10000
  );

  const firstSnowDepthMeters =
    Array.isArray(data?.hourly?.snow_depth) &&
    data.hourly.snow_depth.length > 0
      ? finiteOrNull(data.hourly.snow_depth[0])
      : null;

  const dates: string[] = Array.isArray(data?.daily?.time)
    ? data.daily.time
    : [];

  const daily = dates.map((date, index) => ({
    date,
    highF: finiteOrNull(data?.daily?.temperature_2m_max?.[index]),
    lowF: finiteOrNull(data?.daily?.temperature_2m_min?.[index]),
    precipitationIn: finiteOrNull(
      data?.daily?.precipitation_sum?.[index]
    ),
    snowfallIn: finiteOrNull(data?.daily?.snowfall_sum?.[index]),
    sunrise: data?.daily?.sunrise?.[index] || null,
    sunset: data?.daily?.sunset?.[index] || null,
  }));

  return {
    elevationFeet:
      finiteOrNull(data?.elevation) == null
        ? null
        : metersToFeet(Number(data.elevation)),
    timezone: data?.timezone || "",
    current: {
      temperatureF: finiteOrNull(data?.current?.temperature_2m),
      apparentTemperatureF: finiteOrNull(
        data?.current?.apparent_temperature
      ),
      precipitationIn: finiteOrNull(data?.current?.precipitation),
      rainIn: finiteOrNull(data?.current?.rain),
      snowfallIn: finiteOrNull(data?.current?.snowfall),
      snowDepthIn:
        firstSnowDepthMeters == null
          ? null
          : firstSnowDepthMeters * 39.3701,
      windMph: finiteOrNull(data?.current?.wind_speed_10m),
      windGustMph: finiteOrNull(data?.current?.wind_gusts_10m),
      visibilityMiles:
        finiteOrNull(data?.current?.visibility) == null
          ? null
          : mToMiles(Number(data.current.visibility)),
      weatherCode: finiteOrNull(data?.current?.weather_code),
    },
    daily,
  };
}

function buildOverpassQuery(
  tool: ToolKey,
  lat: number,
  lon: number
) {
  const radius =
    tool === "fuel-food" || tool === "safety"
      ? 50000
      : tool === "trail" || tool === "bouldering" || tool === "camping"
        ? 40000
        : 30000;

  const around = `(around:${radius},${lat},${lon})`;

  switch (tool) {
    case "trail":
      return `
[out:json][timeout:20];
(
  nwr${around}["highway"~"^(path|footway|bridleway)$"]["name"];
);
out tags center 30;
      `.trim();

    case "bouldering":
      return `
[out:json][timeout:20];
(
  nwr${around}["climbing:boulder"="yes"]["name"];
  nwr${around}["sport"="climbing"]["name"];
  nwr${around}["natural"="rock"]["name"];
);
out tags center 30;
      `.trim();

    case "road":
      return `
[out:json][timeout:20];
(
  way${around}["highway"~"^(track|service|unclassified)$"]["name"];
  nwr${around}["barrier"="gate"];
);
out tags center 30;
      `.trim();

    case "permits":
      return `
[out:json][timeout:20];
(
  nwr${around}["boundary"="protected_area"]["name"];
  nwr${around}["leisure"="nature_reserve"]["name"];
  nwr${around}["protect_class"]["name"];
);
out tags center 30;
      `.trim();

    case "vehicle":
      return `
[out:json][timeout:20];
(
  way${around}["highway"~"^(track|path|service)$"]["motor_vehicle"];
  way${around}["highway"~"^(track|path|service)$"]["motorcycle"];
  way${around}["highway"~"^(track|path|service)$"]["atv"];
  way${around}["highway"~"^(track|path|service)$"]["4wd_only"];
);
out tags center 30;
      `.trim();

    case "camping":
      return `
[out:json][timeout:20];
(
  nwr${around}["tourism"="camp_site"];
  nwr${around}["tourism"="caravan_site"];
);
out tags center 30;
      `.trim();

    case "fuel-food":
      return `
[out:json][timeout:20];
(
  nwr${around}["amenity"="fuel"];
  nwr${around}["amenity"="restaurant"];
  nwr${around}["amenity"="fast_food"];
  nwr${around}["amenity"="cafe"];
  nwr${around}["shop"="supermarket"];
  nwr${around}["shop"="convenience"];
);
out tags center 40;
      `.trim();

    case "safety":
      return `
[out:json][timeout:20];
(
  nwr${around}["amenity"="hospital"];
  nwr${around}["amenity"="clinic"];
  nwr${around}["amenity"="police"];
  nwr${around}["amenity"="fire_station"];
  nwr${around}["amenity"="ranger_station"];
);
out tags center 30;
      `.trim();

    default:
      return "";
  }
}

function itemKind(tool: ToolKey, tags: Record<string, string>) {
  if (tool === "trail") return "Trail";
  if (tool === "bouldering") return "Climbing / Bouldering";
  if (tool === "camping") return "Campground";
  if (tool === "permits") return "Protected Area";
  if (tool === "vehicle") return "Motorized Access";
  if (tool === "road") {
    if (tags.barrier === "gate") return "Gate";
    return "Access Road";
  }
  if (tool === "fuel-food") {
    if (tags.amenity === "fuel") return "Fuel";
    if (tags.shop === "supermarket") return "Groceries";
    if (tags.shop === "convenience") return "Convenience Store";
    if (tags.amenity === "cafe") return "Cafe";
    if (tags.amenity === "fast_food") return "Fast Food";
    return "Food";
  }
  if (tool === "safety") {
    if (tags.amenity === "hospital") return "Hospital";
    if (tags.amenity === "clinic") return "Clinic";
    if (tags.amenity === "police") return "Police";
    if (tags.amenity === "fire_station") return "Fire Station";
    if (tags.amenity === "ranger_station") return "Ranger Station";
    return "Emergency Service";
  }

  return "Nearby Result";
}

async function getNearby(
  tool: ToolKey,
  lat: number,
  lon: number
): Promise<{ items: NearbyItem[]; source: string }> {
  const query = buildOverpassQuery(tool, lat, lon);
  if (!query) return { items: [], source: "none" };

  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.nchc.org.tw/api/interpreter",
  ];

  let lastError = "Nearby service returned no usable response.";

  for (const endpoint of endpoints) {
    try {
      const body = new URLSearchParams({ data: query });

      const data = await fetchJson(
        endpoint,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
            "User-Agent": "TrippinDays/1.0 (https://trippindays.com)",
          },
          body,
        },
        22000
      );

      const elements = Array.isArray(data?.elements)
        ? data.elements
        : [];

      const items = elements
        .map((element: any) => {
          const itemLat = finiteOrNull(
            element?.lat ?? element?.center?.lat
          );
          const itemLon = finiteOrNull(
            element?.lon ?? element?.center?.lon
          );

          if (itemLat == null || itemLon == null) return null;

          const tags =
            element?.tags && typeof element.tags === "object"
              ? (element.tags as Record<string, string>)
              : {};

          const fallbackName =
            tool === "road" && tags.barrier === "gate"
              ? "Access Gate"
              : itemKind(tool, tags);

          const website =
            tags.website ||
            tags["contact:website"] ||
            tags.url ||
            null;

          return {
            id: `${element.type}-${element.id}`,
            name: tags.name || fallbackName,
            kind: itemKind(tool, tags),
            latitude: itemLat,
            longitude: itemLon,
            distanceMiles: haversineMiles(
              lat,
              lon,
              itemLat,
              itemLon
            ),
            tags,
            website,
          } as NearbyItem;
        })
        .filter(Boolean)
        .sort(
          (a: NearbyItem, b: NearbyItem) =>
            (a.distanceMiles ?? 9999) -
            (b.distanceMiles ?? 9999)
        )
        .slice(0, 20);

      return {
        items,
        source: new URL(endpoint).hostname,
      };
    } catch (error) {
      lastError =
        error instanceof Error
          ? error.message
          : "Nearby service failed.";
    }
  }

  throw new Error(lastError);
}

function officialLinks(
  tool: ToolKey,
  countryCode: string
) {
  const links: Array<{ label: string; url: string }> = [];

  if (tool === "avalanche") {
    if (countryCode === "ca") {
      links.push({
        label: "Avalanche Canada Forecasts",
        url: "https://www.avalanche.ca/",
      });
    } else if (
      [
        "at",
        "ch",
        "de",
        "fr",
        "it",
        "es",
        "si",
        "sk",
        "no",
        "se",
        "fi",
        "is",
      ].includes(countryCode)
    ) {
      links.push({
        label: "European Avalanche Services",
        url: "https://www.avalanches.org/",
      });
    } else {
      links.push({
        label: "Avalanche.org Forecasts",
        url: "https://avalanche.org/",
      });
    }
  }

  if (countryCode === "us") {
    if (tool === "road" || tool === "vehicle") {
      links.push({
        label: "U.S. State Transportation Websites",
        url: "https://www.fhwa.dot.gov/about/webstate.cfm",
      });
    }

    if (tool === "permits" || tool === "camping") {
      links.push({
        label: "Recreation.gov",
        url: "https://www.recreation.gov/",
      });
    }

    if (tool === "hunting") {
      links.push({
        label: "Find Your State Government / Wildlife Agency",
        url: "https://www.usa.gov/state-governments",
      });
      links.push({
        label: "U.S. Fish & Wildlife Service",
        url: "https://www.fws.gov/",
      });
    }

    if (tool === "safety") {
      links.push({
        label: "State Emergency Management Agencies",
        url: "https://www.usa.gov/state-emergency-management",
      });
    }
  }

  return links;
}

function toolNote(tool: ToolKey) {
  switch (tool) {
    case "trail":
      return "Trail surface and access tags come from OpenStreetMap and may not reflect same-day closures. Confirm official land-manager notices before leaving.";
    case "road":
      return "Mapped gates and road tags are useful for planning but are not a live closure feed. Check the responsible road agency or land manager before departure.";
    case "vehicle":
      return "Motorized-access tags can be incomplete. Confirm OHV, ATV, UTV, motorcycle and 4x4 legality with the land manager.";
    case "permits":
      return "Nearby protected areas are shown as a starting point. Permit, reservation and fee requirements must be confirmed with the managing agency.";
    case "hunting":
      return "Hunting seasons, units, tags, methods and bag limits are legal rules. TrippinDays does not infer or guess them.";
    case "avalanche":
      return "Weather context is not an avalanche forecast. Always use the official forecast center for the exact terrain and day.";
    case "safety":
      return "Nearby emergency-service map data can be incomplete. In an emergency, use the local emergency number and share your exact coordinates.";
    default:
      return "";
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const requestedTool = searchParams.get("tool");

  if (requestedTool === "health") {
    return NextResponse.json({
      ok: true,
      route: "/api/off-the-road/toolkit",
      message: "Off the Road Toolkit API is running.",
    });
  }

  const tool = requestedTool as ToolKey | null;
  const lat = Number(searchParams.get("lat"));
  const lon = Number(searchParams.get("lon"));

  if (!tool || !VALID_TOOLS.has(tool)) {
    return NextResponse.json(
      { ok: false, error: "Invalid toolkit tool." },
      { status: 400 }
    );
  }

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    lat < -90 ||
    lat > 90 ||
    lon < -180 ||
    lon > 180
  ) {
    return NextResponse.json(
      { ok: false, error: "Valid latitude and longitude are required." },
      { status: 400 }
    );
  }

  try {
    const [area, weather] = await Promise.all([
      getAreaLabel(lat, lon),
      getWeather(lat, lon),
    ]);

    const nearbyTools: ToolKey[] = [
      "trail",
      "bouldering",
      "road",
      "permits",
      "vehicle",
      "camping",
      "fuel-food",
      "safety",
    ];

    let items: NearbyItem[] = [];
    let nearbyError = "";
    let nearbySource = "";

    if (nearbyTools.includes(tool)) {
      try {
        const nearby = await getNearby(tool, lat, lon);
        items = nearby.items;
        nearbySource = nearby.source;
      } catch (error) {
        nearbyError =
          error instanceof Error
            ? error.message
            : "Nearby service failed.";
      }
    }

    return NextResponse.json({
      ok: true,
      tool,
      location: {
        ...area,
        latitude: lat,
        longitude: lon,
      },
      weather,
      items,
      nearbyError,
      nearbySource,
      officialLinks: officialLinks(tool, area.countryCode),
      note: toolNote(tool),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "The toolkit could not load current data.",
      },
      { status: 500 }
    );
  }
}
