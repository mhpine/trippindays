"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { PassportStamp } from "@/lib/passportTypes";

type Position = { latitude: number; longitude: number; accuracy: number };

export default function VerifyStampPage() {
  const params = useParams();
  const rawSlug = params?.slug;
  const slug = (Array.isArray(rawSlug) ? rawSlug[0] : rawSlug ?? "").trim().toLowerCase();

  const [stamp, setStamp] = useState<PassportStamp | null>(null);
  const [stampLoading, setStampLoading] = useState(true);
  const [position, setPosition] = useState<Position | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [message, setMessage] = useState("Check your location and take a verification photo.");
  const [checkingLocation, setCheckingLocation] = useState(false);
  const [saving, setSaving] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [earnedAt, setEarnedAt] = useState<string | null>(null);
  const [collectedCount, setCollectedCount] = useState<number | null>(null);

  useEffect(() => { void loadStamp(); }, [slug]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  async function loadStamp() {
    try {
      setStampLoading(true);
      const supabase = createClient();
      const { data, error } = await supabase
        .from("stamps")
        .select("id, slug, name, location, category, image_url, prompt, status, latitude, longitude, unlock_radius, state, country, description, difficulty, featured, created_at, updated_at")
        .eq("slug", slug)
        .eq("status", "approved")
        .maybeSingle();
      if (error) throw error;
      setStamp((data as PassportStamp | null) ?? null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The stamp could not be loaded.");
      setStamp(null);
    } finally {
      setStampLoading(false);
    }
  }

 const distanceMeters = useMemo(() => {
  if (
    !position ||
    !stamp ||
    stamp.latitude === null ||
    stamp.longitude === null
  ) {
    return null;
  }

  return calculateDistanceMeters(
    position.latitude,
    position.longitude,
    stamp.latitude,
    stamp.longitude
  );
}, [position, stamp]);

  if (stampLoading) return <main className="min-h-screen bg-[#061426] px-6 py-16 text-white"><div className="mx-auto max-w-xl rounded-3xl bg-white/10 p-8 text-center"><div className="text-4xl">📍</div><p className="mt-4 font-bold">Loading stamp...</p></div></main>;
  if (!stamp) return <main className="min-h-screen bg-[#061426] px-6 py-16 text-white"><div className="mx-auto max-w-xl rounded-3xl bg-white/10 p-8"><h1 className="text-3xl font-black">Stamp Not Found</h1><p className="mt-3 text-white/60">Slug received: {slug || "(empty)"}</p><a href="/passport" className="mt-6 inline-block font-bold text-cyan-300">Return to Passport</a></div></main>;

  const gpsConfigured = stamp.latitude !== null && stamp.longitude !== null;
  const insideUnlockArea = gpsConfigured && distanceMeters !== null && distanceMeters <= stamp.unlock_radius;

function checkLocation() {
  const activeStamp = stamp;

  if (!activeStamp) {
    setMessage("The stamp could not be loaded.");
    return;
  }

  const gpsConfigured =
    activeStamp.latitude !== null &&
    activeStamp.longitude !== null;

  if (!gpsConfigured) {
    setMessage("This stamp does not have GPS coordinates yet.");
    return;
  }

  if (!navigator.geolocation) {
    setMessage("GPS is not supported by this browser.");
    return;
  }
    setCheckingLocation(true);
    setMessage("Checking your current location...");
    navigator.geolocation.getCurrentPosition(
      (result) => {
        const nextPosition = { latitude: result.coords.latitude, longitude: result.coords.longitude, accuracy: result.coords.accuracy };
        setPosition(nextPosition);
        setCheckingLocation(false);
        const distance = calculateDistanceMeters(nextPosition.latitude, nextPosition.longitude, activeStamp.latitude!, stamp.longitude!);
        if (nextPosition.accuracy > 200) { setMessage(`GPS accuracy is about ${Math.round(nextPosition.accuracy)} meters. Move outdoors and try again.`); return; }
        if (distance > activeStamp.unlock_radius) { setMessage(`You are ${formatDistance(distance)} from ${activeStamp.name}. Move within ${formatDistance(stamp.unlock_radius)} to unlock it.`); return; }
        setMessage(`GPS confirmed. Now take a verification photo at ${activeStamp.name}.`);
      },
      (error) => {
        setCheckingLocation(false);
        if (error.code === 1) setMessage("Location permission was denied.");
        else if (error.code === 2) setMessage("Your location could not be determined.");
        else if (error.code === 3) setMessage("The GPS request timed out.");
        else setMessage("GPS verification failed.");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  function selectPhoto(event: ChangeEvent<HTMLInputElement>) {
    const selectedPhoto = event.target.files?.[0];
    if (!selectedPhoto) return;
    if (!selectedPhoto.type.startsWith("image/")) { setMessage("Please choose an image."); return; }
    if (selectedPhoto.size > 6 * 1024 * 1024) { setMessage("The photo must be smaller than 6 MB."); return; }
    if (preview) URL.revokeObjectURL(preview);
    setPhoto(selectedPhoto);
    setPreview(URL.createObjectURL(selectedPhoto));
    setMessage("Photo selected. Tap Verify Visit and Unlock.");
  }

  async function verifyVisit() {
  const activeStamp = stamp;

  if (!activeStamp) {
    setMessage("The stamp could not be loaded.");
    return;
  }

  if (!position) {
    setMessage("Check your GPS location first.");
    return;
  }

  if (!insideUnlockArea) {
    setMessage(
      `You are not close enough to ${activeStamp.name}.`
    );
    return;
  }

  if (!photo) {
    setMessage(
      "Take or select a verification photo first."
    );
    return;
  }

  try {
      setSaving(true);
      setMessage("Saving your verified stamp...");
      const supabase = createClient();
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) { window.location.href = `/login?redirect=${encodeURIComponent(`/verify-stamp/${stamp.slug}`)}`; return; }

      const { data: existing, error: existingError } = await supabase.from("user_stamps").select("earned_at").eq("user_id", user.id).eq("stamp_slug", stamp.slug).maybeSingle();
      if (existingError) throw existingError;
      if (existing) {
        const { count } = await supabase.from("user_stamps").select("*", { count: "exact", head: true }).eq("user_id", user.id);
        setCollectedCount(count ?? null);
        setEarnedAt(existing.earned_at);
        setUnlocked(true);
        setMessage("You already collected this stamp.");
        return;
      }

      const extension = photo.name.split(".").pop()?.toLowerCase() || "jpg";
      const photoPath = `${user.id}/${stamp.slug}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from("stamp-verification-photos").upload(photoPath, photo, { cacheControl: "3600", contentType: photo.type, upsert: false });
      if (uploadError) throw uploadError;

      const now = new Date().toISOString();
      const { error: insertError } = await supabase.from("user_stamps").insert({
        user_id: user.id,
        stamp_slug: stamp.slug,
        stamp_name: stamp.name,
        earned_at: now,
        gps_latitude: position.latitude,
        gps_longitude: position.longitude,
        gps_accuracy_meters: position.accuracy,
        distance_from_stamp_meters: Math.round(distanceMeters ?? 0),
        verification_photo_path: photoPath,
      });

      if (insertError) {
        await supabase.storage.from("stamp-verification-photos").remove([photoPath]);
        throw insertError;
      }

      const { count } = await supabase.from("user_stamps").select("*", { count: "exact", head: true }).eq("user_id", user.id);
      setCollectedCount(count ?? null);
      setEarnedAt(now);
      setUnlocked(true);
      try { navigator.vibrate?.([80, 50, 120]); } catch {}
      setMessage(`${stamp.name} was added to your passport.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The stamp could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#061426] px-5 py-12 text-white">
      <section className="mx-auto max-w-xl rounded-[2rem] border border-white/10 bg-[#102b4a] p-6 shadow-2xl">
        <div className="flex items-center gap-5">
          <img src={stamp.image_url || "/stamps/default-stamp.png"} alt={`${stamp.name} passport stamp`} className={`h-28 w-28 object-contain ${unlocked ? "" : "grayscale opacity-45"}`} />
          <div><p className="text-sm font-black uppercase tracking-[0.22em] text-cyan-300">GPS Stamp Verification</p><h1 className="mt-2 text-3xl font-black">{stamp.name}</h1><p className="mt-2 text-white/55">{stamp.location}</p></div>
        </div>

        {unlocked ? (
          <div className="mt-8 rounded-3xl border border-emerald-400/30 bg-emerald-500/10 p-7 text-center">
            <p className="text-sm font-black uppercase tracking-[0.28em] text-emerald-300">Congratulations</p>
            <img src={stamp.image_url || "/stamps/default-stamp.png"} alt={`${stamp.name} unlocked stamp`} className="mx-auto mt-5 h-52 w-52 object-contain drop-shadow-2xl" />
            <h2 className="mt-4 text-4xl font-black text-emerald-300">Stamp Unlocked</h2>
            <p className="mt-3 text-xl font-black">{stamp.name}</p>
            {preview && <img src={preview} alt="Your verification memory" className="mt-6 h-52 w-full rounded-2xl object-cover" />}
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <ResultCard label="Passport Progress" value={`${collectedCount ?? "—"} collected`} />
              <ResultCard label="Earned" value={earnedAt ? new Date(earnedAt).toLocaleDateString() : "Today"} />
            </div>
            <a href="/passport" className="mt-6 block rounded-2xl bg-emerald-500 px-5 py-4 text-lg font-black text-white">View Passport</a>
          </div>
        ) : (
          <>
            <button type="button" onClick={checkLocation} disabled={checkingLocation || saving || !gpsConfigured} className="mt-8 w-full rounded-2xl bg-blue-600 px-5 py-4 text-lg font-black disabled:opacity-50">{checkingLocation ? "Checking Location..." : gpsConfigured ? "📍 Check My Location" : "GPS Not Configured"}</button>
            {position && <div className="mt-5 grid gap-3 sm:grid-cols-3"><StatusCard label="Distance" value={distanceMeters === null ? "Unknown" : formatDistance(distanceMeters)} passed={insideUnlockArea} /><StatusCard label="Unlock Radius" value={formatDistance(stamp.unlock_radius)} passed={insideUnlockArea} /><StatusCard label="GPS Accuracy" value={`${Math.round(position.accuracy)} m`} passed={position.accuracy <= 200} /></div>}
            <label className="mt-5 block cursor-pointer rounded-2xl bg-cyan-400 px-5 py-4 text-center text-lg font-black text-slate-950">📷 Take or Select Photo<input type="file" accept="image/*" capture="environment" onChange={selectPhoto} className="hidden" /></label>
            {preview && <img src={preview} alt="Verification preview" className="mt-5 max-h-80 w-full rounded-2xl object-cover" />}
            <button type="button" onClick={() => void verifyVisit()} disabled={!insideUnlockArea || !photo || saving} className="mt-5 w-full rounded-2xl bg-emerald-500 px-5 py-4 text-lg font-black disabled:cursor-not-allowed disabled:opacity-40">{saving ? "Saving Stamp..." : "✓ Verify Visit and Unlock"}</button>
          </>
        )}

        <p className="mt-5 rounded-2xl bg-black/20 p-4 leading-7 text-white/70">{message}</p>
        {!unlocked && <a href="/passport" className="mt-6 block text-center font-bold text-cyan-300">Return to Passport</a>}
      </section>
    </main>
  );
}

function StatusCard({ label, value, passed }: { label: string; value: string; passed: boolean }) {
  return <div className="rounded-2xl bg-black/20 p-4"><p className="text-xs font-bold uppercase tracking-wide text-white/40">{label}</p><p className="mt-2 break-words font-black">{passed ? "✓ " : "⚠ "}{value}</p></div>;
}
function ResultCard({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-black/20 p-4"><p className="text-xs font-bold uppercase tracking-wide text-white/40">{label}</p><p className="mt-2 text-2xl font-black">{value}</p></div>;
}
function calculateDistanceMeters(latitude1: number, longitude1: number, latitude2: number, longitude2: number) {
  const earthRadiusMeters = 6371000;
  const latitudeDifference = degreesToRadians(latitude2 - latitude1);
  const longitudeDifference = degreesToRadians(longitude2 - longitude1);
  const value = Math.sin(latitudeDifference / 2) ** 2 + Math.cos(degreesToRadians(latitude1)) * Math.cos(degreesToRadians(latitude2)) * Math.sin(longitudeDifference / 2) ** 2;
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}
function degreesToRadians(value: number) { return (value * Math.PI) / 180; }
function formatDistance(meters: number) { return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1609.344).toFixed(1)} mi`; }
