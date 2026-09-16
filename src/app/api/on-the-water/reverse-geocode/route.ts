import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const latitude = Number(request.nextUrl.searchParams.get("lat"));
  const longitude = Number(request.nextUrl.searchParams.get("lon"));

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return NextResponse.json(
      { success: false, error: "Valid latitude and longitude are required." },
      { status: 400 }
    );
  }

  try {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("lat", String(latitude));
    url.searchParams.set("lon", String(longitude));
    url.searchParams.set("zoom", "10");
    url.searchParams.set("addressdetails", "1");

    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        "User-Agent": "TrippinDays/1.0 (https://trippindays.com)",
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Reverse geocoder returned ${response.status}.`);
    }

    const data = await response.json();
    const address = data?.address || {};

    const city =
      address.city ||
      address.town ||
      address.village ||
      address.hamlet ||
      address.municipality ||
      address.county ||
      "Current Location";

    const state = address.state_code || address.state || "";
    const shortState =
      typeof state === "string" && state.startsWith("US-")
        ? state.slice(3)
        : state;

    return NextResponse.json({
      success: true,
      city,
      state: shortState,
      label: [city, shortState].filter(Boolean).join(", "),
    });
  } catch (error) {
    console.error("On the Water reverse geocode error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Could not determine the current city from GPS coordinates.",
      },
      { status: 502 }
    );
  }
}
