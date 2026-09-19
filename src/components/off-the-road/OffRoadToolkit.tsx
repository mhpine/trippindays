"use client";

import { useEffect, useMemo, useState } from "react";

type ToolKey =
  | "compass"
  | "weather"
  | "trail"
  | "snow"
  | "avalanche"
  | "terrain"
  | "bouldering"
  | "road"
  | "permits"
  | "vehicle"
  | "hunting"
  | "daylight"
  | "camping"
  | "fuel-food"
  | "navigation"
  | "safety";

type ToolMeta = {
  key: ToolKey;
  icon: string;
  title: string;
  description: string;
};

type LocationState = {
  latitude: number;
  longitude: number;
  accuracy?: number;
};

type NearbyItem = {
  id: string;
  name: string;
  kind?: string;
  latitude: number;
  longitude: number;
  distanceMiles?: number;
  tags?: Record<string, string>;
  website?: string | null;
};

type OfficialLink = {
  label: string;
  url: string;
};

type ToolkitPayload = {
  ok: boolean;
  tool: ToolKey;
  location?: {
    label?: string;
    city?: string;
    state?: string;
    country?: string;
    countryCode?: string;
    latitude: number;
    longitude: number;
  };
  weather?: {
    elevationFeet?: number | null;
    timezone?: string;
    current?: {
      temperatureF?: number | null;
      apparentTemperatureF?: number | null;
      precipitationIn?: number | null;
      rainIn?: number | null;
      snowfallIn?: number | null;
      snowDepthIn?: number | null;
      windMph?: number | null;
      windGustMph?: number | null;
      visibilityMiles?: number | null;
      weatherCode?: number | null;
    };
    daily?: Array<{
      date: string;
      highF?: number | null;
      lowF?: number | null;
      precipitationIn?: number | null;
      snowfallIn?: number | null;
      sunrise?: string | null;
      sunset?: string | null;
    }>;
  };
  items?: NearbyItem[];
  nearbyError?: string;
  nearbySource?: string;
  officialLinks?: OfficialLink[];
  message?: string;
  note?: string;
  error?: string;
};

const TOOLS: ToolMeta[] = [
  {
    key: "compass",
    icon: "🧭",
    title: "Compass",
    description: "Live heading and cardinal direction",
  },
  {
    key: "weather",
    icon: "🌦️",
    title: "Weather",
    description: "Temperature, wind, rain and forecast window",
  },
  {
    key: "trail",
    icon: "🥾",
    title: "Trail Conditions",
    description: "Surface, access and nearby trail information",
  },
  {
    key: "snow",
    icon: "❄️",
    title: "Snow Conditions",
    description: "Snowfall, depth and winter weather",
  },
  {
    key: "avalanche",
    icon: "⚠️",
    title: "Avalanche",
    description: "Weather context and official avalanche forecasts",
  },
  {
    key: "terrain",
    icon: "⛰️",
    title: "Elevation & Terrain",
    description: "Elevation and terrain information",
  },
  {
    key: "bouldering",
    icon: "🪨",
    title: "Bouldering",
    description: "Nearby boulder and climbing areas",
  },
  {
    key: "road",
    icon: "🚧",
    title: "Road Access",
    description: "Nearby access roads, gates and official road sources",
  },
  {
    key: "permits",
    icon: "🎫",
    title: "Passes & Permits",
    description: "Protected areas, permits, fees and official sources",
  },
  {
    key: "vehicle",
    icon: "🚙",
    title: "Vehicle Rules",
    description: "ATV, UTV, dirt bike and 4x4 access tags",
  },
  {
    key: "hunting",
    icon: "🦌",
    title: "Hunting Rules",
    description: "Official-season and regulation source links",
  },
  {
    key: "daylight",
    icon: "🌅",
    title: "Daylight",
    description: "Sunrise, sunset and daylight window",
  },
  {
    key: "camping",
    icon: "🏕️",
    title: "Camping",
    description: "Nearby campgrounds and overnight options",
  },
  {
    key: "fuel-food",
    icon: "⛽",
    title: "Fuel & Food",
    description: "Nearby fuel, food and supplies",
  },
  {
    key: "navigation",
    icon: "🗺️",
    title: "Navigation",
    description: "Current position and map/navigation links",
  },
  {
    key: "safety",
    icon: "🆘",
    title: "Safety",
    description: "Nearby emergency services and current coordinates",
  },
];

