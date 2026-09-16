"use client";

import {
  useEffect,
  useState,
  type ReactNode,
} from "react";

type SavedWaterLocation = {
  name: string;
  latitude: number;
  longitude: number;
  state?: string;
  source?: "gps" | "search";
};

type ConditionsData = {
  success: boolean;

  updatedAt?: string;

  weather?: {
    current?: {
      temperatureF?: number | null;
      feelsLikeF?: number | null;
      description?: string;
      windSpeedMph?: number | null;
      windGustMph?: number | null;
      windDirection?: string | null;
    };

    daily?: {
      sunrise?: string[];
      sunset?: string[];
    } | null;
  };

  marine?: {
    available?: boolean;

    current?: {
      waveHeightFt?: number | null;
      waveDirection?: string | null;
      wavePeriodSeconds?: number | null;

      swellHeightFt?: number | null;
      swellDirection?: string | null;
      swellPeriodSeconds?: number | null;

      waterTemperatureF?: number | null;

      currentSpeedMph?: number | null;
      currentDirection?: string | null;

      seaLevelHeightFt?: number | null;
      tideTrend?: string;
    } | null;
  };
};

type FloatPlan = {
  people: string;
  vessel: string;
  vesselColor: string;
  launchPoint: string;
  destination: string;
  expectedReturn: string;
  emergencyContact: string;
};

type ToolkitTab =
  | "conditions"
  | "tools"
  | "float"
  | "sos";

const emptyFloatPlan: FloatPlan = {
  people: "",
  vessel: "",
  vesselColor: "",
  launchPoint: "",
  destination: "",
  expectedReturn: "",
  emergencyContact: "",
};

