import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query");

    if (!query) {
      return NextResponse.json(
        { error: "Missing photo search query." },
        { status: 400 }
      );
    }

    const apiKey = process.env.PEXELS_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Pexels API key is not configured." },
        { status: 500 }
      );
    }

    const response = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(
        query
      )}&per_page=1&orientation=landscape`,
      {
        headers: {
          Authorization: apiKey,
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: "Could not load destination photo." },
        { status: response.status }
      );
    }

    const data = await response.json();

    const photo = data.photos?.[0];

    if (!photo) {
      return NextResponse.json({ imageUrl: "" });
    }

    return NextResponse.json({
      imageUrl: photo.src?.large2x || photo.src?.large || "",
      photographer: photo.photographer || "",
      photographerUrl: photo.photographer_url || "",
      pexelsUrl: photo.url || "",
    });
  } catch (error) {
    console.error("Photo route error:", error);

    return NextResponse.json(
      { error: "Photo lookup failed." },
      { status: 500 }
    );
  }
}