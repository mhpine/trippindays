import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const token = process.env.DUFFEL_ACCESS_TOKEN;

    if (!token) {
      return NextResponse.json(
        { error: "Duffel access token is missing." },
        { status: 500 }
      );
    }

    const { offerId } = await request.json();

    if (!offerId || typeof offerId !== "string") {
      return NextResponse.json(
        { error: "A Duffel offer ID is required." },
        { status: 400 }
      );
    }

    const response = await fetch(
      `https://api.duffel.com/air/offers/${encodeURIComponent(offerId)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Duffel-Version": "v2",
        },
        cache: "no-store",
      }
    );

    const payload = await response.json();

    if (!response.ok) {
      console.error("Duffel offer refresh error:", payload);
      return NextResponse.json(
        {
          error:
            payload?.errors?.[0]?.message ||
            "This flight offer is no longer available. Search again.",
        },
        { status: response.status }
      );
    }

    const offer = payload?.data;

    if (!offer) {
      return NextResponse.json(
        { error: "Duffel did not return the selected offer." },
        { status: 502 }
      );
    }

    // Safety lock: this checkout is intentionally TEST-ONLY for now.
    if (offer.live_mode !== false) {
      return NextResponse.json(
        {
          error:
            "Safety stop: live Duffel offers cannot be booked from this test checkout.",
        },
        { status: 403 }
      );
    }

    const passengers = Array.isArray(offer.passengers)
      ? offer.passengers.map((passenger: any) => ({
          id: passenger.id,
          type: passenger.type || "adult",
        }))
      : [];

    return NextResponse.json({
      id: offer.id,
      totalAmount: offer.total_amount,
      totalCurrency: offer.total_currency,
      expiresAt: offer.expires_at || null,
      liveMode: offer.live_mode,
      passengers,
    });
  } catch (error) {
    console.error("Duffel offer refresh API error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not refresh the Duffel offer.",
      },
      { status: 500 }
    );
  }
}
