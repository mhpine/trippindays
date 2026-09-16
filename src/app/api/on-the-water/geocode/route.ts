import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim();

    if (!query || query.length < 2) {
      return NextResponse.json(
        {
          success: false,
          error: "Enter a city, state, or ZIP code.",
        },
        { status: 400 }
      );
    }

    const url =
      "https://geocoding-api.open-meteo.com/v1/search?" +
      new URLSearchParams({
        name: query,
        count: "8",
        language: "en",
        format: "json",
      });

    const response = await fetch(url, {
      next: {
        revalidate: 86400,
      },
    });

    if (!response.ok) {
      throw new Error("Location service failed.");
    }

    const data = await response.json();

    const results = Array.isArray(data.results)
      ? data.results.map((place: any) => ({
          id: place.id,
          name: place.name,
          latitude: place.latitude,
          longitude: place.longitude,
          state: place.admin1 || "",
          county: place.admin2 || "",
          country: place.country || "",
          countryCode: place.country_code || "",
          timezone: place.timezone || "",
        }))
      : [];

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    console.error(
      "On the Water geocode error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: "Unable to search that location.",
      },
      { status: 500 }
    );
  }
}