function cardinalDirection(heading: number | null) {
  if (heading == null || !Number.isFinite(heading)) return "—";

  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const index = Math.round((((heading % 360) + 360) % 360) / 45) % 8;
  return directions[index];
}

function formatNumber(value: number | null | undefined, digits = 0) {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(digits);
}

function weatherLabel(code: number | null | undefined) {
  if (code == null) return "Current conditions";
  if (code === 0) return "Clear";
  if ([1, 2, 3].includes(code)) return "Partly cloudy";
  if ([45, 48].includes(code)) return "Fog";
  if ([51, 53, 55, 56, 57].includes(code)) return "Drizzle";
  if ([61, 63, 65, 66, 67].includes(code)) return "Rain";
  if ([71, 73, 75, 77].includes(code)) return "Snow";
  if ([80, 81, 82].includes(code)) return "Rain showers";
  if ([85, 86].includes(code)) return "Snow showers";
  if ([95, 96, 99].includes(code)) return "Thunderstorms";
  return "Current conditions";
}

function ToolMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-stone-50 p-3">
      <div className="text-[10px] font-black uppercase tracking-[0.14em] text-stone-500">
        {label}
      </div>
      <div className="mt-1 text-lg font-black text-stone-900">
        {value}
      </div>
    </div>
  );
}

