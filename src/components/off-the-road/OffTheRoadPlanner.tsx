"use client";

import dynamic from "next/dynamic";
import OffRoadToolkit from "@/components/off-the-road/OffRoadToolkit";
import SiteHeader from "@/components/SiteHeader";
import useTrippinDaysLocation from "@/hooks/useTrippinDaysLocation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import SiteQuickAccess from "@/components/SiteQuickAccess";
import { createClient } from "@/lib/supabase/client";
const OffTheRoadMap = dynamic(
  () => import("@/components/off-the-road/OffTheRoadMap"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[430px] items-center justify-center rounded-3xl bg-[#edf0e7] font-black text-[#314024]">
        Loading interactive map...
      </div>
    ),
  }
);


const OFF_ROAD_IMAGES = {
  hero:
    "/images/otr.png",
  planner:
    "https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&w=1600&q=85",
  hiking:
    "https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&w=1200&q=85",
  biking:
    "https://images.unsplash.com/photo-1526481280695-3c687fd643ed?auto=format&fit=crop&w=1200&q=85",
  motorized:
    "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1200&q=85",
  horseback:
    "https://images.unsplash.com/photo-1553284965-83fd3e82fa5a?auto=format&fit=crop&w=1200&q=85",
  hunting:
    "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1200&q=85",
  mountain:
    "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=85",
  winter:
    "https://images.unsplash.com/photo-1483664852095-d6cc6870702d?auto=format&fit=crop&w=1200&q=85",
};

const HUNTING_IMAGES = {
  bigGame: "/images/big-game.png",
  uplandTurkey: "/images/upland-turkey.png",
  waterfowl: "/images/waterfowl.png",
  smallGame: "/images/small-game.png",
};

function imageForHuntType(huntType: string) {
  if (huntType === "Big Game") {
    return HUNTING_IMAGES.bigGame;
  }

  if (huntType === "Upland / Game Birds" || huntType === "Turkey") {
    return HUNTING_IMAGES.uplandTurkey;
  }

  if (huntType === "Waterfowl") {
    return HUNTING_IMAGES.waterfowl;
  }

  if (huntType === "Small Game") {
    return HUNTING_IMAGES.smallGame;
  }

  return OFF_ROAD_IMAGES.hunting;
}

function imageForActivity(activity: string) {
  if (
    activity === "Hiking" ||
    activity === "Backpacking" ||
    activity === "Trail Running" ||
    activity === "Dog-Friendly Trails"
  ) {
    return OFF_ROAD_IMAGES.hiking;
  }

  if (
    activity === "Mountain Biking" ||
    activity === "Gravel Biking" ||
    activity === "Fat-Tire Biking"
  ) {
    return OFF_ROAD_IMAGES.biking;
  }

  if (
    activity === "ATV / UTV" ||
    activity === "Dirt Bikes" ||
    activity === "4x4 / Off-Road" ||
    activity === "Overlanding"
  ) {
    return OFF_ROAD_IMAGES.motorized;
  }

  if (activity === "Horseback Riding") {
    return OFF_ROAD_IMAGES.horseback;
  }

  if (activity === "Hunting") {
    return OFF_ROAD_IMAGES.hunting;
  }

  if (
    activity === "Downhill Skiing" ||
    activity === "Snowboarding" ||
    activity === "Cross-Country Skiing" ||
    activity === "Snowshoeing" ||
    activity === "Snowmobiling" ||
    activity === "Sledding / Tubing"
  ) {
    return OFF_ROAD_IMAGES.winter;
  }

  return OFF_ROAD_IMAGES.mountain;
}

type Activity = {
  name: string;
  icon: string;
  group: string;
  subtitle: string;
};

type OffRoadLocation = {
  name: string;
  state?: string;
  latitude: number;
  longitude: number;
  source: "gps" | "search";
};

type OffRoadResult = {
  id: string;
  rank: number;
  name: string;
  region?: string;
  category?: string;
  latitude: number;
  longitude: number;
  distanceMiles: number;
  score: number;
  label: string;
  bestTime?: string;
  temperatureF?: number | null;
  wind?: number | null;
  gust?: number | null;
  precipitation?: number | null;
  snowfall?: number | null;
  snowDepth?: number | null;
  elevationFeet?: number | null;
  difficulty?: string;
  accessNote?: string;
};

type RegionalHuntPlan = {
  icon: string;
  title: string;
  huntType: string;
  speciesFocus: string;
  duration: string;
  range: string;
  description: string;
  badge: string;
};

type HuntingRegionProfile = {
  key: string;
  regionName: string;
  stateCode?: string;
  stateName?: string;
  agencyName?: string;
  agencyUrl?: string;
  plans: RegionalHuntPlan[];
};

type HuntSeasonStatus = {
  key: string;
  status: "checking" | "open" | "closed" | "unknown";
  species: string;
  season: string;
  unit: string;
  license: string;
  bagLimit: string;
  shootingHours: string;
  access: string;
  closures: string;
  reason: string;
  officialUrl: string;
};

const STATE_NAME_TO_CODE: Record<string, string> = {
  alabama: "AL",
  alaska: "AK",
  arizona: "AZ",
  arkansas: "AR",
  california: "CA",
  colorado: "CO",
  connecticut: "CT",
  delaware: "DE",
  florida: "FL",
  georgia: "GA",
  hawaii: "HI",
  idaho: "ID",
  illinois: "IL",
  indiana: "IN",
  iowa: "IA",
  kansas: "KS",
  kentucky: "KY",
  louisiana: "LA",
  maine: "ME",
  maryland: "MD",
  massachusetts: "MA",
  michigan: "MI",
  minnesota: "MN",
  mississippi: "MS",
  missouri: "MO",
  montana: "MT",
  nebraska: "NE",
  nevada: "NV",
  "new hampshire": "NH",
  "new jersey": "NJ",
  "new mexico": "NM",
  "new york": "NY",
  "north carolina": "NC",
  "north dakota": "ND",
  ohio: "OH",
  oklahoma: "OK",
  oregon: "OR",
  pennsylvania: "PA",
  "rhode island": "RI",
  "south carolina": "SC",
  "south dakota": "SD",
  tennessee: "TN",
  texas: "TX",
  utah: "UT",
  vermont: "VT",
  virginia: "VA",
  washington: "WA",
  "west virginia": "WV",
  wisconsin: "WI",
  wyoming: "WY",
};

const STATE_CODE_TO_NAME = Object.fromEntries(
  Object.entries(STATE_NAME_TO_CODE).map(([name, code]) => [
    code,
    name
      .split(" ")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" "),
  ])
) as Record<string, string>;

const OFFICIAL_HUNTING_AGENCIES: Record<
  string,
  { name: string; url: string }
> = {
  AL: { name: "Outdoor Alabama", url: "https://www.outdooralabama.com/hunting" },
  AK: { name: "Alaska Department of Fish and Game", url: "https://www.adfg.alaska.gov/index.cfm?adfg=hunting.main" },
  AZ: { name: "Arizona Game and Fish Department", url: "https://www.azgfd.com/hunting/" },
  AR: { name: "Arkansas Game and Fish Commission", url: "https://www.agfc.com/hunting/" },
  CA: { name: "California Department of Fish and Wildlife", url: "https://wildlife.ca.gov/Hunting" },
  CO: { name: "Colorado Parks and Wildlife", url: "https://cpw.state.co.us/hunting" },
  CT: { name: "Connecticut DEEP", url: "https://portal.ct.gov/deep/hunting" },
  DE: { name: "Delaware DNREC", url: "https://dnrec.delaware.gov/fish-wildlife/hunting/" },
  FL: { name: "Florida Fish and Wildlife Conservation Commission", url: "https://myfwc.com/hunting/" },
  GA: { name: "Georgia Wildlife Resources Division", url: "https://georgiawildlife.com/hunting" },
  HI: { name: "Hawaii Division of Forestry and Wildlife", url: "https://dlnr.hawaii.gov/recreation/hunting/" },
  ID: { name: "Idaho Fish and Game", url: "https://idfg.idaho.gov/hunt" },
  IL: { name: "Illinois Department of Natural Resources", url: "https://dnr.illinois.gov/hunting.html" },
  IN: { name: "Indiana DNR Fish & Wildlife", url: "https://www.in.gov/dnr/fish-and-wildlife/hunting-and-trapping/" },
  IA: { name: "Iowa DNR", url: "https://www.iowadnr.gov/hunting" },
  KS: { name: "Kansas Department of Wildlife & Parks", url: "https://ksoutdoors.com/Hunting" },
  KY: { name: "Kentucky Department of Fish & Wildlife Resources", url: "https://fw.ky.gov/Hunt/Pages/default.aspx" },
  LA: { name: "Louisiana Department of Wildlife and Fisheries", url: "https://www.wlf.louisiana.gov/page/hunting" },
  ME: { name: "Maine Department of Inland Fisheries & Wildlife", url: "https://www.maine.gov/ifw/hunting-trapping/hunting/index.html" },
  MD: { name: "Maryland Department of Natural Resources", url: "https://dnr.maryland.gov/wildlife/Pages/hunt_trap/home.aspx" },
  MA: { name: "Massachusetts Division of Fisheries and Wildlife", url: "https://www.mass.gov/hunting" },
  MI: { name: "Michigan Department of Natural Resources", url: "https://www.michigan.gov/dnr/things-to-do/hunting" },
  MN: { name: "Minnesota DNR", url: "https://www.dnr.state.mn.us/hunting/index.html" },
  MS: { name: "Mississippi Department of Wildlife, Fisheries, and Parks", url: "https://www.mdwfp.com/wildlife-hunting" },
  MO: { name: "Missouri Department of Conservation", url: "https://mdc.mo.gov/hunting-trapping" },
  MT: { name: "Montana Fish, Wildlife & Parks", url: "https://fwp.mt.gov/hunt" },
  NE: { name: "Nebraska Game and Parks", url: "https://outdoornebraska.gov/hunt/" },
  NV: { name: "Nevada Department of Wildlife", url: "https://www.ndow.org/get-outside/hunting/" },
  NH: { name: "New Hampshire Fish and Game", url: "https://www.wildlife.nh.gov/hunting-nh" },
  NJ: { name: "New Jersey Fish & Wildlife", url: "https://dep.nj.gov/njfw/hunting/" },
  NM: { name: "New Mexico Department of Game and Fish", url: "https://wildlife.dgf.nm.gov/hunting/" },
  NY: { name: "New York State DEC", url: "https://dec.ny.gov/things-to-do/hunting" },
  NC: { name: "North Carolina Wildlife Resources Commission", url: "https://www.ncwildlife.gov/hunting" },
  ND: { name: "North Dakota Game and Fish Department", url: "https://gf.nd.gov/hunting" },
  OH: { name: "Ohio Division of Wildlife", url: "https://ohiodnr.gov/discover-and-learn/safety-conservation/about-ODNR/wildlife" },
  OK: { name: "Oklahoma Department of Wildlife Conservation", url: "https://www.wildlifedepartment.com/hunting" },
  OR: { name: "Oregon Department of Fish and Wildlife", url: "https://myodfw.com/hunting" },
  PA: { name: "Pennsylvania Game Commission", url: "https://www.pa.gov/agencies/pgc/huntingandtrapping.html" },
  RI: { name: "Rhode Island DEM", url: "https://dem.ri.gov/natural-resources-bureau/fish-wildlife/hunting-trapping" },
  SC: { name: "South Carolina Department of Natural Resources", url: "https://www.dnr.sc.gov/hunting.html" },
  SD: { name: "South Dakota Game, Fish and Parks", url: "https://gfp.sd.gov/hunt/" },
  TN: { name: "Tennessee Wildlife Resources Agency", url: "https://www.tn.gov/twra/hunting.html" },
  TX: { name: "Texas Parks & Wildlife Department", url: "https://tpwd.texas.gov/regulations/outdoor-annual/hunting" },
  UT: { name: "Utah Division of Wildlife Resources", url: "https://wildlife.utah.gov/hunting/main-hunting-page.html" },
  VT: { name: "Vermont Fish & Wildlife Department", url: "https://www.vtfishandwildlife.com/hunt" },
  VA: { name: "Virginia Department of Wildlife Resources", url: "https://dwr.virginia.gov/hunting/" },
  WA: { name: "Washington Department of Fish and Wildlife", url: "https://wdfw.wa.gov/hunting" },
  WV: { name: "West Virginia Division of Natural Resources", url: "https://wvdnr.gov/hunting/" },
  WI: { name: "Wisconsin DNR", url: "https://dnr.wisconsin.gov/topic/hunt" },
  WY: { name: "Wyoming Game and Fish Department", url: "https://wgfd.wyo.gov/hunting" },
};

