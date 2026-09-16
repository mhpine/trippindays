"use client";

import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

const OnTheWaterMap = dynamic(
  () => import("@/components/on-the-water/OnTheWaterMap"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[420px] items-center justify-center rounded-2xl bg-cyan-50 font-bold text-cyan-800">
        Loading interactive map...
      </div>
    ),
  }
);

type WaterLocation = {
  name: string;
  state?: string;
  latitude: number;
  longitude: number;
  source: "gps" | "search";
};

type WaterType = "" | "Freshwater" | "Saltwater" | "Either";

type HourlyWaterPoint = {
  time: string;
  score: number;
  wind: number | null;
  gust: number | null;
  wave: number | null;
  period: number | null;
  swell: number | null;
  swellPeriod: number | null;
  waterTemp: number | null;
};

type WaterResult = {
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
  wind: number | null;
  gust: number | null;
  wave: number | null;
  period: number | null;
  swell: number | null;
  swellPeriod: number | null;
  waterTemp: number | null;
  marineAvailable: boolean;
  hourly: HourlyWaterPoint[];
  waterType?: "Freshwater" | "Saltwater";
  popularity?: "Popular" | "Local Favorite" | "Hidden Gem" | string;
  fishingAccess?: string[];
  targetSpecies?: string[];
  seasonalStatus?: string;
  seasonalNote?: string;
  publicAccess?: string;
  rulesNote?: string;
};

type SavedWaterSpot = {
  key: string;
  tripId?: string;
  name: string;
  region?: string;
  category?: string;
  latitude: number;
  longitude: number;
  distanceMiles: number;
  score: number;
  label: string;
  bestTime?: string;
  activity: string;
  waterType: WaterType;
  targetSpecies?: string[];
  seasonalStatus?: string;
  seasonalNote?: string;
};

type WaterAlertLevel = "off" | "good" | "excellent";

type WaterAlertCheck = {
  score: number;
  label: string;
  checkedAt: string;
  triggered: boolean;
  threshold: number;
  wind: number | null;
  gust: number | null;
  wave: number | null;
  period: number | null;
  waterTemp: number | null;
};

const activities = [
  "Surfing",
  "Personal Water Craft",
  "Fishing",
  "Kayak / Paddle",
  "Sailing",
];

const RECENT_WATER_DESTINATIONS_KEY =
  "trippindays-water-recent-destinations";

const SAVED_WATER_SPOTS_KEY =
  "trippindays-water-saved-spots";

const WATER_ALERT_LEVELS_KEY =
  "trippindays-water-condition-alerts";

const WATER_BROWSER_NOTIFICATIONS_KEY =
  "trippindays-water-browser-notifications";

const WATER_BROWSER_NOTIFICATION_STATE_KEY =
  "trippindays-water-browser-notification-state";

