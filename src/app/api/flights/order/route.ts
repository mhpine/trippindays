import { NextResponse } from "next/server";

type PassengerInput = {
  id: string;
  title: "mr" | "mrs" | "ms" | "miss" | "dr";
  givenName: string;
  familyName: string;
  bornOn: string;
  gender: "m" | "f";
  email: string;
  phoneNumber: string;
};

function normalizePhoneForDuffel(value: string): string {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");

  if (!digits) return "";
  if (trimmed.startsWith("+")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
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
    const offerId = body?.offerId;
    const passengers: PassengerInput[] = Array.isArray(body?.passengers)
      ? body.passengers
      : [];

    if (!offerId || typeof offerId !== "string") {
      return NextResponse.json(
        { error: "A Duffel offer ID is required." },
        { status: 400 }
      );
    }

    if (passengers.length < 1 || passengers.length > 9) {
      return NextResponse.json(
        { error: "Between 1 and 9 passengers are required." },
        { status: 400 }
      );
    }

    // Refresh the offer immediately before booking.
    const offerResponse = await fetch(
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

    const offerPayload = await offerResponse.json();

    if (!offerResponse.ok) {
      console.error("Duffel pre-order offer refresh error:", offerPayload);
      return NextResponse.json(
        {
          error:
            offerPayload?.errors?.[0]?.message ||
            "The selected flight is no longer available. Search again.",
        },
        { status: offerResponse.status }
      );
    }

    const offer = offerPayload?.data;

    // HARD SAFETY LOCK. Remove only when TrippinDays is deliberately ready
    // to sell live airfare and has a live payment/funding flow in place.
    if (offer?.live_mode !== false) {
      return NextResponse.json(
        {
          error:
            "Safety stop: this endpoint refuses to create live airline orders.",
        },
        { status: 403 }
      );
    }

    const offerPassengerIds = new Set(
      (offer?.passengers || []).map((passenger: any) => passenger.id)
    );

    for (const passenger of passengers) {
      if (!offerPassengerIds.has(passenger.id)) {
        return NextResponse.json(
          { error: "Passenger data does not match the selected Duffel offer." },
          { status: 400 }
        );
      }

      if (
        !passenger.givenName?.trim() ||
        !passenger.familyName?.trim() ||
        !passenger.bornOn ||
        !passenger.email?.trim() ||
        !passenger.phoneNumber?.trim()
      ) {
        return NextResponse.json(
          { error: "All passenger fields are required." },
          { status: 400 }
        );
      }
    }

    const normalizedPassengers = passengers.map((passenger) => ({
      ...passenger,
      phoneNumber: normalizePhoneForDuffel(passenger.phoneNumber),
    }));

    const invalidPhone = normalizedPassengers.find(
      (passenger) => !/^\+[1-9]\d{7,14}$/.test(passenger.phoneNumber)
    );

    if (invalidPhone) {
      return NextResponse.json(
        {
          error:
            "Enter a valid phone number. U.S. numbers may be entered normally, like (360) 555-1234.",
        },
        { status: 400 }
      );
    }

    const totalAmount = offer.total_amount;
    const totalCurrency = offer.total_currency;

    const orderResponse = await fetch("https://api.duffel.com/air/orders", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "Duffel-Version": "v2",
      },
      body: JSON.stringify({
        data: {
          type: "instant",
          selected_offers: [offerId],
          payments: [
            {
              type: "balance",
              amount: totalAmount,
              currency: totalCurrency,
            },
          ],
          passengers: normalizedPassengers.map((passenger) => ({
            id: passenger.id,
            title: passenger.title,
            given_name: passenger.givenName.trim(),
            family_name: passenger.familyName.trim(),
            born_on: passenger.bornOn,
            gender: passenger.gender,
            email: passenger.email.trim(),
            phone_number: passenger.phoneNumber.trim(),
          })),
          metadata: {
            source: "trippindays-test-checkout",
          },
        },
      }),
      cache: "no-store",
    });

    const orderPayload = await orderResponse.json();

    if (!orderResponse.ok) {
      console.error("Duffel order creation error:", orderPayload);

      return NextResponse.json(
        {
          error:
            orderPayload?.errors?.[0]?.message ||
            "Duffel could not create the test order.",
          details: orderPayload,
        },
        { status: orderResponse.status }
      );
    }

    const order = orderPayload?.data;
    const firstSegment = order?.slices?.[0]?.segments?.[0];

    return NextResponse.json({
      id: order?.id,
      bookingReference: order?.booking_reference || "",
      totalAmount: order?.total_amount || totalAmount,
      totalCurrency: order?.total_currency || totalCurrency,
      airline:
        firstSegment?.operating_carrier?.name ||
        firstSegment?.marketing_carrier?.name ||
        order?.owner?.name ||
        "Airline",
      liveMode: order?.live_mode === true,
    });
  } catch (error) {
    console.error("Duffel test order API error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not create the Duffel test order.",
      },
      { status: 500 }
    );
  }
}
