"use client";

import { ChangeEvent, useMemo, useState } from "react";

type Position = {
  latitude: number;
  longitude: number;
  accuracy: number;
};

type StampDestination = {
  slug: string;
  name: string;
  location: string;
  latitude: number;
  longitude: number;
  unlockRadiusMeters: number;
  image: string;
};

const stamp: StampDestination = {
  slug: "mount-rainier",
  name: "Mount Rainier",
  location: "Washington",
  latitude: 46.7867,
  longitude: -121.735,
  unlockRadiusMeters: 1500,
  image: "/stamps/rainier.png",
};

export default function VerifyTestPage() {
  const [position, setPosition] = useState<Position | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [message, setMessage] = useState(
    "Check your location and take a verification photo."
  );
  const [checkingLocation, setCheckingLocation] = useState(false);
  const [unlocked, setUnlocked] = useState(false);

  const distanceMeters = useMemo(() => {
    if (!position) return null;

    return calculateDistanceMeters(
      position.latitude,
      position.longitude,
      stamp.latitude,
      stamp.longitude
    );
  }, [position]);

  const insideUnlockArea =
    distanceMeters !== null &&
    distanceMeters <= stamp.unlockRadiusMeters;

  function checkLocation() {
    if (!navigator.geolocation) {
      setMessage("GPS location is not supported by this browser.");
      return;
    }

    setCheckingLocation(true);
    setMessage("Checking your current location...");

    navigator.geolocation.getCurrentPosition(
      (result) => {
        const nextPosition = {
          latitude: result.coords.latitude,
          longitude: result.coords.longitude,
          accuracy: result.coords.accuracy,
        };

        setPosition(nextPosition);
        setCheckingLocation(false);

        const distance = calculateDistanceMeters(
          nextPosition.latitude,
          nextPosition.longitude,
          stamp.latitude,
          stamp.longitude
        );

        if (nextPosition.accuracy > 200) {
          setMessage(
            `GPS accuracy is about ${Math.round(
              nextPosition.accuracy
            )} meters. Move outdoors and try again.`
          );
          return;
        }

        if (distance > stamp.unlockRadiusMeters) {
          setMessage(
            `You are ${formatDistance(
              distance
            )} from ${stamp.name}. You must be within ${formatDistance(
              stamp.unlockRadiusMeters
            )} to unlock this stamp.`
          );
          return;
        }

        setMessage(
          `GPS confirmed. You are close enough to ${stamp.name}. Now take a verification photo.`
        );
      },
      (error) => {
        setCheckingLocation(false);

        if (error.code === 1) {
          setMessage(
            "Location permission was denied. Allow location access and try again."
          );
          return;
        }

        if (error.code === 2) {
          setMessage("Your location could not be determined.");
          return;
        }

        if (error.code === 3) {
          setMessage("The GPS request timed out. Try again outdoors.");
          return;
        }

        setMessage("GPS verification failed.");
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  }

  function selectPhoto(event: ChangeEvent<HTMLInputElement>) {
    const selectedPhoto = event.target.files?.[0];

    if (!selectedPhoto) return;

    if (!selectedPhoto.type.startsWith("image/")) {
      setMessage("Please select an image.");
      return;
    }

    if (selectedPhoto.size > 6 * 1024 * 1024) {
      setMessage("The photo must be smaller than 6 MB.");
      return;
    }

    if (preview) {
      URL.revokeObjectURL(preview);
    }

    setPhoto(selectedPhoto);
    setPreview(URL.createObjectURL(selectedPhoto));
    setMessage("Photo selected. Tap Verify Visit.");
  }

  function verifyVisit() {
    if (!position) {
      setMessage("Check your GPS location first.");
      return;
    }

    if (!insideUnlockArea) {
      setMessage(
        `You are not close enough to ${stamp.name} to unlock this stamp.`
      );
      return;
    }

    if (!photo) {
      setMessage("Take or select a verification photo first.");
      return;
    }

    setUnlocked(true);
    setMessage(`${stamp.name} stamp unlocked!`);
  }

  return (
    <main className="min-h-screen bg-[#061426] px-5 py-12 text-white">
      <section className="mx-auto max-w-xl rounded-[2rem] border border-white/10 bg-[#102b4a] p-6 shadow-2xl">
        <div className="flex items-center gap-5">
          <img
            src={stamp.image}
            alt={`${stamp.name} passport stamp`}
            className={`h-28 w-28 object-contain ${
              unlocked ? "" : "grayscale opacity-45"
            }`}
          />

          <div>
            <p className="text-sm font-black uppercase tracking-[0.22em] text-cyan-300">
              GPS Stamp Verification
            </p>

            <h1 className="mt-2 text-4xl font-black">{stamp.name}</h1>

            <p className="mt-2 text-white/55">{stamp.location}</p>
          </div>
        </div>

        {unlocked ? (
          <div className="mt-8 rounded-3xl border border-emerald-400/30 bg-emerald-500/10 p-7 text-center">
            <img
              src={stamp.image}
              alt={`${stamp.name} unlocked stamp`}
              className="mx-auto h-48 w-48 object-contain drop-shadow-2xl"
            />

            <h2 className="mt-4 text-3xl font-black text-emerald-300">
              Stamp Unlocked
            </h2>

            <p className="mt-3 text-white/65">
              GPS and photo requirements were completed.
            </p>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={checkLocation}
              disabled={checkingLocation}
              className="mt-8 w-full rounded-2xl bg-blue-600 px-5 py-4 text-lg font-black transition hover:bg-blue-500 disabled:opacity-50"
            >
              {checkingLocation
                ? "Checking Location..."
                : "📍 Check My Location"}
            </button>

            {position && (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <StatusCard
                  label="Distance"
                  value={
                    distanceMeters === null
                      ? "Unknown"
                      : formatDistance(distanceMeters)
                  }
                  passed={insideUnlockArea}
                />

                <StatusCard
                  label="Unlock Radius"
                  value={formatDistance(stamp.unlockRadiusMeters)}
                  passed={insideUnlockArea}
                />

                <StatusCard
                  label="GPS Accuracy"
                  value={`${Math.round(position.accuracy)} m`}
                  passed={position.accuracy <= 200}
                />

                <StatusCard
                  label="Location"
                  value={`${position.latitude.toFixed(
                    5
                  )}, ${position.longitude.toFixed(5)}`}
                  passed={true}
                />
              </div>
            )}

            <label className="mt-5 block cursor-pointer rounded-2xl bg-cyan-400 px-5 py-4 text-center text-lg font-black text-slate-950 transition hover:bg-cyan-300">
              📷 Take or Select Photo

              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={selectPhoto}
                className="hidden"
              />
            </label>

            {preview && (
              <img
                src={preview}
                alt="Verification preview"
                className="mt-5 max-h-80 w-full rounded-2xl object-cover"
              />
            )}

            <button
              type="button"
              onClick={verifyVisit}
              disabled={!insideUnlockArea || !photo}
              className="mt-5 w-full rounded-2xl bg-emerald-500 px-5 py-4 text-lg font-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ✓ Verify Visit and Unlock
            </button>
          </>
        )}

        <p className="mt-5 rounded-2xl bg-black/20 p-4 leading-7 text-white/70">
          {message}
        </p>

        <a
          href="/passport"
          className="mt-6 block text-center font-bold text-cyan-300 hover:text-cyan-200"
        >
          Return to Passport
        </a>
      </section>
    </main>
  );
}

function StatusCard({
  label,
  value,
  passed,
}: {
  label: string;
  value: string;
  passed: boolean;
}) {
  return (
    <div className="rounded-2xl bg-black/20 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-white/40">
        {label}
      </p>

      <p className="mt-2 break-words font-black">
        {passed ? "✓ " : "⚠ "}
        {value}
      </p>
    </div>
  );
}

function calculateDistanceMeters(
  latitude1: number,
  longitude1: number,
  latitude2: number,
  longitude2: number
) {
  const earthRadiusMeters = 6371000;

  const latitudeDifference = degreesToRadians(latitude2 - latitude1);
  const longitudeDifference = degreesToRadians(longitude2 - longitude1);

  const value =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(degreesToRadians(latitude1)) *
      Math.cos(degreesToRadians(latitude2)) *
      Math.sin(longitudeDifference / 2) ** 2;

  return (
    earthRadiusMeters *
    2 *
    Math.atan2(Math.sqrt(value), Math.sqrt(1 - value))
  );
}

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180;
}

function formatDistance(meters: number) {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }

  return `${(meters / 1609.344).toFixed(1)} mi`;
}