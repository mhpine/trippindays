import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

    end?: {
      localDate?: string;
      localTime?: string;
      dateTime?: string;
    };
  };

  images?: Array<{
    url?: string;
    width?: number;
    height?: number;
  }>;

  priceRanges?: Array<{
    min?: number;
    max?: number;
    currency?: string;
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

      country?: {
        name?: string;
        countryCode?: string;
      };

      location?: {
        latitude?: string;
        longitude?: string;
      };
    }>;

    attractions?: Array<{
      name?: string;
    }>;
  };
};

type MajorAirshow = {
  id: string;

  name: string;

  city: string;
  region: string;

  venue: string;

  latitude: number | null;
  longitude: number | null;

  distanceMiles: number | null;

  startDate: string;
  endDate: string | null;
  startTime: string | null;

  eventType:
    | "Airshow"
    | "Military Demonstration"
    | "Warbird Event"
    | "Fly-In"
    | "Balloon Festival"
    | "Aviation Festival";

  performers: string[];

  ticketUrl: string | null;

  imageUrl: string | null;

  priceFrom: number | null;
  currency: string | null;

  source: string;
};

/* =========================================================
   SEARCH TERMS

   These deliberately overlap.

   We de-duplicate after Ticketmaster responds.
========================================================= */

const AIRSHOW_KEYWORDS = [
  "air show",
  "airshow",
  "air fest",
  "aviation festival",
  "Blue Angels",
  "Thunderbirds",
  "warbirds",
  "AirVenture",
  "fly-in",
  "air and water show",
  "balloon festival",
];

/* =========================================================
   DISTANCE
========================================================= */

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function distanceMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const earthRadius = 3958.8;

  const dLat =
    toRadians(lat2 - lat1);

  const dLon =
    toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(
      toRadians(lat1)
    ) *
      Math.cos(
        toRadians(lat2)
      ) *
      Math.sin(dLon / 2) ** 2;

  return (
    2 *
    earthRadius *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    )
  );
}

/* =========================================================
   CLASSIFY EVENT
========================================================= */

function classifyEvent(
  text: string
): MajorAirshow["eventType"] {
  const value =
    text.toLowerCase();

  if (
    value.includes(
      "blue angels"
    ) ||
    value.includes(
      "thunderbirds"
    ) ||
    value.includes(
      "military demonstration"
    )
  ) {
    return "Military Demonstration";
  }

  if (
    value.includes(
      "balloon"
    )
  ) {
    return "Balloon Festival";
  }

  if (
    value.includes(
      "warbird"
    )
  ) {
    return "Warbird Event";
  }

  if (
    value.includes(
      "fly-in"
    ) ||
    value.includes(
      "fly in"
    )
  ) {
    return "Fly-In";
  }

  if (
    value.includes(
      "aviation"
    ) ||
    value.includes(
      "airventure"
    ) ||
    value.includes(
      "aerospace"
    )
  ) {
    return "Aviation Festival";
  }

  return "Airshow";
}

/* =========================================================
   MAKE SURE RESULT REALLY LOOKS AVIATION RELATED
========================================================= */

