"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

export type TrippinDaysDeviceLocation = {
  name: "Current Location";
  label: string;
  shortLabel: string;
  city?: string;
  state?: string;
  country?: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  source: "gps";
  updatedAt: number;
};

type Options = {
  autoRefreshIfGranted?: boolean;
};

const STORAGE_KEY = "trippindays-current-location";
const LOCATION_EVENT = "trippindays:device-location";

function readSavedLocation(): TrippinDaysDeviceLocation | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as TrippinDaysDeviceLocation;

    if (
      !Number.isFinite(Number(parsed?.latitude)) ||
      !Number.isFinite(Number(parsed?.longitude))
    ) {
      return null;
    }

    return {
      ...parsed,
      name: "Current Location",
      latitude: Number(parsed.latitude),
      longitude: Number(parsed.longitude),
      source: "gps",
      updatedAt: Number(parsed.updatedAt) || Date.now(),
    };
  } catch {
    return null;
  }
}

async function reverseGeocode(
  latitude: number,
  longitude: number
) {
  try {
    const response = await fetch(
      `/api/location/reverse-geocode?lat=${encodeURIComponent(
        String(latitude)
      )}&lon=${encodeURIComponent(String(longitude))}`,
      { cache: "no-store" }
    );

    const data = await response.json();

    if (!response.ok || !data?.success) {
      return null;
    }

    return {
      label:
        typeof data.label === "string" && data.label
          ? data.label
          : "Current Location",
      shortLabel:
        typeof data.shortLabel === "string" && data.shortLabel
          ? data.shortLabel
          : "Current Location",
      city:
        typeof data.city === "string"
          ? data.city
          : "",
      state:
        typeof data.state === "string"
          ? data.state
          : "",
      country:
        typeof data.country === "string"
          ? data.country
          : "",
    };
  } catch {
    return null;
  }
}

export default function useTrippinDaysLocation(
  options: Options = {}
) {
  const {
    autoRefreshIfGranted = true,
  } = options;

  const [location, setLocation] =
    useState<TrippinDaysDeviceLocation | null>(null);

  const [findingLocation, setFindingLocation] =
    useState(false);

  const [error, setError] = useState("");

  const saveLocation = useCallback(
    (next: TrippinDaysDeviceLocation) => {
      setLocation(next);

      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(next)
        );

        window.dispatchEvent(
          new CustomEvent(LOCATION_EVENT, {
            detail: next,
          })
        );
      } catch {
        // The location still works for this page if storage is unavailable.
      }
    },
    []
  );

  const useCurrentLocation = useCallback(
    async (): Promise<TrippinDaysDeviceLocation | null> => {
      setError("");

      if (
        typeof navigator === "undefined" ||
        !navigator.geolocation
      ) {
        setError(
          "Device location is not supported in this browser."
        );
        return null;
      }

      setFindingLocation(true);

      try {
        const position =
          await new Promise<GeolocationPosition>(
            (resolve, reject) => {
              navigator.geolocation.getCurrentPosition(
                resolve,
                reject,
                {
                  enableHighAccuracy: true,
                  timeout: 15000,
                  maximumAge: 60000,
                }
              );
            }
          );

        const latitude =
          position.coords.latitude;
        const longitude =
          position.coords.longitude;

        const readable =
          await reverseGeocode(
            latitude,
            longitude
          );

        const next: TrippinDaysDeviceLocation = {
          name: "Current Location",
          label:
            readable?.label ||
            "Current Location",
          shortLabel:
            readable?.shortLabel ||
            readable?.label ||
            "Current Location",
          city: readable?.city || "",
          state: readable?.state || "",
          country: readable?.country || "",
          latitude,
          longitude,
          accuracy:
            Number.isFinite(position.coords.accuracy)
              ? position.coords.accuracy
              : undefined,
          source: "gps",
          updatedAt: Date.now(),
        };

        saveLocation(next);
        return next;
      } catch (caught) {
        const geoError =
          caught as GeolocationPositionError;

        if (geoError?.code === 1) {
          setError(
            "Location permission was blocked. Allow location access and try again."
          );
        } else if (geoError?.code === 3) {
          setError(
            "Getting your device location timed out. Try again."
          );
        } else {
          setError(
            "TrippinDays could not get your current device location."
          );
        }

        return null;
      } finally {
        setFindingLocation(false);
      }
    },
    [saveLocation]
  );

  useEffect(() => {
    const saved = readSavedLocation();

    if (saved) {
      setLocation(saved);
    }

    function handleLocationEvent(event: Event) {
      const customEvent =
        event as CustomEvent<TrippinDaysDeviceLocation>;

      if (customEvent.detail) {
        setLocation(customEvent.detail);
      }
    }

    function handleStorage(event: StorageEvent) {
      if (event.key !== STORAGE_KEY) return;

      const next = readSavedLocation();
      setLocation(next);
    }

    window.addEventListener(
      LOCATION_EVENT,
      handleLocationEvent
    );

    window.addEventListener(
      "storage",
      handleStorage
    );

    return () => {
      window.removeEventListener(
        LOCATION_EVENT,
        handleLocationEvent
      );

      window.removeEventListener(
        "storage",
        handleStorage
      );
    };
  }, []);

  useEffect(() => {
    if (!autoRefreshIfGranted) return;
    if (
      typeof navigator === "undefined" ||
      !navigator.permissions
    ) {
      return;
    }

    let cancelled = false;

    async function refreshIfAlreadyAllowed() {
      try {
        const permission =
          await (navigator.permissions as any).query({
            name: "geolocation",
          });

        if (
          !cancelled &&
          permission?.state === "granted"
        ) {
          await useCurrentLocation();
        }
      } catch {
        // Safari and some browsers do not expose geolocation permissions here.
      }
    }

    void refreshIfAlreadyAllowed();

    return () => {
      cancelled = true;
    };
  }, [
    autoRefreshIfGranted,
    useCurrentLocation,
  ]);

  return {
    location,
    findingLocation,
    error,
    useCurrentLocation,
    storageKey: STORAGE_KEY,
  };
}
