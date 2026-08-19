import OpenAI from "openai";
import { NextResponse } from "next/server";

type AdventureOption = {
  name: string;
  region: string;
  category: string;
  emoji: string;
  matchScore: number;
  estimatedDriveTime: string;
  estimatedDistance: string;
  estimatedCost: number;
  reason: string;
};

type GeminiTrip = {
  title: string;
  selectedDestination: string;
   roundTripMiles: number;
  weatherSearchLocation: string;
  summary: string;
  whySelected: string[];
  adventures: AdventureOption[];
    musicSuggestions?: {
    title: string;
    artist: string;
    reason: string;
  }[];
  plan: string;
};

type GeoResult = {
  latitude: number;
  longitude: number;
  name: string;
  admin1?: string;
  country?: string;
};

type LiveChecks = {
  checkedAt: string;
  location: string;
  latitude: number;
  longitude: number;
  temperature: number | null;
  feelsLike: number | null;
  windSpeed: number | null;
  precipitation: number | null;
  weatherCode: number | null;
  high: number | null;
  low: number | null;
  rainChance: number | null;
};

function normalizeName(value: string) {
  return value.trim().toLowerCase();
}

function removeDuplicateAdventures(
  adventures: AdventureOption[]
) {
  const seen = new Set<string>();

  return adventures.filter((adventure) => {
    const key = `${normalizeName(
      adventure.name
    )}|${normalizeName(adventure.region)}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function weatherDescription(code: number | null) {
  if (code === null) return "Current conditions";

  if (code === 0) return "Clear skies";
  if ([1, 2].includes(code)) return "Mostly clear";
  if (code === 3) return "Overcast";

  if ([45, 48].includes(code)) {
    return "Foggy conditions";
  }

  if ([51, 53, 55].includes(code)) {
    return "Drizzle";
  }

  if ([56, 57].includes(code)) {
    return "Freezing drizzle";
  }

  if ([61, 63, 65].includes(code)) {
    return "Rain";
  }

  if ([66, 67].includes(code)) {
    return "Freezing rain";
  }

  if ([71, 73, 75, 77].includes(code)) {
    return "Snow";
  }

  if ([80, 81, 82].includes(code)) {
    return "Rain showers";
  }

  if ([85, 86].includes(code)) {
    return "Snow showers";
  }

  if ([95, 96, 99].includes(code)) {
    return "Thunderstorms";
  }

  return "Current conditions";
}

function buildLiveWeatherSection(
  liveChecks: LiveChecks | null
) {
  if (!liveChecks) {
    return `
LIVE WEATHER

Live weather could not be verified automatically for this destination.
Check current local weather immediately before departure.
`.trim();
  }

  const lines = [
    "LIVE WEATHER",
    "",
    `Location: ${liveChecks.location}`,
    `Conditions: ${weatherDescription(
      liveChecks.weatherCode
    )}`,
  ];

  if (liveChecks.temperature !== null) {
    lines.push(
      `Current temperature: ${Math.round(
        liveChecks.temperature
      )}°F`
    );
  }

  if (liveChecks.feelsLike !== null) {
    lines.push(
      `Feels like: ${Math.round(
        liveChecks.feelsLike
      )}°F`
    );
  }

  if (
    liveChecks.high !== null &&
    liveChecks.low !== null
  ) {
    lines.push(
      `Today's high / low: ${Math.round(
        liveChecks.high
      )}°F / ${Math.round(liveChecks.low)}°F`
    );
  }

  if (liveChecks.rainChance !== null) {
    lines.push(
      `Chance of precipitation: ${Math.round(
        liveChecks.rainChance
      )}%`
    );
  }

  if (liveChecks.windSpeed !== null) {
    lines.push(
      `Wind: about ${Math.round(
        liveChecks.windSpeed
      )} mph`
    );
  }

  if (liveChecks.precipitation !== null) {
    lines.push(
      `Current precipitation: ${liveChecks.precipitation} in`
    );
  }

  lines.push( 
    "",
    "Weather was checked by TrippinDays using live forecast data. Conditions can change, especially in mountain and coastal areas."
  );

  return lines.join("\n");
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
       { error: "OPENAI_API_KEY is missing from .env.local." },
        { status: 500 }
      );
    }

    const body = await request.json();
    const tripRequest = body.tripRequest;

    const recentDestinations = Array.isArray(
      body.recentDestinations
    )
      ? body.recentDestinations
          .filter(
            (item: unknown): item is string =>
              typeof item === "string"
          )
          .map((item: string) => item.trim())
          .filter(Boolean)
          .slice(0, 30)
      : [];

    if (
      !tripRequest ||
      typeof tripRequest !== "string"
    ) {
      return NextResponse.json(
        {
          error: "A trip request is required.",
        },
        { status: 400 }
      );
    }

    const isSpecificAdventure = tripRequest
      .toLowerCase()
      .includes(
        "create a complete itinerary specifically for"
      );

    const excludedDestinationText =
      recentDestinations.length > 0 &&
      !isSpecificAdventure
        ? `
Avoid recommending these recently shown destinations unless the user
specifically requested one of them:

${recentDestinations
  .map((name: string) => `- ${name}`)
  .join("\n")}
`
        : "";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

    const discoveryInstructions = `
Find 4 to 6 REAL road-trip destinations that fit the user's:

- Starting location
- Budget
- Requested distance or radius
- Interests
- Available time

Choose the strongest destination as the AI Pick.

Variety rules:

- Prefer destinations not shown recently.
- Do not return duplicate destinations.
- Do not return two attractions that are essentially the same trip.
- Include a mix of destination types whenever possible.
- Good categories include Waterfall, Park, Scenic Drive, Small Town,
  Museum, Wildlife, Coast, Mountain, Food, History, Garden,
  Roadside Attraction, UFO/Paranormal, Volcano, Lake, and Historic Site.
- Use no more than two destinations from the same category.
- At least three recommendations should be different from the recent list.
- Only reuse a recent destination when the user explicitly requests it or
  there are too few realistic alternatives within the stated limits.
- Sort adventures from highest match to lowest match.
- The first adventure must be selectedDestination.
`;

    const specificAdventureInstructions = `
The user already selected a specific destination.

Do NOT search for additional destinations.
Do NOT replace the selected destination with another place.

Build one complete itinerary only for the destination named in the request.

Return exactly one item in the adventures array.
That one item must be the selected destination.
Use a matchScore of 100.
`;

    const itineraryRequirements = `
MANDATORY ITINERARY RULES:

Every TrippinDays itinerary MUST include the user's main request PLUS
all of the practical travel sections listed below.

These sections are REQUIRED even when the traveler did not ask for them.

1. MAIN ADVENTURE / REQUESTED EXPERIENCES

- Make the user's requested interests the focus of the trip.
- If the traveler requests several different things, such as waterfalls,
  volcanoes, UFO attractions, history, wildlife, or food, incorporate as
  many as realistically possible without exceeding their time, distance,
  or budget.
- Arrange the itinerary chronologically.
- Include realistic departure and return times.
- Include driving segments and estimated mileage.
- Include parking information where relevant.
- Include entrance fees or permits when reasonably known.
- Include major activities, viewpoints, short walks, attractions,
  photography opportunities, and other requested experiences.
- Include estimated costs throughout the day.

2. RESTAURANTS

Include a clearly labeled section:
1B. DESTINATION TYPES

When appropriate for the user's interests, actively consider real:

- Amusement parks and theme parks
- Zoos
- Aquariums
- Hiking trails

These may be the MAIN destination of the trip, not just an additional stop.

If the user requests rides, roller coasters, family fun, animals,
wildlife, marine life, hiking, walking, nature, scenic views,
children's activities, entertainment, or similar experiences,
consider amusement parks, theme parks, zoos, aquariums, and hiking trails.

For hiking trails, include the real trail name and trail location when known.
Never invent a trail or attraction.

When a hiking trail is included, recommend checking current trail
conditions and use AllTrails for detailed trail maps and navigation.

RESTAURANTS

- Include at least 2 practical restaurant or food options.
- Prefer restaurants close to the route, planned stops, or main destination.
- Use real restaurant names only when reasonably confident they exist.
- Include the city or area.
- Include an approximate price level or estimated meal cost when possible.
- Never claim current hours, table availability, or reservations are verified.
- Tell the traveler to verify hours before visiting.
- If you cannot confidently identify a specific restaurant, provide a
  practical Maps-search recommendation instead of inventing one.

3. GAS / FUEL

Include a clearly labeled section:

GAS / FUEL

- Include at least 2 practical fuel options or recommended fuel areas.
- Prefer stations or towns directly along the route or near the destination.
- Use real station names only when reasonably confident they exist.
- Never invent current gasoline prices.
- Mention when travelers should consider fueling before entering remote,
  mountain, desert, park, forest, coastal, or rural areas.
- If a specific station cannot be confidently identified, name the town
  or highway area where the traveler should refuel.

4. ROAD CONDITIONS

Include a clearly labeled section:

ROAD CONDITIONS

- Do NOT invent live road closures, construction, traffic incidents,
  pass conditions, wildfire closures, or chain requirements.
- Mention the major highways or roads likely used for the trip when known.
- Identify potential road concerns such as mountain passes, seasonal roads,
  gravel roads, winter conditions, forest roads, ferry crossings, remote roads,
  or limited cellular service when relevant.
- Always include this statement:

"Live road conditions and closures must be verified before departure."

5. LIVE WEATHER

Include the following exact placeholder on its own line:

[[LIVE_WEATHER]]

Do NOT invent current weather in the itinerary.

TrippinDays will replace this placeholder with verified live weather
after the AI trip is generated.

6. NEAREST HOSPITAL

Include a clearly labeled section:

NEAREST HOSPITAL

- Identify the nearest practical hospital or emergency medical facility
  to the main destination when reasonably confident.
- Include the city or community where it is located.
- Do not invent an exact driving time if uncertain.
- Do not claim emergency department status or current availability is verified.
- Tell the traveler to use Maps or emergency services for current routing
  in an emergency.
- If a hospital cannot be confidently identified, state that the traveler
  should locate the nearest emergency facility in Maps before departure
  rather than inventing one.

7. CHECK BEFORE LEAVING

Every itinerary MUST END with a clearly labeled section:

CHECK BEFORE LEAVING

Include reminders appropriate to the trip, such as:

- Check live weather
- Check road conditions and closures
- Verify attraction or park access
- Verify current hours
- Verify entrance fees and reservations
- Check fuel level
- Download offline maps in remote areas
- Charge phone
- Bring water
- Bring appropriate clothing
- Check trail conditions when hiking
- Check wildfire or smoke conditions when relevant
- Check ferry schedules when relevant
- Check snow or mountain-pass conditions when relevant

The itinerary should feel like a complete road-trip assistant,
not merely a list of attractions.
`;
const response = await openai.responses.create({
  model: "gpt-5.6-luna",
    reasoning: { effort: "low" },

  input: `
You are TrippinDays, an AI road-trip assistant.

The user entered:

${tripRequest}

${excludedDestinationText}

${
  isSpecificAdventure
    ? specificAdventureInstructions
    : discoveryInstructions
}

${itineraryRequirements}

Return ONLY valid JSON.

Do not include markdown.
Do not include code fences.
Do not include commentary outside the JSON object.

Use exactly this structure:

{
  "title": "Exciting title for the selected adventure",
  "selectedDestination": "Full name of the selected destination",
  "weatherSearchLocation": "Nearest real city or town, state",
  "summary": "Two short sentences about the trip",
  "whySelected": [
    "Fits the requested radius or selected destination",
    "Fits the stated budget",
    "Matches the requested activities",
    "Offers a memorable road-trip experience"
  ],
  "adventures": [
    {
      "name": "Real destination name",
      "region": "City, region, or state",
      "category": "Waterfall",
      "emoji": "🏔️",
      "matchScore": 96,
      "estimatedDriveTime": "About 1 hr 45 min each way",
      "estimatedDistance": "About 85 miles each way",
      "estimatedCost": 75,
      "reason": "Short explanation of why it fits"
    }
  ],
  "musicSuggestions": [
  {
    "title": "Song title",
    "artist": "Artist name",
    "reason": "One short sentence explaining why this song fits the trip"
  },
  {
    "title": "Song title",
    "artist": "Artist name",
    "reason": "One short sentence explaining why this song fits the trip"
  },
  {
    "title": "Song title",
    "artist": "Artist name",
    "reason": "One short sentence explaining why this song fits the trip"
  }
],
"roundTripMiles": 123,
  "plan": "A detailed chronological itinerary containing the required TrippinDays sections, including [[LIVE_WEATHER]] exactly once."
}

Important:

- All destinations must be real.
- Never knowingly invent a business, hospital, road, attraction, park,
  restaurant, gas station, or landmark.
- Respect the user's starting location, requested radius, available time,
  interests, and budget whenever realistically possible.
- Clearly label mileage, drive times, prices, and costs as estimates.
- roundTripMiles must be the estimated total driving mileage from the user's starting location through the planned trip and back to the starting location. Return it as a number only.
- Do not claim to know live traffic, road closures, business hours,
  reservations, fuel prices, or availability unless live data was supplied.
- weatherSearchLocation must be a real nearby city or town suitable for
  looking up weather for the main destination.
- Keep the itinerary practical and chronological.
- The user's requested experiences remain the main focus.
- Restaurants, Gas / Fuel, Road Conditions, Live Weather,
  Nearest Hospital, and Check Before Leaving are mandatory.
- Include [[LIVE_WEATHER]] exactly once in plan.
- musicSuggestions must contain exactly 3 real, widely known songs with real artist names that fit the mood, destination, or style of the trip. Do not invent songs or artists.
        `,

        
      });
if (!response.output_text) {
  throw new Error(
    "OpenAI returned an empty response."
  );
}

const cleanedText = response.output_text
    const firstBrace =
      cleanedText.indexOf("{");

    const lastBrace =
      cleanedText.lastIndexOf("}");

    if (
      firstBrace === -1 ||
      lastBrace === -1
    ) {
      throw new Error(
        "Gemini did not return valid trip data."
      );
    }

    let jsonOnly = cleanedText.slice(
      firstBrace,
      lastBrace + 1
    );
type MusicSuggestion = {
  title: string;
  artist: string;
  reason: string;
};
    // Remove common Gemini JSON mistakes.
    jsonOnly = jsonOnly
      .replace(/,\s*}/g, "}")
      .replace(/,\s*]/g, "]");

    let trip: GeminiTrip;

    try {
      const start = jsonOnly.indexOf("{");
const end = jsonOnly.lastIndexOf("}");

if (start === -1 || end === -1) {
  throw new Error("No JSON object found in Gemini response");
}

const cleanedJson = jsonOnly.slice(start, end + 1);

trip = JSON.parse(cleanedJson) as GeminiTrip;
    } catch (parseError) {
      console.error(
        "Gemini JSON parse failed:",
        parseError
      );

      console.error(
        "Gemini returned:",
        jsonOnly
      );

      throw new Error(
        "The AI created an invalid trip response. Please try planning the trip again."
      );
    }

    if (!trip.selectedDestination) {
      throw new Error(
        "Gemini did not choose a destination."
      );
    }

    if (
      !Array.isArray(trip.adventures) ||
      trip.adventures.length === 0
    ) {
      throw new Error(
        "Gemini did not return destination choices."
      );
    }

    const deduplicated =
      removeDuplicateAdventures(
        trip.adventures
      );

    const adventures =
      isSpecificAdventure
        ? deduplicated.slice(0, 1)
        : deduplicated.slice(0, 6);

    let liveChecks: LiveChecks | null =
      null;

    const weatherLocation =
      trip.weatherSearchLocation ||
      trip.selectedDestination;

    const geoUrl =
      "https://geocoding-api.open-meteo.com/v1/search?" +
      new URLSearchParams({
        name: weatherLocation,
        count: "1",
        language: "en",
        format: "json",
      });

    const geoResponse = await fetch(
      geoUrl,
      {
        cache: "no-store",
      }
    );

    if (geoResponse.ok) {
      const geoData =
        await geoResponse.json();

      const location =
        geoData.results?.[0] as
          | GeoResult
          | undefined;

      if (location) {
        const weatherUrl =
          "https://api.open-meteo.com/v1/forecast?" +
          new URLSearchParams({
            latitude: String(
              location.latitude
            ),

            longitude: String(
              location.longitude
            ),

            current:
              "temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m",

            daily:
              "temperature_2m_max,temperature_2m_min,precipitation_probability_max",

            temperature_unit:
              "fahrenheit",

            wind_speed_unit: "mph",

            precipitation_unit: "inch",

            timezone: "auto",

            forecast_days: "1",
          });

        const weatherResponse =
          await fetch(weatherUrl, {
            cache: "no-store",
          });

        if (weatherResponse.ok) {
          const weather =
            await weatherResponse.json();

          liveChecks = {
            checkedAt:
              new Date().toISOString(),

            location: [
              location.name,
              location.admin1,
              location.country,
            ]
              .filter(Boolean)
              .join(", "),

            latitude:
              location.latitude,

            longitude:
              location.longitude,

            temperature:
              weather.current
                ?.temperature_2m ??
              null,

            feelsLike:
              weather.current
                ?.apparent_temperature ??
              null,

            windSpeed:
              weather.current
                ?.wind_speed_10m ??
              null,

            precipitation:
              weather.current
                ?.precipitation ??
              null,

            weatherCode:
              weather.current
                ?.weather_code ??
              null,

            high:
              weather.daily
                ?.temperature_2m_max?.[0] ??
              null,

            low:
              weather.daily
                ?.temperature_2m_min?.[0] ??
              null,

            rainChance:
              weather.daily
                ?.precipitation_probability_max?.[0] ??
              null,
          };
        }
      }
    }

    const liveWeatherSection =
      buildLiveWeatherSection(
        liveChecks
      );

    let finalPlan = trip.plan || "";

    /*
      Gemini places [[LIVE_WEATHER]]
      exactly where weather belongs.
      Replace that placeholder with
      verified Open-Meteo information.
    */

    if (
      finalPlan.includes(
        "[[LIVE_WEATHER]]"
      )
    ) {
      finalPlan = finalPlan.replace(
        "[[LIVE_WEATHER]]",
        liveWeatherSection
      );
    } else {
      /*
        Safety fallback in case Gemini
        accidentally omits the placeholder.
      */

      finalPlan =
        `${finalPlan}\n\n${liveWeatherSection}`.trim();
    }

    return NextResponse.json({
      title:
        trip.title ||
        "Your TrippinDays Adventure",

      destination:
        trip.selectedDestination,
roundTripMiles: trip.roundTripMiles,
      summary: trip.summary || "",

      whySelected: Array.isArray(
        trip.whySelected
      )
        ? trip.whySelected
        : [],

      adventures,
musicSuggestions: Array.isArray(trip.musicSuggestions)
  ? trip.musicSuggestions
  : [],
      plan: finalPlan,

      liveChecks,

      itineraryMode:
        isSpecificAdventure
          ? "specific"
          : "discovery",
    });
  } catch (error) {
    console.error(
      "Trip planning error:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Unknown server error.";

    return NextResponse.json(
      {
        error: message,
      },
      {
        status: 500,
      }
    );
  }
}