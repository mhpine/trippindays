"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type FeaturedTrip = {
  title: string;
  destination: string;
  region: string;
  description: string;
  image: string;
  estimatedCost: number;
  estimatedDriveTime: string;
  estimatedDistance: string;
  tripLength: string;
  difficulty: string;
  petFriendly: boolean;
  highlights: string[];
  packingList: string[];
  safetyNotes: string[];
};

type RegionKey =
  | "pacific-northwest"
  | "west"
  | "southwest"
  | "mountain"
  | "midwest"
  | "south"
  | "southeast"
  | "northeast";

type RegionalFeaturedTrip = FeaturedTrip & {
  regionKey: RegionKey;
  emoji: string;
};

const FEATURED_TRIPS: RegionalFeaturedTrip[] = [
  {
    title: "Mount Rainier Scenic Day Adventure",
    destination: "Mount Rainier National Park",
    region: "Washington",
    regionKey: "pacific-northwest",
    emoji: "🏔️",
    description: "A mountain escape with waterfalls, alpine viewpoints, scenic walks, picnic stops, and unforgettable views.",
    image: "/images/Rainier.png",
    estimatedCost: 95,
    estimatedDriveTime: "About 2 hours each way",
    estimatedDistance: "About 95 miles each way",
    tripLength: "Full Day",
    difficulty: "Easy to Moderate",
    petFriendly: false,
    highlights: ["Paradise viewpoints", "Narada Falls", "Reflection Lakes", "Short scenic walks", "Mountain picnic stop", "Sunset photo opportunities"],
    packingList: ["Water", "Layered clothing", "Rain jacket", "Comfortable walking shoes", "Phone charger", "Snacks or picnic lunch", "Camera"],
    safetyNotes: ["Check current park road conditions before leaving.", "Weather can change quickly at higher elevations.", "Carry water and stay on marked trails.", "Verify entrance fees, closures, and reservation requirements."],
  },
  {
    title: "Olympic Peninsula Wild Coast Escape",
    destination: "Olympic National Park",
    region: "Washington",
    regionKey: "pacific-northwest",
    emoji: "🌲",
    description: "Rainforest trails, dramatic Pacific beaches, waterfalls, and moody coastal scenery packed into one memorable getaway.",
    image: "/images/olympic.png",
    estimatedCost: 145,
    estimatedDriveTime: "About 2–3 hours each way",
    estimatedDistance: "About 130 miles each way",
    tripLength: "Weekend",
    difficulty: "Easy to Moderate",
    petFriendly: false,
    highlights: ["Hoh Rain Forest", "Ruby Beach", "Lake Crescent", "Madison Falls", "Pacific viewpoints", "Small-town food stops"],
    packingList: ["Rain shell", "Water", "Layers", "Walking shoes", "Portable charger", "Snacks", "Binoculars"],
    safetyNotes: ["Check coastal weather and tide conditions.", "Allow extra time for winding roads.", "Stay back from driftwood during rough surf.", "Verify seasonal road closures."],
  },
  {
    title: "Columbia Gorge Waterfall Run",
    destination: "Columbia River Gorge",
    region: "Oregon",
    regionKey: "pacific-northwest",
    emoji: "💦",
    description: "A waterfall-heavy drive through the Columbia Gorge with viewpoints, short walks, historic highway stops, and great food.",
    image: "/images/olympic.png",
    estimatedCost: 90,
    estimatedDriveTime: "About 2 hours each way",
    estimatedDistance: "About 110 miles each way",
    tripLength: "Full Day",
    difficulty: "Easy",
    petFriendly: true,
    highlights: ["Multnomah Falls", "Vista House", "Historic Columbia River Highway", "Hood River", "Waterfall viewpoints", "Local food stops"],
    packingList: ["Water", "Rain jacket", "Walking shoes", "Camera", "Snacks", "Dog supplies if needed"],
    safetyNotes: ["Expect wet and slippery paths near waterfalls.", "Check parking and timed-entry rules where applicable.", "Watch for cyclists on the historic highway."],
  },
  {
    title: "Redwood Giants Road Trip",
    destination: "Redwood National and State Parks",
    region: "Northern California",
    regionKey: "west",
    emoji: "🌳",
    description: "Cruise beneath giant redwoods, stop at fern-lined trails, and mix forest scenery with the rugged Northern California coast.",
    image: "/images/Redwood National Park.png",
    estimatedCost: 160,
    estimatedDriveTime: "Varies by starting point",
    estimatedDistance: "Regional road trip",
    tripLength: "Weekend",
    difficulty: "Easy to Moderate",
    petFriendly: true,
    highlights: ["Avenue of the Giants", "Prairie Creek", "Coastal overlooks", "Massive redwood groves", "Scenic drives", "Small coastal towns"],
    packingList: ["Layers", "Rain jacket", "Water", "Walking shoes", "Camera", "Offline maps"],
    safetyNotes: ["Cell service can be limited.", "Watch for elk near roadways.", "Check trail and road conditions before departure."],
  },
  {
    title: "Yosemite Valley Greatest Hits",
    destination: "Yosemite National Park",
    region: "California",
    regionKey: "west",
    emoji: "🏞️",
    description: "Iconic granite cliffs, waterfalls, valley viewpoints, and easy scenic walks through one of America’s classic landscapes.",
    image: "/images/yosemite.png",
    estimatedCost: 175,
    estimatedDriveTime: "Varies by starting point",
    estimatedDistance: "Regional road trip",
    tripLength: "Weekend",
    difficulty: "Easy to Moderate",
    petFriendly: false,
    highlights: ["Tunnel View", "Yosemite Falls", "El Capitan", "Valley Loop", "Merced River", "Sunset viewpoints"],
    packingList: ["Water", "Layers", "Sun protection", "Walking shoes", "Snacks", "Portable charger"],
    safetyNotes: ["Reservations may be required seasonally.", "Arrive early for parking.", "Keep food secured from wildlife."],
  },
  {
    title: "Sedona Red Rock Weekend",
    destination: "Sedona",
    region: "Arizona",
    regionKey: "southwest",
    emoji: "🌄",
    description: "Red-rock viewpoints, scenic drives, short hikes, sunsets, and a lively food scene make this an easy Southwest escape.",
    image: "/images/Sedona.png",
    estimatedCost: 180,
    estimatedDriveTime: "Varies by starting point",
    estimatedDistance: "Regional road trip",
    tripLength: "Weekend",
    difficulty: "Easy to Moderate",
    petFriendly: true,
    highlights: ["Red Rock Scenic Byway", "Airport Mesa", "Bell Rock", "Oak Creek", "Tlaquepaque", "Sunset viewpoints"],
    packingList: ["Water", "Sun protection", "Hiking shoes", "Layers", "Camera", "Dog water if needed"],
    safetyNotes: ["Heat can be intense.", "Carry more water than you think you need.", "Parking fills early at popular trailheads."],
  },
  {
    title: "Utah Canyon Country Sampler",
    destination: "Zion National Park",
    region: "Utah",
    regionKey: "southwest",
    emoji: "🏜️",
    description: "Towering canyon walls, desert scenery, riverside walks, and unforgettable overlooks in southern Utah.",
    image: "/images/utah1.png",
    estimatedCost: 190,
    estimatedDriveTime: "Varies by starting point",
    estimatedDistance: "Regional road trip",
    tripLength: "Weekend",
    difficulty: "Moderate",
    petFriendly: false,
    highlights: ["Zion Canyon", "Pa’rus Trail", "Canyon Overlook", "Virgin River", "Springdale", "Desert sunsets"],
    packingList: ["Water", "Sun hat", "Hiking shoes", "Layers", "Snacks", "Portable charger"],
    safetyNotes: ["Check shuttle operations.", "Watch heat and flash-flood forecasts.", "Some trails may require permits."],
  },
  {
    title: "Rocky Mountain High Country Escape",
    destination: "Rocky Mountain National Park",
    region: "Colorado",
    regionKey: "mountain",
    emoji: "🫎",
    description: "Alpine lakes, mountain wildlife, scenic roads, and high-elevation overlooks make this a classic Rockies adventure.",
    image: "/images/Rocky Mountain National Park.png",
    estimatedCost: 150,
    estimatedDriveTime: "Varies by starting point",
    estimatedDistance: "Regional road trip",
    tripLength: "Full Day",
    difficulty: "Easy to Moderate",
    petFriendly: false,
    highlights: ["Trail Ridge Road", "Bear Lake", "Moraine Park", "Elk viewing", "Alpine overlooks", "Estes Park"],
    packingList: ["Layers", "Water", "Sun protection", "Walking shoes", "Binoculars", "Snacks"],
    safetyNotes: ["Altitude affects some travelers.", "Weather changes quickly above treeline.", "Timed entry may be required."],
  },
  {
    title: "Yellowstone Geysers and Wildlife",
    destination: "Yellowstone National Park",
    region: "Wyoming",
    regionKey: "mountain",
    emoji: "♨️",
    description: "Geysers, bison, waterfalls, colorful thermal basins, and sweeping valleys on an unforgettable national-park road trip.",
    image: "/images/yellowstone.png",
    estimatedCost: 240,
    estimatedDriveTime: "Multi-day drive for many travelers",
    estimatedDistance: "Regional road trip",
    tripLength: "3 Days",
    difficulty: "Easy to Moderate",
    petFriendly: false,
    highlights: ["Old Faithful", "Grand Prismatic Spring", "Lamar Valley", "Grand Canyon of Yellowstone", "Bison viewing", "Scenic loops"],
    packingList: ["Layers", "Water", "Binoculars", "Camera", "Walking shoes", "Bear-safe awareness"],
    safetyNotes: ["Never approach wildlife.", "Stay on boardwalks in thermal areas.", "Allow extra driving time for wildlife jams."],
  },
  {
    title: "Door County Lakeshore Escape",
    destination: "Door County",
    region: "Wisconsin",
    regionKey: "midwest",
    emoji: "⛵",
    description: "Lake Michigan shoreline, charming towns, lighthouses, local food, and easy scenic drives through Wisconsin’s peninsula.",
    image: "/images/Door County.png",
    estimatedCost: 140,
    estimatedDriveTime: "Varies by starting point",
    estimatedDistance: "Regional road trip",
    tripLength: "Weekend",
    difficulty: "Easy",
    petFriendly: true,
    highlights: ["Peninsula State Park", "Fish Creek", "Lighthouses", "Lake views", "Cherry country", "Local supper clubs"],
    packingList: ["Layers", "Walking shoes", "Water", "Camera", "Light jacket", "Dog supplies if needed"],
    safetyNotes: ["Summer weekends can be busy.", "Check ferry schedules if island hopping.", "Lake weather can change quickly."],
  },
  {
    title: "Hocking Hills Waterfall Day",
    destination: "Hocking Hills State Park",
    region: "Ohio",
    regionKey: "midwest",
    emoji: "🥾",
    description: "Rock shelters, forest trails, waterfalls, and scenic backroads make this one of the Midwest’s best quick escapes.",
    image: "/images/Hocking Hills State Park.png",
    estimatedCost: 80,
    estimatedDriveTime: "Varies by starting point",
    estimatedDistance: "Regional day trip",
    tripLength: "Full Day",
    difficulty: "Moderate",
    petFriendly: true,
    highlights: ["Old Man’s Cave", "Ash Cave", "Cedar Falls", "Forest drives", "Rock formations", "Picnic stops"],
    packingList: ["Water", "Walking shoes", "Layers", "Snacks", "Camera", "Dog leash if needed"],
    safetyNotes: ["Trails can be slick after rain.", "Stay on marked paths.", "Parking fills on peak weekends."],
  },
  {
    title: "Smoky Mountains Scenic Escape",
    destination: "Great Smoky Mountains National Park",
    region: "Tennessee / North Carolina",
    regionKey: "southeast",
    emoji: "🌫️",
    description: "Mountain overlooks, waterfalls, wildlife, historic valleys, and classic Appalachian scenery in America’s most visited national park.",
    image: "/images/Great Smoky Mountains National Park.png",
    estimatedCost: 135,
    estimatedDriveTime: "Varies by starting point",
    estimatedDistance: "Regional road trip",
    tripLength: "Weekend",
    difficulty: "Easy to Moderate",
    petFriendly: false,
    highlights: ["Cades Cove", "Newfound Gap", "Waterfall walks", "Mountain overlooks", "Wildlife viewing", "Gatlinburg food stops"],
    packingList: ["Rain jacket", "Layers", "Water", "Walking shoes", "Binoculars", "Snacks"],
    safetyNotes: ["Expect traffic during peak seasons.", "Never feed or approach wildlife.", "Fog can reduce visibility quickly."],
  },
  {
    title: "Blue Ridge Parkway Cruise",
    destination: "Blue Ridge Parkway",
    region: "North Carolina",
    regionKey: "southeast",
    emoji: "🚙",
    description: "A relaxed mountain drive packed with overlooks, waterfalls, picnic spots, small towns, and Appalachian scenery.",
    image: "/images/Blue Ridge Parkway.png",
    estimatedCost: 105,
    estimatedDriveTime: "Flexible scenic drive",
    estimatedDistance: "Choose your route length",
    tripLength: "Full Day",
    difficulty: "Easy",
    petFriendly: true,
    highlights: ["Scenic overlooks", "Waterfalls", "Mountain towns", "Picnic areas", "Short hikes", "Sunset views"],
    packingList: ["Water", "Layers", "Camera", "Snacks", "Walking shoes", "Dog supplies if needed"],
    safetyNotes: ["Check seasonal road closures.", "Fuel options are limited directly on the parkway.", "Watch for cyclists and wildlife."],
  },
  {
    title: "Texas Hill Country Backroads",
    destination: "Texas Hill Country",
    region: "Texas",
    regionKey: "south",
    emoji: "🌻",
    description: "Rolling backroads, swimming holes, barbecue, wineries, historic towns, and wide-open scenery in central Texas.",
    image: "/images/Texas Hill Country.png",
    estimatedCost: 155,
    estimatedDriveTime: "Flexible regional drive",
    estimatedDistance: "Regional road trip",
    tripLength: "Weekend",
    difficulty: "Easy",
    petFriendly: true,
    highlights: ["Fredericksburg", "Enchanted Rock area", "BBQ stops", "Scenic ranch roads", "Swimming holes", "Small-town squares"],
    packingList: ["Water", "Sun protection", "Comfortable shoes", "Cooler", "Camera", "Dog water if needed"],
    safetyNotes: ["Summer heat can be dangerous.", "Watch for deer on rural roads.", "Check swimming-hole conditions before visiting."],
  },
  {
    title: "Ozark Waterfalls and Mountain Roads",
    destination: "Ozark National Forest",
    region: "Arkansas",
    regionKey: "south",
    emoji: "🍂",
    description: "Curvy mountain roads, waterfalls, swimming holes, forest overlooks, and small-town stops through the Arkansas Ozarks.",
    image: "/images/Ozark National Forest.png",
    estimatedCost: 110,
    estimatedDriveTime: "Flexible regional drive",
    estimatedDistance: "Regional road trip",
    tripLength: "Weekend",
    difficulty: "Easy to Moderate",
    petFriendly: true,
    highlights: ["Scenic Highway 7", "Waterfall stops", "Buffalo River area", "Forest overlooks", "Mountain towns", "Picnic pullouts"],
    packingList: ["Water", "Walking shoes", "Layers", "Snacks", "Offline maps", "Dog supplies if needed"],
    safetyNotes: ["Cell service can be spotty.", "Mountain roads can be winding.", "Check water levels and weather before creek crossings."],
  },
  {
    title: "Acadia Sunrise and Coast Day",
    destination: "Acadia National Park",
    region: "Maine",
    regionKey: "northeast",
    emoji: "🌅",
    description: "Rocky Atlantic coastline, mountain viewpoints, carriage roads, lobster stops, and one of the East Coast’s best sunrises.",
    image: "/images/Acadia National Park.png",
    estimatedCost: 145,
    estimatedDriveTime: "Varies by starting point",
    estimatedDistance: "Regional road trip",
    tripLength: "Full Day",
    difficulty: "Easy to Moderate",
    petFriendly: true,
    highlights: ["Cadillac Mountain", "Park Loop Road", "Jordan Pond", "Thunder Hole", "Bar Harbor", "Ocean overlooks"],
    packingList: ["Layers", "Water", "Walking shoes", "Camera", "Rain shell", "Snacks"],
    safetyNotes: ["Cadillac Mountain reservations may be required.", "Coastal rocks can be slippery.", "Arrive early during peak season."],
  },
  {
    title: "Hudson Valley Scenic Weekend",
    destination: "Hudson Valley",
    region: "New York",
    regionKey: "northeast",
    emoji: "🍎",
    description: "River views, mountain overlooks, historic towns, farm markets, and excellent food just beyond the city corridor.",
    image: "/images/Hudson Valley.png",
    estimatedCost: 170,
    estimatedDriveTime: "Flexible regional drive",
    estimatedDistance: "Regional road trip",
    tripLength: "Weekend",
    difficulty: "Easy",
    petFriendly: true,
    highlights: ["Hudson River views", "Beacon", "Historic estates", "Farm markets", "Mountain overlooks", "Local restaurants"],
    packingList: ["Layers", "Walking shoes", "Water", "Camera", "Reusable tote", "Dog supplies if needed"],
    safetyNotes: ["Weekend traffic can be heavy.", "Check attraction reservations.", "Fall foliage season books quickly."],
  },
];

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