export default function OnTheWaterPlanner() {
  const [activity, setActivity] = useState("Surfing");
  const [waterType, setWaterType] = useState<WaterType>("");
  const [startingLocation, setStartingLocation] = useState("");
  const [radius, setRadius] = useState("150");
  const [skill, setSkill] = useState("Intermediate");
  const [when, setWhen] = useState("This Weekend");
  const [fishingAccess, setFishingAccess] = useState("Any");
  const [targetFish, setTargetFish] = useState("Anything Active Now");
  const [fishingAdventure, setFishingAdventure] = useState("Either");

  const [location, setLocation] = useState<WaterLocation | null>(null);
  const [results, setResults] = useState<WaterResult[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState("");

  const [signedIn, setSignedIn] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [premiumLoading, setPremiumLoading] = useState(true);

  const [savedSpots, setSavedSpots] = useState<SavedWaterSpot[]>([]);
  const [savingSpotKey, setSavingSpotKey] = useState<string | null>(null);
  const [alertLevels, setAlertLevels] = useState<Record<string, WaterAlertLevel>>({});
  const [alertChecks, setAlertChecks] = useState<Record<string, WaterAlertCheck>>({});
  const [checkingAlerts, setCheckingAlerts] = useState(false);
  const [alertsLoaded, setAlertsLoaded] = useState(false);
  const [browserNotificationsEnabled, setBrowserNotificationsEnabled] =
    useState(false);
  const [notificationPermission, setNotificationPermission] =
    useState<"default" | "granted" | "denied" | "unsupported">(
      "default"
    );
  const [pushSubscriptionReady, setPushSubscriptionReady] =
    useState(false);
  const syncedSavedSpotsRef = useRef(false);

  /* =========================================================
     LOAD SAVED LOCATION
  ========================================================= */

  useEffect(() => {
    try {
      const saved = localStorage.getItem(
        "trippindays-water-location"
      );

      if (!saved) return;

      const parsed = JSON.parse(saved) as WaterLocation;

      if (
        Number.isFinite(Number(parsed.latitude)) &&
        Number.isFinite(Number(parsed.longitude))
      ) {
        setLocation(parsed);

        setStartingLocation(
          parsed.source === "gps"
            ? "Current Location"
            : [parsed.name, parsed.state]
                .filter(Boolean)
                .join(", ")
        );
      }
    } catch {
      // Ignore bad saved location data.
    }
  }, []);

  /* =========================================================
     LOAD SAVED WATER SPOTS
  ========================================================= */

  useEffect(() => {
    try {
      const saved = localStorage.getItem(
        SAVED_WATER_SPOTS_KEY
      );

      if (!saved) return;

      const parsed = JSON.parse(saved);

      if (Array.isArray(parsed)) {
        setSavedSpots(
          parsed
            .filter(
              (item) =>
                item &&
                typeof item.name === "string" &&
                Number.isFinite(Number(item.latitude)) &&
                Number.isFinite(Number(item.longitude))
            )
            .slice(0, 20)
        );
      }
    } catch {
      // Saved spots are optional. Ignore malformed local data.
    }
  }, []);

  /* =========================================================
     LOAD PREMIUM CONDITION ALERT PREFERENCES
  ========================================================= */

  useEffect(() => {
    try {
      const saved = localStorage.getItem(
        WATER_ALERT_LEVELS_KEY
      );

      if (saved) {
        const parsed = JSON.parse(saved);

        if (parsed && typeof parsed === "object") {
          setAlertLevels(parsed);
        }
      }
    } catch {
      // Alert preferences are optional.
    } finally {
      setAlertsLoaded(true);
    }
  }, []);

  /* =========================================================
     BROWSER + PUSH NOTIFICATION STATUS

     Browser notifications work while TrippinDays is open.
     A service-worker PushSubscription is also detected here so
     the next server alert runner can wake the installed PWA /
     browser when the site is not currently open.
  ========================================================= */

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!("Notification" in window)) {
      setNotificationPermission("unsupported");
      setBrowserNotificationsEnabled(false);
      setPushSubscriptionReady(false);
      return;
    }

    setNotificationPermission(Notification.permission);

    try {
      setBrowserNotificationsEnabled(
        localStorage.getItem(WATER_BROWSER_NOTIFICATIONS_KEY) ===
          "true" && Notification.permission === "granted"
      );
    } catch {
      setBrowserNotificationsEnabled(false);
    }

    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPushSubscriptionReady(false);
      return;
    }

    void navigator.serviceWorker
      .getRegistration()
      .then(async (registration) => {
        if (!registration) {
          setPushSubscriptionReady(false);
          return;
        }

        const subscription =
          await registration.pushManager.getSubscription();
        setPushSubscriptionReady(Boolean(subscription));
      })
      .catch(() => {
        setPushSubscriptionReady(false);
      });
  }, []);

  /* =========================================================
     PREMIUM ACCESS

     Uses the same profiles.is_premium flag already used by
     the rest of TrippinDays. Existing Premium members unlock
     the advanced On the Water tools automatically.
  ========================================================= */

  useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    async function loadPremiumAccess(userId?: string | null) {
      if (!mounted) return;

      if (!userId) {
        setSignedIn(false);
        setIsPremium(false);
        setPremiumLoading(false);
        return;
      }

      setSignedIn(true);
      setPremiumLoading(true);

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("is_premium")
        .eq("id", userId)
        .maybeSingle();

      if (!mounted) return;

      if (error) {
        console.error(
          "On the Water premium check failed:",
          error
        );
        setIsPremium(false);
      } else {
        setIsPremium(profile?.is_premium === true);
      }

      setPremiumLoading(false);
    }

    async function loadSession() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      await loadPremiumAccess(user?.id ?? null);
    }

    void loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        void loadPremiumAccess(
          session?.user?.id ?? null
        );
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  /* =========================================================
     SYNC LEGACY WATER SPOTS TO MY TRIPS

     Spots saved before this update only existed in localStorage.
     Once a Premium member is signed in, attach those spots to an
     existing On the Water trip row or create the missing My Trips row.
  ========================================================= */

  useEffect(() => {
    if (
      premiumLoading ||
      !signedIn ||
      !isPremium ||
      savedSpots.length === 0 ||
      syncedSavedSpotsRef.current
    ) {
      return;
    }

    syncedSavedSpotsRef.current = true;

    async function syncSavedWaterSpotsToMyTrips() {
      const supabase = createClient();

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          return;
        }

        const { data: existingTrips, error: existingTripsError } =
          await supabase
            .from("trips")
            .select("id, trip_snapshot")
            .eq("user_id", user.id)
            .eq("status", "saved");

        if (existingTripsError) {
          throw existingTripsError;
        }

        const tripIdByWaterSpotKey = new Map<string, string>();

        for (const trip of existingTrips || []) {
          const snapshot =
            trip?.trip_snapshot &&
            typeof trip.trip_snapshot === "object" &&
            !Array.isArray(trip.trip_snapshot)
              ? (trip.trip_snapshot as Record<string, unknown>)
              : null;

          const snapshotKey =
            typeof snapshot?.waterSpotKey === "string"
              ? snapshot.waterSpotKey
              : "";

          if (snapshotKey && trip.id) {
            tripIdByWaterSpotKey.set(
              snapshotKey,
              trip.id
            );
          }
        }

        let changed = false;
        const synced: SavedWaterSpot[] = [];

        for (const spot of savedSpots) {
          if (spot.tripId) {
            synced.push(spot);
            continue;
          }

          const existingTripId =
            tripIdByWaterSpotKey.get(spot.key);

          if (existingTripId) {
            synced.push({
              ...spot,
              tripId: existingTripId,
            });
            changed = true;
            continue;
          }

          const { data: inserted, error: insertError } =
            await supabase
              .from("trips")
              .insert(
                buildSavedWaterTripRow(
                  spot,
                  user.id
                )
              )
              .select("id")
              .single();

          if (insertError) {
            throw insertError;
          }

          synced.push({
            ...spot,
            tripId: inserted?.id || undefined,
          });
          changed = true;
        }

        if (changed) {
          persistSavedSpots(synced);
        }
      } catch (error) {
        console.error(
          "Saved Water Spots My Trips sync failed:",
          error
        );
      }
    }

    void syncSavedWaterSpotsToMyTrips();
  }, [
    premiumLoading,
    signedIn,
    isPremium,
    savedSpots.length,
  ]);

  /* =========================================================
     CHECK ENABLED CONDITION ALERTS

     First version is in-app: checks when On the Water opens,
     whenever an alert setting changes, and every 30 minutes
     while the page remains open.
  ========================================================= */

  useEffect(() => {
    if (
      premiumLoading ||
      !alertsLoaded ||
      !isPremium ||
      savedSpots.length === 0
    ) {
      return;
    }

    const enabled = savedSpots.filter(
      (spot) =>
        (alertLevels[spot.key] || "off") !== "off"
    );

    if (enabled.length === 0) {
      setAlertChecks({});
      return;
    }

    void checkSavedSpotAlerts(enabled);

    const interval = window.setInterval(() => {
      void checkSavedSpotAlerts(enabled);
    }, 30 * 60 * 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [
    premiumLoading,
    alertsLoaded,
    isPremium,
    savedSpots.length,
    JSON.stringify(alertLevels),
  ]);

  function openPremium() {
    if (!signedIn) {
      window.location.href =
        "/login?redirect=/premium";
      return;
    }

    window.location.href = "/premium";
  }

  function waterSpotKey(place: {
    name: string;
    latitude: number;
    longitude: number;
  }) {
    return `${place.name
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")}|${Number(
      place.latitude
    ).toFixed(4)}|${Number(place.longitude).toFixed(4)}`;
  }

  function isWaterSpotSaved(place: {
    name: string;
    latitude: number;
    longitude: number;
  }) {
    const key = waterSpotKey(place);

    return savedSpots.some(
      (spot) => spot.key === key
    );
  }

  function persistSavedSpots(next: SavedWaterSpot[]) {
    setSavedSpots(next);

    try {
      localStorage.setItem(
        SAVED_WATER_SPOTS_KEY,
        JSON.stringify(next)
      );
    } catch {
      // Browser storage may be unavailable.
    }
  }

  function persistAlertLevels(
    next: Record<string, WaterAlertLevel>
  ) {
    setAlertLevels(next);

    try {
      localStorage.setItem(
        WATER_ALERT_LEVELS_KEY,
        JSON.stringify(next)
      );
    } catch {
      // Browser storage may be unavailable.
    }
  }

  async function setSpotAlertLevel(
    spot: SavedWaterSpot,
    level: WaterAlertLevel
  ) {
    if (!isPremium) {
      setMessage(
        "Condition Alerts are an On the Water Premium feature."
      );
      return;
    }

    const next = {
      ...alertLevels,
      [spot.key]: level,
    };

    if (level === "off") {
      delete next[spot.key];
      setAlertChecks((current) => {
        const updated = { ...current };
        delete updated[spot.key];
        return updated;
      });
    }

    // Save immediately on this device so the UI never feels delayed.
    persistAlertLevels(next);

    if (!signedIn) {
      setMessage(
        level === "off"
          ? `Condition Alert turned off for ${spot.name}.`
          : `Condition Alert enabled on this device for ${spot.name}. Sign in to sync push alerts.`
      );
      return;
    }

    const supabase = createClient();

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw userError || new Error("Sign in required.");
      }

      if (level === "off") {
        const { error } = await supabase
          .from("water_condition_alerts")
          .delete()
          .eq("user_id", user.id)
          .eq("spot_key", spot.key);

        if (error) throw error;
      } else {
        const threshold = level === "excellent" ? 90 : 70;

        const { error } = await supabase
          .from("water_condition_alerts")
          .upsert(
            {
              user_id: user.id,
              trip_id: spot.tripId || null,
              spot_key: spot.key,
              name: spot.name,
              region: spot.region || null,
              latitude: spot.latitude,
              longitude: spot.longitude,
              activity: spot.activity,
              water_type: spot.waterType || null,
              target_species:
                spot.activity === "Fishing"
                  ? spot.targetSpecies || []
                  : [],
              seasonal_status:
                spot.activity === "Fishing"
                  ? spot.seasonalStatus || null
                  : null,
              seasonal_note:
                spot.activity === "Fishing"
                  ? spot.seasonalNote || null
                  : null,
              alert_level: level,
              threshold,
              enabled: true,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id,spot_key" }
          );

        if (error) throw error;
      }

      setMessage(
        level === "off"
          ? `Condition Alert turned off for ${spot.name}.`
          : `Condition Alert enabled and synced for ${spot.name}.`
      );
    } catch (error) {
      console.error("Water alert cloud sync failed:", error);
      setMessage(
        level === "off"
          ? `Alert is off on this device, but cloud sync could not be confirmed.`
          : `Alert is saved on this device, but cloud push sync is not ready yet.`
      );
    }
  }

  async function enableBrowserNotifications() {
    if (!isPremium) {
      setMessage(
        "Browser Condition Alerts are an On the Water Premium feature."
      );
      return;
    }

    if (typeof window === "undefined" || !("Notification" in window)) {
      setNotificationPermission("unsupported");
      setMessage(
        "This browser does not support browser notifications."
      );
      return;
    }

    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setMessage(
        "This browser can show in-app alerts but does not support web push on this device."
      );
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);

      if (permission !== "granted") {
        localStorage.setItem(
          WATER_BROWSER_NOTIFICATIONS_KEY,
          "false"
        );
        setBrowserNotificationsEnabled(false);
        setPushSubscriptionReady(false);
        setMessage(
          permission === "denied"
            ? "Browser notifications are blocked. In-app Condition Alerts still work."
            : "Browser notifications were not enabled."
        );
        return;
      }

      localStorage.setItem(
        WATER_BROWSER_NOTIFICATIONS_KEY,
        "true"
      );
      setBrowserNotificationsEnabled(true);

      const registration = await navigator.serviceWorker.register(
        "/sw.js",
        { scope: "/" }
      );

      await navigator.serviceWorker.ready;

      const keyResponse = await fetch(
        "/api/on-the-water/push-public-key",
        { cache: "no-store" }
      );
      const keyData = await keyResponse.json();
      const vapidPublicKeyBytes =
        Array.isArray(keyData?.publicKeyBytes)
          ? keyData.publicKeyBytes.filter(
              (value: unknown) =>
                typeof value === "number" &&
                Number.isInteger(value) &&
                value >= 0 &&
                value <= 255
            )
          : [];

      if (
        !keyResponse.ok ||
        vapidPublicKeyBytes.length !== 65
      ) {
        setPushSubscriptionReady(false);
        setMessage(
          keyData?.error ||
            "Browser alerts are on, but device push could not get a valid server push key."
        );
        return;
      }

      let subscription =
        await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey:
            new Uint8Array(vapidPublicKeyBytes),
        });
      }

      const supabase = createClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw userError || new Error("Sign in required for push alerts.");
      }

      const json = subscription.toJSON();
      const p256dh = json.keys?.p256dh || "";
      const auth = json.keys?.auth || "";

      if (!subscription.endpoint || !p256dh || !auth) {
        throw new Error("Push subscription keys were incomplete.");
      }

      const { error: saveError } = await supabase
        .from("water_push_subscriptions")
        .upsert(
          {
            user_id: user.id,
            endpoint: subscription.endpoint,
            p256dh,
            auth,
            user_agent: navigator.userAgent,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,endpoint" }
        );

      if (saveError) throw saveError;

      setPushSubscriptionReady(true);
      setMessage(
        "Device push registration is ready. TrippinDays can now store this device for Premium water alerts."
      );

      const enabled = savedSpots.filter(
        (spot) =>
          (alertLevels[spot.key] || "off") !== "off"
      );

      if (enabled.length > 0) {
        void checkSavedSpotAlerts(enabled);
      }
    } catch (error) {
      console.error("Push notification setup failed:", error);
      setPushSubscriptionReady(false);
      setMessage(
        error instanceof Error
          ? error.message
          : "Browser notifications could not be enabled on this device."
      );
    }
  }

  async function disableBrowserNotifications() {
    try {
      localStorage.setItem(
        WATER_BROWSER_NOTIFICATIONS_KEY,
        "false"
      );
    } catch {}

    setBrowserNotificationsEnabled(false);

    try {
      if (
        typeof navigator !== "undefined" &&
        "serviceWorker" in navigator
      ) {
        const registration =
          await navigator.serviceWorker.getRegistration();
        const subscription =
          await registration?.pushManager.getSubscription();

        if (subscription) {
          const endpoint = subscription.endpoint;

          const supabase = createClient();
          const {
            data: { user },
          } = await supabase.auth.getUser();

          if (user) {
            await supabase
              .from("water_push_subscriptions")
              .delete()
              .eq("user_id", user.id)
              .eq("endpoint", endpoint);
          }

          await subscription.unsubscribe();
        }
      }
    } catch (error) {
      console.error("Push unsubscribe failed:", error);
    }

    setPushSubscriptionReady(false);
    setMessage(
      "Browser/device alerts are off. In-app alerts will continue to work."
    );
  }

  function maybeSendBrowserNotification(
    spot: SavedWaterSpot,
    check: WaterAlertCheck
  ) {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return;
    }

    if (Notification.permission !== "granted") {
      return;
    }

    let enabled = false;

    try {
      enabled =
        localStorage.getItem(WATER_BROWSER_NOTIFICATIONS_KEY) ===
        "true";
    } catch {
      enabled = false;
    }

    if (!enabled) return;

    let sentState: Record<
      string,
      { wasTriggered?: boolean; sentAt?: string; score?: number }
    > = {};

    try {
      const saved = localStorage.getItem(
        WATER_BROWSER_NOTIFICATION_STATE_KEY
      );

      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === "object") {
          sentState = parsed;
        }
      }
    } catch {
      sentState = {};
    }

    const previous = sentState[spot.key] || {};

    if (!check.triggered) {
      sentState[spot.key] = {
        ...previous,
        wasTriggered: false,
        score: check.score,
      };

      try {
        localStorage.setItem(
          WATER_BROWSER_NOTIFICATION_STATE_KEY,
          JSON.stringify(sentState)
        );
      } catch {}
      return;
    }

    const lastSent = previous.sentAt
      ? new Date(previous.sentAt).getTime()
      : 0;
    const sixHours = 6 * 60 * 60 * 1000;
    const crossedThreshold = previous.wasTriggered !== true;
    const cooldownExpired = Date.now() - lastSent >= sixHours;

    if (!crossedThreshold && !cooldownExpired) {
      return;
    }

    try {
      const notification = new Notification(
        `${spot.name}: ${check.label}`,
        {
          body: `${spot.activity} conditions are ${check.score}/100. Your alert threshold has been reached.`,
          tag: `trippindays-water-${spot.key}`,
        }
      );

      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    } catch {
      return;
    }

    sentState[spot.key] = {
      wasTriggered: true,
      sentAt: new Date().toISOString(),
      score: check.score,
    };

    try {
      localStorage.setItem(
        WATER_BROWSER_NOTIFICATION_STATE_KEY,
        JSON.stringify(sentState)
      );
    } catch {}
  }

  function alertClamp(value: number) {
    return Math.max(0, Math.min(1, value));
  }

  function alertLowIsGood(
    value: number | null,
    good: number,
    bad: number
  ) {
    if (value == null) return 0.65;
    if (value <= good) return 1;
    if (value >= bad) return 0;

    return alertClamp(
      1 - (value - good) / (bad - good)
    );
  }

  function alertRangeIsGood(
    value: number | null,
    idealMin: number,
    idealMax: number,
    hardMin: number,
    hardMax: number
  ) {
    if (value == null) return 0.6;

    if (value >= idealMin && value <= idealMax) {
      return 1;
    }

    if (value < idealMin) {
      if (value <= hardMin) return 0;
      return alertClamp(
        (value - hardMin) / (idealMin - hardMin)
      );
    }

    if (value >= hardMax) return 0;

    return alertClamp(
      1 -
        (value - idealMax) /
          (hardMax - idealMax)
    );
  }

  function currentConditionScore(
    activityName: string,
    values: {
      wind: number | null;
      gust: number | null;
      wave: number | null;
      period: number | null;
    }
  ) {
    const { wind, gust, wave, period } = values;

    let score = 50;

    if (activityName === "Surfing") {
      score =
        alertRangeIsGood(wave, 2, 6, 0.5, 10) * 35 +
        alertRangeIsGood(period, 9, 16, 5, 22) * 25 +
        alertLowIsGood(wind, 8, 22) * 25 +
        alertLowIsGood(gust, 15, 32) * 15;
    } else if (activityName === "Personal Water Craft") {
      score =
        alertLowIsGood(wind, 8, 20) * 40 +
        alertLowIsGood(gust, 14, 30) * 30 +
        alertLowIsGood(wave, 1, 5) * 30;
    } else if (activityName === "Fishing") {
      score =
        alertLowIsGood(wind, 10, 24) * 45 +
        alertLowIsGood(gust, 16, 32) * 30 +
        alertLowIsGood(wave, 2, 6) * 25;
    } else if (activityName === "Kayak / Paddle") {
      score =
        alertLowIsGood(wind, 6, 18) * 45 +
        alertLowIsGood(gust, 10, 25) * 30 +
        alertLowIsGood(wave, 0.75, 3) * 25;
    } else if (activityName === "Sailing") {
      score =
        alertRangeIsGood(wind, 8, 18, 2, 30) * 60 +
        alertLowIsGood(gust, 22, 38) * 30 +
        alertLowIsGood(wave, 3, 8) * 10;
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  function currentConditionLabel(score: number) {
    if (score >= 90) return "Excellent Conditions";
    if (score >= 80) return "Great Conditions";
    if (score >= 70) return "Good Conditions";
    if (score >= 55) return "Fair Conditions";
    return "Poor Conditions";
  }

  async function checkSavedSpotAlerts(
    spotsToCheck: SavedWaterSpot[] = savedSpots
  ) {
    if (!isPremium || spotsToCheck.length === 0) {
      return;
    }

    const enabled = spotsToCheck.filter(
      (spot) =>
        (alertLevels[spot.key] || "off") !== "off"
    );

    if (enabled.length === 0) {
      return;
    }

    setCheckingAlerts(true);

    try {
      const checked = await Promise.all(
        enabled.map(async (spot) => {
          try {
            const response = await fetch(
              `/api/on-the-water/conditions?lat=${encodeURIComponent(
                String(spot.latitude)
              )}&lon=${encodeURIComponent(
                String(spot.longitude)
              )}`,
              { cache: "no-store" }
            );

            const data = await response.json();

            if (!response.ok || !data?.success) {
              return null;
            }

            const weather = data?.weather?.current || null;
            const marine = data?.marine?.current || null;

            const wind =
              typeof weather?.windSpeedMph === "number"
                ? weather.windSpeedMph
                : null;
            const gust =
              typeof weather?.windGustMph === "number"
                ? weather.windGustMph
                : null;
            const wave =
              typeof marine?.waveHeightFt === "number"
                ? marine.waveHeightFt
                : null;
            const period =
              typeof marine?.wavePeriodSeconds === "number"
                ? marine.wavePeriodSeconds
                : null;
            const waterTemp =
              typeof marine?.waterTemperatureF === "number"
                ? marine.waterTemperatureF
                : null;

            const score = currentConditionScore(
              spot.activity,
              { wind, gust, wave, period }
            );

            const level =
              alertLevels[spot.key] || "off";
            const threshold =
              level === "excellent" ? 90 : 70;

            return {
              key: spot.key,
              spot,
              check: {
                score,
                label: currentConditionLabel(score),
                checkedAt: new Date().toISOString(),
                triggered: score >= threshold,
                threshold,
                wind,
                gust,
                wave,
                period,
                waterTemp,
              } satisfies WaterAlertCheck,
            };
          } catch (error) {
            console.error(
              `Condition Alert check failed for ${spot.name}:`,
              error
            );
            return null;
          }
        })
      );

      setAlertChecks((current) => {
        const next = { ...current };

        for (const item of checked) {
          if (item) {
            next[item.key] = item.check;
          }
        }

        return next;
      });

      for (const item of checked) {
        if (item) {
          maybeSendBrowserNotification(
            item.spot,
            item.check
          );
        }
      }
    } finally {
      setCheckingAlerts(false);
    }
  }

  function buildSavedWaterTripRow(
    spot: SavedWaterSpot,
    userId: string
  ) {
    const start = location
      ? [location.name, location.state]
          .filter(Boolean)
          .join(", ")
      : startingLocation.trim() || null;

    const tripRequest = `
WATER_SPOT_KEY: ${spot.key}

Starting Location: ${start || "Ask the traveler for their starting location."}

Time Available: ${when}

Travelers: 1

Trip Request:
Create a complete On the Water trip to ${spot.name}${
      spot.region ? `, ${spot.region}` : ""
    }.

Activity: ${spot.activity}
Water Type: ${spot.waterType || "Either"}
Saved Condition Score: ${spot.score}/100 - ${spot.label}
Saved Distance: ${spot.distanceMiles} miles
${spot.bestTime ? `Saved Best Condition Window: ${spot.bestTime}` : ""}

Use the selected water destination as the exact trip destination. Include realistic travel time, parking or launch/access information, activity timing, food, fuel, gear/rental or lessons when relevant, weather/marine checks, safety considerations, estimated costs, and a realistic return-home time.
    `.trim();

    const itinerary = `
ON THE WATER SAVED SPOT

Destination: ${spot.name}${spot.region ? `, ${spot.region}` : ""}
Activity: ${spot.activity}
Water Type: ${spot.waterType || "Either"}
Condition Score when saved: ${spot.score}/100 - ${spot.label}
Distance when saved: ${spot.distanceMiles} miles
${spot.bestTime ? `Best condition window when saved: ${spot.bestTime}` : ""}

This destination was saved from TrippinDays On the Water. Conditions can change, so re-check the Water Toolkit and current forecasts before leaving. Use Plan This Trip from On the Water whenever you want TrippinDays to build the complete current itinerary.
    `.trim();

    return {
      user_id: userId,
      title: `${spot.name} • ${spot.activity}`,
      starting_location: start,
      destination: [spot.name, spot.region]
        .filter(Boolean)
        .join(", "),
      image_url: null,
      budget: null,
      time_available: when,
      travelers: "1",
      trip_request: tripRequest,
      itinerary,
      trip_snapshot: {
        source: "on-the-water",
        waterSpotKey: spot.key,
        summary: `${spot.activity} at ${spot.name} saved from On the Water.`,
        waterSpot: {
          key: spot.key,
          name: spot.name,
          region: spot.region || "",
          category: spot.category || "Water Destination",
          latitude: spot.latitude,
          longitude: spot.longitude,
          distanceMiles: spot.distanceMiles,
          score: spot.score,
          label: spot.label,
          bestTime: spot.bestTime || "",
          activity: spot.activity,
          waterType: spot.waterType || "Either",
          targetSpecies: spot.targetSpecies || [],
          seasonalStatus: spot.seasonalStatus || "",
          seasonalNote: spot.seasonalNote || "",
        },
        whySelected: [
          `Saved condition score: ${spot.score}/100 - ${spot.label}.`,
          `${spot.distanceMiles} miles from the selected starting point when saved.`,
          spot.bestTime
            ? `Best saved condition window: ${spot.bestTime}.`
            : "Re-check current conditions before leaving.",
        ],
      },
      status: "saved",
    };
  }

  async function toggleSavedWaterSpot(place: {
    name: string;
    region?: string;
    category?: string;
    latitude: number;
    longitude: number;
    distanceMiles: number;
    score: number;
    label: string;
    bestTime?: string;
    waterType?: WaterType;
    targetSpecies?: string[];
    seasonalStatus?: string;
    seasonalNote?: string;
  }) {
    if (!isPremium) {
      setMessage(
        "Saved Water Spots are an On the Water Premium feature."
      );
      return;
    }

    const key = waterSpotKey(place);

    if (savingSpotKey === key) {
      return;
    }

    const existingSpot = savedSpots.find(
      (spot) => spot.key === key
    );

    const supabase = createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      window.location.href =
        "/login?redirect=/on-the-water";
      return;
    }

    setSavingSpotKey(key);

    try {
      if (existingSpot) {
        if (existingSpot.tripId) {
          const { error: deleteError } = await supabase
            .from("trips")
            .delete()
            .eq("id", existingSpot.tripId)
            .eq("user_id", user.id);

          if (deleteError) {
            throw deleteError;
          }
        }

        persistSavedSpots(
          savedSpots.filter(
            (spot) => spot.key !== key
          )
        );

        const nextAlertLevels = { ...alertLevels };
        delete nextAlertLevels[key];
        persistAlertLevels(nextAlertLevels);

        setAlertChecks((current) => {
          const updated = { ...current };
          delete updated[key];
          return updated;
        });

        const { error: alertDeleteError } = await supabase
          .from("water_condition_alerts")
          .delete()
          .eq("user_id", user.id)
          .eq("spot_key", key);

        if (alertDeleteError) {
          console.error(
            "Could not remove saved Water Spot alert:",
            alertDeleteError
          );
        }

        setMessage(
          `${place.name} removed from Saved Water Spots and My Trips.`
        );
        return;
      }

      const nextSpot: SavedWaterSpot = {
        key,
        name: place.name,
        region: place.region || "",
        category: place.category || "Water Destination",
        latitude: Number(place.latitude),
        longitude: Number(place.longitude),
        distanceMiles: Number(place.distanceMiles) || 0,
        score: Number(place.score) || 0,
        label: place.label || "Conditions Available",
        bestTime: place.bestTime || "",
        activity,
        waterType:
          waterType === "Either" && place.waterType
            ? place.waterType
            : waterType || "Either",
        targetSpecies:
          Array.isArray(place.targetSpecies)
            ? place.targetSpecies.slice(0, 4)
            : [],
        seasonalStatus:
          typeof place.seasonalStatus === "string"
            ? place.seasonalStatus
            : "",
        seasonalNote:
          typeof place.seasonalNote === "string"
            ? place.seasonalNote
            : "",
      };

      const { data: savedTrip, error: insertError } = await supabase
        .from("trips")
        .insert(
          buildSavedWaterTripRow(
            nextSpot,
            user.id
          )
        )
        .select("id")
        .single();

      if (insertError) {
        throw insertError;
      }

      const syncedSpot: SavedWaterSpot = {
        ...nextSpot,
        tripId: savedTrip?.id || undefined,
      };

      persistSavedSpots(
        [syncedSpot, ...savedSpots].slice(0, 20)
      );

      if (savedTrip?.id) {
        localStorage.setItem(
          "trippindays-last-saved-trip-id",
          savedTrip.id
        );
      }

      setMessage(
        `${place.name} saved to Water Spots and My Trips.`
      );
    } catch (error) {
      console.error(
        "Could not sync Water Spot with My Trips:",
        error
      );

      setMessage(
        error instanceof Error
          ? `Could not save ${place.name} to My Trips: ${error.message}`
          : `Could not save ${place.name} to My Trips.`
      );
    } finally {
      setSavingSpotKey(null);
    }
  }

  function toolkitLocationFor(
    place?:
      | Pick<
          WaterResult,
          "name" | "region" | "latitude" | "longitude"
        >
      | SavedWaterSpot
      | null
  ) {
    if (place) {
      return {
        name: place.name,
        state: place.region || undefined,
        latitude: place.latitude,
        longitude: place.longitude,
        source: "search" as const,
      };
    }

    if (location) {
      return location;
    }

    return null;
  }

  function syncToolkitDestination(
    place:
      | WaterResult
      | SavedWaterSpot
  ) {
    const toolkitLocation = toolkitLocationFor(place);

    if (!toolkitLocation) return;

    try {
      localStorage.setItem(
        "trippindays-water-toolkit-location",
        JSON.stringify(toolkitLocation)
      );
    } catch {}

    window.dispatchEvent(
      new CustomEvent("trippindays:water-destination", {
        detail: toolkitLocation,
      })
    );
  }

  function openWaterToolkit(
    tab: "conditions" | "tools" | "float" | "sos",
    place?: WaterResult | SavedWaterSpot | null
  ) {
    const toolkitLocation = toolkitLocationFor(place);

    window.dispatchEvent(
      new CustomEvent("trippindays:open-water-toolkit", {
        detail: {
          tab,
          location: toolkitLocation || undefined,
        },
      })
    );
  }

  function selectWaterPlace(id: string) {
    setSelectedId(id);

    const place = results.find((item) => item.id === id);

    if (place) {
      syncToolkitDestination(place);
    }
  }

  function openWaterResource(
    resource:
      | "cameras"
      | "tides"
      | "buoys"
      | "forecast"
      | "temperature"
      | "alerts"
  ) {
    const focus = selectedPlace || results[0] || null;
    const focusLocation = toolkitLocationFor(focus);

    if (resource === "temperature") {
      openWaterToolkit("conditions", focus);
      return;
    }

    const lat = focusLocation?.latitude;
    const lon = focusLocation?.longitude;

    let url = "";

    if (resource === "cameras") {
      url = "https://www.ndbc.noaa.gov/buoycams.shtml";
    } else if (resource === "tides") {
      url = "https://tidesandcurrents.noaa.gov/";
    } else if (resource === "buoys") {
      url =
        lat != null && lon != null
          ? `https://www.ndbc.noaa.gov/?lat=${lat}&lon=${lon}&ls=false&status=r&type=h&zoom=8`
          : "https://www.ndbc.noaa.gov/observations.shtml";
    } else if (resource === "forecast") {
      url = "https://www.weather.gov/marine/";
    } else if (resource === "alerts") {
      url = "https://www.weather.gov/alerts";
    }

    window.open(
      url,
      "_blank",
      "noopener,noreferrer"
    );
  }

  /* =========================================================
     HERO ACTIVITY TILE SELECTION

     Clicking Surfing / PWC / Fishing / Kayak / Sailing in the
     hero now automatically fills the matching planner activity.
  ========================================================= */

  useEffect(() => {
    function handleWaterActivity(event: Event) {
      const customEvent = event as CustomEvent<string>;
      const selectedActivity = customEvent.detail;

      if (
        !selectedActivity ||
        !activities.includes(selectedActivity)
      ) {
        return;
      }

      setActivity(selectedActivity);

      // Make the user explicitly choose Freshwater / Saltwater / Either
      // for the newly selected activity.
      setWaterType("");

      setResults([]);
      setSelectedId(null);
      setMessage("");

      window.setTimeout(() => {
        document
          .getElementById("water-planner")
          ?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
      }, 50);
    }

    window.addEventListener(
      "trippindays:water-activity",
      handleWaterActivity
    );

    return () => {
      window.removeEventListener(
        "trippindays:water-activity",
        handleWaterActivity
      );
    };
  }, []);

  function changeActivity(nextActivity: string) {
    setActivity(nextActivity);
    setWaterType("");
    setResults([]);
    setSelectedId(null);
    setMessage("");
  }

  /* =========================================================
     LOCATION
  ========================================================= */

  async function geocodeTypedLocation() {
    const query = startingLocation.trim();

    if (!query) {
      setMessage("Enter a starting location first.");
      return null;
    }

    if (
      query === "Current Location" &&
      location?.source === "gps"
    ) {
      return location;
    }

    if (location?.source === "search") {
      const existing = [location.name, location.state]
        .filter(Boolean)
        .join(", ");

      if (query === existing) {
        return location;
      }
    }

    const response = await fetch(
      `/api/on-the-water/geocode?q=${encodeURIComponent(query)}`,
      {
        cache: "no-store",
      }
    );

    const data = await response.json();

    if (
      !response.ok ||
      !Array.isArray(data.results) ||
      data.results.length === 0
    ) {
      throw new Error("We couldn't find that starting location.");
    }

    const found = data.results[0];

    const nextLocation: WaterLocation = {
      name: found.name,
      state: found.state,
      latitude: Number(found.latitude),
      longitude: Number(found.longitude),
      source: "search",
    };

    setLocation(nextLocation);

    setStartingLocation(
      [nextLocation.name, nextLocation.state]
        .filter(Boolean)
        .join(", ")
    );

    localStorage.setItem(
      "trippindays-water-location",
      JSON.stringify(nextLocation)
    );

    return nextLocation;
  }

  function useMyLocation() {
    setMessage("");

    if (!navigator.geolocation) {
      setMessage("Location services are not available.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLocation: WaterLocation = {
          name: "Current Location",
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          source: "gps",
        };

        setLocation(nextLocation);
        setStartingLocation("Current Location");
        setResults([]);
        setSelectedId(null);

        localStorage.setItem(
          "trippindays-water-location",
          JSON.stringify(nextLocation)
        );
      },
      () => {
        setMessage(
          "Could not get your location. Enter a city, state, or ZIP instead."
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000,
      }
    );
  }

  /* =========================================================
     SEARCH
  ========================================================= */

  async function findBestConditions() {
    if (searching) return;

    if (!waterType) {
      setMessage(
        `Choose Freshwater, Saltwater, or Either for ${activity} before searching.`
      );
      return;
    }

    if (!isPremium && Number(radius) > 150) {
      setMessage(
        "Searches beyond 150 miles are an On the Water Premium feature."
      );
      return;
    }

    setSearching(true);
    setMessage("");
    setResults([]);
    setSelectedId(null);

    try {
      const start = await geocodeTypedLocation();

      if (!start) return;

      const displayLocation = [
        start.name,
        start.state,
      ]
        .filter(Boolean)
        .join(", ");

      let recentDestinations: string[] = [];

      try {
        const savedRecent = localStorage.getItem(
          RECENT_WATER_DESTINATIONS_KEY
        );

        if (savedRecent) {
          const parsedRecent = JSON.parse(savedRecent);

          if (Array.isArray(parsedRecent)) {
            recentDestinations = parsedRecent
              .filter((item) => typeof item === "string")
              .slice(0, 5);
          }
        }
      } catch {
        recentDestinations = [];
      }

      // Server-verified Premium access: send the current Supabase token.
      // The API, not browser state, decides whether paid water data is returned.
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const accessToken = session?.access_token || "";

      const response = await fetch(
        "/api/on-the-water/search",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(accessToken
              ? { Authorization: `Bearer ${accessToken}` }
              : {}),
          },
          cache: "no-store",
          body: JSON.stringify({
            latitude: start.latitude,
            longitude: start.longitude,
            location: displayLocation,
            startingLocation: displayLocation,
            radius: Number(radius),
            radiusMiles: Number(radius),
            activity,
            waterType,
            skill,
            when,
            fishingAccess,
            targetSpecies: targetFish,
            fishingAdventure,
            recentDestinations,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            `Water search failed with status ${response.status}.`
        );
      }

      // Keep browser UI aligned with the server's verified entitlement.
      if (
        data?.access &&
        typeof data.access.isPremium === "boolean"
      ) {
        setIsPremium(data.access.isPremium === true);
      }

      // If a non-Premium request asked for a paid radius, the server
      // clamps it. Reflect that server decision in the UI.
      if (
        Number.isFinite(Number(data?.radiusMiles)) &&
        Number(data.radiusMiles) !== Number(radius)
      ) {
        setRadius(String(data.radiusMiles));
      }

      const rawResults = Array.isArray(data.results)
        ? data.results
        : [];

      const cleaned: WaterResult[] = rawResults
        .map((item: any, index: number) => ({
          id:
            item.id ||
            `${String(item.name || "water")
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")}-${index}`,
          rank: Number(item.rank) || index + 1,
          name:
            item.name ||
            `Water Destination ${index + 1}`,
          region: item.region || "",
          category:
            item.category ||
            item.kind ||
            "Water Destination",
          latitude: Number(item.latitude),
          longitude: Number(item.longitude),
          distanceMiles: Number(item.distanceMiles) || 0,
          score: Number(item.score) || 0,
          label: item.label || "Conditions Available",
          bestTime: item.bestTime || "",
          wind: numberOrNull(item.wind),
          gust: numberOrNull(item.gust),
          wave: numberOrNull(item.wave),
          period: numberOrNull(item.period),
          swell: numberOrNull(item.swell),
          swellPeriod: numberOrNull(item.swellPeriod),
          waterTemp: numberOrNull(item.waterTemp),
          marineAvailable:
            item.marineAvailable === true,
          waterType:
            item.waterType === "Freshwater" ||
            item.waterType === "Saltwater"
              ? item.waterType
              : undefined,
          popularity:
            typeof item.popularity === "string"
              ? item.popularity
              : undefined,
          fishingAccess: Array.isArray(item.fishingAccess)
            ? item.fishingAccess.filter(
                (value: unknown): value is string =>
                  typeof value === "string"
              )
            : [],
          targetSpecies: Array.isArray(item.targetSpecies)
            ? item.targetSpecies.filter(
                (value: unknown): value is string =>
                  typeof value === "string"
              )
            : [],
          seasonalStatus:
            typeof item.seasonalStatus === "string"
              ? item.seasonalStatus
              : undefined,
          seasonalNote:
            typeof item.seasonalNote === "string"
              ? item.seasonalNote
              : undefined,
          publicAccess:
            typeof item.publicAccess === "string"
              ? item.publicAccess
              : undefined,
          rulesNote:
            typeof item.rulesNote === "string"
              ? item.rulesNote
              : undefined,
          hourly: Array.isArray(item.hourly)
            ? item.hourly
                .map((point: any) => ({
                  time: String(point.time || ""),
                  score: Number(point.score) || 0,
                  wind: numberOrNull(point.wind),
                  gust: numberOrNull(point.gust),
                  wave: numberOrNull(point.wave),
                  period: numberOrNull(point.period),
                  swell: numberOrNull(point.swell),
                  swellPeriod: numberOrNull(
                    point.swellPeriod
                  ),
                  waterTemp: numberOrNull(
                    point.waterTemp
                  ),
                }))
                .filter(
                  (point: HourlyWaterPoint) =>
                    point.time.length > 0
                )
            : [],
        }))
        .filter(
          (item: WaterResult) =>
            Number.isFinite(item.latitude) &&
            Number.isFinite(item.longitude)
        );

      setResults(cleaned);

      if (cleaned.length > 0) {
        setSelectedId(cleaned[0].id);
        syncToolkitDestination(cleaned[0]);

        try {
          const leadName = cleaned[0].name;
          const nextRecent = [
            leadName,
            ...recentDestinations.filter(
              (name) =>
                name.toLowerCase() !==
                leadName.toLowerCase()
            ),
          ].slice(0, 5);

          localStorage.setItem(
            RECENT_WATER_DESTINATIONS_KEY,
            JSON.stringify(nextRecent)
          );
        } catch {
          // Search history is optional.
        }

        setMessage(
          `Found ${cleaned.length} ${waterType.toLowerCase()} ${activity.toLowerCase()} destination${
            cleaned.length === 1 ? "" : "s"
          }.`
        );
      } else {
        setMessage(
          data.message ||
            `No ${waterType.toLowerCase()} ${activity.toLowerCase()} destinations were returned within ${radius} miles.`
        );
      }
    } catch (error) {
      console.error("WATER SEARCH ERROR", error);

      setMessage(
        error instanceof Error
          ? error.message
          : "Water destination search failed."
      );
    } finally {
      setSearching(false);
    }
  }

  /* =========================================================
     PLAN THIS TRIP

     Uses the SAME TrippinDays trip flow as the main site:
     save trippindays-request -> open /trip.
  ========================================================= */

  function planWaterTrip(
    place: {
      name: string;
      region?: string;
      latitude: number;
      longitude: number;
      distanceMiles: number;
      score: number;
      label: string;
      bestTime?: string;
      waterType?: WaterType;
      popularity?: string;
      fishingAccess?: string[];
      targetSpecies?: string[];
      seasonalStatus?: string;
      seasonalNote?: string;
      publicAccess?: string;
    },
    savedContext?: {
      activity?: string;
      waterType?: WaterType;
    }
  ) {
    const tripActivity =
      savedContext?.activity || activity;

    const selectedWaterType =
      savedContext?.waterType ||
      waterType ||
      "Either";

    const tripWaterType =
      selectedWaterType === "Either" && place.waterType
        ? place.waterType
        : selectedWaterType;

    const start = location
      ? [location.name, location.state]
          .filter(Boolean)
          .join(", ")
      : startingLocation.trim() || "Current Location";

    const waterPreferenceText =
      tripWaterType === "Either"
        ? "Either freshwater or saltwater is acceptable."
        : `${tripWaterType} only.`;

    const fullRequest = `
Starting Location: ${start}

Budget: $100

Time Available: ${when}

Travelers: 1

Trip Request:
Create a complete On the Water trip specifically to ${place.name}${
      place.region ? `, ${place.region}` : ""
    }.

Activity: ${tripActivity}
Water Type: ${tripWaterType}
Condition Score: ${place.score}/100 - ${place.label}
Distance from starting point: ${place.distanceMiles} miles
${
  place.bestTime
    ? `Best condition window: ${place.bestTime}`
    : ""
}

${waterPreferenceText}
${
  tripActivity === "Fishing"
    ? `Fishing focus: ${place.targetSpecies?.join(", ") || targetFish || "Anything active now"}
Fishing access: ${place.fishingAccess?.join(", ") || fishingAccess}
Spot type: ${place.popularity || fishingAdventure}
Seasonal status: ${place.seasonalStatus || "Check current seasonal opportunity"}
${place.seasonalNote || ""}
${place.publicAccess ? `Public access: ${place.publicAccess}` : ""}
Always tell the traveler to verify the current official fishing regulations, emergency closures, retention limits, and gear rules before leaving.`
    : ""
}

Build the trip around ${tripActivity.toLowerCase()} at this exact destination. Include realistic driving time and distance, parking or launch/access information, activity timing around the best available conditions, food, fuel, gear/rental or lessons when relevant, weather/marine checks, safety considerations, estimated costs, and a realistic return-home time.
    `.trim();

    localStorage.setItem(
      "trippindays-request",
      fullRequest
    );

    localStorage.setItem(
      "trippindays-water-trip",
      JSON.stringify({
        destination: place.name,
        region: place.region || "",
        latitude: place.latitude,
        longitude: place.longitude,
        activity: tripActivity,
        waterType: tripWaterType,
        score: place.score,
        label: place.label,
        distanceMiles: place.distanceMiles,
        bestTime: place.bestTime || "",
        startingLocation: start,
        when,
      })
    );

    window.location.href = "/trip";
  }

  function planSavedWaterTrip(
    spot: SavedWaterSpot
  ) {
    planWaterTrip(spot, {
      activity: spot.activity,
      waterType: spot.waterType,
    });
  }

  const enabledAlertSpots = savedSpots.filter(
    (spot) =>
      (alertLevels[spot.key] || "off") !== "off"
  );

  const triggeredAlertSpots = enabledAlertSpots.filter(
    (spot) => alertChecks[spot.key]?.triggered === true
  );

  const visibleResults = isPremium
    ? results
    : results.slice(0, 3);

  const selectedPlace =
    visibleResults.find(
      (place) => place.id === selectedId
    ) ?? visibleResults[0] ?? null;

  return (
    <section
      id="water-planner"
      className="bg-[#eef7fa] px-4 py-10 sm:px-6"
    >
      <div className="mx-auto max-w-[1500px]">
        <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
          {/* PLANNER */}
          <div className="rounded-3xl bg-white p-6 shadow-md">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-3xl font-black text-[#073b59]">
                  🌊 Plan Your On the Water Adventure
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Choose the activity, water type and region. We&apos;ll rank real destinations by conditions.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {!premiumLoading && isPremium && (
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800">
                    ★ Premium Active
                  </span>
                )}

                <button
                  type="button"
                  onClick={useMyLocation}
                  className="font-bold text-cyan-700"
                >
                  📍 Use My Location
                </button>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <Field title="Activity">
                <select
                  className={inputClass}
                  value={activity}
                  onChange={(event) =>
                    changeActivity(event.target.value)
                  }
                >
                  {activities.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </Field>

              <Field title={waterTypeLabel(activity)}>
                <select
                  className={inputClass}
                  value={waterType}
                  onChange={(event) => {
                    setWaterType(
                      event.target.value as WaterType
                    );
                    setResults([]);
                    setSelectedId(null);
                    setMessage("");
                  }}
                >
                  <option value="">
                    Choose water type...
                  </option>
                  <option value="Freshwater">
                    {activity === "Surfing"
                      ? "Freshwater / Great Lakes"
                      : "Freshwater"}
                  </option>
                  <option value="Saltwater">
                    Saltwater
                  </option>
                  <option value="Either">
                    Either
                  </option>
                </select>
              </Field>

              <Field title="Starting Location">
                <input
                  className={inputClass}
                  value={startingLocation}
                  onChange={(event) => {
                    setStartingLocation(event.target.value);
                    setMessage("");
                    setResults([]);
                    setSelectedId(null);

                    if (
                      event.target.value !==
                      "Current Location"
                    ) {
                      setLocation(null);
                    }
                  }}
                  placeholder="City, state or ZIP"
                />
              </Field>

              <Field title="Search Radius">
                <select
                  className={inputClass}
                  value={radius}
                  onChange={(event) => {
                    setRadius(event.target.value);
                    setResults([]);
                    setSelectedId(null);
                  }}
                >
                  <option value="50">Within 50 miles</option>
                  <option value="100">Within 100 miles</option>
                  <option value="150">Within 150 miles</option>
                  <option
                    value="200"
                    disabled={!isPremium}
                  >
                    Within 200 miles
                    {isPremium ? "" : " — Premium"}
                  </option>
                  <option
                    value="250"
                    disabled={!isPremium}
                  >
                    Within 250 miles
                    {isPremium ? "" : " — Premium"}
                  </option>
                </select>
              </Field>

              <Field title="Experience">
                <select
                  className={inputClass}
                  value={skill}
                  onChange={(event) =>
                    setSkill(event.target.value)
                  }
                >
                  <option>Beginner</option>
                  <option>Intermediate</option>
                  <option>Advanced</option>
                  <option>Expert</option>
                </select>
              </Field>

              <Field title="When">
                <select
                  className={inputClass}
                  value={when}
                  onChange={(event) =>
                    setWhen(event.target.value)
                  }
                >
                  <option>Today</option>
                  <option>Tomorrow</option>
                  <option>This Weekend</option>
                  <option>Next 7 Days</option>
                </select>
              </Field>

              {activity === "Fishing" && (
                <>
                  <Field title="Fishing Access">
                    <select
                      className={inputClass}
                      value={fishingAccess}
                      onChange={(event) => {
                        setFishingAccess(event.target.value);
                        setResults([]);
                        setSelectedId(null);
                      }}
                    >
                      <option>Any</option>
                      <option>Bank / Shore</option>
                      <option>Pier / Jetty</option>
                      <option>Boat</option>
                      <option>Kayak</option>
                      <option>Wade</option>
                    </select>
                  </Field>

                  <Field title="Target Fish">
                    <input
                      className={inputClass}
                      value={targetFish}
                      onChange={(event) => {
                        setTargetFish(event.target.value);
                        setResults([]);
                        setSelectedId(null);
                      }}
                      placeholder="Anything Active Now, salmon, halibut..."
                    />
                  </Field>

                  <Field title="Adventure Level">
                    <select
                      className={inputClass}
                      value={fishingAdventure}
                      onChange={(event) => {
                        setFishingAdventure(event.target.value);
                        setResults([]);
                        setSelectedId(null);
                      }}
                    >
                      <option>Either</option>
                      <option>Easy Access</option>
                      <option>A Little Exploring</option>
                      <option>Find Me a Hidden Gem</option>
                    </select>
                  </Field>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={findBestConditions}
              disabled={searching}
              className="mt-7 w-full rounded-xl bg-[#078dcf] px-6 py-4 text-lg font-black text-white shadow hover:bg-[#067bb4] disabled:opacity-60"
            >
              {searching
                ? "Finding Your Best Conditions..."
                : "Find My Best Conditions →"}
            </button>

            {message && (
              <div className="mt-4 rounded-xl border border-cyan-200 bg-cyan-50 p-4 font-semibold text-[#07507a]">
                {message}
              </div>
            )}
          </div>

          {/* MAP */}
          <div className="rounded-3xl bg-white p-5 shadow-md">
            <h3 className="text-2xl font-black text-[#073b59]">
              Search Near You
            </h3>

            <p className="mb-4 text-sm text-slate-500">
              Tap a ranked pin to see the destination and plan that exact trip.
            </p>

            <OnTheWaterMap
              startLatitude={
                location?.latitude ?? 39.8283
              }
              startLongitude={
                location?.longitude ?? -98.5795
              }
              startLabel={
                location
                  ? [location.name, location.state]
                      .filter(Boolean)
                      .join(", ")
                  : "Choose a location"
              }
              showStartMarker={Boolean(location)}
              places={visibleResults}
              selectedId={selectedId}
              onSelect={selectWaterPlace}
              onPlanTrip={planWaterTrip}
              savedKeys={savedSpots.map(
                (spot) => spot.key
              )}
              onToggleSaved={toggleSavedWaterSpot}
            />
          </div>
        </div>

        {!premiumLoading && isPremium && (
          <div className="mt-6 overflow-hidden rounded-3xl border border-amber-300 bg-gradient-to-r from-[#052f49] via-[#064f70] to-[#078dcf] p-5 text-white shadow-lg sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.2em] text-amber-300">
                  ★ On the Water Premium Active
                </div>
                <h3 className="mt-1 text-2xl font-black">
                  Advanced water intelligence is unlocked.
                </h3>
                <p className="mt-2 text-sm font-semibold text-cyan-50">
                  You get up to 6 ranked destinations, 250-mile searches, best-condition windows, detailed water data, Saved Water Spots, and activity-specific Condition Alerts.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 text-xs font-black">
                <span className="rounded-full bg-white/10 px-3 py-2">6 ranked spots</span>
                <span className="rounded-full bg-white/10 px-3 py-2">250 mi search</span>
                <span className="rounded-full bg-white/10 px-3 py-2">Best windows</span>
                <span className="rounded-full bg-white/10 px-3 py-2">Advanced conditions</span>
                <span className="rounded-full bg-white/10 px-3 py-2">★ Saved spots</span>
                <span className="rounded-full bg-white/10 px-3 py-2">🔔 Condition alerts</span>
                <span className="rounded-full bg-white/10 px-3 py-2">📲 Device push</span>
              </div>
            </div>
          </div>
        )}

        {/* PREMIUM CONDITION ALERTS */}
        {!premiumLoading &&
          isPremium && (
            <div className="mt-8 rounded-3xl border border-cyan-200 bg-cyan-50 p-5 shadow-md sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.18em] text-cyan-700">
                    🔔 Premium Condition Alerts
                  </div>
                  <h2 className="mt-1 text-2xl font-black text-[#073b59]">
                    {enabledAlertSpots.length > 0
                      ? "Your saved water is being checked."
                      : "Set up your water alerts."}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {enabledAlertSpots.length > 0
                      ? "Alerts are activity-specific. Saved spots are checked in the background, and Fishing spots also track seasonal opportunities."
                      : "Enable browser alerts, then turn on Good or Excellent alerts for any saved water spot."}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {notificationPermission === "unsupported" ? (
                    <span className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-black text-slate-500">
                      Browser alerts unavailable
                    </span>
                  ) : browserNotificationsEnabled ? (
                    <button
                      type="button"
                      onClick={() =>
                        void disableBrowserNotifications()
                      }
                      className="rounded-xl border border-rose-200 bg-white px-4 py-3 text-sm font-black text-rose-700 transition hover:bg-rose-50"
                    >
                      🔔 Turn Browser Alerts Off
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        void enableBrowserNotifications()
                      }
                      className="rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm font-black text-emerald-700 transition hover:bg-emerald-50"
                    >
                      🔔 Turn Browser Alerts On
                    </button>
                  )}

                  {enabledAlertSpots.length > 0 ? (
                    <button
                      type="button"
                      onClick={() =>
                        void checkSavedSpotAlerts(
                          enabledAlertSpots
                        )
                      }
                      disabled={checkingAlerts}
                      className="rounded-xl bg-[#078dcf] px-4 py-3 text-sm font-black text-white transition hover:bg-[#067bb4] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {checkingAlerts
                        ? "Checking..."
                        : "Check Alerts Now"}
                    </button>
                  ) : (
                    <span className="max-w-[290px] text-xs font-bold leading-relaxed text-slate-500">
                      Choose an alert level on any Saved Water Spot to start monitoring it.
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-cyan-100 bg-white/80 p-4 text-xs leading-relaxed text-slate-600">
                <span className="font-black text-[#073b59]">Browser alerts:</span>{" "}
                {browserNotificationsEnabled
                  ? `ON${pushSubscriptionReady ? " — device push is registered." : "."} Background alerts can notify this device when a saved spot reaches its threshold, including when TrippinDays is not open.`
                  : notificationPermission === "denied"
                    ? "OFF — blocked by this browser. In-app Condition Alerts still work."
                    : "OFF — turn them on to get device/browser notifications."}
                <span className="mt-1 block text-slate-400">
                  Fishing alerts also watch the saved spot's typical regional seasonal opportunity and can notify you when it moves into Active or Peak.
                </span>
              </div>

              {enabledAlertSpots.length === 0 && (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
                  Save a water spot, then set its Condition Alert to <strong>Good or better</strong> or <strong>Excellent only</strong>. Browser alerts can be enabled before you do that.
                </div>
              )}

              {triggeredAlertSpots.length > 0 ? (
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  {triggeredAlertSpots.map((spot) => {
                    const check = alertChecks[spot.key];

                    return (
                      <div
                        key={spot.key}
                        className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-xs font-black uppercase tracking-wide text-emerald-700">
                              Conditions Met
                            </div>
                            <h3 className="mt-1 text-lg font-black text-[#073b59]">
                              {spot.name}
                            </h3>
                            <div className="mt-1 text-sm font-semibold text-slate-500">
                              {spot.activity}
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-3xl font-black text-emerald-600">
                              {check?.score ?? "—"}
                            </div>
                            <div className="text-[10px] font-black uppercase text-slate-400">
                              /100
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm font-black text-emerald-800">
                          {check?.label || "Conditions available"}
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              openWaterToolkit(
                                "conditions",
                                spot
                              )
                            }
                            className="rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm font-black text-cyan-800"
                          >
                            Conditions
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              planSavedWaterTrip(spot)
                            }
                            className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-black text-white"
                          >
                            Plan Trip →
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-cyan-100 bg-white p-4 text-sm font-semibold text-slate-600">
                  {checkingAlerts
                    ? "Checking your saved spots against current conditions..."
                    : "No saved spot currently meets its alert threshold. We’ll keep checking while On the Water is open."}
                </div>
              )}
            </div>
          )}

        {/* SAVED WATER SPOTS */}
        {!premiumLoading &&
          isPremium &&
          savedSpots.length > 0 && (
            <div className="mt-8 rounded-3xl border border-amber-200 bg-white p-5 shadow-md sm:p-6">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.18em] text-amber-600">
                    ★ Premium
                  </div>
                  <h2 className="mt-1 text-2xl font-black text-[#073b59]">
                    Saved Water Spots
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Your favorite water destinations are saved on this device for quick planning and live condition checks.
                  </p>
                </div>

                <div className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-800">
                  {savedSpots.length} saved
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {savedSpots.map((spot) => (
                  <article
                    key={spot.key}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-black text-[#073b59]">
                          {spot.name}
                        </h3>

                        {spot.region && (
                          <div className="text-sm text-slate-500">
                            {spot.region}
                          </div>
                        )}

                        <div className="mt-2 text-xs font-black text-cyan-700">
                          {spot.activity} • {spot.waterType}
                        </div>

                        {spot.activity === "Fishing" &&
                          spot.targetSpecies &&
                          spot.targetSpecies.length > 0 && (
                            <div className="mt-1 text-xs font-semibold text-slate-500">
                              🐟 {spot.targetSpecies.join(", ")}
                              {spot.seasonalStatus
                                ? ` • ${spot.seasonalStatus}`
                                : ""}
                            </div>
                          )}
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          toggleSavedWaterSpot(spot)
                        }
                        className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800 transition hover:bg-amber-200"
                        title="Remove saved spot"
                      >
                        ★ Saved
                      </button>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-white p-3">
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                          Last saved score
                        </div>
                        <div className="text-sm font-bold text-slate-600">
                          {spot.label}
                        </div>
                      </div>

                      <div className="text-2xl font-black text-emerald-600">
                        {spot.score}
                        <span className="text-xs text-slate-400">
                          /100
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 rounded-xl border border-cyan-100 bg-white p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-wide text-cyan-700">
                            {spot.activity === "Fishing"
                              ? "🐟 Condition + Fish Run Alert"
                              : "🔔 Condition Alert"}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {spot.activity === "Fishing"
                              ? "Alert me when fishing conditions reach my threshold and when the saved fishery moves into an Active or Peak seasonal window."
                              : `Alert me when current ${spot.activity.toLowerCase()} conditions reach my threshold.`}
                          </div>
                        </div>

                        <select
                          value={
                            alertLevels[spot.key] || "off"
                          }
                          onChange={(event) =>
                            void setSpotAlertLevel(
                              spot,
                              event.target.value as WaterAlertLevel
                            )
                          }
                          className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-black text-cyan-900 outline-none"
                        >
                          <option value="off">Off</option>
                          <option value="good">Good or better (70+)</option>
                          <option value="excellent">Excellent only (90+)</option>
                        </select>
                      </div>

                      {alertChecks[spot.key] &&
                        (alertLevels[spot.key] || "off") !== "off" && (
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-cyan-100 pt-3 text-xs">
                            <span className="font-semibold text-slate-500">
                              Latest check: {alertChecks[spot.key].label}
                            </span>
                            <span className={`font-black ${
                              alertChecks[spot.key].triggered
                                ? "text-emerald-700"
                                : "text-slate-600"
                            }`}>
                              {alertChecks[spot.key].score}/100
                            </span>
                          </div>
                        )}
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          openWaterToolkit(
                            "conditions",
                            spot
                          )
                        }
                        className="rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm font-black text-cyan-800 transition hover:bg-cyan-100"
                      >
                        🌡️ Conditions
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          planSavedWaterTrip(spot)
                        }
                        className="rounded-xl bg-[#078dcf] px-3 py-2 text-sm font-black text-white transition hover:bg-[#067bb4]"
                      >
                        Plan Trip →
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}

        {/* RESULTS */}
        {results.length > 0 && (
          <div className="mt-8">
            <h2 className="text-3xl font-black text-[#073b59]">
              Best Conditions Near You
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {activity} • {waterType} • within {radius} miles
            </p>

            {!isPremium && results.length > 3 && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900">
                Free shows the top 3 ranked destinations. Premium unlocks all {results.length} results plus advanced condition details.
              </div>
            )}

            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {visibleResults.map((place) => (
                <article
                  key={place.id}
                  className={`rounded-2xl bg-white p-5 shadow-md ${
                    selectedId === place.id
                      ? "ring-4 ring-amber-400"
                      : ""
                  }`}
                >
                  <button
                    type="button"
                    onClick={() =>
                      selectWaterPlace(place.id)
                    }
                    className="w-full text-left"
                  >
                    <div className="flex justify-between gap-4">
                      <div>
                        <div className="text-sm font-black text-cyan-600">
                          #{place.rank}
                        </div>

                        <h3 className="mt-1 text-xl font-black text-[#073b59]">
                          {place.name}
                        </h3>

                        {place.region && (
                          <div className="text-sm text-slate-500">
                            {place.region}
                          </div>
                        )}

                        <div className="mt-2 text-sm text-slate-600">
                          {place.distanceMiles} miles away
                        </div>

                        <div className="mt-1 text-xs text-slate-500">
                          {place.category}
                        </div>

                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="inline-flex rounded-full bg-cyan-50 px-3 py-1 text-xs font-black text-cyan-800">
                            {place.waterType || waterType}
                          </span>
                          {activity === "Fishing" && place.popularity && (
                            <span className="inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-800">
                              {place.popularity === "Hidden Gem" ? "💎 " : "🎣 "}
                              {place.popularity}
                            </span>
                          )}
                          {activity === "Fishing" && place.seasonalStatus && (
                            <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-800">
                              🐟 {place.seasonalStatus}
                            </span>
                          )}
                        </div>

                        {activity === "Fishing" && (
                          <div className="mt-3 space-y-1 text-xs leading-relaxed text-slate-600">
                            {place.targetSpecies && place.targetSpecies.length > 0 && (
                              <div>
                                <span className="font-black text-[#073b59]">Target now:</span>{" "}
                                {place.targetSpecies.join(", ")}
                              </div>
                            )}
                            {place.fishingAccess && place.fishingAccess.length > 0 && (
                              <div>
                                <span className="font-black text-[#073b59]">Access:</span>{" "}
                                {place.fishingAccess.join(", ")}
                              </div>
                            )}
                            {place.publicAccess && (
                              <div>
                                <span className="font-black text-[#073b59]">Public access:</span>{" "}
                                {place.publicAccess}
                              </div>
                            )}
                            {place.seasonalNote && (
                              <div>{place.seasonalNote}</div>
                            )}
                            <div className="font-bold text-amber-700">
                              ⚖️ {place.rulesNote || "Check current official regulations before fishing."}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="text-right">
                        <div className="text-3xl font-black text-emerald-600">
                          {place.score}
                        </div>

                        <div className="text-xs text-slate-400">
                          /100
                        </div>

                        <div className="mt-1 text-xs font-bold text-emerald-700">
                          {place.label}
                        </div>
                      </div>
                    </div>
                  </button>

                  <div className="mt-5 grid grid-cols-[auto_1fr] gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        toggleSavedWaterSpot(place)
                      }
                      className={`rounded-xl border px-4 py-3 font-black transition ${
                        isWaterSpotSaved(place)
                          ? "border-amber-300 bg-amber-100 text-amber-900 hover:bg-amber-200"
                          : "border-slate-200 bg-white text-slate-600 hover:border-amber-300 hover:bg-amber-50"
                      }`}
                      title={
                        isPremium
                          ? isWaterSpotSaved(place)
                            ? "Remove from Saved Water Spots"
                            : "Save this Water Spot"
                          : "Premium feature"
                      }
                    >
                      {isWaterSpotSaved(place)
                        ? "★"
                        : "☆"}
                    </button>

                    <button
                      type="button"
                      onClick={() => planWaterTrip(place)}
                      className="rounded-xl bg-[#078dcf] px-4 py-3 font-black text-white transition hover:bg-[#067bb4]"
                    >
                      Plan This Trip →
                    </button>
                  </div>
                </article>
              ))}
            </div>

            {selectedPlace && (
              <div className="mt-6 overflow-hidden rounded-3xl border border-cyan-200 bg-white shadow-md">
                <div className="flex flex-wrap items-center justify-between gap-3 bg-[#073b59] px-5 py-4 text-white">
                  <div>
                    <div className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">
                      Advanced Water Intelligence
                    </div>
                    <h3 className="mt-1 text-xl font-black">
                      {selectedPlace.name}
                    </h3>
                  </div>

                  {isPremium ? (
                    <span className="rounded-full bg-emerald-400/20 px-3 py-1 text-xs font-black text-emerald-100">
                      Premium Unlocked
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-400/20 px-3 py-1 text-xs font-black text-amber-100">
                      🔒 Premium
                    </span>
                  )}
                </div>

                {isPremium ? (
                  <div className="p-5">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <PremiumMetric
                        label="Best Window"
                        value={
                          selectedPlace.bestTime
                            ? formatForecastTime(
                                selectedPlace.bestTime
                              )
                            : "Forecast window"
                        }
                      />
                      <PremiumMetric
                        label="Wind"
                        value={formatMetric(
                          selectedPlace.wind,
                          " mph"
                        )}
                      />
                      <PremiumMetric
                        label="Wind Gusts"
                        value={formatMetric(
                          selectedPlace.gust,
                          " mph"
                        )}
                      />
                      <PremiumMetric
                        label="Wave Height"
                        value={formatMetric(
                          selectedPlace.wave,
                          " ft"
                        )}
                      />
                      <PremiumMetric
                        label="Wave Period"
                        value={formatMetric(
                          selectedPlace.period,
                          " sec"
                        )}
                      />
                      <PremiumMetric
                        label="Swell"
                        value={formatMetric(
                          selectedPlace.swell,
                          " ft"
                        )}
                      />
                      <PremiumMetric
                        label="Swell Period"
                        value={formatMetric(
                          selectedPlace.swellPeriod,
                          " sec"
                        )}
                      />
                      <PremiumMetric
                        label="Water Temp"
                        value={formatMetric(
                          selectedPlace.waterTemp,
                          "°F"
                        )}
                      />
                    </div>

                    <div className="mt-6 border-t border-slate-200 pt-5">
                      <div className="flex flex-wrap items-end justify-between gap-3">
                        <div>
                          <div className="text-xs font-black uppercase tracking-[0.18em] text-cyan-700">
                            Premium Water Table
                          </div>
                          <h4 className="mt-1 text-xl font-black text-[#073b59]">
                            Hour-by-hour conditions
                          </h4>
                          <p className="mt-1 text-sm font-semibold text-slate-500">
                            Compare the forecast around the best condition window before choosing when to go.
                          </p>
                        </div>

                        <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
                          {selectedPlace.hourly.length} forecast hours
                        </div>
                      </div>

                      {selectedPlace.hourly.length > 0 ? (
                        <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
                          <table className="min-w-[850px] w-full border-collapse text-sm">
                            <thead className="bg-slate-50 text-left text-[11px] font-black uppercase tracking-wide text-slate-500">
                              <tr>
                                <th className="px-4 py-3">Time</th>
                                <th className="px-4 py-3">Score</th>
                                <th className="px-4 py-3">Wind</th>
                                <th className="px-4 py-3">Gusts</th>
                                <th className="px-4 py-3">Waves</th>
                                <th className="px-4 py-3">Period</th>
                                <th className="px-4 py-3">Swell</th>
                                <th className="px-4 py-3">Water</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedPlace.hourly.map((hour) => {
                                const isBest =
                                  hour.time ===
                                  selectedPlace.bestTime;

                                return (
                                  <tr
                                    key={hour.time}
                                    className={
                                      isBest
                                        ? "border-t border-slate-200 bg-emerald-50"
                                        : "border-t border-slate-200 bg-white"
                                    }
                                  >
                                    <td className="whitespace-nowrap px-4 py-3 font-black text-[#073b59]">
                                      {formatForecastTime(hour.time)}
                                      {isBest && (
                                        <span className="ml-2 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-black text-white">
                                          BEST
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 font-black text-emerald-700">
                                      {hour.score}/100
                                    </td>
                                    <td className="px-4 py-3">
                                      {formatShortMetric(hour.wind, " mph")}
                                    </td>
                                    <td className="px-4 py-3">
                                      {formatShortMetric(hour.gust, " mph")}
                                    </td>
                                    <td className="px-4 py-3">
                                      {formatShortMetric(hour.wave, " ft")}
                                    </td>
                                    <td className="px-4 py-3">
                                      {formatShortMetric(hour.period, " sec")}
                                    </td>
                                    <td className="px-4 py-3">
                                      {formatShortMetric(hour.swell, " ft")}
                                    </td>
                                    <td className="px-4 py-3">
                                      {formatShortMetric(hour.waterTemp, "°F")}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">
                          Hourly forecast details were not available for this destination.
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-5">
                    <p className="max-w-3xl text-sm font-semibold leading-6 text-slate-600">
                      The map, ranked destinations, basic
                      condition score, Plan This Trip, and
                      safety tools stay free. Premium unlocks
                      the detailed wind, gust, wave, swell,
                      water-temperature and best-window data,
                      plus expanded 200 and 250 mile searches.
                    </p>

                    <button
                      type="button"
                      onClick={openPremium}
                      className="mt-4 rounded-xl bg-amber-500 px-5 py-3 font-black text-slate-950 transition hover:bg-amber-400"
                    >
                      Unlock Advanced Water Tools →
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* PREMIUM CARD */}

        {!premiumLoading && !isPremium && (
          <div className="mt-8 overflow-hidden rounded-3xl bg-gradient-to-br from-[#052f49] via-[#064f70] to-[#078dcf] p-6 text-white shadow-xl sm:p-8">
            <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr] lg:items-center">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.2em] text-cyan-200">
                  TrippinDays On the Water Premium
                </div>

                <h2 className="mt-2 text-3xl font-black">
                  Go farther. Read the water better.
                </h2>

                <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-cyan-50">
                  Unlock advanced condition details,
                  expanded search range and deeper water
                  planning while keeping the basic map,
                  destination search, trip planning and
                  SOS/Safety free for everyone.
                </p>

                <div className="mt-5 flex flex-wrap gap-2 text-xs font-black">
                  <span className="rounded-full bg-white/10 px-3 py-2">
                    Detailed wave + swell data
                  </span>
                  <span className="rounded-full bg-white/10 px-3 py-2">
                    Wind + gust intelligence
                  </span>
                  <span className="rounded-full bg-white/10 px-3 py-2">
                    Water temperature
                  </span>
                  <span className="rounded-full bg-white/10 px-3 py-2">
                    200–250 mile searches
                  </span>
                </div>
              </div>

              <div className="rounded-2xl bg-white/10 p-5 backdrop-blur-sm">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  <div className="rounded-xl bg-white p-4 text-[#073b59]">
                    <div className="text-xs font-black uppercase text-cyan-700">
                      On the Water Premium
                    </div>
                    <div className="mt-1 text-2xl font-black">
                      $4.99
                      <span className="text-sm font-bold">
                        /mo
                      </span>
                    </div>
                    <div className="text-xs font-bold text-slate-500">
                      or $49.99/year
                    </div>
                  </div>

                  <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-[#073b59]">
                    <div className="text-xs font-black uppercase text-amber-700">
                      All Access
                    </div>
                    <div className="mt-1 text-2xl font-black">
                      $9.99
                      <span className="text-sm font-bold">
                        /mo
                      </span>
                    </div>
                    <div className="text-xs font-bold text-slate-500">
                      or $89.99/year
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={openPremium}
                  className="mt-4 w-full rounded-xl bg-amber-400 px-5 py-3 font-black text-slate-950 transition hover:bg-amber-300"
                >
                  View Premium Options →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* QUICK RESOURCES */}
        <div className="mt-8 rounded-3xl bg-[#063e5b] p-6 text-white shadow-lg">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black">
                On the Water Quick Resources
              </h2>
              <p className="mt-1 text-sm text-cyan-100">
                Live tools now open real NOAA / National Weather Service resources. Water Temperature opens your TrippinDays Toolkit for the selected destination.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                openWaterToolkit("tools", selectedPlace)
              }
              className="rounded-xl bg-white px-4 py-2 text-sm font-black text-[#063e5b] transition hover:bg-cyan-50"
            >
              🧭 Open Water Toolkit
            </button>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <ResourceButton
              icon="📹"
              title="Live Cameras"
              subtitle="NOAA BuoyCAMs"
              onClick={() => openWaterResource("cameras")}
            />

            <ResourceButton
              icon="↕️"
              title="Tide Charts"
              subtitle="NOAA Tides & Currents"
              onClick={() => openWaterResource("tides")}
            />

            <ResourceButton
              icon="🌊"
              title="Buoy Data"
              subtitle="NDBC near selected spot"
              onClick={() => openWaterResource("buoys")}
            />

            <ResourceButton
              icon="💨"
              title="Marine Forecast"
              subtitle="Official NWS marine"
              onClick={() => openWaterResource("forecast")}
            />

            <ResourceButton
              icon="🌡️"
              title="Water Temperature"
              subtitle="Open live Toolkit data"
              onClick={() => openWaterResource("temperature")}
            />

            <ResourceButton
              icon="⚠️"
              title="Marine Alerts"
              subtitle="Active NWS alerts"
              onClick={() => openWaterResource("alerts")}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function ResourceButton({
  icon,
  title,
  subtitle,
  onClick,
}: {
  icon: string;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl bg-white/10 p-4 text-left transition hover:-translate-y-0.5 hover:bg-white/20"
    >
      <div className="text-2xl">{icon}</div>
      <div className="mt-2 text-sm font-black">
        {title}
      </div>
      <div className="mt-1 text-[11px] font-semibold text-cyan-100">
        {subtitle}
      </div>
    </button>
  );
}



const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-semibold text-slate-700 outline-none focus:border-cyan-500";

function numberOrNull(value: unknown) {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function formatMetric(
  value: number | null,
  suffix: string
) {
  return value == null
    ? "Unavailable"
    : `${value}${suffix}`;
}

function formatShortMetric(
  value: number | null,
  suffix: string
) {
  return value == null
    ? "—"
    : `${value}${suffix}`;
}

function formatForecastTime(value: string) {
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/
  );

  if (!match) return value;

  const [, , month, day, hourText, minute] = match;
  let hour = Number(hourText);
  const suffix = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;

  return `${month}/${day} ${hour}:${minute} ${suffix}`;
}

function PremiumMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-xs font-black uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-lg font-black text-[#073b59]">
        {value}
      </div>
    </div>
  );
}

function waterTypeLabel(activity: string) {
  if (activity === "Surfing") {
    return "Ocean or Freshwater?";
  }

  if (activity === "Sailing") {
    return "Freshwater or Saltwater?";
  }

  return "Water Type";
}

function Field({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <label>
      <span className="mb-2 block text-sm font-black text-[#073b59]">
        {title}
      </span>

      {children}
    </label>
  );
}