function detectStateCode(locationText: string, stateHint?: string) {
  const combined = `${stateHint || ""} ${locationText || ""}`.trim();
  const lower = combined.toLowerCase();

  for (const [name, code] of Object.entries(STATE_NAME_TO_CODE)) {
    if (lower.includes(name)) return code;
  }

  const upper = combined.toUpperCase();

  for (const code of Object.values(STATE_NAME_TO_CODE)) {
    const match = upper.match(new RegExp(`(^|[^A-Z])${code}([^A-Z]|$)`));
    if (match) return code;
  }

  return undefined;
}

function huntingPlansForRegion(regionKey: string): RegionalHuntPlan[] {
  const commonWaterfowl: RegionalHuntPlan = {
    icon: "🦆",
    title: "Regional Waterfowl Hunt",
    huntType: "Waterfowl",
    speciesFocus: "Ducks, geese and other legal regional waterfowl",
    duration: "Morning–1 day",
    range: "Regional",
    description:
      "Plan around legal water access, shooting hours, weather, required stamps and current closures.",
    badge: "WATERFOWL",
  };

  const commonSmallGame: RegionalHuntPlan = {
    icon: "🐇",
    title: "Small Game Day",
    huntType: "Small Game",
    speciesFocus: "Legal small-game species in the selected region",
    duration: "1 day",
    range: "Near home",
    description:
      "Find a practical small-game outing with legal species, public access, daylight and nearby fuel or food.",
    badge: "SMALL GAME",
  };

  const profiles: Record<string, RegionalHuntPlan[]> = {
    pacific_northwest: [
      {
        icon: "🦌",
        title: "Northwest Big Game Weekend",
        huntType: "Big Game",
        speciesFocus: "Deer, elk and other legal Northwest big game",
        duration: "2–3 days",
        range: "Regional",
        description:
          "Build a Northwest big-game trip around legal units, public access, season timing and realistic mountain travel.",
        badge: "BIG GAME",
      },
      {
        icon: "🦃",
        title: "Turkey & Upland Trip",
        huntType: "Upland / Game Birds",
        speciesFocus: "Turkey, grouse, quail and other legal regional game birds",
        duration: "1–2 days",
        range: "Regional",
        description:
          "Plan around regional turkey or upland opportunities with season timing, habitat, access and weather.",
        badge: "UPLAND / TURKEY",
      },
      commonWaterfowl,
      commonSmallGame,
    ],
    mountain_west: [
      {
        icon: "🦌",
        title: "Mountain West Big Game",
        huntType: "Big Game",
        speciesFocus: "Elk, mule deer, pronghorn and other legal regional big game",
        duration: "2–4 days",
        range: "Regional",
        description:
          "Build around legal units, elevation, public land, season timing, tags and realistic backcountry access.",
        badge: "BIG GAME",
      },
      {
        icon: "🦃",
        title: "Mountain Upland Trip",
        huntType: "Upland / Game Birds",
        speciesFocus: "Turkey, grouse and other legal upland species",
        duration: "1–2 days",
        range: "Regional",
        description:
          "Match legal upland opportunities to elevation, habitat, access and current weather.",
        badge: "UPLAND",
      },
      commonWaterfowl,
      commonSmallGame,
    ],
    southwest: [
      {
        icon: "🦌",
        title: "Southwest Big Game",
        huntType: "Big Game",
        speciesFocus: "Mule deer, elk and other legal Southwest big game",
        duration: "2–4 days",
        range: "Regional",
        description:
          "Plan around desert or mountain units, public access, tags, season timing and realistic travel.",
        badge: "BIG GAME",
      },
      {
        icon: "🦃",
        title: "Quail & Upland Trip",
        huntType: "Upland / Game Birds",
        speciesFocus: "Quail, turkey and other legal Southwest game birds",
        duration: "1–2 days",
        range: "Regional",
        description:
          "Build a regional upland trip around legal species, habitat, access, season timing and weather.",
        badge: "UPLAND",
      },
      commonWaterfowl,
      commonSmallGame,
    ],
    plains: [
      {
        icon: "🦌",
        title: "Plains Big Game Weekend",
        huntType: "Big Game",
        speciesFocus: "Whitetail, mule deer, pronghorn and other legal regional big game",
        duration: "2–3 days",
        range: "Regional",
        description:
          "Build around legal units, public access, season timing and realistic prairie travel.",
        badge: "BIG GAME",
      },
      {
        icon: "🦃",
        title: "Pheasant & Upland Trip",
        huntType: "Upland / Game Birds",
        speciesFocus: "Pheasant, turkey, grouse and other legal regional game birds",
        duration: "1–2 days",
        range: "Regional",
        description:
          "Plan a regional upland hunt around habitat, legal season dates, access and weather.",
        badge: "UPLAND",
      },
      commonWaterfowl,
      commonSmallGame,
    ],
    great_lakes: [
      {
        icon: "🦌",
        title: "Great Lakes Whitetail Weekend",
        huntType: "Big Game",
        speciesFocus: "Whitetail deer and other legal regional big game",
        duration: "2–3 days",
        range: "Regional",
        description:
          "Build a woods-and-farmland big-game trip around legal zones, season timing and public access.",
        badge: "BIG GAME",
      },
      {
        icon: "🦃",
        title: "Great Lakes Upland Trip",
        huntType: "Upland / Game Birds",
        speciesFocus: "Grouse, pheasant, turkey and other legal regional game birds",
        duration: "1–2 days",
        range: "Regional",
        description:
          "Plan around forests, fields, legal seasons, access and current weather.",
        badge: "UPLAND",
      },
      commonWaterfowl,
      commonSmallGame,
    ],
    northeast: [
      {
        icon: "🦌",
        title: "Northeast Big Game Weekend",
        huntType: "Big Game",
        speciesFocus: "Whitetail deer and other legal Northeast big game",
        duration: "2–3 days",
        range: "Regional",
        description:
          "Build around legal zones, public-land access, season timing and realistic woodland travel.",
        badge: "BIG GAME",
      },
      {
        icon: "🦃",
        title: "Turkey & Forest Bird Trip",
        huntType: "Upland / Game Birds",
        speciesFocus: "Turkey, grouse and other legal regional game birds",
        duration: "1–2 days",
        range: "Regional",
        description:
          "Match legal seasons to forest habitat, access, daylight and weather.",
        badge: "UPLAND / TURKEY",
      },
      commonWaterfowl,
      commonSmallGame,
    ],
    southeast: [
      {
        icon: "🦌",
        title: "Southern Deer Weekend",
        huntType: "Big Game",
        speciesFocus: "Whitetail deer and other legal regional big game",
        duration: "2–3 days",
        range: "Regional",
        description:
          "Build around legal zones, public or permitted access, season timing and warm-weather conditions.",
        badge: "BIG GAME",
      },
      {
        icon: "🦃",
        title: "Southern Turkey Trip",
        huntType: "Upland / Game Birds",
        speciesFocus: "Turkey and other legal Southern game birds",
        duration: "1–2 days",
        range: "Regional",
        description:
          "Plan around legal turkey or upland seasons, habitat, access, daylight and weather.",
        badge: "TURKEY / UPLAND",
      },
      commonWaterfowl,
      commonSmallGame,
    ],
    california: [
      {
        icon: "🦌",
        title: "California Big Game Trip",
        huntType: "Big Game",
        speciesFocus: "Deer and other legal California big game",
        duration: "2–3 days",
        range: "Regional",
        description:
          "Build around legal zones, tags, public access, wildfire closures and realistic travel.",
        badge: "BIG GAME",
      },
      {
        icon: "🦃",
        title: "California Turkey & Upland",
        huntType: "Upland / Game Birds",
        speciesFocus: "Turkey, quail and other legal California game birds",
        duration: "1–2 days",
        range: "Regional",
        description:
          "Plan around legal seasons, habitat, access, weather and current closures.",
        badge: "UPLAND / TURKEY",
      },
      commonWaterfowl,
      commonSmallGame,
    ],
    alaska: [
      {
        icon: "🫎",
        title: "Alaska Big Game Expedition",
        huntType: "Big Game",
        speciesFocus: "Moose, caribou and other legal Alaska big game",
        duration: "3–5 days",
        range: "Regional",
        description:
          "Build around legal hunt areas, tags, transport realities, weather, daylight and remote-access requirements.",
        badge: "BIG GAME",
      },
      {
        icon: "🦃",
        title: "Alaska Upland Trip",
        huntType: "Upland / Game Birds",
        speciesFocus: "Ptarmigan and other legal Alaska game birds",
        duration: "1–2 days",
        range: "Regional",
        description:
          "Plan around legal seasons, access, daylight, weather and backcountry safety.",
        badge: "UPLAND",
      },
      commonWaterfowl,
      commonSmallGame,
    ],
    hawaii: [
      {
        icon: "🦌",
        title: "Hawaii Game Mammal Trip",
        huntType: "Big Game",
        speciesFocus: "Legal game mammals for the selected island",
        duration: "1–2 days",
        range: "Island",
        description:
          "Keep the hunt on the selected island and verify legal areas, permits, seasons and land access.",
        badge: "GAME MAMMAL",
      },
      {
        icon: "🦃",
        title: "Hawaii Game Bird Trip",
        huntType: "Upland / Game Birds",
        speciesFocus: "Legal game birds for the selected island",
        duration: "1 day",
        range: "Island",
        description:
          "Plan around island-specific legal species, public hunting areas, permits and current conditions.",
        badge: "GAME BIRDS",
      },
      commonWaterfowl,
      commonSmallGame,
    ],
    fallback: [
      {
        icon: "🦌",
        title: "Regional Big Game",
        huntType: "Big Game",
        speciesFocus: "Legal big-game species for the selected region",
        duration: "2–3 days",
        range: "Regional",
        description:
          "Use the selected location to identify legal regional big-game opportunities before building the trip.",
        badge: "BIG GAME",
      },
      {
        icon: "🦃",
        title: "Regional Upland Hunt",
        huntType: "Upland / Game Birds",
        speciesFocus: "Legal upland and game-bird species for the selected region",
        duration: "1–2 days",
        range: "Regional",
        description:
          "Use the selected region to determine the legal species, season, access and current conditions.",
        badge: "UPLAND",
      },
      commonWaterfowl,
      commonSmallGame,
    ],
  };

  return profiles[regionKey] || profiles.fallback;
}