export default function WaterToolkit() {
  const [
    open,
    setOpen,
  ] = useState(false);

  const [
    tab,
    setTab,
  ] =
    useState<ToolkitTab>(
      "conditions"
    );

  const [
    currentLocation,
    setCurrentLocation,
  ] =
    useState<SavedWaterLocation | null>(
      null
    );

  const [
    conditionsLocation,
    setConditionsLocation,
  ] =
    useState<SavedWaterLocation | null>(
      null
    );

  const conditionsTarget =
    conditionsLocation || currentLocation;

  const [
    conditions,
    setConditions,
  ] =
    useState<ConditionsData | null>(
      null
    );

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    status,
    setStatus,
  ] = useState("");

  const [
    heading,
    setHeading,
  ] =
    useState<number | null>(
      null
    );

  const [
    compassRunning,
    setCompassRunning,
  ] = useState(false);

  const [
    floatPlan,
    setFloatPlan,
  ] =
    useState<FloatPlan>(
      emptyFloatPlan
    );

  /*
  ==================================
  LOAD SAVED DATA
  ==================================
  */

  useEffect(() => {
    try {
      const savedLocation =
        localStorage.getItem(
          "trippindays-water-location"
        );

      if (savedLocation) {
        const parsedCurrent =
          JSON.parse(
            savedLocation
          ) as SavedWaterLocation;

        setCurrentLocation(
          parsedCurrent
        );

        setConditionsLocation(
          (existing) =>
            existing ||
            parsedCurrent
        );
      }

      const savedToolkitLocation =
        localStorage.getItem(
          "trippindays-water-toolkit-location"
        );

      if (savedToolkitLocation) {
        setConditionsLocation(
          JSON.parse(
            savedToolkitLocation
          )
        );
      }

      const savedPlan =
        localStorage.getItem(
          "trippindays-water-float-plan"
        );

      if (savedPlan) {
        setFloatPlan(
          JSON.parse(
            savedPlan
          )
        );
      }
    } catch (error) {
      console.error(
        "Water Toolkit storage error:",
        error
      );
    }
  }, []);

  /*
  ==================================
  REFRESH CONDITIONS WHEN OPENED
  ==================================
  */

  useEffect(() => {
    if (
      open &&
      conditionsTarget
    ) {
      loadConditions(
        conditionsTarget
      );
    }
  }, [
    open,
    conditionsTarget?.latitude,
    conditionsTarget?.longitude,
  ]);

  /*
  ==================================
  PLANNER / DESTINATION EVENTS

  A selected water destination is not the user's current GPS
  position. Keep them separate so destination conditions never
  overwrite SOS, Float Plan, or shared current-location coordinates.
  ==================================
  */

  useEffect(() => {
    function handleWaterDestination(event: Event) {
      const customEvent =
        event as CustomEvent<SavedWaterLocation>;

      const next =
        customEvent.detail;

      if (
        !next ||
        !Number.isFinite(
          Number(next.latitude)
        ) ||
        !Number.isFinite(
          Number(next.longitude)
        )
      ) {
        return;
      }

      setConditionsLocation(
        next
      );

      try {
        localStorage.setItem(
          "trippindays-water-toolkit-location",
          JSON.stringify(next)
        );
      } catch {}
    }

    function handleOpenToolkit(event: Event) {
      const customEvent =
        event as CustomEvent<{
          tab?: ToolkitTab;
          location?: SavedWaterLocation;
        }>;

      const detail =
        customEvent.detail;

      if (
        detail?.tab === "conditions" ||
        detail?.tab === "tools" ||
        detail?.tab === "float" ||
        detail?.tab === "sos"
      ) {
        setTab(detail.tab);
      }

      if (
        detail?.location &&
        Number.isFinite(
          Number(
            detail.location.latitude
          )
        ) &&
        Number.isFinite(
          Number(
            detail.location.longitude
          )
        )
      ) {
        setConditionsLocation(
          detail.location
        );

        try {
          localStorage.setItem(
            "trippindays-water-toolkit-location",
            JSON.stringify(
              detail.location
            )
          );
        } catch {}
      }

      setOpen(true);
    }

    window.addEventListener(
      "trippindays:water-destination",
      handleWaterDestination
    );

    window.addEventListener(
      "trippindays:open-water-toolkit",
      handleOpenToolkit
    );

    return () => {
      window.removeEventListener(
        "trippindays:water-destination",
        handleWaterDestination
      );

      window.removeEventListener(
        "trippindays:open-water-toolkit",
        handleOpenToolkit
      );
    };
  }, []);

  /*
  ==================================
  ESCAPE CLOSE
  ==================================
  */

  useEffect(() => {
    function handleKey(
      event: KeyboardEvent
    ) {
      if (
        event.key ===
        "Escape"
      ) {
        setOpen(false);
      }
    }

    window.addEventListener(
      "keydown",
      handleKey
    );

    return () =>
      window.removeEventListener(
        "keydown",
        handleKey
      );
  }, []);

  /*
  ==================================
  LIVE CONDITIONS
  ==================================
  */

  async function loadConditions(
    waterLocation: SavedWaterLocation
  ) {
    setLoading(true);

    try {
      const response =
        await fetch(
          `/api/on-the-water/conditions?lat=${waterLocation.latitude}&lon=${waterLocation.longitude}`
        );

      const data =
        await response.json();

      if (
        response.ok &&
        data.success
      ) {
        setConditions(
          data
        );
      } else {
        setStatus(
          "Live conditions could not be loaded."
        );
      }
    } catch (error) {
      console.error(
        error
      );

      setStatus(
        "Live conditions could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }

  /*
  ==================================
  GPS
  ==================================
  */

  function useCurrentGps() {
    setStatus("");

    if (
      !navigator.geolocation
    ) {
      setStatus(
        "GPS is not supported on this device."
      );

      return;
    }

    setLoading(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const current: SavedWaterLocation =
          {
            name:
              "Current Location",

            latitude:
              position.coords
                .latitude,

            longitude:
              position.coords
                .longitude,

            source: "gps",
          };

        setCurrentLocation(
          current
        );

        setConditionsLocation(
          current
        );

        try {
          localStorage.removeItem(
            "trippindays-water-toolkit-location"
          );
        } catch {}

        localStorage.setItem(
          "trippindays-water-location",
          JSON.stringify(
            current
          )
        );

        setStatus(
          "Current GPS location updated."
        );

        setLoading(false);
      },

      () => {
        setLoading(false);

        setStatus(
          "We couldn't get your current GPS location."
        );
      },

      {
        enableHighAccuracy:
          true,

        timeout: 15000,

        maximumAge: 30000,
      }
    );
  }

  /*
  ==================================
  COMPASS
  ==================================
  */

  async function startCompass() {
    setStatus("");

    if (
      typeof window ===
      "undefined"
    ) {
      return;
    }

    const Orientation =
      window.DeviceOrientationEvent as typeof DeviceOrientationEvent & {
        requestPermission?: () =>
          Promise<
            "granted" | "denied"
          >;
      };

    try {
      if (
        typeof Orientation
          ?.requestPermission ===
        "function"
      ) {
        const permission =
          await Orientation.requestPermission();

        if (
          permission !==
          "granted"
        ) {
          setStatus(
            "Compass permission was not granted."
          );

          return;
        }
      }

      window.addEventListener(
        "deviceorientation",
        handleOrientation,
        true
      );

      setCompassRunning(
        true
      );

      setStatus(
        "Compass started."
      );
    } catch (error) {
      console.error(
        error
      );

      setStatus(
        "Compass is not available on this device or browser."
      );
    }
  }

  function stopCompass() {
    window.removeEventListener(
      "deviceorientation",
      handleOrientation,
      true
    );

    setCompassRunning(
      false
    );
  }

  function handleOrientation(
    event: DeviceOrientationEvent
  ) {
    const compassEvent =
      event as DeviceOrientationEvent & {
        webkitCompassHeading?: number;
      };

    let value:
      | number
      | null = null;

    if (
      typeof compassEvent.webkitCompassHeading ===
      "number"
    ) {
      value =
        compassEvent.webkitCompassHeading;
    } else if (
      typeof event.alpha ===
      "number"
    ) {
      value =
        360 -
        event.alpha;
    }

    if (
      value !== null
    ) {
      setHeading(
        Math.round(
          (value + 360) %
            360
        )
      );
    }
  }

  useEffect(() => {
    return () => {
      window.removeEventListener(
        "deviceorientation",
        handleOrientation,
        true
      );
    };
  }, []);

  /*
  ==================================
  COPY GPS
  ==================================
  */

  async function copyCoordinates() {
    if (
      !currentLocation ||
      currentLocation.source !== "gps"
    ) {
      setStatus(
        "No GPS coordinates are available."
      );

      return;
    }

    const text =
      `${currentLocation.latitude.toFixed(
        6
      )}, ${currentLocation.longitude.toFixed(
        6
      )}`;

    try {
      await navigator.clipboard.writeText(
        text
      );

      setStatus(
        "Coordinates copied."
      );
    } catch {
      setStatus(
        text
      );
    }
  }

  /*
  ==================================
  SHARE LOCATION
  ==================================
  */

  async function shareLocation() {
    if (
      !currentLocation ||
      currentLocation.source !== "gps"
    ) {
      setStatus(
        "No GPS location is available."
      );

      return;
    }

    const coordinates =
      `${currentLocation.latitude.toFixed(
        6
      )}, ${currentLocation.longitude.toFixed(
        6
      )}`;

    const mapsUrl =
      `https://www.google.com/maps?q=${currentLocation.latitude},${currentLocation.longitude}`;

    const text =
      `My current location: ${coordinates}\n${mapsUrl}`;

    try {
      if (
        navigator.share
      ) {
        await navigator.share({
          title:
            "My Current Location",

          text,
        });

        return;
      }

      await navigator.clipboard.writeText(
        text
      );

      setStatus(
        "Location copied so you can share it."
      );
    } catch {
      // User may simply cancel share.
    }
  }

  /*
  ==================================
  NEARBY MAP SEARCH
  ==================================
  */

  function searchNearby(
    query: string
  ) {
    const nearbyLocation =
      conditionsTarget;

    if (!nearbyLocation) {
      setStatus(
        "Choose a water destination or use Current GPS first."
      );

      return;
    }

    const search =
      encodeURIComponent(
        `${query} near ${nearbyLocation.latitude},${nearbyLocation.longitude}`
      );

    window.open(
      `https://www.google.com/maps/search/?api=1&query=${search}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  /*
  ==================================
  FLOAT PLAN
  ==================================
  */

  function updatePlan(
    field: keyof FloatPlan,
    value: string
  ) {
    setFloatPlan(
      (current) => ({
        ...current,
        [field]:
          value,
      })
    );
  }

  function saveFloatPlan() {
    localStorage.setItem(
      "trippindays-water-float-plan",
      JSON.stringify(
        floatPlan
      )
    );

    setStatus(
      "Float Plan saved on this device."
    );
  }

  function clearFloatPlan() {
    setFloatPlan(
      emptyFloatPlan
    );

    localStorage.removeItem(
      "trippindays-water-float-plan"
    );

    setStatus(
      "Float Plan cleared."
    );
  }

  function buildFloatPlanText() {
    const coords =
      currentLocation?.source === "gps"
        ? `${currentLocation.latitude.toFixed(
            6
          )}, ${currentLocation.longitude.toFixed(
            6
          )}`
        : "Not available";

    return `TRIPPINDAYS FLOAT PLAN

People aboard: ${floatPlan.people || "Not entered"}
Vessel: ${floatPlan.vessel || "Not entered"}
Vessel color: ${floatPlan.vesselColor || "Not entered"}
Launch point: ${floatPlan.launchPoint || "Not entered"}
Destination: ${floatPlan.destination || "Not entered"}
Expected return: ${floatPlan.expectedReturn || "Not entered"}
Emergency contact: ${floatPlan.emergencyContact || "Not entered"}

Current coordinates:
${coords}

This Float Plan is informational and does not replace official emergency or maritime safety services.`;
  }

  async function shareFloatPlan() {
    const text =
      buildFloatPlanText();

    try {
      if (
        navigator.share
      ) {
        await navigator.share({
          title:
            "My Float Plan",

          text,
        });

        return;
      }

      await navigator.clipboard.writeText(
        text
      );

      setStatus(
        "Float Plan copied so you can share it."
      );
    } catch {
      // Share cancelled.
    }
  }

  /*
  ==================================
  DATA HELPERS
  ==================================
  */

  const weather =
    conditions?.weather
      ?.current;

  const marine =
    conditions?.marine
      ?.current;

  const sunrise =
    conditions?.weather
      ?.daily?.sunrise?.[0];

  const sunset =
    conditions?.weather
      ?.daily?.sunset?.[0];

  return (
    <>
      {/* =================================
          FLOATING BUTTON
      ================================= */}

      {!open && (
        <button
          type="button"
          onClick={() =>
            setOpen(true)
          }
          className="fixed bottom-5 right-5 z-[99980] flex items-center gap-3 rounded-full bg-[#063e5b] px-5 py-4 font-black text-white shadow-2xl transition hover:scale-105 hover:bg-[#075b80]"
          aria-label="Open On the Water Toolkit"
        >
          <span className="text-2xl">
            🧭
          </span>

          <span className="hidden sm:inline">
            Water Toolkit
          </span>
        </button>
      )}

      {/* =================================
          BACKDROP
      ================================= */}

      {open && (
        <button
          type="button"
          aria-label="Close Water Toolkit"
          onClick={() =>
            setOpen(false)
          }
          className="fixed inset-0 z-[99990] bg-slate-950/40 backdrop-blur-[1px]"
        />
      )}

      {/* =================================
          TOOLKIT DRAWER
      ================================= */}

      <aside
        className={`fixed inset-y-0 right-0 z-[99999] w-full max-w-[470px] transform overflow-y-auto bg-[#eef7fa] shadow-2xl transition-transform duration-300 ${
          open
            ? "translate-x-0"
            : "translate-x-full"
        }`}
      >
        {/* HEADER */}

        <div className="sticky top-0 z-10 bg-[#063e5b] px-5 pb-4 pt-5 text-white shadow-md">

          <div className="flex items-start justify-between gap-4">

            <div>

              <div className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">
                TrippinDays
              </div>

              <h2 className="mt-1 text-2xl font-black">
                🌊 Water Toolkit
              </h2>

              <p className="mt-1 text-sm text-cyan-100">
                Conditions, navigation tools and safety.
              </p>

            </div>

            <button
              type="button"
              onClick={() =>
                setOpen(false)
              }
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-xl font-black hover:bg-white/20"
            >
              ×
            </button>

          </div>

          {/* LOCATION */}

          <div className="mt-4 grid gap-2 sm:grid-cols-2">

            <div className="rounded-xl bg-white/10 p-3">
              <div className="text-xs font-black uppercase tracking-wider text-cyan-200">
                {currentLocation?.source === "gps"
                  ? "Current GPS Location"
                  : "Starting Location"}
              </div>

              {currentLocation ? (
                <>
                  <div className="mt-1 font-black">
                    📍{" "}
                    {currentLocation.name}

                    {currentLocation.state
                      ? `, ${currentLocation.state}`
                      : ""}
                  </div>

                  <div className="mt-1 text-xs text-cyan-100">
                    {currentLocation.latitude.toFixed(
                      5
                    )}
                    ,{" "}
                    {currentLocation.longitude.toFixed(
                      5
                    )}
                  </div>
                </>
              ) : (
                <div className="mt-1 text-sm text-cyan-100">
                  GPS not loaded
                </div>
              )}

              <button
                type="button"
                onClick={
                  useCurrentGps
                }
                className="mt-3 rounded-lg bg-white px-3 py-2 text-xs font-black text-[#063e5b]"
              >
                📍 Use Current GPS
              </button>
            </div>

            <div className="rounded-xl bg-white/10 p-3">
              <div className="text-xs font-black uppercase tracking-wider text-cyan-200">
                Conditions For
              </div>

              {conditionsTarget ? (
                <>
                  <div className="mt-1 font-black">
                    🌊{" "}
                    {conditionsTarget.name}

                    {conditionsTarget.state
                      ? `, ${conditionsTarget.state}`
                      : ""}
                  </div>

                  <div className="mt-1 text-xs text-cyan-100">
                    {conditionsTarget.latitude.toFixed(
                      5
                    )}
                    ,{" "}
                    {conditionsTarget.longitude.toFixed(
                      5
                    )}
                  </div>
                </>
              ) : (
                <div className="mt-1 text-sm text-cyan-100">
                  Select a water destination
                </div>
              )}
            </div>

          </div>

          {/* TABS */}

          <div className="mt-4 grid grid-cols-4 gap-1 rounded-xl bg-white/10 p-1">

            <TabButton
              active={
                tab ===
                "conditions"
              }
              onClick={() =>
                setTab(
                  "conditions"
                )
              }
            >
              🌊
              <span>
                Conditions
              </span>
            </TabButton>

            <TabButton
              active={
                tab ===
                "tools"
              }
              onClick={() =>
                setTab(
                  "tools"
                )
              }
            >
              🧭
              <span>
                Tools
              </span>
            </TabButton>

            <TabButton
              active={
                tab ===
                "float"
              }
              onClick={() =>
                setTab(
                  "float"
                )
              }
            >
              📋
              <span>
                Float Plan
              </span>
            </TabButton>

            <TabButton
              active={
                tab ===
                "sos"
              }
              onClick={() =>
                setTab(
                  "sos"
                )
              }
            >
              🆘
              <span>
                SOS
              </span>
            </TabButton>

          </div>

        </div>

        {/* STATUS */}

        {status && (
          <div className="mx-4 mt-4 rounded-xl border border-cyan-200 bg-cyan-50 p-3 text-sm font-bold text-[#07507a]">
            {status}
          </div>
        )}

        {/* =================================
            CONDITIONS TAB
        ================================= */}

        {tab ===
          "conditions" && (
          <div className="p-4">

            <SectionTitle
              title="Live Conditions"
              subtitle="Current weather and modeled water conditions."
            />

            {!conditionsTarget && (
              <InfoBox>
                Choose a water destination in the planner or tap Use Current GPS.
              </InfoBox>
            )}

            {loading && (
              <InfoBox>
                Loading live conditions...
              </InfoBox>
            )}

            {conditionsTarget &&
              !loading && (
              <div className="mt-4 grid grid-cols-2 gap-3">

                <DataCard
                  icon="💨"
                  label="Wind"
                  value={
                    weather?.windSpeedMph !=
                    null
                      ? `${weather.windSpeedMph} mph`
                      : "—"
                  }
                  sub={
                    weather?.windDirection ||
                    "Direction unavailable"
                  }
                />

                <DataCard
                  icon="💨"
                  label="Gusts"
                  value={
                    weather?.windGustMph !=
                    null
                      ? `${weather.windGustMph} mph`
                      : "—"
                  }
                  sub="Current gusts"
                />

                <DataCard
                  icon="🌊"
                  label="Waves"
                  value={
                    marine?.waveHeightFt !=
                    null
                      ? `${marine.waveHeightFt} ft`
                      : "—"
                  }
                  sub={
                    marine?.wavePeriodSeconds !=
                    null
                      ? `${marine.wavePeriodSeconds} sec period`
                      : "Wave model"
                  }
                />

                <DataCard
                  icon="〰️"
                  label="Swell"
                  value={
                    marine?.swellHeightFt !=
                    null
                      ? `${marine.swellHeightFt} ft`
                      : "—"
                  }
                  sub={
                    marine?.swellPeriodSeconds !=
                    null
                      ? `${marine.swellPeriodSeconds} sec period`
                      : "Swell model"
                  }
                />

                <DataCard
                  icon="🌡️"
                  label="Water Temp"
                  value={
                    marine?.waterTemperatureF !=
                    null
                      ? `${marine.waterTemperatureF}°F`
                      : "—"
                  }
                  sub="Surface temperature"
                />

                <DataCard
                  icon="↕️"
                  label="Tide Trend"
                  value={
                    marine?.tideTrend ||
                    "Unavailable"
                  }
                  sub={
                    marine?.seaLevelHeightFt !=
                    null
                      ? `${marine.seaLevelHeightFt} ft model level`
                      : "Modeled data"
                  }
                />

                <DataCard
                  icon="🌅"
                  label="Sunrise"
                  value={
                    formatSunTime(
                      sunrise
                    )
                  }
                  sub="Local forecast time"
                />

                <DataCard
                  icon="🌇"
                  label="Sunset"
                  value={
                    formatSunTime(
                      sunset
                    )
                  }
                  sub="Local forecast time"
                />

                <DataCard
                  icon="🌙"
                  label="Moon"
                  value={getMoonPhase(
                    new Date()
                  )}
                  sub="Approximate phase"
                />

                <DataCard
                  icon="🌤️"
                  label="Weather"
                  value={
                    weather?.temperatureF !=
                    null
                      ? `${weather.temperatureF}°F`
                      : "—"
                  }
                  sub={
                    weather?.description ||
                    "Current weather"
                  }
                />

              </div>
            )}

            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
              Wave, swell, current and tide information may be modeled data. Always verify official local marine forecasts, tide stations, warnings and navigation information before heading out.
            </div>

          </div>
        )}

        {/* =================================
            TOOLS TAB
        ================================= */}

        {tab ===
          "tools" && (
          <div className="p-4">

            <SectionTitle
              title="Water Tools"
              subtitle="Quick tools for your day on the water."
            />

            {/* COMPASS */}

            <div className="mt-4 rounded-2xl bg-white p-5 shadow-sm">

              <div className="flex items-center justify-between">

                <div>
                  <div className="font-black text-[#073b59]">
                    🧭 Device Compass
                  </div>

                  <div className="text-xs text-slate-500">
                    Uses your phone&apos;s orientation sensor.
                  </div>
                </div>

                {compassRunning ? (
                  <button
                    type="button"
                    onClick={
                      stopCompass
                    }
                    className="rounded-lg bg-slate-200 px-3 py-2 text-xs font-black text-slate-700"
                  >
                    Stop
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={
                      startCompass
                    }
                    className="rounded-lg bg-[#078dcf] px-3 py-2 text-xs font-black text-white"
                  >
                    Start
                  </button>
                )}

              </div>

              <div className="mt-5 flex justify-center">

                <div className="relative flex h-44 w-44 items-center justify-center rounded-full border-[10px] border-[#dceff4] bg-[#f7fbfc]">

                  <div className="absolute top-2 text-xs font-black text-red-600">
                    N
                  </div>

                  <div className="absolute bottom-2 text-xs font-black text-slate-500">
                    S
                  </div>

                  <div className="absolute left-3 text-xs font-black text-slate-500">
                    W
                  </div>

                  <div className="absolute right-3 text-xs font-black text-slate-500">
                    E
                  </div>

                  <div
                    className="absolute h-24 w-1 origin-bottom rounded-full bg-red-500 transition-transform"
                    style={{
                      transform: `translateY(-48px) rotate(${heading ?? 0}deg)`,
                    }}
                  />

                  <div className="z-10 rounded-full bg-[#063e5b] px-4 py-2 text-center text-white shadow">

                    <div className="text-xl font-black">
                      {heading !=
                      null
                        ? `${heading}°`
                        : "—"}
                    </div>

                    <div className="text-[10px] font-bold">
                      {heading !=
                      null
                        ? headingDirection(
                            heading
                          )
                        : "Heading"}
                    </div>

                  </div>

                </div>

              </div>

              <div className="mt-4 text-center text-xs text-slate-500">
                For convenience only. Do not use a phone compass as your sole marine navigation instrument.
              </div>

            </div>

            {/* GPS */}

            <div className="mt-4 rounded-2xl bg-white p-5 shadow-sm">

              <div className="font-black text-[#073b59]">
                📍 GPS Coordinates
              </div>

              {currentLocation?.source === "gps" ? (
                <div className="mt-3">

                  <div className="rounded-xl bg-slate-50 p-4 font-mono text-lg font-black text-[#07507a]">
                    {currentLocation.latitude.toFixed(
                      6
                    )}
                    <br />
                    {currentLocation.longitude.toFixed(
                      6
                    )}
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">

                    <button
                      type="button"
                      onClick={
                        copyCoordinates
                      }
                      className="rounded-xl border border-slate-200 px-3 py-3 text-sm font-black text-[#07507a]"
                    >
                      Copy GPS
                    </button>

                    <button
                      type="button"
                      onClick={
                        shareLocation
                      }
                      className="rounded-xl bg-[#078dcf] px-3 py-3 text-sm font-black text-white"
                    >
                      Share Location
                    </button>

                  </div>

                </div>
              ) : (
                <InfoBox>
                  Use Current GPS to load your coordinates.
                </InfoBox>
              )}

            </div>

            {/* NEARBY */}

            <div className="mt-4 rounded-2xl bg-white p-5 shadow-sm">

              <div className="font-black text-[#073b59]">
                ⚓ Nearby Water Services
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">

                <NearbyButton
                  icon="🚤"
                  label="Boat Launches"
                  onClick={() =>
                    searchNearby(
                      "boat launch"
                    )
                  }
                />

                <NearbyButton
                  icon="⚓"
                  label="Marinas"
                  onClick={() =>
                    searchNearby(
                      "marina"
                    )
                  }
                />

                <NearbyButton
                  icon="⛽"
                  label="Marine Fuel"
                  onClick={() =>
                    searchNearby(
                      "marine fuel"
                    )
                  }
                />

                <NearbyButton
                  icon="🛶"
                  label="Kayak Launches"
                  onClick={() =>
                    searchNearby(
                      "kayak launch"
                    )
                  }
                />

              </div>

            </div>

          </div>
        )}

        {/* =================================
            FLOAT PLAN TAB
        ================================= */}

        {tab ===
          "float" && (
          <div className="p-4">

            <SectionTitle
              title="Float Plan"
              subtitle="Leave your trip details with someone you trust before going out."
            />

            <div className="mt-4 rounded-2xl bg-white p-5 shadow-sm">

              <PlanField
                label="People Aboard"
                value={
                  floatPlan.people
                }
                placeholder="Example: 2"
                onChange={(
                  value
                ) =>
                  updatePlan(
                    "people",
                    value
                  )
                }
              />

              <PlanField
                label="Vessel / Watercraft"
                value={
                  floatPlan.vessel
                }
                placeholder="Example: 19-ft Sea-Doo Switch"
                onChange={(
                  value
                ) =>
                  updatePlan(
                    "vessel",
                    value
                  )
                }
              />

              <PlanField
                label="Vessel Color"
                value={
                  floatPlan.vesselColor
                }
                placeholder="Example: Blue and white"
                onChange={(
                  value
                ) =>
                  updatePlan(
                    "vesselColor",
                    value
                  )
                }
              />

              <PlanField
                label="Launch Point"
                value={
                  floatPlan.launchPoint
                }
                placeholder="Marina, ramp or beach"
                onChange={(
                  value
                ) =>
                  updatePlan(
                    "launchPoint",
                    value
                  )
                }
              />

              <PlanField
                label="Destination / Route"
                value={
                  floatPlan.destination
                }
                placeholder="Where are you going?"
                onChange={(
                  value
                ) =>
                  updatePlan(
                    "destination",
                    value
                  )
                }
              />

              <label className="mt-4 block">

                <span className="mb-2 block text-sm font-black text-[#073b59]">
                  Expected Return
                </span>

                <input
                  type="datetime-local"
                  value={
                    floatPlan.expectedReturn
                  }
                  onChange={(
                    event
                  ) =>
                    updatePlan(
                      "expectedReturn",
                      event.target
                        .value
                    )
                  }
                  className={
                    fieldClass
                  }
                />

              </label>

              <PlanField
                label="Emergency Contact"
                value={
                  floatPlan.emergencyContact
                }
                placeholder="Name and phone number"
                onChange={(
                  value
                ) =>
                  updatePlan(
                    "emergencyContact",
                    value
                  )
                }
              />

              <div className="mt-5 grid grid-cols-2 gap-2">

                <button
                  type="button"
                  onClick={
                    saveFloatPlan
                  }
                  className="rounded-xl bg-[#078dcf] px-4 py-3 font-black text-white"
                >
                  Save Plan
                </button>

                <button
                  type="button"
                  onClick={
                    shareFloatPlan
                  }
                  className="rounded-xl bg-emerald-600 px-4 py-3 font-black text-white"
                >
                  Share Plan
                </button>

              </div>

              <button
                type="button"
                onClick={
                  clearFloatPlan
                }
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-600"
              >
                Clear Float Plan
              </button>

            </div>

            <div className="mt-4 rounded-xl border border-cyan-200 bg-cyan-50 p-4 text-sm leading-relaxed text-[#07507a]">
              A Float Plan works best when you actually send it to a responsible person who knows when to contact authorities if you do not return.
            </div>

          </div>
        )}

        {/* =================================
            SOS TAB — ALWAYS FREE
        ================================= */}

        {tab ===
          "sos" && (
          <div className="p-4">

            <div className="rounded-2xl bg-red-600 p-5 text-white shadow-lg">

              <div className="text-xs font-black uppercase tracking-[0.2em] text-red-100">
                Always Free
              </div>

              <h2 className="mt-1 text-3xl font-black">
                🆘 SOS & Safety
              </h2>

              <p className="mt-2 text-sm text-red-50">
                Emergency tools are never behind a TrippinDays paywall.
              </p>

            </div>

            {/* CALL 911 */}

            <a
              href="tel:911"
              className="mt-4 flex w-full items-center justify-center gap-3 rounded-2xl bg-red-600 px-5 py-5 text-xl font-black text-white shadow-lg transition hover:bg-red-700"
            >
              📞 Call 911
            </a>

            {/* LOCATION */}

            <div className="mt-4 rounded-2xl bg-white p-5 shadow-sm">

              <div className="text-lg font-black text-[#073b59]">
                📍 Your Coordinates
              </div>

              {currentLocation?.source === "gps" ? (
                <>
                  <div className="mt-3 rounded-xl bg-red-50 p-4 font-mono text-lg font-black text-red-700">

                    {currentLocation.latitude.toFixed(
                      6
                    )}
                    <br />
                    {currentLocation.longitude.toFixed(
                      6
                    )}

                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">

                    <button
                      type="button"
                      onClick={
                        copyCoordinates
                      }
                      className="rounded-xl border border-red-200 px-3 py-3 text-sm font-black text-red-700"
                    >
                      Copy Coordinates
                    </button>

                    <button
                      type="button"
                      onClick={
                        shareLocation
                      }
                      className="rounded-xl bg-red-600 px-3 py-3 text-sm font-black text-white"
                    >
                      Share Location
                    </button>

                  </div>
                </>
              ) : (
                <button
                  type="button"
                  onClick={
                    useCurrentGps
                  }
                  className="mt-3 w-full rounded-xl bg-red-600 px-4 py-3 font-black text-white"
                >
                  Get My GPS Location
                </button>
              )}

            </div>

            {/* VHF */}

            <div className="mt-4 rounded-2xl bg-white p-5 shadow-sm">

              <div className="text-lg font-black text-[#073b59]">
                📻 Marine VHF
              </div>

              <div className="mt-3 rounded-xl bg-[#063e5b] p-5 text-center text-white">

                <div className="text-xs font-black uppercase tracking-wider text-cyan-200">
                  Distress / Calling
                </div>

                <div className="mt-1 text-5xl font-black">
                  16
                </div>

                <div className="text-sm font-bold text-cyan-100">
                  VHF Channel 16
                </div>

              </div>

              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                If you have a marine VHF radio and face a life-threatening emergency, use the appropriate distress procedure and provide your position, nature of the emergency, vessel description and number of people aboard.
              </p>

            </div>

            {/* FLOAT PLAN */}

            <button
              type="button"
              onClick={() =>
                setTab(
                  "float"
                )
              }
              className="mt-4 w-full rounded-2xl bg-[#078dcf] px-5 py-4 font-black text-white"
            >
              📋 Open My Float Plan
            </button>

            {/* SAFETY WARNING */}

            <div className="mt-4 rounded-2xl border-2 border-red-200 bg-red-50 p-5">

              <div className="font-black text-red-800">
                Important Safety Notice
              </div>

              <p className="mt-2 text-sm leading-relaxed text-red-800">
                TrippinDays is not an emergency beacon, satellite messenger or marine navigation system. It does not replace a PLB, EPIRB, marine VHF radio, satellite communicator, approved charts, Coast Guard guidance or other proper safety equipment.
              </p>

              <p className="mt-3 text-sm font-bold text-red-900">
                Never rely on a phone or TrippinDays as your only emergency communication method on the water.
              </p>

            </div>

          </div>
        )}

      </aside>
    </>
  );
}

/*
==================================
UI HELPERS
==================================
*/

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={
        onClick
      }
      className={`flex flex-col items-center gap-1 rounded-lg px-1 py-2 text-[10px] font-black transition ${
        active
          ? "bg-white text-[#063e5b]"
          : "text-cyan-100 hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}

function SectionTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div>

      <h3 className="text-2xl font-black text-[#073b59]">
        {title}
      </h3>

      <p className="mt-1 text-sm text-slate-500">
        {subtitle}
      </p>

    </div>
  );
}

function DataCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: string;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">

      <div className="text-2xl">
        {icon}
      </div>

      <div className="mt-2 text-[10px] font-black uppercase tracking-wider text-slate-400">
        {label}
      </div>

      <div className="mt-1 text-lg font-black text-[#073b59]">
        {value}
      </div>

      <div className="mt-1 text-xs text-slate-500">
        {sub}
      </div>

    </div>
  );
}

function InfoBox({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="mt-4 rounded-xl border border-cyan-200 bg-cyan-50 p-4 text-sm font-semibold text-[#07507a]">
      {children}
    </div>
  );
}

function NearbyButton({
  icon,
  label,
  onClick,
}: {
  icon: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={
        onClick
      }
      className="rounded-xl border border-slate-200 bg-[#f7fbfc] p-4 text-left transition hover:border-cyan-400 hover:bg-cyan-50"
    >

      <div className="text-2xl">
        {icon}
      </div>

      <div className="mt-2 text-sm font-black text-[#073b59]">
        {label}
      </div>

    </button>
  );
}

function PlanField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (
    value: string
  ) => void;
}) {
  return (
    <label className="mt-4 block">

      <span className="mb-2 block text-sm font-black text-[#073b59]">
        {label}
      </span>

      <input
        value={
          value
        }
        onChange={(
          event
        ) =>
          onChange(
            event.target.value
          )
        }
        placeholder={
          placeholder
        }
        className={
          fieldClass
        }
      />

    </label>
  );
}

const fieldClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20";

/*
==================================
HEADING
==================================
*/

function headingDirection(
  heading: number
) {
  const directions = [
    "N",
    "NE",
    "E",
    "SE",
    "S",
    "SW",
    "W",
    "NW",
  ];

  return directions[
    Math.round(
      heading / 45
    ) % 8
  ];
}

/*
==================================
SUN TIME
==================================
*/

function formatSunTime(
  value?: string
) {
  if (!value) {
    return "—";
  }

  const match =
    value.match(
      /T(\d{2}):(\d{2})/
    );

  if (!match) {
    return value;
  }

  let hour =
    Number(match[1]);

  const minute =
    match[2];

  const suffix =
    hour >= 12
      ? "PM"
      : "AM";

  hour =
    hour % 12 || 12;

  return `${hour}:${minute} ${suffix}`;
}

/*
==================================
MOON PHASE
==================================
*/

function getMoonPhase(
  date: Date
) {
  const knownNewMoon =
    new Date(
      "2000-01-06T18:14:00Z"
    );

  const lunarCycle =
    29.53058867;

  const daysSince =
    (date.getTime() -
      knownNewMoon.getTime()) /
    86400000;

  const age =
    ((daysSince %
      lunarCycle) +
      lunarCycle) %
    lunarCycle;

  if (age < 1.84566)
    return "🌑 New";

  if (age < 5.53699)
    return "🌒 Waxing Crescent";

  if (age < 9.22831)
    return "🌓 First Quarter";

  if (age < 12.91963)
    return "🌔 Waxing Gibbous";

  if (age < 16.61096)
    return "🌕 Full";

  if (age < 20.30228)
    return "🌖 Waning Gibbous";

  if (age < 23.99361)
    return "🌗 Last Quarter";

  if (age < 27.68493)
    return "🌘 Waning Crescent";

  return "🌑 New";
}