function regionFromCoordinates(latitude: number, longitude: number): RegionKey {
  if (longitude < -116 && latitude >= 42) return "pacific-northwest";
  if (longitude < -114) return "west";
  if (longitude < -102 && latitude < 38) return "southwest";
  if (longitude < -102) return "mountain";
  if (longitude < -86 && latitude >= 36) return "midwest";
  if (longitude < -86) return "south";
  if (latitude < 37) return "southeast";
  return "northeast";
}

function regionFromTimezone(): RegionKey {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";

  // Timezone is only a fallback when we do not have a more precise starting
  // location or granted browser geolocation. Keep each U.S. timezone mapped
  // to the broad region that best represents most travelers in that zone.
  if (zone.includes("Los_Angeles")) return "west";
  if (zone.includes("Boise")) return "pacific-northwest";
  if (zone.includes("Denver")) return "mountain";
  if (zone.includes("Phoenix")) return "southwest";
  if (zone.includes("Chicago")) return "midwest";
  if (zone.includes("New_York")) return "northeast";
  return "south";
}

function regionFromLocationText(value: string): RegionKey | null {
  const text = value.toLowerCase();

  const hasAny = (values: string[]) => values.some((item) => text.includes(item));

  if (hasAny(["washington", ", wa", " wa ", "oregon", ", or", " or ", "idaho", ", id", " id "])) {
    return "pacific-northwest";
  }

  if (hasAny(["california", ", ca", " ca ", "nevada", ", nv", " nv "])) {
    return "west";
  }

  if (hasAny(["arizona", ", az", " az ", "new mexico", ", nm", " nm ", "utah", ", ut", " ut "])) {
    return "southwest";
  }

  if (hasAny(["colorado", ", co", " co ", "wyoming", ", wy", " wy ", "montana", ", mt", " mt "])) {
    return "mountain";
  }

  if (
    hasAny([
      "wisconsin", ", wi", " wi ", "michigan", ", mi", " mi ", "minnesota", ", mn", " mn ",
      "illinois", ", il", " il ", "indiana", ", in", " in ", "ohio", ", oh", " oh ",
      "iowa", ", ia", " ia ", "missouri", ", mo", " mo ", "north dakota", ", nd", " nd ",
      "south dakota", ", sd", " sd ", "nebraska", ", ne", " ne ", "kansas", ", ks", " ks "
    ])
  ) {
    return "midwest";
  }

  if (
    hasAny([
      "texas", ", tx", " tx ", "oklahoma", ", ok", " ok ", "arkansas", ", ar", " ar ",
      "louisiana", ", la", " la ", "mississippi", ", ms", " ms "
    ])
  ) {
    return "south";
  }

  if (
    hasAny([
      "tennessee", ", tn", " tn ", "north carolina", ", nc", " nc ", "south carolina", ", sc", " sc ",
      "georgia", ", ga", " ga ", "florida", ", fl", " fl ", "alabama", ", al", " al ",
      "kentucky", ", ky", " ky ", "virginia", ", va", " va ", "west virginia", ", wv", " wv "
    ])
  ) {
    return "southeast";
  }

  if (
    hasAny([
      "maine", ", me", " me ", "new hampshire", ", nh", " nh ", "vermont", ", vt", " vt ",
      "massachusetts", ", ma", " ma ", "rhode island", ", ri", " ri ", "connecticut", ", ct", " ct ",
      "new york", ", ny", " ny ", "new jersey", ", nj", " nj ", "pennsylvania", ", pa", " pa ",
      "maryland", ", md", " md ", "delaware", ", de", " de ", "district of columbia", "washington dc"
    ])
  ) {
    return "northeast";
  }

  return null;
}

