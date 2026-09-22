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

    const offers = Array.isArray(data?.data?.offers)
      ? data.data.offers
      : [];

    // Look at more Duffel offers so one airline
    // doesn't dominate the first few results.
    const formattedOffers = offers.map((offer: any) => {
  const outboundSlice = offer.slices?.[0];
      const outboundFirstSegment =
        outboundSlice?.segments?.[0];

      const outboundLastSegment =
        outboundSlice?.segments?.[
          (outboundSlice?.segments?.length || 1) - 1
        ];

      const returnSlice = offer.slices?.[1];

      const returnFirstSegment =
        returnSlice?.segments?.[0];

      const returnLastSegment =
        returnSlice?.segments?.[
          (returnSlice?.segments?.length || 1) - 1
        ];

      const operatingCarriers = Array.from(
        new Set(
          (offer.slices || [])
            .flatMap((slice: any) => slice?.segments || [])
            .map(
              (segment: any) =>
                segment?.operating_carrier?.name
            )
            .filter(Boolean)
        )
      );

      const marketingAirline =
        outboundFirstSegment?.marketing_carrier?.name;

      const operatingAirline =
        outboundFirstSegment?.operating_carrier?.name;

      const airline =
        marketingAirline ||
        operatingAirline ||
        "Airline";

      const airlineLogo =
        outboundFirstSegment?.marketing_carrier?.logo_symbol_url ||
        outboundFirstSegment?.operating_carrier?.logo_symbol_url ||
        null;

      return {
        id: offer.id,

        totalAmount: offer.total_amount,
        totalCurrency: offer.total_currency,

        airline,
        airlineLogo,

        marketingCarrier: marketingAirline || null,
        operatingCarrier: operatingAirline || null,
        operatingCarriers,

        origin:
          outboundSlice?.origin?.iata_code ||
          String(origin).toUpperCase(),

        destination:
          outboundSlice?.destination?.iata_code ||
          String(destination).toUpperCase(),

        departureTime:
          outboundFirstSegment?.departing_at || null,

        arrivalTime:
          outboundLastSegment?.arriving_at || null,

        duration:
          outboundSlice?.duration || null,

        stops: Math.max(
          0,
          (outboundSlice?.segments?.length || 1) - 1
        ),

        returnOrigin:
          returnSlice?.origin?.iata_code || null,

        returnDestination:
          returnSlice?.destination?.iata_code || null,

        returnDepartureTime:
          returnFirstSegment?.departing_at || null,

        returnArrivalTime:
          returnLastSegment?.arriving_at || null,

        returnDuration:
          returnSlice?.duration || null,

        returnStops: returnSlice
          ? Math.max(
              0,
              (returnSlice?.segments?.length || 1) - 1
            )
          : null,

        expiresAt: offer.expires_at,
      };
    });

    // Sort all offers cheapest first.
    const sortedOffers = [...formattedOffers].sort(
      (a: any, b: any) =>
        Number(a.totalAmount) - Number(b.totalAmount)
    );

    // Prevent one airline from taking over the results.
    // Maximum 3 offers from each airline.
    const airlineCounts = new Map<string, number>();

    const diverseOffers = sortedOffers
      .filter((offer: any) => {
        const airline =
          offer.airline || "Unknown Airline";

        const count =
          airlineCounts.get(airline) || 0;

        if (count >= 6) {
          return false;
        }

        airlineCounts.set(airline, count + 1);

        return true;
      })
      .slice(0, 12);

    // Build list of airlines actually available
    // for this particular search.
    const availableAirlines = Array.from(
      new Set(
        sortedOffers
          .map((offer: any) => offer.airline)
          .filter(Boolean)
      )
    ).sort();

   return NextResponse.json({
  offerRequestId: data?.data?.id || null,

  liveMode: data?.data?.live_mode ?? null,

  roundTrip: Boolean(returnDate),

  offers: diverseOffers,

  availableAirlines,

  totalDuffelOffers: offers.length,

  displayedOffers: diverseOffers.length,

  allReturnedAirlines: Array.from(
    new Set(
      offers
        .flatMap((offer: any) =>
          (offer.slices || []).flatMap((slice: any) =>
            (slice.segments || []).flatMap((segment: any) => [
              segment?.marketing_carrier?.name,
              segment?.operating_carrier?.name,
            ])
          )
        )
        .filter(Boolean)
    )
  ),
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