function looksLikeAirshow(
  event: TicketmasterEvent
) {
  const venue =
    event._embedded
      ?.venues?.[0];

  const attractions =
    event._embedded
      ?.attractions ??
    [];

  const text = [
    event.name,
    venue?.name,

    ...attractions.map(
      (item) =>
        item.name
    ),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const terms = [
    "air show",
    "airshow",
    "air-show",

    "air & water",
    "air and water",

    "blue angels",

    "thunderbirds",

    "air fest",
    "airfest",

    "aviation",

    "airventure",

    "warbird",

    "fly-in",
    "fly in",

    "wings over",

    "festival of flight",

    "fleet week",

    "air expo",
    "aerospace expo",

    "air spectacular",

    "air-space",

    "balloon festival",
  ];

  return terms.some(
    (term) =>
      text.includes(term)
  );
}

/* =========================================================
   PICK BEST IMAGE
========================================================= */

function getImage(
  event: TicketmasterEvent
) {
  const images =
    event.images ?? [];

  if (
    images.length === 0
  ) {
    return null;
  }

  const sorted =
    [...images].sort(
      (a, b) =>
        Number(
          b.width ?? 0
        ) -
        Number(
          a.width ?? 0
        )
    );

  return (
    sorted[0]?.url ??
    null
  );
}

/* =========================================================
   NORMALIZE TICKETMASTER EVENT
========================================================= */

function normalizeEvent(
  event: TicketmasterEvent,
  userLat: number | null,
  userLon: number | null
): MajorAirshow | null {
  if (
    !event.id ||
    !event.name
  ) {
    return null;
  }

  if (
    !looksLikeAirshow(
      event
    )
  ) {
    return null;
  }

  const venue =
    event._embedded
      ?.venues?.[0];

  const latitude =
    Number(
      venue?.location
        ?.latitude
    );

  const longitude =
    Number(
      venue?.location
        ?.longitude
    );

  const hasCoordinates =
    Number.isFinite(
      latitude
    ) &&
    Number.isFinite(
      longitude
    );

  let distance:
    | number
    | null =
    null;

  if (
    userLat != null &&
    userLon != null &&
    hasCoordinates
  ) {
    distance =
      Math.round(
        distanceMiles(
          userLat,
          userLon,
          latitude,
          longitude
        )
      );
  }

  const performers =
    (
      event._embedded
        ?.attractions ??
      []
    )
      .map(
        (item) =>
          item.name
      )
      .filter(
        (
          value
        ): value is string =>
          typeof value ===
            "string" &&
          value.trim()
            .length > 0
      )
      .slice(
        0,
        8
      );

  const price =
    event.priceRanges?.[0];

  const searchableText =
    [
      event.name,
      venue?.name,
      ...performers,
    ]
      .filter(Boolean)
      .join(" ");

  return {
    id:
      event.id,

    name:
      event.name,

    city:
      venue?.city
        ?.name ??
      "",

    region:
      venue?.state
        ?.stateCode ??
      venue?.state
        ?.name ??
      "",

    venue:
      venue?.name ??
      "",

    latitude:
      hasCoordinates
        ? latitude
        : null,

    longitude:
      hasCoordinates
        ? longitude
        : null,

    distanceMiles:
      distance,

    startDate:
      event.dates
        ?.start
        ?.localDate ??
      "",

    endDate:
      event.dates
        ?.end
        ?.localDate ??
      null,

    startTime:
      event.dates
        ?.start
        ?.localTime ??
      null,

    eventType:
      classifyEvent(
        searchableText
      ),

    performers,

    ticketUrl:
      event.url ??
      null,

    imageUrl:
      getImage(
        event
      ),

    priceFrom:
      typeof price?.min ===
      "number"
        ? price.min
        : null,

    currency:
      price?.currency ??
      null,

    source:
      "Ticketmaster Discovery",
  };
}

/* =========================================================
   SEARCH ONE KEYWORD
========================================================= */

async function searchKeyword(
  apiKey: string,
  keyword: string,
  startDateTime: string,
  endDateTime: string
) {
  const params =
    new URLSearchParams({
      apikey:
        apiKey,

      keyword,

      countryCode:
        "US",

      startDateTime,

      endDateTime,

      size:
        "100",

      sort:
        "date,asc",
    });

  try {
    const response =
      await fetch(
        `https://app.ticketmaster.com/discovery/v2/events.json?${params.toString()}`,
        {
          next: {
            revalidate:
              21600,
          },
        }
      );

    if (
      !response.ok
    ) {
      console.error(
        "Major airshow Ticketmaster search failed:",
        keyword,
        response.status
      );

      return [];
    }

    const data =
      await response.json();

    return Array.isArray(
      data?._embedded
        ?.events
    )
      ? (data._embedded
          .events as TicketmasterEvent[])
      : [];
  } catch (
    error
  ) {
    console.error(
      "Major airshow search error:",
      keyword,
      error
    );

    return [];
  }
}

/* =========================================================
   API
========================================================= */

export async function GET(
  request: NextRequest
) {
  try {
    const apiKey =
      process.env
        .TICKETMASTER_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          success:
            false,

          error:
            "TICKETMASTER_API_KEY is not configured.",
        },
        {
          status:
            500,
        }
      );
    }

    const userLatitude =
      Number(
        request.nextUrl
          .searchParams
          .get("lat")
      );

    const userLongitude =
      Number(
        request.nextUrl
          .searchParams
          .get("lon")
      );

    const userLat =
      Number.isFinite(
        userLatitude
      )
        ? userLatitude
        : null;

    const userLon =
      Number.isFinite(
        userLongitude
      )
        ? userLongitude
        : null;

    const now =
      new Date();

    const end =
      new Date(
        now.getTime() +
          400 *
            24 *
            60 *
            60 *
            1000
      );

    const startDateTime =
      now.toISOString();

    const endDateTime =
      end.toISOString();

    const batches =
      await Promise.all(
        AIRSHOW_KEYWORDS.map(
          (keyword) =>
            searchKeyword(
              apiKey,
              keyword,
              startDateTime,
              endDateTime
            )
        )
      );

    const allEvents =
      batches.flat();

    const unique =
      new Map<
        string,
        MajorAirshow
      >();

    for (
      const event of
      allEvents
    ) {
      const normalized =
        normalizeEvent(
          event,
          userLat,
          userLon
        );

      if (
        !normalized ||
        !normalized.startDate
      ) {
        continue;
      }

      const key = [
        normalized.name
          .toLowerCase()
          .replace(
            /\s+/g,
            " "
          ),

        normalized.startDate,

        normalized.city
          .toLowerCase(),
      ].join("|");

      if (
        !unique.has(
          key
        )
      ) {
        unique.set(
          key,
          normalized
        );
      }
    }

    const events =
      Array.from(
        unique.values()
      )
        .sort(
          (
            a,
            b
          ) =>
            a.startDate.localeCompare(
              b.startDate
            )
        )
        .slice(
          0,
          75
        );

    return NextResponse.json({
      success:
        true,

      checkedAt:
        new Date()
          .toISOString(),

      events,

      officialSchedules: [
        {
          name:
            "U.S. Navy Blue Angels",

          url:
            "https://www.blueangels.navy.mil/show/",
        },

        {
          name:
            "U.S. Air Force Thunderbirds",

          url:
            "https://www.airforce.com/thunderbirds/schedule",
        },
      ],
    });
  } catch (
    error
  ) {
    console.error(
      "Major Airshow Schedule error:",
      error
    );

    return NextResponse.json(
      {
        success:
          false,

        error:
          error instanceof
          Error
            ? error.message
            : "Unable to load the major airshow schedule.",
      },
      {
        status:
          500,
      }
    );
  }
}