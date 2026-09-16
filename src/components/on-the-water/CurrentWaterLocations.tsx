"use client";

import { useEffect, useRef, useState } from "react";

type SavedWaterLocation = {
  name?: string;
  state?: string;
  latitude?: number;
  longitude?: number;
  source?: "gps" | "search";
};

const STORAGE_KEY = "trippindays-water-location";

function displaySavedLocation(location: SavedWaterLocation) {
  const name = location.name?.trim();
  const state = location.state?.trim();

  if (name && name !== "Current Location") {
    return [name, state].filter(Boolean).join(", ");
  }

  return "Current Location";
}

export default function CurrentWaterLocation() {
  const [label, setLabel] = useState("Current Location");
  const lastLookup = useRef("");

  useEffect(() => {
    let cancelled = false;

    async function refreshLocationLabel() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
          if (!cancelled) setLabel("Current Location");
          return;
        }

        const location = JSON.parse(raw) as SavedWaterLocation;
        const savedLabel = displaySavedLocation(location);

        if (savedLabel !== "Current Location") {
          if (!cancelled) setLabel(savedLabel);
          return;
        }

        if (
          typeof location.latitude !== "number" ||
          typeof location.longitude !== "number"
        ) {
          if (!cancelled) setLabel("Current Location");
          return;
        }

        const lookupKey = `${location.latitude.toFixed(4)},${location.longitude.toFixed(4)}`;
        if (lastLookup.current === lookupKey && label !== "Current Location") {
          return;
        }
        lastLookup.current = lookupKey;

        const response = await fetch(
          `/api/on-the-water/reverse-geocode?lat=${encodeURIComponent(
            location.latitude
          )}&lon=${encodeURIComponent(location.longitude)}`,
          { cache: "no-store" }
        );

        const data = await response.json();
        if (!cancelled && response.ok && data?.success && data?.label) {
          setLabel(data.label);
        } else if (!cancelled) {
          setLabel("Current Location");
        }
      } catch {
        if (!cancelled) setLabel("Current Location");
      }
    }

    void refreshLocationLabel();

    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key === STORAGE_KEY) {
        void refreshLocationLabel();
      }
    };

    const onFocus = () => void refreshLocationLabel();
    const onWaterLocationChanged = () => void refreshLocationLabel();

    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onFocus);
    window.addEventListener(
      "trippindays:water-location-changed",
      onWaterLocationChanged as EventListener
    );

    const interval = window.setInterval(refreshLocationLabel, 1500);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener(
        "trippindays:water-location-changed",
        onWaterLocationChanged as EventListener
      );
    };
  }, [label]);

  return <>{label}</>;
}