function getHuntingRegionProfile(
  locationText: string,
  stateHint?: string
): HuntingRegionProfile {
  const stateCode = detectStateCode(locationText, stateHint);
  const stateName = stateCode ? STATE_CODE_TO_NAME[stateCode] : undefined;

  let key = "fallback";
  let regionName = stateName || "Your Region";

  if (stateCode === "AK") {
    key = "alaska";
    regionName = "Alaska";
  } else if (stateCode === "HI") {
    key = "hawaii";
    regionName = "Hawaii";
  } else if (stateCode === "CA") {
    key = "california";
    regionName = "California";
  } else if (["WA", "OR", "ID"].includes(stateCode || "")) {
    key = "pacific_northwest";
    regionName = stateName || "Pacific Northwest";
  } else if (["MT", "WY", "CO", "UT"].includes(stateCode || "")) {
    key = "mountain_west";
    regionName = stateName || "Mountain West";
  } else if (["AZ", "NM", "NV"].includes(stateCode || "")) {
    key = "southwest";
    regionName = stateName || "Southwest";
  } else if (["ND", "SD", "NE", "KS", "OK", "TX"].includes(stateCode || "")) {
    key = "plains";
    regionName = stateName || "Plains";
  } else if (["MN", "WI", "MI", "IA", "IL", "IN", "OH", "MO"].includes(stateCode || "")) {
    key = "great_lakes";
    regionName = stateName || "Great Lakes / Midwest";
  } else if (["ME", "NH", "VT", "MA", "RI", "CT", "NY", "NJ", "PA", "MD", "DE", "WV"].includes(stateCode || "")) {
    key = "northeast";
    regionName = stateName || "Northeast";
  } else if (["VA", "NC", "SC", "GA", "FL", "AL", "MS", "LA", "AR", "TN", "KY"].includes(stateCode || "")) {
    key = "southeast";
    regionName = stateName || "Southeast";
  }

  const agency = stateCode
    ? OFFICIAL_HUNTING_AGENCIES[stateCode]
    : undefined;

  return {
    key,
    regionName,
    stateCode,
    stateName,
    agencyName: agency?.name,
    agencyUrl: agency?.url,
    plans: huntingPlansForRegion(key),
  };
}

const ACTIVITIES: Activity[] = [
  { name: "Hiking", icon: "🥾", group: "Trails", subtitle: "Trails & day hikes" },
  { name: "Backpacking", icon: "🎒", group: "Trails", subtitle: "Overnight trail adventures" },
  { name: "Trail Running", icon: "🏃", group: "Trails", subtitle: "Run the backcountry" },
  { name: "Dog-Friendly Trails", icon: "🐕", group: "Trails", subtitle: "Bring your adventure buddy" },

  { name: "Mountain Biking", icon: "🚵", group: "Biking", subtitle: "Singletrack & downhill" },
  { name: "Gravel Biking", icon: "🚲", group: "Biking", subtitle: "Forest & gravel roads" },
  { name: "Fat-Tire Biking", icon: "🚴", group: "Biking", subtitle: "Snow & soft-surface riding" },

  { name: "ATV / UTV", icon: "🛞", group: "Motorized", subtitle: "OHV areas & trail systems" },
  { name: "Dirt Bikes", icon: "🏍️", group: "Motorized", subtitle: "Motorcycle trail systems" },
  { name: "4x4 / Off-Road", icon: "🚙", group: "Motorized", subtitle: "4WD roads & routes" },
  { name: "Overlanding", icon: "🏕️", group: "Motorized", subtitle: "Backroads + camping" },

  { name: "Horseback Riding", icon: "🐎", group: "Equestrian", subtitle: "Trails, tours & horse camping" },

  { name: "Hunting", icon: "🦌", group: "Hunting", subtitle: "Big game, small game, birds & waterfowl" },

  { name: "Caving / Spelunking", icon: "🕳️", group: "Mountains", subtitle: "Caves, tours & wild routes" },
  { name: "Mountaineering", icon: "🏔️", group: "Mountains", subtitle: "Summits, snow & alpine routes" },
  { name: "Rock Climbing", icon: "🧗", group: "Mountains", subtitle: "Crags, walls & climbing areas" },
  { name: "Bouldering", icon: "🪨", group: "Mountains", subtitle: "Boulder fields, problems & climbing areas" },

  { name: "Downhill Skiing", icon: "⛷️", group: "Winter", subtitle: "Resorts & ski areas" },
  { name: "Snowboarding", icon: "🏂", group: "Winter", subtitle: "Resorts & terrain parks" },
  { name: "Cross-Country Skiing", icon: "🎿", group: "Winter", subtitle: "Nordic trails" },
  { name: "Snowshoeing", icon: "❄️", group: "Winter", subtitle: "Winter trails" },
  { name: "Snowmobiling", icon: "🛷", group: "Winter", subtitle: "Snowmobile routes" },
  { name: "Sledding / Tubing", icon: "🛷", group: "Winter", subtitle: "Hills & tubing areas" },

  { name: "Seasonal Picks", icon: "🍂", group: "Explore", subtitle: "Best activity for right now" },
  { name: "Surprise Me", icon: "🎲", group: "Explore", subtitle: "Let TrippinDays choose" },
];

const GROUPS = [
  "All",
  "Trails",
  "Biking",
  "Motorized",
  "Equestrian",
  "Hunting",
  "Mountains",
  "Winter",
  "Explore",
];

const HUNT_TYPES = [
  "Big Game",
  "Small Game",
  "Upland / Game Birds",
  "Waterfowl",
  "Turkey",
  "What Can I Hunt Today?",
];


function SectionTitle({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div>
      {eyebrow && (
        <div className="text-xs font-black uppercase tracking-[0.22em] text-orange-600">
          {eyebrow}
        </div>
      )}
      <h2 className="mt-1 text-2xl font-black tracking-tight text-stone-900 sm:text-3xl">
        {title}
      </h2>
      {children && (
        <div className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">
          {children}
        </div>
      )}
    </div>
  );
}


function PremiumOffRoadCard({
  icon,
  title,
  description,
  buttonLabel,
  disabled,
  onClick,
}: {
  icon: string;
  title: string;
  description: string;
  buttonLabel: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <article className="flex min-h-[250px] flex-col rounded-3xl border border-white/10 bg-white/10 p-5 backdrop-blur">
      <div className="text-4xl">{icon}</div>
      <div className="mt-4 text-lg font-black">
        {title}
      </div>
      <p className="mt-2 flex-1 text-sm font-semibold leading-6 text-stone-200">
        {description}
      </p>
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className="mt-5 w-full rounded-2xl bg-white px-4 py-3 text-xs font-black text-[#26331f] transition hover:bg-orange-100 disabled:cursor-wait disabled:opacity-60"
      >
        {disabled ? "CHECKING ACCESS..." : buttonLabel}
      </button>
    </article>
  );
}

