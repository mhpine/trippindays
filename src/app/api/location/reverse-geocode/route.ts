import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function clean(value: unknown) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const lat = Number(searchParams.get("lat"));
  const lon = Number(searchParams.get("lon"));

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    lat < -90 ||
    lat > 90 ||
    lon < -180 ||
    lon > 180
  ) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Valid latitude and longitude are required.",
      },
      { status: 400 }
    );
  }

  try {
    const url =
      "https://nominatim.openstreetmap.org/reverse" +
      `?format=jsonv2&lat=${encodeURIComponent(
        String(lat)
      )}&lon=${encodeURIComponent(
        String(lon)
      )}&zoom=14&addressdetails=1`;

    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        "User-Agent":
          "TrippinDays/1.0 (https://trippindays.com)",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Reverse geocode failed with ${response.status}.`
      );
    }

    const data = await response.json();
    const address = data?.address || {};

    const city =
      clean(address.city) ||
      clean(address.town) ||
      clean(address.village) ||
      clean(address.hamlet) ||
      clean(address.municipality) ||
      clean(address.county);

    const state = clean(address.state);
    const country = clean(address.country);

    const shortLabel =
      [city, state]
        .filter(Boolean)
        .join(", ") ||
      [state, country]
        .filter(Boolean)
        .join(", ") ||
      "Current Location";

    const label =
      [city, state, country]
        .filter(Boolean)
        .join(", ") ||
      clean(data?.display_name) ||
      shortLabel;

    return NextResponse.json({
      success: true,
      label,
      shortLabel,
      city,
      state,
      country,
      latitude: lat,
      longitude: lon,
    });
  } catch {
    // GPS itself is still authoritative even if the readable-name lookup fails.
    return NextResponse.json({
      success: true,
      label: "Current Location",
      shortLabel: "Current Location",
      city: "",
      state: "",
      country: "",
      latitude: lat,
      longitude: lon,
    });
  }
}
