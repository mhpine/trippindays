import { NextResponse } from "next/server";

type TicketmasterEvent = {
  id?: string;
  name?: string;
  url?: string;
  dates?: {
    start?: {
      localDate?: string;
      localTime?: string;
      dateTime?: string;
    };
  };
  classifications?: Array<{
    segment?: {
      name?: string;
    };
    genre?: {
      name?: string;
    };
  }>;
  _embedded?: {
    venues?: Array<{
      name?: string;
      city?: {
        name?: string;
      };
      state?: {
        name?: string;
        stateCode?: string;
      };
      location?: {
        latitude?: string;
        longitude?: string;
      };
    }>;
  };
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const lat = searchParams.get("lat");
    const lon = searchParams.get("lon");
    const radius = searchParams.get("radius") || "75";

    if (!lat || !lon) {
      return NextResponse.json(
        { error: "Latitude and longitude are required." },
        { status: 400 }
      );
    }

    const latitude = Number(lat);
    const longitude = Number(lon);
    const searchRadius = Number(radius);

    if (
      Number.isNaN(latitude) ||
      Number.isNaN(longitude) ||
      Number.isNaN(searchRadius)
    ) {
      return NextResponse.json(
        { error: "Invalid GPS coordinates or radius." },
        { status: 400 }
      );
    }

    const apiKey = process.env.TICKETMASTER_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Ticketmaster API key is not configured." },
        { status: 500 }
      );
    }

    const ticketmasterUrl = new URL(
      "https://app.ticketmaster.com/discovery/v2/events.json"
    );

    ticketmasterUrl.searchParams.set("apikey", apiKey);
    ticketmasterUrl.searchParams.set(
      "latlong",
      `${latitude},${longitude}`
    );
    ticketmasterUrl.searchParams.set(
      "radius",
      String(searchRadius)
    );
    ticketmasterUrl.searchParams.set("unit", "miles");
    ticketmasterUrl.searchParams.set("size", "50");
    ticketmasterUrl.searchParams.set("sort", "date,asc");

    const response = await fetch(ticketmasterUrl.toString(), {
      cache: "no-store",
    });

    if (!response.ok) {
      console.error(
        "Ticketmaster error:",
        response.status,
        await response.text()
      );

      return NextResponse.json(
        { error: "Ticketmaster event search failed." },
        { status: 502 }
      );
    }

    const data = await response.json();

    const rawEvents: TicketmasterEvent[] =
      data?._embedded?.events ?? [];

    const events = rawEvents
      .map((event) => {
        const venue = event._embedded?.venues?.[0];

        const segment =
          event.classifications?.[0]?.segment?.name ?? "";

        const genre =
          event.classifications?.[0]?.genre?.name ?? "";

        const type =
          segment.toLowerCase() === "sports"
            ? "sports"
            : segment.toLowerCase() === "music"
            ? "concert"
            : "other";

        return {
          id: event.id ?? "",
          name: event.name ?? "Event",
          type,
          category: segment,
          genre,

          date:
            event.dates?.start?.localDate ?? "",

          time:
            event.dates?.start?.localTime ?? "",

          dateTime:
            event.dates?.start?.dateTime ?? "",

          ticketUrl:
            event.url ?? "",

          venue: {
            name:
              venue?.name ?? "Venue TBD",

            city:
              venue?.city?.name ?? "",

            state:
              venue?.state?.stateCode ??
              venue?.state?.name ??
              "",

            latitude:
              venue?.location?.latitude
                ? Number(venue.location.latitude)
                : null,

            longitude:
              venue?.location?.longitude
                ? Number(venue.location.longitude)
                : null,
          },
        };
      })
      .filter(
        (event) =>
          event.type === "sports" ||
          event.type === "concert"
      );

    return NextResponse.json({
      latitude,
      longitude,
      radius: searchRadius,
      count: events.length,
      events,
    });
  } catch (error) {
    console.error("Nearby events error:", error);

    return NextResponse.json(
      { error: "Could not load nearby events." },
      { status: 500 }
    );
  }
}