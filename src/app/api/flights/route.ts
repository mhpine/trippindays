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

    const body = await request.json();

    const {
      origin,
      destination,
      departureDate,
      returnDate,
      adults = 1,
      cabinClass = "economy",
    } = body;

    if (!origin || !destination || !departureDate) {
      return NextResponse.json(
        { error: "Origin, destination, and departure date are required." },
        { status: 400 }
      );
    }

    const slices = [
      {
        origin: String(origin).toUpperCase(),
        destination: String(destination).toUpperCase(),
        departure_date: departureDate,
      },
    ];

    if (returnDate) {
      slices.push({
        origin: String(destination).toUpperCase(),
        destination: String(origin).toUpperCase(),
        departure_date: returnDate,
      });
    }

    const passengers = Array.from(
      { length: Math.max(1, Math.min(9, Number(adults))) },
      () => ({ type: "adult" })
    );

    const duffelResponse = await fetch(
      "https://api.duffel.com/air/offer_requests?return_offers=true",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
          "Duffel-Version": "v2",
        },
        body: JSON.stringify({
          data: {
            slices,
            passengers,
            cabin_class: cabinClass,
          },
        }),
        cache: "no-store",
      }
    );

    const data = await duffelResponse.json();

    if (!duffelResponse.ok) {
      console.error("Duffel flight search error:", data);

      return NextResponse.json(
        {
          error: "Could not search flights.",
          details: data,
        },
        { status: duffelResponse.status }
      );
    }

    const offers = Array.isArray(data?.data?.offers) ? data.data.offers : [];

    const formattedOffers = offers.slice(0, 10).map((offer: any) => {
      const outboundSlice = offer.slices?.[0];
      const outboundFirstSegment = outboundSlice?.segments?.[0];
      const outboundLastSegment =
        outboundSlice?.segments?.[outboundSlice.segments.length - 1];

      const returnSlice = offer.slices?.[1];
      const returnFirstSegment = returnSlice?.segments?.[0];
      const returnLastSegment =
        returnSlice?.segments?.[returnSlice.segments.length - 1];

      const operatingCarriers = Array.from(
        new Set(
          (offer.slices || [])
            .flatMap((slice: any) => slice?.segments || [])
            .map((segment: any) => segment?.operating_carrier?.name)
            .filter(Boolean)
        )
      );

      return {
        id: offer.id,
        totalAmount: offer.total_amount,
        totalCurrency: offer.total_currency,

        airline:
          outboundFirstSegment?.operating_carrier?.name ||
          outboundFirstSegment?.marketing_carrier?.name ||
          "Airline",

        airlineLogo:
          outboundFirstSegment?.operating_carrier?.logo_symbol_url ||
          outboundFirstSegment?.marketing_carrier?.logo_symbol_url ||
          null,

        operatingCarriers,

        origin:
          outboundSlice?.origin?.iata_code || String(origin).toUpperCase(),

        destination:
          outboundSlice?.destination?.iata_code ||
          String(destination).toUpperCase(),

        departureTime: outboundFirstSegment?.departing_at || null,
        arrivalTime: outboundLastSegment?.arriving_at || null,
        duration: outboundSlice?.duration || null,

        stops: Math.max(0, (outboundSlice?.segments?.length || 1) - 1),

        returnOrigin: returnSlice?.origin?.iata_code || null,
        returnDestination: returnSlice?.destination?.iata_code || null,
        returnDepartureTime: returnFirstSegment?.departing_at || null,
        returnArrivalTime: returnLastSegment?.arriving_at || null,
        returnDuration: returnSlice?.duration || null,

        returnStops: returnSlice
          ? Math.max(0, (returnSlice?.segments?.length || 1) - 1)
          : null,

        expiresAt: offer.expires_at,
      };
    });

    return NextResponse.json({
      offerRequestId: data?.data?.id || null,
      roundTrip: Boolean(returnDate),
      offers: formattedOffers,
    });
  } catch (error) {
    console.error("Flight API error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Something went wrong searching flights.",
      },
      { status: 500 }
    );
  }
}
