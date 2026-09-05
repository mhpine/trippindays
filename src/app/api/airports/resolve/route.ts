import { NextResponse } from "next/server";

type DuffelPlace = {
  type?: "airport" | "city";
  name?: string;
  iata_code?: string;
  city_name?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  airports?: DuffelPlace[] | null;
};

type GeoResult = {
  latitude: number;
  longitude: number;
  label: string;
};

function duffelHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    "Duffel-Version": "v2",
  };
}

function flattenAirports(places: DuffelPlace[]) {
  const airports: DuffelPlace[] = [];

  for (const place of places) {
    if (place.type === "airport" && place.iata_code) {
      airports.push(place);
    }

    if (place.type === "city" && Array.isArray(place.airports)) {
      for (const airport of place.airports) {
        if (airport.iata_code) airports.push(airport);
      }
    }
  }

  return airports;
}

function result(place?: DuffelPlace) {
  if (!place?.iata_code) return null;

  return {
    name: place.name || place.city_name || place.iata_code,
    cityName: place.city_name || null,
    iataCode: place.iata_code,
    latitude: place.latitude ?? null,
    longitude: place.longitude ?? null,
  };
}

async function searchDuffelByName(token: string, query: string) {
  const url = new URL("https://api.duffel.com/places/suggestions");
  url.searchParams.set("query", query);

  const response = await fetch(url, {
    headers: duffelHeaders(token),
    cache: "no-store",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.errors?.[0]?.message || "Duffel airport lookup failed."
    );
  }

  return flattenAirports(Array.isArray(data?.data) ? data.data : []);
}

async function searchDuffelNearby(
  token: string,
  latitude: number,
  longitude: number,
  radiusMetres = 250000
) {
  const url = new URL("https://api.duffel.com/places/suggestions");
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lng", String(longitude));
  url.searchParams.set("rad", String(radiusMetres));

  const response = await fetch(url, {
    headers: duffelHeaders(token),
    cache: "no-store",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.errors?.[0]?.message || "Duffel nearby airport lookup failed."
    );
  }

  return flattenAirports(Array.isArray(data?.data) ? data.data : []);
}

async function geocodeLocation(query: string): Promise<GeoResult | null> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "us");

  const response = await fetch(url, {
    headers: {
      "User-Agent": "TrippinDays/1.0 (trippindays.com)",
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) return null;

  const data = await response.json();
  const first = Array.isArray(data) ? data[0] : null;

  if (!first) return null;

  const latitude = Number(first.lat);
  const longitude = Number(first.lon);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return {
    latitude,
    longitude,
    label: first.display_name || query,
  };
}

async function resolveToAirport(
  token: string,
  query: string,
  coordinates?: { latitude: number; longitude: number } | null
) {
  // 1. If we already know coordinates, use them first.
  if (coordinates) {
    const nearby = await searchDuffelNearby(
      token,
      coordinates.latitude,
      coordinates.longitude
    );

    if (nearby.length > 0) {
      return {
        primary: nearby[0],
        alternatives: nearby.slice(1, 4),
        geoLabel: query,
      };
    }
  }

  // 2. Try Duffel's own city/airport name search.
  const byName = await searchDuffelByName(token, query);

  if (byName.length > 0) {
    return {
      primary: byName[0],
      alternatives: byName.slice(1, 4),
      geoLabel: query,
    };
  }

  // 3. If that failed, geocode the ZIP/city/park/etc. into coordinates.
  const geocoded = await geocodeLocation(query);

  if (!geocoded) return null;

  const nearby = await searchDuffelNearby(
    token,
    geocoded.latitude,
    geocoded.longitude
  );

  if (nearby.length === 0) return null;

  return {
    primary: nearby[0],
    alternatives: nearby.slice(1, 4),
    geoLabel: geocoded.label,
  };
}

export async function POST(request: Request) {
  try {
    const token = process.env.DUFFEL_ACCESS_TOKEN;

    if (!token) {
      return NextResponse.json(
        { error: "Duffel access token is missing." },
        { status: 500 }
      );
    }

    const body = await request.json();

    const origin = String(body?.origin || "").trim();
    const destination = String(body?.destination || "").trim();

    const destinationLatitude = Number(body?.destinationLatitude);
    const destinationLongitude = Number(body?.destinationLongitude);

    if (!origin || !destination) {
      return NextResponse.json(
        { error: "Starting location and destination are required." },
        { status: 400 }
      );
    }

    const destinationCoordinates =
      Number.isFinite(destinationLatitude) &&
      Number.isFinite(destinationLongitude)
        ? {
            latitude: destinationLatitude,
            longitude: destinationLongitude,
          }
        : null;

    const [originMatch, destinationMatch] = await Promise.all([
      resolveToAirport(token, origin, null),
      resolveToAirport(token, destination, destinationCoordinates),
    ]);

    if (!originMatch?.primary || !destinationMatch?.primary) {
      return NextResponse.json(
        {
          error:
            "TrippinDays could not automatically match airports for this trip.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      origin: result(originMatch.primary),
      destination: result(destinationMatch.primary),

      originAlternatives: originMatch.alternatives
        .map(result)
        .filter(Boolean),

      destinationAlternatives: destinationMatch.alternatives
        .map(result)
        .filter(Boolean),

      originResolvedFrom: originMatch.geoLabel,
      destinationResolvedFrom: destinationMatch.geoLabel,
    });
  } catch (error) {
    console.error("Airport resolve error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not automatically find airports.",
      },
      { status: 500 }
    );
  }
}