export default function OffTheRoadPlanner() {
  const [group, setGroup] = useState("All");
  const [activity, setActivity] = useState("Hiking");
  const [huntType, setHuntType] = useState("Big Game");
  const [selectedHuntPlan, setSelectedHuntPlan] =
    useState<RegionalHuntPlan | null>(null);
  const [huntSpecies, setHuntSpecies] = useState("");
  const [huntMethod, setHuntMethod] = useState("");
  const [huntUnit, setHuntUnit] = useState("");
  const [verifyingHuntDetails, setVerifyingHuntDetails] =
    useState(false);
  const [startingLocation, setStartingLocation] = useState("");

  const {
    location: deviceLocation,
    findingLocation: findingDeviceLocation,
    error: deviceLocationError,
    useCurrentLocation,
  } = useTrippinDaysLocation({
    autoRefreshIfGranted: true,
  });

  const [usingDeviceLocation, setUsingDeviceLocation] = useState(true);
  const [radius, setRadius] = useState("100");
  const [skill, setSkill] = useState("Any");
  const [when, setWhen] = useState("This Weekend");
  const [location, setLocation] = useState<OffRoadLocation | null>(null);
  const [results, setResults] = useState<OffRoadResult[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState("");
  const [huntSeasonChecks, setHuntSeasonChecks] = useState<
    Record<string, HuntSeasonStatus>
  >({});
  const [checkingHuntSeasons, setCheckingHuntSeasons] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [premiumLoading, setPremiumLoading] = useState(true);

  const visibleActivities = useMemo(
    () =>
      group === "All"
        ? ACTIVITIES
        : ACTIVITIES.filter((item) => item.group === group),
    [group]
  );

  const selectedActivity = useMemo(
    () => ACTIVITIES.find((item) => item.name === activity) ?? ACTIVITIES[0],
    [activity]
  );

  const selectedResult = useMemo(
    () =>
      results.find((item) => item.id === selectedId) ??
      results[0] ??
      null,
    [results, selectedId]
  );

  useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    async function loadPremiumAccess() {
      setPremiumLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!mounted) return;

      setSignedIn(Boolean(user));

      if (!user) {
        setIsPremium(false);
        setPremiumLoading(false);
        return;
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("is_premium")
        .eq("id", user.id)
        .maybeSingle();

      if (!mounted) return;

      if (error) {
        console.error(
          "Off the Road Premium access check failed:",
          error
        );
        setIsPremium(false);
      } else {
        setIsPremium(profile?.is_premium === true);
      }

      setPremiumLoading(false);
    }

    void loadPremiumAccess();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void loadPremiumAccess();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const huntingRegion = useMemo(
    () =>
      getHuntingRegionProfile(
        startingLocation,
        deviceLocation?.state || location?.state
      ),
    [startingLocation, deviceLocation?.state, location?.state]
  );

  useEffect(() => {
    setSelectedHuntPlan(null);
    setHuntSpecies("");
    setHuntMethod("");
    setHuntUnit("");
    setVerifyingHuntDetails(false);
  }, [huntingRegion.key]);

  /* =========================================================
     LIVE REGIONAL HUNTING SEASON CHECK

     One server request checks every regional hunting card against
     current official wildlife-agency information. A hunt can only
     become plannable when the server returns status: "open".
  ========================================================= */

  useEffect(() => {
    if (
      !startingLocation.trim() ||
      huntingRegion.plans.length === 0
    ) {
      return;
    }

    let cancelled = false;

    async function checkRegionalHuntingSeasons() {
      const checking = Object.fromEntries(
        huntingRegion.plans.map((hunt) => [
          hunt.title,
          {
            key: hunt.title,
            status: "checking" as const,
            species: "",
            season: "",
            unit: "",
            license: "",
            bagLimit: "",
            shootingHours: "",
            access: "",
            closures: "",
            reason: "",
            officialUrl: huntingRegion.agencyUrl || "",
          },
        ])
      );

      setHuntSeasonChecks(checking);
      setCheckingHuntSeasons(true);

      try {
        const response = await fetch(
          "/api/off-the-road/hunting-status",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            cache: "no-store",
            body: JSON.stringify({
              location: startingLocation,
              latitude: location?.latitude ?? deviceLocation?.latitude,
              longitude: location?.longitude ?? deviceLocation?.longitude,
              stateCode: huntingRegion.stateCode || "",
              stateName: huntingRegion.stateName || "",
              regionName: huntingRegion.regionName,
              country: deviceLocation?.country || "United States",
              agencyName: huntingRegion.agencyName || "",
              agencyUrl: huntingRegion.agencyUrl || "",
              date: new Date().toISOString().slice(0, 10),
              plans: huntingRegion.plans.map((hunt) => ({
                key: hunt.title,
                huntType: hunt.huntType,
                speciesFocus: hunt.speciesFocus,
              })),
            }),
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data?.error || "Could not verify hunting seasons."
          );
        }

        if (cancelled) return;

        const next: Record<string, HuntSeasonStatus> = {};

        for (const hunt of huntingRegion.plans) {
          const found = Array.isArray(data?.results)
            ? data.results.find(
                (item: any) => item?.key === hunt.title
              )
            : null;

          next[hunt.title] = {
            key: hunt.title,
            status:
              found?.status === "open" ||
              found?.status === "closed"
                ? found.status
                : "unknown",
            species:
              typeof found?.species === "string"
                ? found.species
                : "",
            season:
              typeof found?.season === "string"
                ? found.season
                : "",
            unit:
              typeof found?.unit === "string"
                ? found.unit
                : "",
            license:
              typeof found?.license === "string"
                ? found.license
                : "",
            bagLimit:
              typeof found?.bagLimit === "string"
                ? found.bagLimit
                : "",
            shootingHours:
              typeof found?.shootingHours === "string"
                ? found.shootingHours
                : "",
            access:
              typeof found?.access === "string"
                ? found.access
                : "",
            closures:
              typeof found?.closures === "string"
                ? found.closures
                : "",
            reason:
              typeof found?.reason === "string"
                ? found.reason
                : "",
            officialUrl:
              typeof found?.officialUrl === "string" &&
              found.officialUrl
                ? found.officialUrl
                : huntingRegion.agencyUrl || "",
          };
        }

        setHuntSeasonChecks(next);
      } catch (error) {
        if (cancelled) return;

        const unknown = Object.fromEntries(
          huntingRegion.plans.map((hunt) => [
            hunt.title,
            {
              key: hunt.title,
              status: "unknown" as const,
              species: "",
              season: "",
              unit: "",
              license: "",
              bagLimit: "",
              shootingHours: "",
              access: "",
              closures: "",
              reason:
                error instanceof Error
                  ? error.message
                  : "Season verification is unavailable.",
              officialUrl: huntingRegion.agencyUrl || "",
            },
          ])
        );

        setHuntSeasonChecks(unknown);
      } finally {
        if (!cancelled) {
          setCheckingHuntSeasons(false);
        }
      }
    }

    void checkRegionalHuntingSeasons();

    return () => {
      cancelled = true;
    };
  }, [
    startingLocation,
    huntingRegion.key,
    huntingRegion.stateCode,
    location?.latitude,
    location?.longitude,
    deviceLocation?.latitude,
    deviceLocation?.longitude,
  ]);

  /* =========================================================
     SHARED TRIPPINDAYS DEVICE LOCATION
  ========================================================= */

  useEffect(() => {
    if (!deviceLocation || !usingDeviceLocation) {
      return;
    }

    const next: OffRoadLocation = {
      name:
        deviceLocation.shortLabel ||
        deviceLocation.label ||
        "Current Location",
      state: deviceLocation.state || undefined,
      latitude: deviceLocation.latitude,
      longitude: deviceLocation.longitude,
      source: "gps",
    };

    setLocation(next);
    setStartingLocation("Current Location");
  }, [deviceLocation, usingDeviceLocation]);

  async function useMyLocation() {
    setMessage("");
    setUsingDeviceLocation(true);

    const current = await useCurrentLocation();

    if (!current) {
      setMessage(
        deviceLocationError ||
          "We couldn't access your location. Allow location access and try again, or enter a city, ZIP code, or starting point."
      );
      return;
    }

    const next: OffRoadLocation = {
      name:
        current.shortLabel ||
        current.label ||
        "Current Location",
      state: current.state || undefined,
      latitude: current.latitude,
      longitude: current.longitude,
      source: "gps",
    };

    setLocation(next);
    setStartingLocation("Current Location");
    setResults([]);
    setSelectedId(null);
  }

  async function findMyBest() {
    if (!startingLocation.trim() && !location) {
      setMessage("Enter a starting location or use your current location.");
      return;
    }

    setSearching(true);
    setMessage("");
    setResults([]);
    setSelectedId(null);

    try {
      const response = await fetch("/api/off-the-road/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          activity,
          huntType: activity === "Hunting" ? huntType : undefined,
          location: startingLocation,
          latitude: location?.latitude,
          longitude: location?.longitude,
          radius: Number(radius),
          skill,
          when,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Off the Road search failed.");
      }

      const nextResults = Array.isArray(data.results) ? data.results : [];
      setResults(nextResults);

      if (
        typeof data.origin?.latitude === "number" &&
        typeof data.origin?.longitude === "number"
      ) {
        setLocation({
          name: data.origin.label || startingLocation || "Starting Location",
          latitude: data.origin.latitude,
          longitude: data.origin.longitude,
          source: location?.source === "gps" ? "gps" : "search",
        });

        if (data.origin.label && startingLocation !== "Current Location") {
          setStartingLocation(data.origin.label);
        }
      }

      if (nextResults.length) {
        setSelectedId(nextResults[0].id);
        window.setTimeout(() => {
          document
            .getElementById("off-road-results")
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 50);
      } else {
        setMessage(
          data.message ||
            `No matching ${activity.toLowerCase()} locations were found within ${radius} miles. Try a larger radius or another activity.`
        );
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong while searching."
      );
    } finally {
      setSearching(false);
    }
  }

  function requireOffRoadPremium() {
    if (premiumLoading) {
      setMessage("Checking your Premium access...");
      return false;
    }

    if (!signedIn) {
      window.location.href =
        "/login?mode=signup&redirect=/off-the-road";
      return false;
    }

    if (!isPremium) {
      window.location.href = "/premium";
      return false;
    }

    return true;
  }

  function openPremiumUpgrade() {
    if (!signedIn) {
      window.location.href =
        "/login?mode=signup&redirect=/off-the-road";
      return;
    }

    window.location.href = "/premium";
  }

  function sendPremiumTripRequest(requestText: string) {
    try {
      localStorage.setItem(
        "trippindays-request",
        requestText
      );
      sessionStorage.setItem(
        "trippindays-request",
        requestText
      );
      window.location.assign("/trip");
    } catch {
      window.location.assign(
        `/trip?request=${encodeURIComponent(requestText)}`
      );
    }
  }

 async function launchOffRoadPremium(
    mode:
      | "intel"
      | "full"
      | "basecamp"
  ) {
    if (!requireOffRoadPremium()) return;

  let chosenResult = selectedResult;

if (!chosenResult) {
  setMessage("Finding the best Off the Road destination...");

  const response = await fetch("/api/off-the-road/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      activity,
      huntType:
        activity === "Hunting"
          ? huntType
          : undefined,
      location: startingLocation || "Current Location",
      latitude:
        location?.latitude ??
        deviceLocation?.latitude,
      longitude:
        location?.longitude ??
        deviceLocation?.longitude,
      radius: Number(radius),
      skill,
      when,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    setMessage(
      data?.error ||
        "Could not find an Off the Road destination."
    );
    return;
  }

  const foundResults = Array.isArray(data?.results)
    ? data.results
    : [];

  if (!foundResults.length) {
    setMessage(
      `No matching ${activity.toLowerCase()} destinations were found within ${radius} miles.`
    );
    return;
  }

  setResults(foundResults);

  chosenResult = foundResults[0];

  setSelectedId(chosenResult.id);
}

    if (!chosenResult) {
      setMessage("Premium could not choose a destination. Try another activity or a larger radius.");
      return;
    }


    const authoritativeGps =
      location?.latitude != null &&
      location?.longitude != null
        ? `AUTHORITATIVE STARTING GPS:
Latitude: ${location.latitude}
Longitude: ${location.longitude}
Use these coordinates as the actual starting point.`
        : "";

    const destinationGps =
      Number.isFinite(chosenResult.latitude) &&
      Number.isFinite(chosenResult.longitude)
        ? `DESTINATION GPS:
Latitude: ${chosenResult.latitude}
Longitude: ${chosenResult.longitude}`
        : "";

    const common = `
Starting Location: ${startingLocation}
${authoritativeGps}

Destination: ${chosenResult.name}
Region: ${chosenResult.region || ""}
${destinationGps}

Activity: ${activity}
Skill Level: ${skill}
When: ${when}
Search Radius: ${radius} miles
Estimated Distance From Start: ${Math.round(
      chosenResult.distanceMiles
    )} miles
Difficulty: ${chosenResult.difficulty || "Varies"}
Elevation: ${
      chosenResult.elevationFeet == null
        ? "Unknown"
        : `${Math.round(
            chosenResult.elevationFeet
          ).toLocaleString()} ft`
    }
Known Access Note: ${
      chosenResult.accessNote ||
      "No special access note supplied."
    }
`.trim();

    let requestText = "";

    if (mode === "intel") {
      requestText = `${common}

Trip Request:
OFF THE ROAD PREMIUM — TRAIL INTELLIGENCE.

Create a premium field briefing and practical adventure plan for this exact destination and activity.

Include:
- current/forecast weather considerations when reliable data is available
- elevation and terrain implications
- snow depth or winter-surface concerns when relevant
- avalanche considerations when relevant, with a clear instruction to verify the official avalanche center
- trailhead, road, OHV, forest-road or access considerations
- permits, passes and vehicle rules that should be checked
- daylight and turnaround planning
- realistic equipment checklist for the selected activity and skill level
- emergency fallback and nearest practical help
- fuel, food and last-service considerations
- a concise Check Before Leaving list

Do not invent current closures, permit availability, avalanche ratings or road conditions. Clearly identify anything that requires an official live check.`;
    } else if (mode === "basecamp") {
      requestText = `${common}

Trip Request:
OFF THE ROAD PREMIUM — BASECAMP WEEKEND.

Build a complete 2-night / 3-day Off the Road basecamp adventure around this destination.

Include:
- Friday arrival or practical Day 1 travel
- exactly 2 overnight stays
- a logical campground, cabin or lodging base area
- the selected activity as the primary adventure
- one or two nearby compatible outdoor activities when practical
- realistic drive times and mileage
- food, fuel and supply stops
- estimated lodging/camping, fuel, food and activity costs
- weather and terrain considerations
- access, permit and vehicle-rule checks
- a backup plan for weather, closures or unsafe conditions
- final return home on Day 3 by about 5 PM when realistically possible

Do not invent current campsite availability, road openings, permits or closures.`;
    } else {
      requestText = `${common}

Trip Request:
OFF THE ROAD PREMIUM — FULL ADVENTURE.

Build a complete premium Off the Road itinerary around this exact destination and activity.

Include:
- a realistic departure and arrival schedule
- route and mileage
- the main adventure with sensible timing
- trailhead/parking/access plan
- weather, terrain and elevation considerations
- food and fuel stops
- lodging or camping when the timing calls for it
- estimated total cost and budget breakdown
- permits, passes and vehicle-rule checks
- equipment and safety checklist
- emergency fallback
- backup adventure if access or weather makes the primary plan unsafe
- final Check Before Leaving section

Do not invent current closures, permit availability, business hours or road conditions.`;
    }

    setMessage(`Premium selected ${chosenResult.name}. Building your adventure...`);

    sendPremiumTripRequest(requestText.trim());
  }

  async function verifySelectedHuntDetails() {
    if (!selectedHuntPlan) return;

    const species = huntSpecies.trim();
    const method = huntMethod.trim();
    const unit = huntUnit.trim();

    if (!species || !method || !unit) {
      setMessage(
        "Enter the species, hunting method, and GMU / unit / zone before verifying."
      );
      return;
    }

    setVerifyingHuntDetails(true);
    setMessage("");

    try {
      const response = await fetch(
        "/api/off-the-road/hunting-status",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          cache: "no-store",
          body: JSON.stringify({
            location: startingLocation,
            latitude:
              location?.latitude ??
              deviceLocation?.latitude,
            longitude:
              location?.longitude ??
              deviceLocation?.longitude,
            stateCode:
              huntingRegion.stateCode || "",
            stateName:
              huntingRegion.stateName || "",
            regionName: huntingRegion.regionName,
            country:
              deviceLocation?.country ||
              "United States",
            agencyName:
              huntingRegion.agencyName || "",
            agencyUrl:
              huntingRegion.agencyUrl || "",
            date: new Date()
              .toISOString()
              .slice(0, 10),
            plans: [
              {
                key: selectedHuntPlan.title,
                huntType:
                  selectedHuntPlan.huntType,
                speciesFocus: `
EXACT HUNT TO VERIFY:
Species: ${species}
Method / weapon category: ${method}
Unit / GMU / Zone: ${unit}

Do not substitute another species, method, unit, zone or season.

Only return OPEN if this exact combination can be verified as currently legal from official wildlife-agency information.
                `.trim(),
                species,
                method,
                unit,
              },
            ],
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Could not verify this hunt."
        );
      }

      const found = Array.isArray(data?.results)
        ? data.results.find(
            (item: any) =>
              item?.key === selectedHuntPlan.title
          )
        : null;

      const verifiedStatus: HuntSeasonStatus = {
        key: selectedHuntPlan.title,
        status:
          found?.status === "open" ||
          found?.status === "closed"
            ? found.status
            : "unknown",
        species:
          typeof found?.species === "string" &&
          found.species
            ? found.species
            : species,
        season:
          typeof found?.season === "string"
            ? found.season
            : "",
        unit:
          typeof found?.unit === "string" &&
          found.unit
            ? found.unit
            : unit,
        license:
          typeof found?.license === "string"
            ? found.license
            : "",
        bagLimit:
          typeof found?.bagLimit === "string"
            ? found.bagLimit
            : "",
        shootingHours:
          typeof found?.shootingHours === "string"
            ? found.shootingHours
            : "",
        access:
          typeof found?.access === "string"
            ? found.access
            : "",
        closures:
          typeof found?.closures === "string"
            ? found.closures
            : "",
        reason:
          typeof found?.reason === "string"
            ? found.reason
            : "",
        officialUrl:
          typeof found?.officialUrl === "string" &&
          found.officialUrl
            ? found.officialUrl
            : huntingRegion.agencyUrl || "",
      };

      setHuntSeasonChecks((current) => ({
        ...current,
        [selectedHuntPlan.title]:
          verifiedStatus,
      }));

      if (verifiedStatus.status === "open") {
        setMessage(
          `✅ Verified: ${species} • ${method} • ${unit}`
        );
      } else if (
        verifiedStatus.status === "closed"
      ) {
        setMessage(
          `⛔ This exact hunt is not currently verified as open: ${species} • ${method} • ${unit}`
        );
      } else {
        setMessage(
          "⚠ TrippinDays could not fully verify this exact hunt. Check the official regulations before planning."
        );
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not verify this hunt."
      );
    } finally {
      setVerifyingHuntDetails(false);
    }
  }

  function planVerifiedHunt(
    hunt: RegionalHuntPlan,
    status: HuntSeasonStatus
  ) {
    if (status.status !== "open") {
      return;
    }

    if (!requireOffRoadPremium()) {
      return;
    }

    const authoritativeGps =
      location?.latitude != null &&
      location?.longitude != null
        ? `AUTHORITATIVE STARTING GPS:
Latitude: ${location.latitude}
Longitude: ${location.longitude}
Use these coordinates as the actual starting point.`
        : "";

    const requestText = `
Starting Location: ${startingLocation}
${authoritativeGps}

Trip Request:
OFF THE ROAD PREMIUM — VERIFIED HUNTING EXPEDITION.\nPREPLANNED REGIONAL HUNTING TRIP.

Hunt: ${hunt.title}
Hunt Type: ${hunt.huntType}
Verified Current Species: ${status.species || hunt.speciesFocus}
Region: ${huntingRegion.regionName}
${huntingRegion.stateName ? `State / Province: ${huntingRegion.stateName}` : ""}

CURRENT OFFICIAL SEASON CHECK:
Status: IN SEASON
Season: ${status.season || "See official regulations"}
Unit / GMU / Zone: ${status.unit || "See official regulations"}
Requested Hunting Method: ${huntMethod || "See official regulations"}
License / Tag / Stamp: ${status.license || "See official regulations"}
Bag Limit: ${status.bagLimit || "See official regulations"}
Shooting Hours: ${status.shootingHours || "See official regulations"}
Access: ${status.access || "See official regulations"}
Closures / Alerts: ${status.closures || "None verified"}
Official Regulations: ${status.officialUrl || huntingRegion.agencyUrl || "Use the official wildlife agency"}

Build a complete hunting trip that is realistic from the starting location.

Use the verified species, season, unit/zone, legal requirements and access information above as hard constraints.

Do not substitute a different species, unit, season, method or property unless it is independently verified as currently legal.

Include:
- a specific legal hunting destination or public hunting area practical from the starting location
- realistic travel time and mileage
- departure time that respects legal shooting hours
- parking, trailhead, boat-launch or access information when relevant
- license/tag/stamp checklist
- legal equipment or method reminders only when verified
- weather and field conditions
- fuel and food stops
- lodging or camping when appropriate
- estimated trip costs
- emergency and safety considerations
- a final Check Before You Go section linking back to official regulations

If current official information becomes ambiguous or conflicts with the verified season check, do not guess. Tell the traveler to verify with the wildlife agency before leaving.
    `.trim();

    sendPremiumTripRequest(requestText);
  }

  function selectActivity(name: string) {
    setActivity(name);
    setResults([]);
    setSelectedId(null);
    setMessage("");

    if (name !== "Hunting") {
      setSelectedHuntPlan(null);
    }

    const found = ACTIVITIES.find((item) => item.name === name);
    if (found && group !== "All" && found.group !== group) {
      setGroup(found.group);
    }

    // After selecting any activity card, move the traveler directly
    // to that activity's planner section.
    window.setTimeout(() => {
      document.getElementById("off-road-planner")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 50);
  }

  const mapLat = location?.latitude ?? 39.8283;
  const mapLon = location?.longitude ?? -98.5795;
  const mapLabel = location?.name ?? startingLocation ?? "Starting Location";

  return (
    <main
      className="min-h-screen text-stone-900"
      style={{
        backgroundColor: "#f3efe5",
        backgroundImage:
          "radial-gradient(circle at 1px 1px, rgba(74,63,45,.055) 1px, transparent 0)",
        backgroundSize: "22px 22px",
      }}
    >
      <SiteHeader />

      {/* HERO */}
      <section
        className="relative overflow-hidden border-b border-black/10"
        style={{
       backgroundImage: `linear-gradient(90deg, rgba(20,26,18,.62) 0%, rgba(30,38,25,.42) 48%, rgba(15,20,14,.10) 100%), url('${OFF_ROAD_IMAGES.hero}')`,
backgroundSize: "cover",
backgroundPosition: "center 70%",
        }}
      >
        <div className="mx-auto max-w-7xl px-4 pb-14 pt-32 sm:px-6 sm:pb-20 sm:pt-36 lg:px-8">
          <div className="max-w-3xl text-white">
           
            <h1 className="text-5xl font-black tracking-[-0.05em] sm:text-7xl">
              OFF THE ROAD
            </h1>

            

            
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-10 px-4 py-8 sm:px-6 lg:px-8">
        {/* CATEGORY NAV */}
        <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-7">
          <SectionTitle
            eyebrow="Choose your terrain"
            title="What do you want to do?"
          >
            Off the Road only shows activities that make sense for your
            selected region and season once live availability data is returned.
          </SectionTitle>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {[
              {
                title: "Trails & Mountains",
                subtitle: "Hike • Bike • Climb • Explore",
                image: OFF_ROAD_IMAGES.hiking,
                group: "Trails",
              },
              {
                title: "Motorized & Backcountry",
                subtitle: "ATV • UTV • Dirt Bike • 4x4",
                image: OFF_ROAD_IMAGES.motorized,
                group: "Motorized",
              },
              {
                title: "Snow & Seasonal",
                subtitle: "Ski • Board • Snowshoe • Ride",
                image: OFF_ROAD_IMAGES.winter,
                group: "Winter",
              },
            ].map((card) => (
              <button
                key={card.title}
                type="button"
                onClick={() => setGroup(card.group)}
                className="group relative min-h-[160px] overflow-hidden rounded-2xl text-left shadow-sm"
                style={{
                  backgroundImage: `linear-gradient(180deg, rgba(20,24,18,.05), rgba(20,24,18,.74)), url('${card.image}')`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              >
                <div className="absolute inset-0 ring-1 ring-inset ring-black/10" />
                <div className="relative flex h-full min-h-[160px] flex-col justify-end p-5 text-white">
                  <div className="text-xl font-black">{card.title}</div>
                  <div className="mt-1 text-xs font-bold text-white/75">
                    {card.subtitle}
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="mt-5 flex gap-2 overflow-x-auto pb-2">
            {GROUPS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setGroup(item)}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-black transition ${
                  group === item
                    ? "bg-[#42552f] text-white"
                    : "border border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100"
                }`}
              >
                {item}
              </button>
            ))}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {visibleActivities.map((item) => {
              const selected = item.name === activity;

              return (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => selectActivity(item.name)}
                  className={`min-h-[118px] rounded-2xl border p-4 text-left transition ${
                    selected
                      ? "border-orange-400 bg-orange-50 ring-2 ring-orange-200"
                      : "border-stone-200 bg-white hover:-translate-y-0.5 hover:border-[#7a8f58] hover:shadow-md"
                  }`}
                >
                  <div className="text-3xl">{item.icon}</div>
                  <div className="mt-3 text-sm font-black text-stone-900">
                    {item.name}
                  </div>
                  <div className="mt-1 text-xs leading-4 text-stone-500">
                    {item.subtitle}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
  <SiteQuickAccess />
        {/* FIND MY BEST */}
        <section id="off-road-planner" className="scroll-mt-24 overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
          <div className="grid lg:grid-cols-[1.15fr_.85fr]">
            <div className="p-5 sm:p-8">
              <SectionTitle
                eyebrow={`${selectedActivity.icon} ${selectedActivity.group}`}
                title={`Find My Best ${selectedActivity.name}`}
              >
                Tell TrippinDays where you're starting and how far you want to
                go. We'll rank nearby matches using location, access and
                forecast conditions.
              </SectionTitle>

              {activity === "Hunting" && (
                <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <div className="text-sm font-black text-amber-950">
                    🦌 Hunting type
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {HUNT_TYPES.map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setHuntType(item)}
                        className={`rounded-full px-3 py-2 text-xs font-black ${
                          huntType === item
                            ? "bg-amber-800 text-white"
                            : "border border-amber-200 bg-white text-amber-900"
                        }`}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                  <p className="mt-3 text-xs leading-5 text-amber-900">
                    Hunting choices are regional. TrippinDays uses your selected
                    starting location to choose the appropriate hunting profile,
                    then requires official regulations before treating a hunt as
                    legal.
                  </p>

                  <div className="mt-3 rounded-xl border border-amber-200 bg-white p-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-700">
                      Regional hunting profile
                    </div>
                    <div className="mt-1 text-sm font-black text-stone-900">
                      {huntingRegion.regionName}
                    </div>
                    {huntingRegion.agencyName && (
                      <div className="mt-1 text-xs font-semibold text-stone-600">
                        Official source: {huntingRegion.agencyName}
                      </div>
                    )}
                  </div>

                  {selectedHuntPlan && (
                    <div className="mt-4 rounded-2xl border border-stone-200 bg-stone-950 p-4 text-white">
                      <div className="text-xs font-black uppercase tracking-[0.18em] text-orange-300">
                        Hunting Legal Check
                      </div>

                      <div className="mt-2 text-lg font-black">
                        {selectedHuntPlan.title}
                      </div>

                      <p className="mt-2 text-xs font-semibold leading-5 text-white/70">
                        Big-game regulations can change by species, hunting method
                        and management unit. Enter the exact hunt you want
                        TrippinDays to check.
                      </p>

                      <div className="mt-5 grid gap-3 sm:grid-cols-3">
                        <label>
                          <span className="text-[10px] font-black uppercase tracking-wider text-white/50">
                            Species
                          </span>

                          <input
                            value={huntSpecies}
                            onChange={(event) =>
                              setHuntSpecies(event.target.value)
                            }
                            placeholder="Deer, elk, moose..."
                            className="mt-2 w-full rounded-xl border border-white/15 bg-white/10 px-3 py-3 text-sm font-bold text-white outline-none placeholder:text-white/35 focus:border-orange-400"
                          />
                        </label>

                        <label>
                          <span className="text-[10px] font-black uppercase tracking-wider text-white/50">
                            Method
                          </span>

                          <select
                            value={huntMethod}
                            onChange={(event) =>
                              setHuntMethod(event.target.value)
                            }
                            className="mt-2 w-full rounded-xl border border-white/15 bg-stone-900 px-3 py-3 text-sm font-bold text-white outline-none focus:border-orange-400"
                          >
                            <option value="">
                              Choose method
                            </option>
                            <option value="Archery">
                              Archery
                            </option>
                            <option value="Muzzleloader">
                              Muzzleloader
                            </option>
                            <option value="Modern firearm">
                              Modern firearm
                            </option>
                            <option value="Shotgun">
                              Shotgun
                            </option>
                            <option value="Other legal method">
                              Other legal method
                            </option>
                          </select>
                        </label>

                        <label>
                          <span className="text-[10px] font-black uppercase tracking-wider text-white/50">
                            GMU / Unit / Zone
                          </span>

                          <input
                            value={huntUnit}
                            onChange={(event) =>
                              setHuntUnit(event.target.value)
                            }
                            placeholder="Example: GMU 667"
                            className="mt-2 w-full rounded-xl border border-white/15 bg-white/10 px-3 py-3 text-sm font-bold text-white outline-none placeholder:text-white/35 focus:border-orange-400"
                          />
                        </label>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          void verifySelectedHuntDetails()
                        }
                        disabled={verifyingHuntDetails}
                        className="mt-4 w-full rounded-xl bg-orange-500 px-4 py-3 text-sm font-black text-white transition hover:bg-orange-600 disabled:cursor-wait disabled:opacity-60"
                      >
                        {verifyingHuntDetails
                          ? "VERIFYING WITH OFFICIAL INFORMATION..."
                          : "🔎 VERIFY THIS HUNT"}
                      </button>

                      {huntSeasonChecks[
                        selectedHuntPlan.title
                      ]?.status === "open" && (
                        <div className="mt-4 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-4">
                          <div className="font-black text-emerald-300">
                            ✓ CURRENT HUNT VERIFIED
                          </div>

                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            {[
                              [
                                "Species",
                                huntSeasonChecks[
                                  selectedHuntPlan.title
                                ]?.species || huntSpecies,
                              ],
                              [
                                "Season",
                                huntSeasonChecks[
                                  selectedHuntPlan.title
                                ]?.season || "Verified",
                              ],
                              [
                                "Unit / GMU / Zone",
                                huntSeasonChecks[
                                  selectedHuntPlan.title
                                ]?.unit || huntUnit,
                              ],
                              [
                                "Method",
                                huntMethod,
                              ],
                              [
                                "License / Tag / Stamp",
                                huntSeasonChecks[
                                  selectedHuntPlan.title
                                ]?.license ||
                                  "See official regulations",
                              ],
                              [
                                "Bag Limit",
                                huntSeasonChecks[
                                  selectedHuntPlan.title
                                ]?.bagLimit ||
                                  "See official regulations",
                              ],
                              [
                                "Shooting Hours",
                                huntSeasonChecks[
                                  selectedHuntPlan.title
                                ]?.shootingHours ||
                                  "See official regulations",
                              ],
                              [
                                "Access",
                                huntSeasonChecks[
                                  selectedHuntPlan.title
                                ]?.access ||
                                  "See official regulations",
                              ],
                            ].map(([label, value]) => (
                              <div
                                key={label}
                                className="rounded-xl border border-white/10 bg-white/5 p-3"
                              >
                                <div className="text-[10px] font-black uppercase tracking-wider text-white/45">
                                  {label}
                                </div>

                                <div className="mt-1 text-xs font-bold">
                                  {value}
                                </div>
                              </div>
                            ))}
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              planVerifiedHunt(
                                selectedHuntPlan,
                                huntSeasonChecks[
                                  selectedHuntPlan.title
                                ]
                              )
                            }
                            className="mt-4 w-full rounded-xl bg-emerald-500 px-4 py-3 text-sm font-black text-white hover:bg-emerald-600"
                          >
                            {isPremium
                              ? "⭐ PLAN VERIFIED PREMIUM HUNT →"
                              : "🔒 PREMIUM HUNT →"}
                          </button>
                        </div>
                      )}

                      {huntSeasonChecks[
                        selectedHuntPlan.title
                      ]?.status === "closed" && (
                        <div className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm font-bold text-red-200">
                          ⛔ This exact species, method and unit combination is
                          not currently verified as open.
                        </div>
                      )}

                      {huntingRegion.agencyUrl && (
                        <a
                          href={huntingRegion.agencyUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-4 inline-flex w-full items-center justify-center rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-black text-white transition hover:bg-white/15"
                        >
                          VIEW OFFICIAL{" "}
                          {huntingRegion.stateCode || ""}{" "}
                          REGULATIONS ↗
                        </a>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="mt-7 grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-black uppercase tracking-wider text-stone-500">
                    Starting Location
                  </span>
                  <input
                    value={startingLocation}
                    onChange={(event) => {
                      setUsingDeviceLocation(false);
                      setStartingLocation(event.target.value);
                      setLocation(null);
                    }}
                    placeholder="City, ZIP code or location"
                    className="mt-2 w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 font-semibold outline-none transition focus:border-[#5b713f] focus:ring-2 focus:ring-emerald-100"
                  />
                  <button
                    type="button"
                    onClick={useMyLocation}
                    className="mt-2 text-xs font-black text-[#42552f]"
                  >
                    {findingDeviceLocation
                      ? "📍 Finding Location..."
                      : "📍 Use My Location"}
                  </button>

                  {deviceLocationError && (
                    <div className="mt-1 text-[11px] font-semibold text-red-600">
                      {deviceLocationError}
                    </div>
                  )}

                  {usingDeviceLocation && deviceLocation && (
                    <div className="mt-1 text-[11px] font-semibold text-stone-500">
                      Using device GPS
                      {deviceLocation.shortLabel &&
                      deviceLocation.shortLabel !== "Current Location"
                        ? ` • ${deviceLocation.shortLabel}`
                        : ""}
                    </div>
                  )}
                </label>

                <label className="block">
                  <span className="text-xs font-black uppercase tracking-wider text-stone-500">
                    Travel Radius
                  </span>
                  <select
                    value={radius}
                    onChange={(event) => setRadius(event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 font-semibold outline-none focus:border-[#5b713f]"
                  >
                    <option value="25">Within 25 miles</option>
                    <option value="50">Within 50 miles</option>
                    <option value="75">Within 75 miles</option>
                    <option value="100">Within 100 miles</option>
                    <option value="150">Within 150 miles</option>
                    <option value="250">Within 250 miles</option>
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs font-black uppercase tracking-wider text-stone-500">
                    Skill / Difficulty
                  </span>
                  <select
                    value={skill}
                    onChange={(event) => setSkill(event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 font-semibold outline-none focus:border-[#5b713f]"
                  >
                    <option>Any</option>
                    <option>Beginner</option>
                    <option>Intermediate</option>
                    <option>Advanced</option>
                    <option>Expert</option>
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs font-black uppercase tracking-wider text-stone-500">
                    When
                  </span>
                  <select
                    value={when}
                    onChange={(event) => setWhen(event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 font-semibold outline-none focus:border-[#5b713f]"
                  >
                    <option>Today</option>
                    <option>Tomorrow</option>
                    <option>This Weekend</option>
                    <option>Next 7 Days</option>
                  </select>
                </label>
              </div>

              <button
                type="button"
                onClick={findMyBest}
                disabled={searching}
                className="mt-7 w-full rounded-2xl bg-orange-500 px-6 py-4 text-base font-black text-white shadow-lg shadow-orange-500/20 transition hover:bg-orange-600 disabled:cursor-wait disabled:opacity-60"
              >
                {searching ? "SEARCHING THE BACKCOUNTRY..." : "FIND MY BEST →"}
              </button>

              {message && (
                <div className="mt-4 rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm font-semibold text-stone-700">
                  {message}
                </div>
              )}
            </div>

            <div
              className="relative min-h-[360px] overflow-hidden bg-cover bg-center"
              style={{
                backgroundImage: `linear-gradient(180deg, rgba(20,24,18,.04), rgba(20,24,18,.72)), url('${imageForActivity(
                  activity
                )}')`,
              }}
            >
              
              <div className="flex h-full min-h-[360px] items-end p-7 text-white">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.2em] text-orange-300">
                    Conditions + Access + Distance
                  </div>
                  <div className="mt-2 text-3xl font-black">
                    Find Your Adventure Today.
                  </div>
                  <p className="mt-3 max-w-md text-sm font-semibold leading-6 text-white/85">
                    TrippinDays: Plan. Pack. Go.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* RESULTS + MAP */}
        <section id="off-road-results" className="scroll-mt-6">
          <SectionTitle
            eyebrow="Ranked for you"
            title={
              results.length
                ? `Best ${activity} Matches`
                : "Your Off the Road Results"
            }
          >
            Results are ranked by distance, activity fit and forecast
            conditions. Access, permits and legal-use data should override the
            ranking whenever a source says an area is closed or restricted.
          </SectionTitle>

          <div className="mt-6 grid gap-6 xl:grid-cols-[.82fr_1.18fr]">
            <div className="space-y-3">
              {results.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-stone-300 bg-white p-8 text-center">
                  <div className="text-5xl">{selectedActivity.icon}</div>
                  <div className="mt-4 text-xl font-black">
                    Pick an activity and hit Find My Best
                  </div>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-stone-500">
                    Your ranked destinations will appear here and automatically
                    populate the interactive map.
                  </p>
                </div>
              ) : (
                results.map((place) => (
                  <button
                    key={place.id}
                    type="button"
                    onClick={() => setSelectedId(place.id)}
                    className={`w-full rounded-3xl border bg-white p-5 text-left shadow-sm transition ${
                      selectedId === place.id
                        ? "border-orange-400 ring-2 ring-orange-100"
                        : "border-stone-200 hover:border-[#7a8f58]"
                    }`}
                  >
                    <div className="flex gap-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-800 text-sm font-black text-white">
                        #{place.rank}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <div className="text-lg font-black text-stone-900">
                              {place.name}
                            </div>
                            <div className="mt-1 text-xs font-bold text-stone-500">
                              {place.region || place.category || activity}
                            </div>
                          </div>

                          <div className="rounded-full bg-[#edf0e7] px-3 py-1 text-xs font-black text-[#42552f]">
                            {place.score}/100
                          </div>
                        </div>

                        <div className="mt-3 text-sm font-black text-orange-700">
                          {place.label}
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                          <Stat label="Distance" value={`${place.distanceMiles} mi`} />
                          <Stat
                            label="Temp"
                            value={
                              place.temperatureF == null
                                ? "—"
                                : `${place.temperatureF}°F`
                            }
                          />
                          <Stat
                            label="Wind"
                            value={place.wind == null ? "—" : `${place.wind} mph`}
                          />
                          <Stat
                            label="Snow"
                            value={
                              place.snowfall == null
                                ? "—"
                                : `${place.snowfall} in`
                            }
                          />
                          <Stat
                            label="Elevation"
                            value={
                              place.elevationFeet == null
                                ? "—"
                                : `${Math.round(place.elevationFeet).toLocaleString()} ft`
                            }
                          />
                          <Stat
                            label="Difficulty"
                            value={place.difficulty || "Varies"}
                          />
                        </div>

                        {place.accessNote && (
                          <div className="mt-3 rounded-xl bg-stone-50 p-3 text-xs font-semibold leading-5 text-stone-600">
                            {place.accessNote}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>

            <div className="xl:sticky xl:top-4 xl:self-start">
              <OffTheRoadMap
                startLatitude={mapLat}
                startLongitude={mapLon}
                startLabel={mapLabel}
                showStartMarker={Boolean(location)}
                places={results}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            </div>
          </div>
        </section>

        <OffRoadToolkit />

        {/* OFF THE ROAD PREMIUM */}
        <section
          className="overflow-hidden rounded-3xl border border-[#314024]/20 bg-[#1f2b1b] text-white shadow-xl"
          id="off-road-premium"
        >
          <div className="grid gap-0 lg:grid-cols-[.78fr_1.22fr]">
            <div className="border-b border-white/10 p-6 sm:p-8 lg:border-b-0 lg:border-r">
              <div className="text-xs font-black uppercase tracking-[0.24em] text-orange-300">
                ⭐ Off the Road Premium
              </div>

              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                Go beyond finding a trail.
              </h2>

              <p className="mt-4 max-w-xl text-sm font-semibold leading-6 text-stone-200">
                Turn a destination into a complete field-ready adventure with
                deeper terrain planning, basecamp weekends, safety fallbacks,
                costs and trip logistics.
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                {premiumLoading ? (
                  <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-black">
                    Checking Premium...
                  </span>
                ) : isPremium ? (
                  <span className="rounded-full bg-emerald-400 px-3 py-1.5 text-xs font-black text-emerald-950">
                    ✓ PREMIUM ACTIVE
                  </span>
                ) : (
                  <span className="rounded-full bg-orange-500 px-3 py-1.5 text-xs font-black text-white">
                    🔒 PREMIUM FEATURES
                  </span>
                )}

                {selectedResult && (
                  <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-black">
                    Selected: {selectedResult.name}
                  </span>
                )}
              </div>

              {!isPremium && !premiumLoading && (
                <button
                  type="button"
                  onClick={openPremiumUpgrade}
                  className="mt-6 rounded-2xl bg-orange-500 px-5 py-3 text-sm font-black text-white transition hover:bg-orange-600"
                >
                  {signedIn
                    ? "UNLOCK OFF THE ROAD PREMIUM →"
                    : "SIGN IN TO UNLOCK →"}
                </button>
              )}
            </div>

            <div className="grid gap-4 p-5 sm:grid-cols-3 sm:p-6">
              <PremiumOffRoadCard
                icon="🧭"
                title="Trail Intelligence+"
                description="A deeper field briefing for terrain, elevation, snow, access, permits, daylight and safety checks."
                buttonLabel={
                  isPremium
                    ? "BUILD INTEL →"
                    : "🔒 PREMIUM"
                }
                disabled={premiumLoading}
                onClick={() =>
                  isPremium
                    ? launchOffRoadPremium("intel")
                    : openPremiumUpgrade()
                }
              />

              <PremiumOffRoadCard
                icon="🏕️"
                title="Basecamp Weekend+"
                description="Build a complete 2-night outdoor weekend with a basecamp, nearby adventures, costs and backup plans."
                buttonLabel={
                  isPremium
                    ? "BUILD WEEKEND →"
                    : "🔒 PREMIUM"
                }
                disabled={premiumLoading}
                onClick={() =>
                  isPremium
                    ? launchOffRoadPremium("basecamp")
                    : openPremiumUpgrade()
                }
              />

              <PremiumOffRoadCard
                icon="🗺️"
                title="Full Adventure+"
                description="Turn the selected destination into a complete itinerary with route, food, fuel, gear, costs and fallbacks."
                buttonLabel={
                  isPremium
                    ? "BUILD ADVENTURE →"
                    : "🔒 PREMIUM"
                }
                disabled={premiumLoading}
                onClick={() =>
                  isPremium
                    ? launchOffRoadPremium("full")
                    : openPremiumUpgrade()
                }
              />
            </div>
          </div>
        </section>

        {/* REGIONAL PREPLANNED HUNTING TRIPS */}
        <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-8">
          <SectionTitle
            eyebrow="Regional hunting trips"
            title={`Preplanned Hunting Adventures • ${huntingRegion.regionName}`}
          >
            These hunting ideas change with the selected starting location.
            TrippinDays only uses them as trip templates; actual species, season,
            unit, tag, license, bag-limit, shooting-hour, access and closure
            details must be verified with the official wildlife agency.
          </SectionTitle>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#42552f] px-3 py-1.5 text-xs font-black text-white">
              📍 {huntingRegion.stateName || huntingRegion.regionName}
            </span>

            {usingDeviceLocation && deviceLocation && (
              <span className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-black text-stone-700">
                Using device location
              </span>
            )}

            {huntingRegion.agencyName && (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-900">
                Official source: {huntingRegion.agencyName}
              </span>
            )}
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {huntingRegion.plans.map((hunt) => (
              <article
                key={`${huntingRegion.key}-${hunt.title}`}
                className="group flex h-full flex-col overflow-hidden rounded-3xl border border-stone-200 bg-stone-950 shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
              >
                <div
                  className="min-h-[250px] bg-cover bg-center"
                  style={{
                    backgroundImage: `url('${imageForHuntType(hunt.huntType)}')`,
                  }}
                />

                <div className="flex flex-1 flex-col bg-white p-4">
                  <div className="text-center">
                    <div className="text-3xl">{hunt.icon}</div>
                    <h3 className="mt-2 text-lg font-black text-stone-900">
                      {hunt.title}
                    </h3>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl bg-stone-50 px-3 py-2">
                      <div className="text-[10px] font-black uppercase tracking-wider text-stone-400">
                        Duration
                      </div>
                      <div className="mt-1 font-black text-stone-800">
                        {hunt.duration}
                      </div>
                    </div>

                    <div className="rounded-xl bg-stone-50 px-3 py-2">
                      <div className="text-[10px] font-black uppercase tracking-wider text-stone-400">
                        Search Area
                      </div>
                      <div className="mt-1 font-black text-stone-800">
                        {hunt.range}
                      </div>
                    </div>
                  </div>
{(() => {
  const season =
    huntSeasonChecks[hunt.title];

  const isChecking =
    !season ||
    season.status === "checking";

  const isOpen =
    season?.status === "open";

  const isClosed =
    season?.status === "closed";

  const needsBigGameDetails =
    hunt.huntType === "Big Game" &&
    !isChecking &&
    !isOpen &&
    !isClosed;

  return (
    <div className="mt-auto pt-4">
      <div
        className={`mb-2 rounded-xl px-3 py-2 text-center text-[11px] font-black uppercase tracking-wider ${
          isChecking
            ? "bg-stone-100 text-stone-500"
            : isOpen
              ? "bg-emerald-100 text-emerald-800"
              : isClosed
                ? "bg-red-50 text-red-700"
                : "bg-amber-50 text-amber-800"
        }`}
      >
        {isChecking
          ? "Checking current season..."
          : isOpen
            ? `✓ In Season${
                season?.species
                  ? ` • ${season.species}`
                  : ""
              }`
            : isClosed
              ? "Not In Season"
              : needsBigGameDetails
                ? "⚠ Details Needed"
                : "Season Not Verified"}
      </div>

      <button
        type="button"
        disabled={
          !isOpen &&
          !needsBigGameDetails
        }
        onClick={() => {
          if (season && isOpen) {
            planVerifiedHunt(
              hunt,
              season
            );
            return;
          }

          if (needsBigGameDetails) {
            setSelectedHuntPlan(hunt);
            setHuntType("Big Game");
            setHuntSpecies("");
            setHuntMethod("");
            setHuntUnit("");

            setMessage(
              "Big game seasons depend on the exact species, weapon or method, and GMU / hunting area. Review the required details before TrippinDays verifies this hunt."
            );

            window.setTimeout(() => {
              document
                .getElementById(
                  "off-road-planner"
                )
                ?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                });
            }, 50);
          }
        }}
        className={`w-full rounded-2xl px-4 py-3 text-sm font-black transition ${
          isOpen ||
          needsBigGameDetails
            ? "bg-orange-500 text-white hover:bg-orange-600"
            : "cursor-not-allowed bg-stone-200 text-stone-500"
        }`}
      >
        {isChecking
          ? "CHECKING SEASON..."
          : isOpen
            ? isPremium
              ? "⭐ PLAN PREMIUM HUNT →"
              : "🔒 PREMIUM HUNT →"
            : isClosed
              ? "NOT IN SEASON"
              : needsBigGameDetails
                ? "CHECK BIG GAME DETAILS →"
                : "NOT AVAILABLE NOW"}
      </button>

      {!isChecking &&
        season?.reason && (
          <div className="mt-2 text-center text-[10px] font-semibold leading-4 text-stone-500">
            {season.reason}
          </div>
        )}
    </div>
  );
})()}
                </div>
              </article>
            ))}
          </div>

          <div className="mt-5 rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm font-semibold leading-6 text-orange-950">
            <strong>Check Before You Go:</strong> Hunting regulations can change
            by state, species, unit, date, method and property. TrippinDays
            should never mark a hunt legal until the official wildlife-agency
            requirements for the selected destination have been checked.
          </div>
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-stone-50 px-3 py-2">
      <div className="text-[10px] font-black uppercase tracking-wider text-stone-400">
        {label}
      </div>
      <div className="mt-1 truncate font-black text-stone-800">{value}</div>
    </div>
  );
}
