"use client";

import { useEffect, useMemo } from "react";
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type OffRoadMapPlace = {
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
  difficulty?: string;
  accessNote?: string;
};

type Props = {
  startLatitude: number;
  startLongitude: number;
  startLabel: string;
  showStartMarker?: boolean;
  places: OffRoadMapPlace[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;

  /*
    Premium-only handoff.
    The parent only supplies this callback when Premium is active.
    If it is undefined, the popup does not show a planning button.
  */
  onPlanTrip?: (place: OffRoadMapPlace) => void;
};

function makeStartIcon() {
  return L.divIcon({
    className: "",
    html: `
      <div style="
        width:24px;
        height:24px;
        border-radius:9999px;
        background:#16a34a;
        border:4px solid white;
        box-shadow:0 4px 12px rgba(0,0,0,.35);
      "></div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -14],
  });
}

function makeDestinationIcon(
  rank: number,
  selected: boolean
) {
  const size = selected ? 46 : 40;
  const color = selected
    ? "#f97316"
    : "#42552f";

  return L.divIcon({
    className: "",
    html: `
      <div style="
        width:${size}px;
        height:${size}px;
        border-radius:9999px;
        background:${color};
        border:3px solid white;
        color:white;
        display:flex;
        align-items:center;
        justify-content:center;
        font-size:14px;
        font-weight:900;
        box-shadow:0 5px 16px rgba(0,0,0,.35);
      ">
        #${rank}
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2)],
  });
}

function MapController({
  startLatitude,
  startLongitude,
  showStartMarker,
  places,
  selectedId,
}: {
  startLatitude: number;
  startLongitude: number;
  showStartMarker: boolean;
  places: OffRoadMapPlace[];
  selectedId?: string | null;
}) {
  const map = useMap();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      map.invalidateSize();
    }, 150);

    return () =>
      window.clearTimeout(timer);
  }, [map]);

  useEffect(() => {
    map.invalidateSize();

    if (selectedId) {
      const selected = places.find(
        (place) =>
          place.id === selectedId
      );

      if (selected) {
        map.flyTo(
          [
            selected.latitude,
            selected.longitude,
          ],
          10,
          { duration: 0.8 }
        );
        return;
      }
    }

    if (
      !showStartMarker &&
      places.length === 0
    ) {
      map.setView(
        [39.8283, -98.5795],
        4
      );
      return;
    }

    const points:
      [number, number][] = [];

    if (showStartMarker) {
      points.push([
        startLatitude,
        startLongitude,
      ]);
    }

    places.forEach((place) => {
      points.push([
        place.latitude,
        place.longitude,
      ]);
    });

    if (!points.length) return;

    if (points.length === 1) {
      map.setView(points[0], 8);
      return;
    }

    const bounds =
      L.latLngBounds(points);

    map.fitBounds(bounds, {
      padding: [45, 45],
      maxZoom: 10,
    });
  }, [
    map,
    places,
    selectedId,
    showStartMarker,
    startLatitude,
    startLongitude,
  ]);

  return null;
}

export default function OffTheRoadMap({
  startLatitude,
  startLongitude,
  startLabel,
  showStartMarker = true,
  places,
  selectedId,
  onSelect,
  onPlanTrip,
}: Props) {
  const startIcon = useMemo(
    () => makeStartIcon(),
    []
  );

  return (
    <div className="relative h-[430px] w-full overflow-hidden rounded-3xl border border-stone-200 bg-[#edf0e7]">
      <MapContainer
        center={[
          startLatitude,
          startLongitude,
        ]}
        zoom={showStartMarker ? 8 : 4}
        scrollWheelZoom
        zoomControl
        style={{
          width: "100%",
          height: "430px",
          minHeight: "430px",
        }}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {showStartMarker && (
          <Marker
            position={[
              startLatitude,
              startLongitude,
            ]}
            icon={startIcon}
          >
            <Popup>
              <div
                style={{
                  minWidth: 170,
                }}
              >
                <div
                  style={{
                    fontWeight: 900,
                    color: "#314024",
                  }}
                >
                  📍 Starting Location
                </div>

                <div
                  style={{
                    marginTop: 5,
                  }}
                >
                  {startLabel}
                </div>
              </div>
            </Popup>
          </Marker>
        )}

        {places.map((place) => (
          <Marker
            key={place.id}
            position={[
              place.latitude,
              place.longitude,
            ]}
            icon={makeDestinationIcon(
              place.rank,
              selectedId === place.id
            )}
            eventHandlers={{
              click: () =>
                onSelect?.(place.id),
            }}
          >
            <Popup>
              <div
                style={{
                  minWidth: 230,
                }}
              >
                <div
                  style={{
                    fontSize: 17,
                    fontWeight: 900,
                    color: "#26331f",
                  }}
                >
                  #{place.rank}{" "}
                  {place.name}
                </div>

                {place.region && (
                  <div
                    style={{
                      marginTop: 3,
                      color: "#78716c",
                    }}
                  >
                    {place.region}
                  </div>
                )}

                <div
                  style={{
                    marginTop: 9,
                    fontWeight: 800,
                    color: "#c2410c",
                  }}
                >
                  {place.score}/100 •{" "}
                  {place.label}
                </div>

                <div
                  style={{
                    marginTop: 5,
                  }}
                >
                  {place.distanceMiles} miles
                  away
                </div>

                {place.category && (
                  <div
                    style={{
                      marginTop: 4,
                      color: "#57534e",
                    }}
                  >
                    {place.category}
                  </div>
                )}

                {place.difficulty && (
                  <div
                    style={{
                      marginTop: 4,
                      color: "#57534e",
                    }}
                  >
                    Difficulty:{" "}
                    {place.difficulty}
                  </div>
                )}

                {place.bestTime && (
                  <div
                    style={{
                      marginTop: 4,
                      color: "#57534e",
                      fontSize: 12,
                    }}
                  >
                    Best window:{" "}
                    {place.bestTime}
                  </div>
                )}

                {/*
                  NO GET DIRECTIONS BUTTON HERE.

                  Premium users get Plan This Trip,
                  which hands the exact selected
                  destination to the main /trip planner.
                */}
                {onPlanTrip && (
                  <button
                    type="button"
                    onClick={() => {
                      onSelect?.(place.id);
                      onPlanTrip(place);
                    }}
                    style={{
                      marginTop: 12,
                      width: "100%",
                      border: 0,
                      borderRadius: 10,
                      padding: "11px 12px",
                      background: "#f97316",
                      color: "white",
                      fontWeight: 900,
                      cursor: "pointer",
                    }}
                  >
                    PLAN THIS TRIP →
                  </button>
                )}
              </div>
            </Popup>
          </Marker>
        ))}

        <MapController
          startLatitude={startLatitude}
          startLongitude={startLongitude}
          showStartMarker={
            showStartMarker
          }
          places={places}
          selectedId={selectedId}
        />
      </MapContainer>

      {!showStartMarker && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 z-[500] -translate-x-1/2 rounded-full bg-white/95 px-4 py-2 text-center text-xs font-black text-[#42552f] shadow-lg">
          📍 Enter a location to center
          the map
        </div>
      )}
    </div>
  );
}