function getStoredStartingRegion(): RegionKey | null {
  try {
    const saved = localStorage.getItem("trippindays-request");
    if (!saved) return null;

    const startingLocationMatch = saved.match(/Starting Location:\s*([^\n]+)/i);
    if (!startingLocationMatch?.[1]) return null;

    return regionFromLocationText(startingLocationMatch[1].trim());
  } catch {
    return null;
  }
}

function chooseFeaturedTrip(regionKey: RegionKey) {
  const regional = FEATURED_TRIPS.filter((trip) => trip.regionKey === regionKey);

  // The main Featured Adventure should be regional whenever we know the
  // traveler's region. National discovery belongs in the related-trip area,
  // not in the primary regional recommendation.
  return shuffle(regional)[0] || FEATURED_TRIPS[0];
}

function chooseRelatedTrips(featured: RegionalFeaturedTrip) {
  const regional = shuffle(
    FEATURED_TRIPS.filter(
      (trip) => trip.regionKey === featured.regionKey && trip.title !== featured.title
    )
  );
  const discovery = shuffle(
    FEATURED_TRIPS.filter(
      (trip) => trip.regionKey !== featured.regionKey && trip.title !== featured.title
    )
  );
  return [...regional.slice(0, 2), ...discovery].slice(0, 3);
}