function TagLine({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  if (!value) return null;

  return (
    <div className="text-xs leading-5 text-stone-600">
      <span className="font-black text-stone-800">{label}: </span>
      {value}
    </div>
  );
}

export default function OffRoadToolkit() {
  const [open, setOpen] = useState(false);
  const [activeTool, setActiveTool] = useState<ToolKey | null>(null);

  const [location, setLocation] = useState<LocationState | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState("");

  const [toolLoading, setToolLoading] = useState(false);
  const [toolError, setToolError] = useState("");
  const [payload, setPayload] = useState<ToolkitPayload | null>(null);

  const [heading, setHeading] = useState<number | null>(null);
  const [compassSupported, setCompassSupported] = useState(true);
  const [compassPermissionNeeded, setCompassPermissionNeeded] = useState(false);
  const [compassPermissionDenied, setCompassPermissionDenied] = useState(false);
  const [compassPermissionGranted, setCompassPermissionGranted] = useState(false);

  const direction = useMemo(
    () => cardinalDirection(heading),
    [heading]
  );

  const activeMeta = useMemo(
    () => TOOLS.find((tool) => tool.key === activeTool) ?? null,
    [activeTool]
  );

  useEffect(() => {
    if (activeTool !== "compass") return;
    if (typeof window === "undefined") return;

    const DeviceOrientationEventAny =
      window.DeviceOrientationEvent as typeof DeviceOrientationEvent & {
        requestPermission?: () => Promise<"granted" | "denied">;
      };

    if (!DeviceOrientationEventAny) {
      setCompassSupported(false);
      return;
    }

    if (
      typeof DeviceOrientationEventAny.requestPermission === "function" &&
      !compassPermissionGranted
    ) {
      setCompassPermissionNeeded(true);
      return;
    }

    setCompassPermissionNeeded(false);

    const handler = (event: DeviceOrientationEvent) => {
      const iosHeading =
        (event as DeviceOrientationEvent & {
          webkitCompassHeading?: number;
        }).webkitCompassHeading;

      let nextHeading: number | null = null;

      if (typeof iosHeading === "number") {
        nextHeading = iosHeading;
      } else if (typeof event.alpha === "number") {
        nextHeading = (360 - event.alpha + 360) % 360;
      }

      if (nextHeading != null) {
        setHeading(Math.round(nextHeading));
      }
    };

    window.addEventListener("deviceorientation", handler, true);

    return () => {
      window.removeEventListener("deviceorientation", handler, true);
    };
  }, [activeTool, compassPermissionGranted]);

  async function enableCompass() {
    try {
      const DeviceOrientationEventAny =
        window.DeviceOrientationEvent as typeof DeviceOrientationEvent & {
          requestPermission?: () => Promise<"granted" | "denied">;
        };

      if (!DeviceOrientationEventAny) {
        setCompassSupported(false);
        return;
      }

      if (typeof DeviceOrientationEventAny.requestPermission === "function") {
        const permission =
          await DeviceOrientationEventAny.requestPermission();

        if (permission !== "granted") {
          setCompassPermissionDenied(true);
          return;
        }
      }

      setCompassPermissionGranted(true);
      setCompassPermissionNeeded(false);
      setCompassPermissionDenied(false);
    } catch {
      setCompassPermissionDenied(true);
    }
  }

  async function loadTool(
    tool: ToolKey,
    coords: LocationState
  ) {
    if (tool === "compass") return;

    setToolLoading(true);
    setToolError("");
    setPayload(null);

    try {
      const params = new URLSearchParams({
        tool,
        lat: String(coords.latitude),
        lon: String(coords.longitude),
      });

      const response = await fetch(
        `/api/off-the-road/toolkit?${params.toString()}`,
        { cache: "no-store" }
      );

      const raw = await response.text();
      let data: ToolkitPayload | null = null;

      try {
        data = raw ? (JSON.parse(raw) as ToolkitPayload) : null;
      } catch {
        throw new Error(
          "The Off the Road Toolkit API is not loading. Make sure src/app/api/off-the-road/toolkit/route.ts exists, then restart npm run dev."
        );
      }

      if (!response.ok || !data?.ok) {
        throw new Error(
          data?.error ||
            `Toolkit API request failed (${response.status}).`
        );
      }

      setPayload(data);
    } catch (error) {
      setToolError(
        error instanceof Error
          ? error.message
          : "Could not load this tool."
      );
    } finally {
      setToolLoading(false);
    }
  }

  function requestLocation(tool: ToolKey) {
    if (!navigator.geolocation) {
      setLocationError(
        "Location services are not available in this browser."
      );
      return;
    }

    setLocationLoading(true);
    setLocationError("");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLocation: LocationState = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };

        setLocation(nextLocation);
        setLocationLoading(false);
        void loadTool(tool, nextLocation);
      },
      (error) => {
        setLocationLoading(false);

        if (error.code === error.PERMISSION_DENIED) {
          setLocationError(
            "Location permission was blocked. Allow location access and try again."
          );
          return;
        }

        setLocationError(
          "Your current location could not be determined."
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 30000,
      }
    );
  }

  function openTool(tool: ToolKey) {
    setActiveTool(tool);
    setToolError("");
    setLocationError("");
    setPayload(null);

    if (tool === "compass") return;

    if (location) {
      void loadTool(tool, location);
    } else {
      requestLocation(tool);
    }
  }

  async function refreshActiveTool() {
    if (!activeTool || activeTool === "compass") return;

    if (location) {
      await loadTool(activeTool, location);
    } else {
      requestLocation(activeTool);
    }
  }

  async function copyCoordinates() {
    if (!location) return;

    try {
      await navigator.clipboard.writeText(
        `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`
      );
    } catch {
      // Clipboard access can be blocked by some browsers.
    }
  }

  function mapsUrl(lat?: number, lon?: number) {
    const latitude = lat ?? location?.latitude;
    const longitude = lon ?? location?.longitude;

    if (latitude == null || longitude == null) return "#";

    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      `${latitude},${longitude}`
    )}`;
  }

  function directionsUrl(item: NearbyItem) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
      `${item.latitude},${item.longitude}`
    )}`;
  }

  function mapsSearchUrl(query: string) {
    if (!location) return "#";

    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      `${query} near ${location.latitude},${location.longitude}`
    )}`;
  }

  function closeToolkit() {
    setOpen(false);
    setActiveTool(null);
    setPayload(null);
    setToolError("");
    setLocationError("");
  }

  const current = payload?.weather?.current;
  const daily = payload?.weather?.daily ?? [];
  const items = payload?.items ?? [];
  const officialLinks = payload?.officialLinks ?? [];

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-[99980] flex items-center gap-3 rounded-full bg-[#3f512f] px-5 py-4 font-black text-white shadow-2xl transition hover:scale-105 hover:bg-[#52683d]"
          aria-label="Open Off the Road Toolkit"
        >
          <span className="text-2xl">🧭</span>
          <span className="hidden sm:inline">
            OTR Tools
          </span>
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-[99990]">
          <button
            type="button"
            aria-label="Close Off the Road Toolkit"
            onClick={closeToolkit}
            className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
          />

          <aside className="absolute bottom-0 right-0 top-0 w-full max-w-[520px] overflow-y-auto bg-[#f3efe5] shadow-2xl">
            <div className="sticky top-0 z-10 border-b border-black/10 bg-[#26301f] px-5 py-4 text-white">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.2em] text-[#d9c99b]">
                    TrippinDays
                  </div>
                  <h2 className="mt-1 text-2xl font-black">
                    Off the Road Toolkit
                  </h2>
                  <p className="mt-1 text-xs font-semibold text-white/65">
                    Trails. Terrain. Access. Conditions.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeToolkit}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/10 text-xl font-black hover:bg-white/20"
                  aria-label="Close toolkit"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-5">
              {activeTool ? (
                <div>
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTool(null);
                        setPayload(null);
                        setToolError("");
                        setLocationError("");
                      }}
                      className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-black text-stone-700"
                    >
                      ← Back to Toolkit
                    </button>

                    {activeTool !== "compass" && (
                      <button
                        type="button"
                        onClick={() => void refreshActiveTool()}
                        className="rounded-full bg-[#3f512f] px-4 py-2 text-sm font-black text-white"
                      >
                        ↻ Refresh
                      </button>
                    )}
                  </div>

                  <div className="mb-4 rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className="text-3xl">
                        {activeMeta?.icon}
                      </div>
                      <div>
                        <div className="text-xs font-black uppercase tracking-[0.18em] text-[#52683d]">
                          Off the Road Tool
                        </div>
                        <h3 className="mt-1 text-2xl font-black text-stone-900">
                          {activeMeta?.title}
                        </h3>
                        <p className="mt-1 text-sm font-semibold leading-6 text-stone-500">
                          {activeMeta?.description}
                        </p>
                      </div>
                    </div>
                  </div>

                  {activeTool === "compass" ? (
                    <div className="rounded-3xl border border-stone-200 bg-white p-6 text-center shadow-sm">
                      <div className="text-xs font-black uppercase tracking-[0.2em] text-[#52683d]">
                        Live Compass
                      </div>

                      <div className="relative mx-auto mt-6 flex h-64 w-64 items-center justify-center rounded-full border-[10px] border-[#26301f] bg-[#ede8da] shadow-inner">
                        <div className="absolute top-3 text-sm font-black text-red-700">
                          N
                        </div>
                        <div className="absolute bottom-3 text-sm font-black">
                          S
                        </div>
                        <div className="absolute left-3 text-sm font-black">
                          W
                        </div>
                        <div className="absolute right-3 text-sm font-black">
                          E
                        </div>

                        <div
                          className="absolute left-1/2 top-1/2 h-[92px] w-1 -translate-x-1/2 -translate-y-full origin-bottom rounded-full bg-red-600 transition-transform duration-150"
                          style={{
                            transform: `translate(-50%, -100%) rotate(${
                              heading ?? 0
                            }deg)`,
                          }}
                        />

                        <div className="z-10 flex h-16 w-16 items-center justify-center rounded-full bg-[#26301f] text-xl font-black text-white shadow-lg">
                          {direction}
                        </div>
                      </div>

                      <div className="mt-5 text-4xl font-black text-stone-900">
                        {heading == null ? "—" : `${heading}°`}
                      </div>

                      <div className="mt-1 text-sm font-black text-[#52683d]">
                        {direction}
                      </div>

                      {!compassSupported && (
                        <div className="mt-5 rounded-2xl bg-stone-100 p-4 text-sm font-semibold text-stone-700">
                          Compass sensors are not available on this device/browser.
                        </div>
                      )}

                      {compassPermissionNeeded && (
                        <button
                          type="button"
                          onClick={enableCompass}
                          className="mt-5 w-full rounded-2xl bg-[#3f512f] px-5 py-3 font-black text-white"
                        >
                          Enable Compass
                        </button>
                      )}

                      {compassPermissionDenied && (
                        <div className="mt-5 rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm font-semibold text-orange-900">
                          Compass permission was not granted. Allow motion/orientation access in your browser settings and try again.
                        </div>
                      )}

                      <p className="mt-5 text-xs leading-5 text-stone-500">
                        Phone compasses can be affected by magnets, vehicles and nearby metal. Use a dedicated navigation device or paper map for critical backcountry navigation.
                      </p>
                    </div>
                  ) : (
                    <>
                      {(locationLoading || toolLoading) && (
                        <div className="rounded-3xl border border-stone-200 bg-white p-6 text-center shadow-sm">
                          <div className="text-3xl">🧭</div>
                          <div className="mt-3 font-black text-stone-900">
                            {locationLoading
                              ? "Getting your current location..."
                              : "Loading current information..."}
                          </div>
                        </div>
                      )}

                      {locationError && (
                        <div className="rounded-3xl border border-orange-200 bg-orange-50 p-5">
                          <div className="font-black text-orange-950">
                            Location needed
                          </div>
                          <p className="mt-2 text-sm font-semibold leading-6 text-orange-900">
                            {locationError}
                          </p>
                          <button
                            type="button"
                            onClick={() => activeTool && requestLocation(activeTool)}
                            className="mt-4 rounded-2xl bg-orange-600 px-5 py-3 font-black text-white"
                          >
                            Use My Location
                          </button>
                        </div>
                      )}

                      {toolError && (
                        <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-900">
                          {toolError}
                        </div>
                      )}

                      {payload && (
                        <>
                          <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
                            <div className="text-xs font-black uppercase tracking-[0.18em] text-[#52683d]">
                              Current Area
                            </div>

                            <div className="mt-2 text-lg font-black text-stone-900">
                              {payload.location?.label ||
                                `${payload.location?.latitude.toFixed(5)}, ${payload.location?.longitude.toFixed(5)}`}
                            </div>

                            <div className="mt-1 text-xs font-semibold text-stone-500">
                              GPS-based toolkit results
                            </div>
                          </div>

                          {activeTool === "weather" && current && (
                            <div className="mt-4 space-y-4">
                              <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
                                <div className="text-xl font-black text-stone-900">
                                  {weatherLabel(current.weatherCode)}
                                </div>

                                <div className="mt-4 grid grid-cols-2 gap-3">
                                  <ToolMetric
                                    label="Temperature"
                                    value={`${formatNumber(current.temperatureF)}°F`}
                                  />
                                  <ToolMetric
                                    label="Feels Like"
                                    value={`${formatNumber(current.apparentTemperatureF)}°F`}
                                  />
                                  <ToolMetric
                                    label="Wind"
                                    value={`${formatNumber(current.windMph)} mph`}
                                  />
                                  <ToolMetric
                                    label="Gusts"
                                    value={`${formatNumber(current.windGustMph)} mph`}
                                  />
                                  <ToolMetric
                                    label="Precipitation"
                                    value={`${formatNumber(current.precipitationIn, 2)} in`}
                                  />
                                  <ToolMetric
                                    label="Visibility"
                                    value={`${formatNumber(current.visibilityMiles, 1)} mi`}
                                  />
                                </div>
                              </div>

                              {daily.length > 0 && (
                                <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
                                  <div className="font-black text-stone-900">
                                    3-Day Forecast
                                  </div>

                                  <div className="mt-3 space-y-2">
                                    {daily.slice(0, 3).map((day) => (
                                      <div
                                        key={day.date}
                                        className="flex items-center justify-between rounded-2xl bg-stone-50 p-3"
                                      >
                                        <div className="text-sm font-black">
                                          {new Date(
                                            `${day.date}T12:00:00`
                                          ).toLocaleDateString(undefined, {
                                            weekday: "short",
                                            month: "short",
                                            day: "numeric",
                                          })}
                                        </div>

                                        <div className="text-right text-xs font-bold text-stone-600">
                                          {formatNumber(day.highF)}° /{" "}
                                          {formatNumber(day.lowF)}°
                                          <br />
                                          Rain {formatNumber(day.precipitationIn, 2)} in
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {activeTool === "snow" && current && (
                            <div className="mt-4 space-y-4">
                              <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
                                <div className="grid grid-cols-2 gap-3">
                                  <ToolMetric
                                    label="Current Snowfall"
                                    value={`${formatNumber(current.snowfallIn, 2)} in`}
                                  />
                                  <ToolMetric
                                    label="Modeled Snow Depth"
                                    value={`${formatNumber(current.snowDepthIn, 1)} in`}
                                  />
                                </div>

                                <div className="mt-4 space-y-2">
                                  {daily.slice(0, 3).map((day) => (
                                    <div
                                      key={day.date}
                                      className="flex items-center justify-between rounded-2xl bg-stone-50 p-3"
                                    >
                                      <span className="text-sm font-black">
                                        {new Date(
                                          `${day.date}T12:00:00`
                                        ).toLocaleDateString(undefined, {
                                          weekday: "short",
                                        })}
                                      </span>
                                      <span className="text-sm font-black text-[#52683d]">
                                        {formatNumber(day.snowfallIn, 1)} in forecast snow
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 text-xs font-semibold leading-5 text-orange-900">
                                Snow values are modeled weather data. Confirm resort, trail, Sno-Park and road status before leaving.
                              </div>
                            </div>
                          )}

                          {activeTool === "daylight" && daily[0] && (
                            <div className="mt-4 rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
                              <div className="grid grid-cols-2 gap-3">
                                <ToolMetric
                                  label="Sunrise"
                                  value={
                                    daily[0].sunrise
                                      ? new Date(daily[0].sunrise).toLocaleTimeString(
                                          [],
                                          {
                                            hour: "numeric",
                                            minute: "2-digit",
                                          }
                                        )
                                      : "—"
                                  }
                                />
                                <ToolMetric
                                  label="Sunset"
                                  value={
                                    daily[0].sunset
                                      ? new Date(daily[0].sunset).toLocaleTimeString(
                                          [],
                                          {
                                            hour: "numeric",
                                            minute: "2-digit",
                                          }
                                        )
                                      : "—"
                                  }
                                />
                              </div>
                            </div>
                          )}

                          {activeTool === "terrain" && (
                            <div className="mt-4 space-y-4">
                              <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
                                <div className="grid grid-cols-2 gap-3">
                                  <ToolMetric
                                    label="Elevation"
                                    value={`${formatNumber(
                                      payload.weather?.elevationFeet
                                    )} ft`}
                                  />
                                  <ToolMetric
                                    label="GPS Accuracy"
                                    value={
                                      location?.accuracy
                                        ? `±${formatNumber(
                                            location.accuracy * 3.28084
                                          )} ft`
                                        : "—"
                                    }
                                  />
                                </div>
                              </div>

                              <a
                                href={mapsUrl()}
                                target="_blank"
                                rel="noreferrer"
                                className="block rounded-2xl bg-[#3f512f] px-5 py-3 text-center font-black text-white"
                              >
                                Open Terrain Area in Maps
                              </a>
                            </div>
                          )}

                          {activeTool === "avalanche" && (
                            <div className="mt-4 space-y-4">
                              {current && (
                                <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
                                  <div className="grid grid-cols-2 gap-3">
                                    <ToolMetric
                                      label="Temperature"
                                      value={`${formatNumber(current.temperatureF)}°F`}
                                    />
                                    <ToolMetric
                                      label="Wind Gust"
                                      value={`${formatNumber(current.windGustMph)} mph`}
                                    />
                                    <ToolMetric
                                      label="Snowfall"
                                      value={`${formatNumber(current.snowfallIn, 2)} in`}
                                    />
                                    <ToolMetric
                                      label="Snow Depth"
                                      value={`${formatNumber(current.snowDepthIn, 1)} in`}
                                    />
                                  </div>
                                </div>
                              )}

                              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold leading-6 text-red-900">
                                TrippinDays does not calculate avalanche danger. Use the official forecast for your exact forecast zone before entering avalanche terrain.
                              </div>
                            </div>
                          )}

                          {activeTool === "navigation" && (
                            <div className="mt-4 space-y-3">
                              <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
                                <div className="font-black text-stone-900">
                                  Current Coordinates
                                </div>
                                <div className="mt-2 font-mono text-sm">
                                  {location?.latitude.toFixed(6)},{" "}
                                  {location?.longitude.toFixed(6)}
                                </div>

                                <div className="mt-4 grid grid-cols-2 gap-2">
                                  <button
                                    type="button"
                                    onClick={() => void copyCoordinates()}
                                    className="rounded-xl border border-stone-300 bg-white px-3 py-3 text-sm font-black"
                                  >
                                    Copy Coordinates
                                  </button>

                                  <a
                                    href={mapsUrl()}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="rounded-xl bg-[#3f512f] px-3 py-3 text-center text-sm font-black text-white"
                                  >
                                    Open Maps
                                  </a>
                                </div>
                              </div>
                            </div>
                          )}

                          {[
                            "trail",
                            "bouldering",
                            "road",
                            "permits",
                            "vehicle",
                            "camping",
                            "fuel-food",
                            "safety",
                          ].includes(activeTool) && (
                            <div className="mt-4 space-y-3">
                              {items.length === 0 ? (
                                <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
                                  <div className="font-black text-stone-900">
                                    Nearby lookup did not return places
                                  </div>

                                  <p className="mt-2 text-sm font-semibold leading-6 text-stone-600">
                                    {payload.nearbyError
                                      ? "The OpenStreetMap nearby service did not answer correctly. You can still use the quick search buttons below while TrippinDays retries on Refresh."
                                      : "No matching places were returned from the nearby map lookup for this exact search."}
                                  </p>

                                  {payload.nearbyError && (
                                    <div className="mt-3 rounded-xl bg-orange-50 p-3 text-xs font-semibold leading-5 text-orange-900">
                                      Data source message: {payload.nearbyError}
                                    </div>
                                  )}

                                  {activeTool === "fuel-food" && (
                                    <div className="mt-4 grid grid-cols-2 gap-2">
                                      <a
                                        href={mapsSearchUrl("gas stations")}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="rounded-xl bg-[#3f512f] px-3 py-3 text-center text-sm font-black text-white"
                                      >
                                        ⛽ Find Fuel
                                      </a>

                                      <a
                                        href={mapsSearchUrl("restaurants")}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="rounded-xl bg-orange-600 px-3 py-3 text-center text-sm font-black text-white"
                                      >
                                        🍽️ Find Food
                                      </a>
                                    </div>
                                  )}

                                  {activeTool === "camping" && (
                                    <a
                                      href={mapsSearchUrl("campgrounds")}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="mt-4 block rounded-xl bg-[#3f512f] px-3 py-3 text-center text-sm font-black text-white"
                                    >
                                      🏕️ Search Campgrounds
                                    </a>
                                  )}

                                  {activeTool === "safety" && (
                                    <div className="mt-4 grid grid-cols-2 gap-2">
                                      <a
                                        href={mapsSearchUrl("hospitals")}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="rounded-xl bg-red-700 px-3 py-3 text-center text-sm font-black text-white"
                                      >
                                        🏥 Hospitals
                                      </a>

                                      <a
                                        href={mapsSearchUrl("urgent care")}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="rounded-xl bg-[#3f512f] px-3 py-3 text-center text-sm font-black text-white"
                                      >
                                        🩺 Urgent Care
                                      </a>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                items.map((item) => (
                                  <div
                                    key={item.id}
                                    className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm"
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div>
                                        <div className="text-lg font-black text-stone-900">
                                          {item.name}
                                        </div>
                                        <div className="mt-1 text-xs font-bold text-[#52683d]">
                                          {item.kind || "Nearby result"}
                                          {item.distanceMiles != null
                                            ? ` • ${item.distanceMiles.toFixed(1)} mi`
                                            : ""}
                                        </div>
                                      </div>
                                    </div>

                                    {activeTool === "trail" && (
                                      <div className="mt-3">
                                        <TagLine
                                          label="Surface"
                                          value={item.tags?.surface}
                                        />
                                        <TagLine
                                          label="Access"
                                          value={item.tags?.access}
                                        />
                                        <TagLine
                                          label="Difficulty"
                                          value={
                                            item.tags?.sac_scale ||
                                            item.tags?.mtb_scale
                                          }
                                        />
                                        <TagLine
                                          label="Trail visibility"
                                          value={item.tags?.trail_visibility}
                                        />
                                      </div>
                                    )}

                                    {activeTool === "road" && (
                                      <div className="mt-3">
                                        <TagLine
                                          label="Road type"
                                          value={item.tags?.highway}
                                        />
                                        <TagLine
                                          label="Surface"
                                          value={item.tags?.surface}
                                        />
                                        <TagLine
                                          label="Access"
                                          value={item.tags?.access}
                                        />
                                        <TagLine
                                          label="Gate"
                                          value={item.tags?.barrier}
                                        />
                                      </div>
                                    )}

                                    {activeTool === "vehicle" && (
                                      <div className="mt-3">
                                        <TagLine
                                          label="Motor vehicle"
                                          value={item.tags?.motor_vehicle}
                                        />
                                        <TagLine
                                          label="Motorcycle"
                                          value={item.tags?.motorcycle}
                                        />
                                        <TagLine
                                          label="ATV"
                                          value={item.tags?.atv}
                                        />
                                        <TagLine
                                          label="4WD"
                                          value={item.tags?.["4wd_only"]}
                                        />
                                        <TagLine
                                          label="Access"
                                          value={item.tags?.access}
                                        />
                                      </div>
                                    )}

                                    {activeTool === "permits" && (
                                      <div className="mt-3">
                                        <TagLine
                                          label="Protected area"
                                          value={
                                            item.tags?.protect_class ||
                                            item.tags?.boundary
                                          }
                                        />
                                        <TagLine
                                          label="Operator"
                                          value={item.tags?.operator}
                                        />
                                      </div>
                                    )}

                                    {activeTool === "safety" && (
                                      <div className="mt-3">
                                        <TagLine
                                          label="Emergency service"
                                          value={item.tags?.amenity}
                                        />
                                        <TagLine
                                          label="Phone"
                                          value={item.tags?.phone}
                                        />
                                      </div>
                                    )}

                                    <div className="mt-4 flex flex-wrap gap-2">
                                      <a
                                        href={directionsUrl(item)}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="rounded-xl bg-[#3f512f] px-4 py-2 text-xs font-black text-white"
                                      >
                                        Directions
                                      </a>

                                      {item.website && (
                                        <a
                                          href={item.website}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-xs font-black text-stone-800"
                                        >
                                          Website
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          )}

                          {activeTool === "hunting" && (
                            <div className="mt-4 rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
                              <div className="font-black text-stone-900">
                                Official rules only
                              </div>
                              <p className="mt-2 text-sm font-semibold leading-6 text-stone-600">
                                Hunting seasons, units, tags, legal methods and bag limits change by jurisdiction. TrippinDays will not guess them. Use the official wildlife agency for the area shown above.
                              </p>
                            </div>
                          )}

                          {payload.note && (
                            <div className="mt-4 rounded-2xl border border-orange-200 bg-orange-50 p-4 text-xs font-semibold leading-5 text-orange-900">
                              {payload.note}
                            </div>
                          )}

                          {officialLinks.length > 0 && (
                            <div className="mt-4 rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
                              <div className="font-black text-stone-900">
                                Official / Trusted Sources
                              </div>

                              <div className="mt-3 grid gap-2">
                                {officialLinks.map((link) => (
                                  <a
                                    key={`${link.label}-${link.url}`}
                                    href={link.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="rounded-xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm font-black text-[#3f512f] hover:bg-stone-100"
                                  >
                                    {link.label} →
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}

                          {location && (
                            <div className="mt-4 rounded-2xl border border-stone-200 bg-white p-4 text-xs font-semibold leading-5 text-stone-500">
                              Coordinates: {location.latitude.toFixed(5)},{" "}
                              {location.longitude.toFixed(5)}
                              {location.accuracy
                                ? ` • GPS accuracy about ${Math.round(
                                    location.accuracy * 3.28084
                                  )} ft`
                                : ""}
                            </div>
                          )}
                        </>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    {TOOLS.map((tool) => (
                      <button
                        key={tool.key}
                        type="button"
                        onClick={() => openTool(tool.key)}
                        className="rounded-2xl border border-stone-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#7a8f58] hover:shadow-md"
                      >
                        <div className="text-2xl">{tool.icon}</div>
                        <div className="mt-3 text-sm font-black text-stone-900">
                          {tool.title}
                        </div>
                        <div className="mt-1 text-xs leading-5 text-stone-500">
                          {tool.description}
                        </div>
                      </button>
                    ))}
                  </div>

                  <div className="mt-5 rounded-2xl border border-orange-200 bg-orange-50 p-4">
                    <div className="font-black text-orange-950">
                      ⚠️ Check Before You Go
                    </div>
                    <p className="mt-2 text-xs font-semibold leading-5 text-orange-900">
                      Conditions, closures, permits and legal-use rules can change. Regulation-heavy tools intentionally link you to official sources instead of guessing.
                    </p>
                  </div>
                </>
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
