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
  imageSearchQuery?: string;
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
  budgetBreakdown?: {
  fuel: number;
  food: number;
  activities: number;
  parking: number;
  lodging: number;
  other: number;
  total: number;
};
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
  uvIndex: number | null;
sunset: string | null;
windGusts: number | null;
moonPhase: string | null;
alerts: string[];
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
function getMoonPhase(date: Date): string {
  const knownNewMoon = new Date("2000-01-06T18:14:00Z");
  const lunarCycle = 29.53058867;

  const daysSince =
    (date.getTime() - knownNewMoon.getTime()) / 86400000;

  const age =
    ((daysSince % lunarCycle) + lunarCycle) % lunarCycle;

  if (age < 1.84566) return "🌑 New Moon";
  if (age < 5.53699) return "🌒 Waxing Crescent";
  if (age < 9.22831) return "🌓 First Quarter";
  if (age < 12.91963) return "🌔 Waxing Gibbous";
  if (age < 16.61096) return "🌕 Full Moon";
  if (age < 20.30228) return "🌖 Waning Gibbous";
  if (age < 23.99361) return "🌗 Last Quarter";
  if (age < 27.68493) return "🌘 Waning Crescent";

  return "🌑 New Moon";
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
const contentLength = Number(request.headers.get("content-length") || 0);

if (contentLength > 20_000) {
  return NextResponse.json(
    { error: "Request too large." },
    { status: 413 }
  );
}
    const body = await request.json();
    const tripRequest = body.tripRequest;
if (
  typeof tripRequest !== "string" ||
  tripRequest.trim().length === 0 ||
  tripRequest.length > 8000
) {
  return NextResponse.json(
    { error: "Invalid trip request." },
    { status: 400 }
  );
}
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

    const normalizedTripRequest = tripRequest.toLowerCase();

    const timeAvailableDaysMatch = tripRequest.match(
      /Time Available:\s*(\d+)\s*Days?\b/i
    );

    const explicitNightMatch = tripRequest.match(
      /\b(\d+)\s*nights?\b/i
    );

    const isWeekendTrip = /Time Available:\s*Weekend\b/i.test(tripRequest);

    const requestedCalendarDays = timeAvailableDaysMatch
      ? Number(timeAvailableDaysMatch[1])
      : isWeekendTrip
        ? 3
        : explicitNightMatch
          ? Number(explicitNightMatch[1]) + 1
          : null;

    const requestedNightCount = requestedCalendarDays !== null
      ? Math.max(0, requestedCalendarDays - 1)
      : explicitNightMatch
        ? Number(explicitNightMatch[1])
        : null;

    const maxDailyDrivingMatch = tripRequest.match(
      /Maximum Daily Driving:\s*(\d+(?:\.\d+)?)\s*Hours?\b/i
    );

    const maximumDailyDrivingHours = maxDailyDrivingMatch
      ? Math.min(8, Number(maxDailyDrivingMatch[1]))
      : 8;

    const hardTripLengthRule =
      requestedCalendarDays !== null && requestedNightCount !== null
        ? `
HARD TRIP LENGTH — CODE-DETECTED AND AUTHORITATIVE:
- EXACTLY ${requestedCalendarDays} calendar day${requestedCalendarDays === 1 ? "" : "s"} total.
- EXACTLY ${requestedNightCount} overnight stay${requestedNightCount === 1 ? "" : "s"} total.
- Day ${requestedCalendarDays} is the FINAL DAY.
- Day ${requestedCalendarDays} MUST end at the ORIGINAL STARTING LOCATION by approximately 5:00 PM local time and never later than 5:00 PM.
- NEVER create Day ${requestedCalendarDays + 1}.
- NEVER create more or fewer than ${requestedNightCount} TONIGHT IN sections.
- The final day has NO TONIGHT IN section.
- The selected trip length is a hard limit. Never silently add a day or night.

ROUND-TRIP PHASE STRUCTURE:
- OUTBOUND: use the first portion of the trip to make realistic progress toward the requested destination.
- DESTINATION: use the middle portion for the destination and requested adventures when time allows.
- RETURN: start home early enough to reach the original starting location on the final day by about 5:00 PM.
- Once the return phase starts, each major driving segment must make geographic progress toward home.
- Do not overshoot the original starting location and backtrack.

EPIC FEASIBILITY MATH:
- Maximum Daily Driving is ${maximumDailyDrivingHours} hour${maximumDailyDrivingHours === 1 ? "" : "s"} of ACTUAL driving time per day for this request.
- Meals, fuel, sightseeing, attractions, hikes, and sleep do NOT count against the driving-hour ceiling.
- Estimate ONE-WAY driving time between the original starting location and requested destination.
- Required outbound driving days = CEILING(one-way driving hours / ${maximumDailyDrivingHours}).
- Required return driving days = the same calculation for the logical return route.
- Minimum pure travel days = outbound driving days + return driving days.
- Any remaining calendar days may be used for destination time and activities.
- Do NOT call a trip impractical merely because the destination cannot be reached in one day.
- Example: about 12 hours one way with a 6-hour daily limit requires 2 outbound days + 2 return days. A 5-day trip is practical and leaves 1 day for the destination.
- Only call the trip impractical when the outbound AND return driving truly cannot fit inside ${requestedCalendarDays} calendar days while respecting the ${maximumDailyDrivingHours}-hour daily driving ceiling and the final-day return-home deadline.
- If impractical, do not extend the trip. State the constraint clearly.
`
        : "";

    const isEpicRoadTrip =
      normalizedTripRequest.includes("epic road trip") ||
      normalizedTripRequest.includes("premium long-distance mode");

    const isSpecificAdventure =
      normalizedTripRequest.includes(
        "create a complete itinerary specifically for"
      );

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

Choose one of the strongest matching destinations as the AI Pick.
Do not always choose the highest-scoring or most famous destination.
When several destinations are good matches, deliberately vary the AI Pick.
A recently recommended destination should not be the AI Pick when another strong realistic alternative exists.

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
  - Actively explore lesser-known and alternative destinations that fit the request.
- Do not automatically favor the most famous or popular destination.
- When several destinations are similarly good matches, vary the selection between trips.
- Prefer a strong alternative over repeatedly choosing the same well-known destination.
- Consider the full geographic area allowed by the user's time and distance, not just the nearest famous attraction.
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

    const epicRoadTripInstructions = `
THIS IS AN EPIC MULTI-DAY ROAD TRIP.

The traveler already supplied a starting location and final destination.

Do NOT search for multiple competing destinations.
Do NOT replace the requested final destination.
Build ONE complete ROUND-TRIP multi-day road trip from the supplied starting location to the supplied destination AND BACK to the original starting location.

The itinerary must not end at the destination. After the destination stay, continue with fully planned return-trip days until the traveler is back at the original starting location.

HARD DRIVING LIMIT:
- Never exceed 8 hours of actual driving in one day.
- If the traveler selected a lower Maximum Daily Driving limit, that lower limit is the hard daily ceiling.
- Driving time means time behind the wheel only.
- Meals, fuel stops, sightseeing, attractions, hikes, and rest stops are additional time.
- Choose a logical overnight stop before the daily driving limit is exceeded.
- Apply the same driving limit to BOTH outbound and return-trip days.
- The selected number of calendar days covers the ENTIRE round trip: outbound travel, destination time, and return travel.
- Do NOT assume a trip is impractical because the destination requires more than one driving day each way.
- Split long drives across multiple days while staying within the selected daily driving ceiling.
- Use the code-detected feasibility math below when a numeric trip length is available.
- Never add extra days beyond the selected timeframe.

MANDATORY OVERNIGHT LODGING:
For EVERY night the traveler is away from the original starting location, including:
- outbound overnight stops,
- the stay at the final destination,
- and return-trip overnight stops,
include:

TONIGHT IN [CITY / AREA]

HOTEL / MOTEL
- Recommend 1 to 3 REAL hotels or motels when reasonably confident they exist.

CAMPGROUND / RV
- Recommend 1 to 3 REAL campgrounds or RV options when reasonably confident they exist.

CABIN / ALTERNATIVE
- Include a REAL cabin, lodge, hostel, or other practical option when appropriate.

For each lodging option:
- Include the city or area.
- Give a short reason it fits the route.
- Consider budget, pet-friendly needs, parking, and route convenience when relevant.
- Never invent a property or campground.
- Never claim current price, vacancy, room availability, campsite availability, amenities, or reservation status is verified unless live booking data was supplied.
- Clearly label lodging costs as estimates.
- Do not fabricate booking or reservation URLs.

End every overnight section with:
Current lodging availability and reservation details must be verified before booking.

MANDATORY RETURN-TRIP STRUCTURE:
- Clearly mark when the RETURN TRIP begins.
- Continue day-by-day planning from the destination back to the original starting location.
- Each return day must have a real calendar date when a Start Date was supplied.
- Include realistic return-route mileage and driving time.
- Include worthwhile food, fuel/rest, scenic, historic, iconic, or unusual stops when appropriate.
- Every return day ending away from home must contain a TONIGHT IN [CITY / AREA] lodging section.
- The original Starting Location is the HARD FINAL ENDPOINT of the return route.
- Before adding any return-trip overnight stop, estimate whether the original Starting Location can be reached within the traveler's selected Maximum Daily Driving limit. If it can, continue directly home and DO NOT add another overnight stop.
- Never choose an overnight city, attraction, restaurant, fuel stop, or scenic stop that requires driving past the original Starting Location and then backtracking to reach home.
- On the return trip, each major route segment must make reasonable geographic progress toward the original Starting Location. Do not knowingly send the traveler farther away from home merely to create another itinerary day or lodging stop.
- Return-trip overnight cities must be on or reasonably near a logical route toward the original Starting Location.
- Avoid unnecessary backtracking, loops, and route reversals unless the traveler explicitly requested a specific attraction that requires the detour.
- Do not add lodging at or beyond the original Starting Location. Once the traveler reaches the original Starting Location, the road trip is complete.
- The final itinerary day must end at the EXACT original Starting Location supplied by the traveler, not a nearby major city, metro area, or substitute location.
- The final day must NOT contain a TONIGHT IN lodging section after arriving home.
- Do NOT substitute a short "return home" summary for the detailed return-trip itinerary.
- Total mileage and total cost must represent the FULL ROUND TRIP and must not include unnecessary overshoot/backtracking mileage.

Return exactly one adventure item representing the requested road trip.
Use a matchScore of 100.
`;

    const itineraryRequirements = `
MANDATORY ITINERARY RULES:
ROUND-TRIP TIMEFRAME — HARD RULE:
- EVERY TrippinDays trip is a ROUND TRIP unless the traveler explicitly requests a one-way trip.
- The original Starting Location is always the final destination of the trip.
- The entire itinerary MUST fit inside the traveler's selected Time Available.
- The traveler MUST arrive back at the ORIGINAL STARTING LOCATION no later than 5:00 PM local time on the FINAL DAY of the selected timeframe.
- The final itinerary day is ALWAYS the return-home day.
- Explicitly show the estimated arrival-home time on the final day.
- The estimated arrival-home time must be 5:00 PM local time or earlier.
- NEVER extend the trip beyond the selected timeframe.
- NEVER add an extra travel day or overnight stay merely because the planned destination is too far away.
- NEVER finish the itinerary at the destination, hotel, attraction, overnight city, or another nearby city.
- NEVER substitute a nearby major city for the traveler's original Starting Location.
- If necessary, shorten activities, remove detours, leave earlier, choose closer overnight stops, or choose a closer destination so the traveler can return home by 5:00 PM on the final day.
- If the specifically requested destination cannot realistically be completed as a round trip within the selected timeframe and driving limits, clearly say that it is not practical within those constraints instead of silently adding days or nights.
- For N requested nights, use exactly N overnight stays. The following day is the final return-home day and must end at the original Starting Location by 5:00 PM.
Every TrippinDays itinerary MUST include the user's main request PLUS
all of the practical travel sections listed below.

These sections are REQUIRED even when the traveler did not ask for them.

WEEKEND MODE — HARD CALENDAR RULE:
- If the user's Time Available is "Weekend" or the request otherwise identifies this as a weekend trip, treat it as exactly THREE CALENDAR DAYS: FRIDAY, SATURDAY, and SUNDAY.
- Weekend Mode always begins on Friday and always ends at the ORIGINAL STARTING LOCATION on Sunday.
- If a Friday Trip Date / Start Date is supplied, Day 1 is that Friday, Day 2 is the following Saturday, and Day 3 is the following Sunday.
- A standard Weekend Mode trip has EXACTLY TWO overnight stays: Friday night and Saturday night.
- NEVER create a Sunday-night lodging stay in Weekend Mode.
- Sunday is always the return-home day.
- Schedule Sunday's activities and driving so the traveler reaches the ORIGINAL STARTING LOCATION no later than 5:00 PM local time at the starting location.
- The Sunday itinerary must explicitly show an estimated arrival-home time of 5:00 PM local time or earlier.
- Do not schedule an attraction, meal, scenic stop, detour, or other activity that would cause arrival home after 5:00 PM Sunday.
- If necessary, shorten Sunday's activities, leave earlier, or choose a closer weekend destination so the traveler can be home by 5:00 PM.
- Do not pass the original starting location, substitute a nearby city for it, or add lodging after reaching home.
- Build distinct DAY 1 — FRIDAY, DAY 2 — SATURDAY, and DAY 3 — SUNDAY sections.
- Day 1 must end with the Friday-night lodging section.
- Day 2 must end with the Saturday-night lodging section.
- Day 3 must end at the original starting location by 5:00 PM local time and must NOT contain a lodging section.
- Weekend Mode must NEVER be collapsed into a one-day loop and must NEVER be extended into Monday.
- If a requested destination cannot realistically support this Friday-through-Sunday structure within the user's budget, driving limits, and 5:00 PM Sunday return requirement, say it is not practical for Weekend Mode and choose/offer a closer realistic weekend-compatible plan rather than adding a third night.

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
2. RESTAURANTS

Include a clearly labeled section:


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

7. OVERNIGHT LODGING

If the itinerary spans more than one calendar day OR requires the traveler to sleep away from the original starting location, lodging is MANDATORY for every night away from home.

MULTI-DAY NIGHT COUNT RULE:
USER-REQUESTED NIGHT COUNT — HARD LIMIT:
- If the traveler explicitly requests a number of nights, that number is authoritative.
- "1 night" means exactly 1 overnight stay and normally 2 calendar days.
- "2 nights" means exactly 2 overnight stays and normally 3 calendar days.
- "3 nights" means exactly 3 overnight stays and normally 4 calendar days.
- "4 nights" means exactly 4 overnight stays and normally 5 calendar days.
- In general, N requested nights means exactly N TONIGHT IN [CITY / AREA] lodging sections.
- NEVER add extra overnight stays beyond the number of nights explicitly requested by the traveler.
- Do not reinterpret "4 nights" as 4 travel days.
- The final calendar day is the return-home day and does not receive another lodging stay.
- If the requested route cannot be completed safely within the requested number of nights while respecting the daily driving limit, clearly state that the trip is not practical under those constraints.
- In that case, recommend either increasing the number of nights, increasing the allowed daily driving time up to the 8-hour maximum, or choosing a closer destination.
- NEVER silently extend a 4-night trip into 5, 6, or more nights.
- A trip spanning N calendar days normally requires N - 1 overnight stays unless the traveler explicitly returns to the original starting location before the final day.
- WEEKEND MODE IS STRICT: Friday through Sunday = exactly 3 calendar days and exactly 2 overnight stays: Friday night and Saturday night only.
- NEVER add a third overnight stay to Weekend Mode.
- NEVER add Sunday-night lodging to Weekend Mode.
- Sunday in Weekend Mode must end at the original starting location by 5:00 PM local time.
- Saturday through Sunday = 2 calendar days = 1 overnight stay.
- Monday through Friday = 5 calendar days = 4 overnight stays.
- Every itinerary day that ends away from the original starting location must contain exactly one TONIGHT IN [CITY / AREA] lodging section.
- Do not skip an overnight date.
- If a Start Date is supplied, keep the overnight stays aligned with the actual calendar dates in chronological order.
- The final day must not contain a lodging section when the traveler returns to the original starting location that day.

For each overnight stay, include a clearly labeled section in this exact format:

TONIGHT IN [CITY / AREA]

HOTEL / MOTEL
- Recommend 1 to 3 REAL hotels or motels only when reasonably confident they exist.

CAMPGROUND / RV
- Recommend 1 to 3 REAL campgrounds or RV options only when reasonably confident they exist.

CABIN / ALTERNATIVE
- Include a REAL cabin, lodge, hostel, or other practical option when appropriate.

For each lodging option:
- Include the city or area.
- Give a short reason it fits the itinerary.
- Consider budget, pet-friendly needs, parking, and route convenience when relevant.
- Never invent a property or campground.
- Never claim current price, vacancy, room availability, campsite availability, amenities, or reservation status is verified unless live booking data was supplied.
- Clearly label lodging costs as estimates.
- Do not fabricate booking or reservation URLs.

End every overnight section with:
Current lodging availability and reservation details must be verified before booking.

Do NOT add an overnight lodging section for the final day if the traveler returns to the original starting location that day.

8. CHECK BEFORE LEAVING

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

const basePrompt = `
You are TrippinDays, an AI road-trip assistant.

The user entered:

${tripRequest}



${
  isEpicRoadTrip
    ? epicRoadTripInstructions
    
    : isSpecificAdventure
      ? specificAdventureInstructions
      : discoveryInstructions
}
${itineraryRequirements}
${hardTripLengthRule}
Budget breakdown requirements:
- Estimate realistic costs for the generated trip.
- fuel = estimated round-trip fuel cost.
- food = estimated food and drink cost for all travelers.
- activities = admission fees, tickets, tours, or activity costs.
- parking = estimated parking costs.
- lodging = estimated lodging cost, or 0 if no overnight stay is needed.
- other = other expected trip costs not included above.
- total = fuel + food + activities + parking + lodging + other.
- Return all budgetBreakdown values as numbers only, with no dollar signs.
- Keep the total within the traveler's stated budget whenever realistically possible.
Return ONLY valid JSON.

Do not include markdown.
Do not include code fences.
Do not include commentary outside the JSON object.

Use exactly this structure:

{
  "title": "Exciting title for the selected adventure",
  "selectedDestination": "Full name of the selected destination",
  "imageSearchQuery": "Real destination name, city or region, state, scenic travel photography",
  "weatherSearchLocation": "Nearest real city or town, state",
  "summary": "Two short sentences about the trip",
  "whySelected": [
    "Fits the requested radius or selected destination",
    "Fits the stated budget",
    "Matches the requested activities",
    "Offers a memorable road-trip experience"
  ],
"budgetBreakdown": {
  "fuel": 0,
  "food": 0,
  "activities": 0,
  "parking": 0,
  "lodging": 0,
  "other": 0,
  "total": 0
},
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
- Treat the user's starting location as authoritative input.
- If the starting location is a ZIP/postal code, do not guess or replace it with a different city.
- Do not invent a city name for a ZIP/postal code unless that mapping is known with confidence.
- If uncertain, keep the starting location exactly as entered by the user.
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
        `;

const response = await openai.responses.create({
  model: "gpt-5.6-luna",
  reasoning: { effort: "none" },
  text: { verbosity: "low" },
  input: basePrompt,
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

      if (
        requestedCalendarDays !== null &&
        requestedNightCount !== null &&
        isEpicRoadTrip
      ) {
        const dayMatches = Array.from(
          (trip.plan || "").matchAll(/\bDAY\s+(\d+)\b/gi)
        ).map((match) => Number(match[1]));

        const uniqueDayNumbers = new Set(dayMatches);
        const overnightCount = (
          (trip.plan || "").match(/TONIGHT IN\s+[^\n]+/gi) || []
        ).length;

        const lengthIsWrong =
          uniqueDayNumbers.size !== requestedCalendarDays ||
          overnightCount !== requestedNightCount ||
          uniqueDayNumbers.has(requestedCalendarDays + 1);

        if (lengthIsWrong) {
          const correctionPrompt = `${basePrompt}

CRITICAL CORRECTION — YOUR PREVIOUS OUTPUT FAILED THE HARD TRIP LENGTH CHECK:
- Required calendar days: EXACTLY ${requestedCalendarDays}.
- Required overnight stays: EXACTLY ${requestedNightCount}.
- Required final day: Day ${requestedCalendarDays}.
- Required final endpoint: ORIGINAL STARTING LOCATION by about 5:00 PM local time.
- NEVER include Day ${requestedCalendarDays + 1}.
- Include EXACTLY ${requestedNightCount} TONIGHT IN sections, one for each night away from home.
- Do not remove lodging. Do not add extra lodging.
- Rebuild the COMPLETE JSON response from scratch so the itinerary satisfies these requirements.
- Keep the requested destination unless the round trip is mathematically impossible under the daily driving ceiling.
- Remember: a roughly 12-hour one-way trip with a 6-hour daily driving ceiling takes 2 driving days each way, so a 5-day round trip is practical with 1 destination day.

Return ONLY valid JSON in the exact structure already specified.`;

          const correctionResponse = await openai.responses.create({
            model: "gpt-5.6-luna",
            reasoning: { effort: "none" },
            text: { verbosity: "low" },
            input: correctionPrompt,
          });

          if (correctionResponse.output_text) {
            const correctedFirstBrace = correctionResponse.output_text.indexOf("{");
            const correctedLastBrace = correctionResponse.output_text.lastIndexOf("}");

            if (correctedFirstBrace !== -1 && correctedLastBrace !== -1) {
              const correctedJson = correctionResponse.output_text
                .slice(correctedFirstBrace, correctedLastBrace + 1)
                .replace(/,\s*}/g, "}")
                .replace(/,\s*]/g, "]");

              trip = JSON.parse(correctedJson) as GeminiTrip;
            }
          }
        }
      }
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
      isSpecificAdventure || isEpicRoadTrip
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
  "temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_gusts_10m",

daily:
  "temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max,sunset",

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
console.log("OPEN METEO STATUS:", weatherResponse.status);
        if (weatherResponse.ok) {
          const weather =
            await weatherResponse.json();
console.log("OPEN METEO WEATHER:", JSON.stringify(weather, null, 2));
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

             uvIndex: weather.daily?.uv_index_max?.[0] ?? null,
sunset: weather.daily?.sunset?.[0] ?? null,
windGusts: weather.current?.wind_gusts_10m ?? null,
moonPhase: getMoonPhase(new Date()),

alerts: [],
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
        imageSearchQuery: trip.imageSearchQuery || "",
roundTripMiles: trip.roundTripMiles,
budgetBreakdown: trip.budgetBreakdown,
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
        isEpicRoadTrip
          ? "epic-road-trip"
          : isSpecificAdventure
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