export default function FeaturedPage() {
  const [featuredTrip, setFeaturedTrip] = useState<RegionalFeaturedTrip>(FEATURED_TRIPS[0]);
  const [relatedTrips, setRelatedTrips] = useState<RegionalFeaturedTrip[]>(() => chooseRelatedTrips(FEATURED_TRIPS[0]));
  const [featuredRegion, setFeaturedRegion] = useState<RegionKey>("pacific-northwest");
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const applyRegion = (regionKey: RegionKey) => {
      if (cancelled) return;
      const nextFeatured = chooseFeaturedTrip(regionKey);
      setFeaturedRegion(regionKey);
      setFeaturedTrip(nextFeatured);
      setRelatedTrips(chooseRelatedTrips(nextFeatured));
    };

    const storedRegion = getStoredStartingRegion();
    const fallbackRegion = storedRegion || regionFromTimezone();

    if (!("geolocation" in navigator)) {
      applyRegion(fallbackRegion);
      return () => {
        cancelled = true;
      };
    }

    if ("permissions" in navigator) {
      navigator.permissions
        .query({ name: "geolocation" as PermissionName })
        .then((permission) => {
          if (permission.state !== "granted") {
            applyRegion(fallbackRegion);
            return;
          }

          navigator.geolocation.getCurrentPosition(
            (position) => {
              applyRegion(
                regionFromCoordinates(
                  position.coords.latitude,
                  position.coords.longitude
                )
              );
            },
            () => applyRegion(fallbackRegion),
            { enableHighAccuracy: false, timeout: 3500, maximumAge: 900000 }
          );
        })
        .catch(() => applyRegion(fallbackRegion));
    } else {
      applyRegion(fallbackRegion);
    }

    return () => {
      cancelled = true;
    };
  }, []);

  function buildFeaturedRequest() {
    return `
Starting Location: Ask the traveler for their starting location if it is not already known.

Budget: Calculate a realistic estimated trip cost from the traveler's actual starting location. Do not use a fixed featured-trip budget.

Time Available: ${featuredTrip.tripLength}

Travelers: Ask the traveler who is coming if not already known.

Trip Request:
Create a complete itinerary specifically for ${featuredTrip.destination}, ${featuredTrip.region}.

Include:
- realistic departure time
- estimated driving time and distance
- parking information
- entrance fees
- scenic stops
- easy walking options
- food recommendations
- total estimated cost based on the traveler's actual starting location, including fuel/transportation, lodging if needed, food, parking, entrance fees, and activities
- return-home time
- packing suggestions
- safety notes

Featured highlights:
${featuredTrip.highlights.map((item) => `- ${item}`).join("\n")}
    `.trim();
  }

  function exploreAdventure() {
    localStorage.setItem(
      "trippindays-request",
      buildFeaturedRequest()
    );

    window.location.href = "/trip";
  }

  async function saveFeaturedTrip() {
    try {
      setIsSaving(true);
      setMessage("");

      const supabase = createClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        window.location.href = "/login?redirect=/featured";
        return;
      }

      const { error: insertError } = await supabase
        .from("trips")
        .insert({
          user_id: user.id,
          title: featuredTrip.title,
          starting_location: null,
          destination: featuredTrip.destination,
          budget: featuredTrip.estimatedCost,
          time_available: featuredTrip.tripLength,
          travelers: null,
          trip_request: buildFeaturedRequest(),
          itinerary:
            "Featured trip saved. Open Explore Adventure to generate the complete personalized itinerary.",
          status: "saved",
        });

      if (insertError) {
        throw insertError;
      }

      setMessage("Featured adventure saved to your account.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The featured trip could not be saved."
      );
    } finally {
      setIsSaving(false);
    }
  }

  function openGoogleMaps() {
    const url =
      "https://www.google.com/maps/dir/?api=1&" +
      new URLSearchParams({
        destination: featuredTrip.destination,
        travelmode: "driving",
        dir_action: "navigate",
      }).toString();

    window.open(url, "_blank", "noopener,noreferrer");
  }

  function openAppleMaps() {
    const url =
      "https://maps.apple.com/?" +
      new URLSearchParams({
        daddr: featuredTrip.destination,
        dirflg: "d",
      }).toString();

    window.open(url, "_blank", "noopener,noreferrer");
  }

  function openWaze() {
    const url =
      "https://www.waze.com/ul?" +
      new URLSearchParams({
        q: featuredTrip.destination,
        navigate: "yes",
      }).toString();

    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function shareAdventure() {
    try {
      if (navigator.share) {
        await navigator.share({
          title: featuredTrip.title,
          text: featuredTrip.description,
          url: window.location.href,
        });
        return;
      }

      await navigator.clipboard.writeText(window.location.href);
      setMessage("Featured adventure link copied.");
    } catch {
      setMessage("Sharing was cancelled.");
    }
  }

  function openRelatedTrip(
    title: string,
    region: string
  ) {
    const request = `
Starting Location: Ask the traveler for their starting location.

Budget: Calculate a realistic estimated trip cost from the traveler's actual starting location. Do not use a fixed featured-trip budget.

Time Available: Full Day

Trip Request:
Create a complete itinerary specifically for ${title}, located in ${region}.

Include driving estimates, parking, fees, food, scenic stops, a realistic total cost based on the traveler's actual starting location, return time, packing suggestions, and safety notes.
    `.trim();

    localStorage.setItem("trippindays-request", request);
    window.location.href = "/trip";
  }

  return (
    <main className="min-h-screen bg-[#071426] text-white">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#071426]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <a href="/" className="text-3xl font-black tracking-tight">
            Trippin<span className="text-sky-400">Days</span>
          </a>

          <nav className="hidden items-center gap-8 text-sm font-bold text-white/65 md:flex">
            <a href="/" className="transition hover:text-white">
              Plan Trip
            </a>
            <a
              href="/featured"
              className="border-b-2 border-cyan-400 pb-2 text-white"
            >
              Featured
            </a>
            <a href="/passport" className="transition hover:text-white">
              Passport
            </a>
            <a href="/journal" className="transition hover:text-white">
              Journal
            </a>
          </nav>

          <a
            href="/login"
            className="rounded-full border border-white/20 px-5 py-2 font-black transition hover:bg-white/10"
          >
            Account
          </a>
        </div>
      </header>

      <section
        className="relative min-h-[620px] overflow-hidden bg-cover bg-center"
        style={{
          backgroundImage: `linear-gradient(90deg, rgba(3,12,28,.96) 0%, rgba(3,12,28,.72) 48%, rgba(3,12,28,.15) 80%), url('${featuredTrip.image}')`,
        }}
      >
        <div className="mx-auto flex min-h-[620px] max-w-7xl items-center px-6 py-16">
          <div className="max-w-3xl">
            <div className="inline-flex rounded-full border border-amber-300/30 bg-amber-400/10 px-4 py-2 text-sm font-black text-amber-200">
              ⭐ Featured Adventure
            </div>
            <div className="ml-3 inline-flex rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-sm font-bold text-cyan-200">
              Regional to you • fresh on each visit
            </div>

            <h1 className="mt-6 text-5xl font-black leading-tight sm:text-6xl lg:text-7xl">
              {featuredTrip.title}
            </h1>

            <p className="mt-5 text-2xl font-bold text-cyan-200">
              📍 {featuredTrip.destination}, {featuredTrip.region}
            </p>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/75">
              {featuredTrip.description}
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <span className="rounded-full bg-white/10 px-4 py-2 font-bold">
                💰 Cost calculated from your starting point
              </span>
              <span className="rounded-full bg-white/10 px-4 py-2 font-bold">
                🚗 {featuredTrip.estimatedDriveTime}
              </span>
              <span className="rounded-full bg-white/10 px-4 py-2 font-bold">
                🕒 {featuredTrip.tripLength}
              </span>
              <span className="rounded-full bg-white/10 px-4 py-2 font-bold">
                🥾 {featuredTrip.difficulty}
              </span>
            </div>

            <div className="mt-9 flex flex-wrap gap-4">
              <button
                type="button"
                onClick={exploreAdventure}
                className="rounded-2xl bg-gradient-to-r from-cyan-400 to-sky-500 px-7 py-4 text-lg font-black text-slate-950 transition hover:scale-[1.02]"
              >
                Explore Adventure →
              </button>

              <button
                type="button"
                onClick={saveFeaturedTrip}
                disabled={isSaving}
                className="rounded-2xl border border-white/20 bg-white/10 px-7 py-4 text-lg font-black transition hover:bg-white/15 disabled:opacity-50"
              >
                {isSaving ? "Saving..." : "💾 Save Trip"}
              </button>
            </div>

            {message && (
              <p className="mt-5 rounded-2xl bg-white/10 px-5 py-4 font-bold text-cyan-200">
                {message}
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-6 lg:grid-cols-[1.25fr_.75fr]">
          <section className="rounded-[2rem] border border-white/10 bg-[#10263f] p-7 shadow-2xl">
            <p className="text-sm font-black uppercase tracking-[0.24em] text-cyan-300">
              Why we picked it • {featuredRegion.replaceAll("-", " ")}
            </p>

            <h2 className="mt-3 text-3xl font-black">
              A fresh adventure picked for your region
            </h2>

            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              {featuredTrip.highlights.map((highlight) => (
                <div
                  key={highlight}
                  className="rounded-2xl bg-white/5 p-5 font-bold text-white/75"
                >
                  ✅ {highlight}
                </div>
              ))}
            </div>
          </section>

          <aside className="rounded-[2rem] border border-white/10 bg-[#10263f] p-7 shadow-2xl">
            <h2 className="text-2xl font-black">Trip Snapshot</h2>

            <div className="mt-6 space-y-5">
              {[
                ["Estimated Cost", "Calculated from your starting point"],
                ["Drive Time", featuredTrip.estimatedDriveTime],
                ["Distance", featuredTrip.estimatedDistance],
                ["Trip Length", featuredTrip.tripLength],
                ["Difficulty", featuredTrip.difficulty],
                [
                  "Pet Friendly",
                  featuredTrip.petFriendly ? "Yes" : "Limited",
                ],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center justify-between gap-4 border-b border-white/10 pb-4"
                >
                  <span className="text-white/45">{label}</span>
                  <span className="text-right font-black">{value}</span>
                </div>
              ))}
            </div>
          </aside>
        </div>

        <section className="mt-6 rounded-[2rem] border border-cyan-400/20 bg-[#10263f] p-7 shadow-2xl">
          <h2 className="text-3xl font-black">🧭 Navigation Center</h2>

          <p className="mt-3 text-white/60">
            Launch directions in your preferred navigation app before you
            begin driving.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <button
              type="button"
              onClick={openGoogleMaps}
              className="rounded-2xl bg-blue-600 px-5 py-4 font-black transition hover:-translate-y-1 hover:bg-blue-500"
            >
              📍 Google Maps
            </button>

            <button
              type="button"
              onClick={openAppleMaps}
              className="rounded-2xl bg-slate-600 px-5 py-4 font-black transition hover:-translate-y-1 hover:bg-slate-500"
            >
              🍎 Apple Maps
            </button>

            <button
              type="button"
              onClick={openWaze}
              className="rounded-2xl bg-cyan-400 px-5 py-4 font-black text-slate-950 transition hover:-translate-y-1 hover:bg-cyan-300"
            >
              🚙 Waze
            </button>
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-[2rem] border border-white/10 bg-[#10263f] p-7 shadow-2xl">
            <h2 className="text-2xl font-black">🎒 What to Pack</h2>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {featuredTrip.packingList.map((item) => (
                <div
                  key={item}
                  className="rounded-2xl bg-white/5 p-4 font-bold text-white/70"
                >
                  • {item}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[2rem] border border-amber-300/20 bg-amber-400/10 p-7 shadow-2xl">
            <h2 className="text-2xl font-black text-amber-100">
              ⚠️ Before You Leave
            </h2>

            <div className="mt-6 space-y-3">
              {featuredTrip.safetyNotes.map((note) => (
                <p
                  key={note}
                  className="rounded-2xl bg-black/15 p-4 leading-7 text-amber-50/80"
                >
                  {note}
                </p>
              ))}
            </div>
          </section>
        </div>

        <section className="mt-6 rounded-[2rem] border border-white/10 bg-[#10263f] p-7 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.24em] text-cyan-300">
                More ideas
              </p>
              <h2 className="mt-2 text-3xl font-black">
                You may also like
              </h2>
            </div>

            <button
              type="button"
              onClick={shareAdventure}
              className="rounded-full border border-white/15 px-5 py-3 font-black transition hover:bg-white/10"
            >
              📤 Share Featured Trip
            </button>
          </div>

          <div className="mt-7 grid gap-5 md:grid-cols-3">
            {relatedTrips.map((trip) => (
              <button
                key={trip.title}
                type="button"
                onClick={() =>
                  openRelatedTrip(
                    trip.title,
                    trip.region
                  )
                }
                className="rounded-3xl border border-white/10 bg-white/5 p-6 text-left transition hover:-translate-y-1 hover:bg-white/10"
              >
                <div className="text-5xl">{trip.emoji}</div>
                <h3 className="mt-5 text-2xl font-black">
                  {trip.title}
                </h3>
                <p className="mt-2 text-white/50">{trip.region}</p>
                <p className="mt-5 font-black text-cyan-300">
                  Explore itinerary →
                </p>
              </button>
            ))}
          </div>
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <button
            type="button"
            onClick={saveFeaturedTrip}
            className="rounded-2xl bg-emerald-500 px-5 py-4 font-black transition hover:bg-emerald-400"
          >
            💾 Save Trip
          </button>

          <a
            href="/journal"
            className="rounded-2xl bg-sky-500 px-5 py-4 text-center font-black transition hover:bg-sky-400"
          >
            📖 Create Journal
          </a>

          <a
            href="/passport"
            className="rounded-2xl border border-white/15 px-5 py-4 text-center font-black transition hover:bg-white/10"
          >
            🛂 View Passport
          </a>

          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-2xl border border-white/15 px-5 py-4 font-black transition hover:bg-white/10"
          >
            🖨 Print
          </button>
        </section>
      </section>
    </main>
  );
}
