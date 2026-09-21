"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

function makeSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function StampAdminPage() {
  const [name, setName] = useState("");

  // Slug is always derived from the stamp name.
  // It is never accepted as free-form user input.
  const slug = makeSlug(name);

  const [location, setLocation] = useState("");
  const [state, setState] = useState("");
  const [country, setCountry] = useState("USA");

  const [category, setCategory] =
    useState("National Park");

  const [description, setDescription] =
    useState("");

  const [difficulty, setDifficulty] =
    useState("Easy");

  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [unlockRadius, setUnlockRadius] = useState("1609");

  const [featured, setFeatured] =
    useState(false);

  const [image, setImage] =
    useState<File | null>(null);

  const [saving, setSaving] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  function handleName(value: string) {
    setName(value);
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const supabase = createClient();

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setError(
          "You must be signed in to TrippinDays."
        );
        setSaving(false);
        return;
      }

      if (!image) {
        setError("Choose a stamp image.");
        setSaving(false);
        return;
      }

      const form = new FormData();

      form.append("name", name);
      form.append("location", location);
      form.append("state", state);
      form.append("country", country);
      form.append("category", category);
      form.append("description", description);
      form.append("difficulty", difficulty);
      form.append("latitude", latitude);
      form.append("longitude", longitude);
      form.append("unlock_radius", unlockRadius);

      form.append(
        "featured",
        featured ? "true" : "false"
      );

      form.append("image", image);

      const response = await fetch(
        "/api/admin/stamps",
        {
          method: "POST",

          headers: {
            Authorization:
              `Bearer ${session.access_token}`,
          },

          body: form,
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Unable to add stamp."
        );
      }

      setMessage(
        `✓ ${result.stamp.name} added successfully.`
      );

      // Clear form after successful insert.
      setName("");
      setLocation("");
      setState("");
      setCountry("USA");
      setCategory("National Park");
      setDescription("");
      setDifficulty("Easy");
      setLatitude("");
      setLongitude("");
      setUnlockRadius("1609");
      setFeatured(false);
      setImage(null);

      const fileInput =
        document.getElementById(
          "stamp-image"
        ) as HTMLInputElement | null;

      if (fileInput) {
        fileInput.value = "";
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to add stamp."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8">
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-lime-400">
            TrippinDays Admin
          </p>

          <h1 className="mt-2 text-4xl font-black">
            Stamp Manager
          </h1>

          <p className="mt-3 text-slate-300">
            Add new Passport stamps without
            changing existing stamps.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl"
        >
          <Field label="Stamp name">
            <input
              required
              value={name}
              onChange={(e) =>
                handleName(e.target.value)
              }
              placeholder="North Cascades National Park"
              maxLength={120}
              autoComplete="off"
              className={inputClass}
            />
          </Field>

          <Field label="Slug">
            <input
              value={slug}
              readOnly
              tabIndex={-1}
              autoComplete="off"
              className={`${inputClass} cursor-not-allowed opacity-70`}
            />

            <p className="mt-1 text-xs text-slate-400">
              Generated automatically from the stamp name and locked for safety.
            </p>
          </Field>

          <Field label="Location">
            <input
              required
              value={location}
              onChange={(e) =>
                setLocation(e.target.value)
              }
              placeholder="North Cascades National Park, Washington"
              maxLength={180}
              autoComplete="off"
              className={inputClass}
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="State">
              <input
                value={state}
                onChange={(e) =>
                  setState(e.target.value)
                }
                placeholder="Washington"
                className={inputClass}
              />
            </Field>

            <Field label="Country">
              <input
                value={country}
                onChange={(e) =>
                  setCountry(e.target.value)
                }
                className={inputClass}
              />
            </Field>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Category">
              <select
                value={category}
                onChange={(e) =>
                  setCategory(e.target.value)
                }
                className={inputClass}
              >
                <option>National Park</option>
                <option>State Park</option>
                <option>National Monument</option>
                <option>City</option>
                <option>Landmark</option>
                <option>Scenic Area</option>
                <option>Adventure</option>
              </select>
            </Field>

            <Field label="Difficulty">
              <select
                value={difficulty}
                onChange={(e) =>
                  setDifficulty(e.target.value)
                }
                className={inputClass}
              >
                <option>Easy</option>
                <option>Moderate</option>
                <option>Hard</option>
              </select>
            </Field>
          </div>

          <Field label="Description">
            <textarea
              value={description}
              onChange={(e) =>
                setDescription(e.target.value)
              }
              placeholder="North Cascades National Park passport stamp."
              rows={3}
              maxLength={1000}
              className={inputClass}
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Latitude">
              <input
                type="number"
                step="any"
                value={latitude}
                onChange={(e) =>
                  setLatitude(e.target.value)
                }
                placeholder="48.7718"
                className={inputClass}
              />
            </Field>

            <Field label="Longitude">
              <input
                type="number"
                step="any"
                value={longitude}
                onChange={(e) =>
                  setLongitude(e.target.value)
                }
                placeholder="-121.2985"
                className={inputClass}
              />
            </Field>
          </div>
          <Field label="Unlock Radius (meters)">
            <input
              type="number"
              min="1"
              value={unlockRadius}
              onChange={(e) =>
                setUnlockRadius(e.target.value)
              }
              placeholder="1609"
              className={inputClass}
            />

            <p className="mt-1 text-xs text-slate-400">
              1609 meters is about 1 mile.
            </p>
          </Field>
          <Field label="Stamp artwork">
            <input
              id="stamp-image"
              required
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) =>
                setImage(
                  e.target.files?.[0] || null
                )
              }
              className="block w-full rounded-xl border border-white/10 bg-slate-900 p-3 text-sm"
            />
          </Field>

          <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-slate-900 p-4">
            <input
              type="checkbox"
              checked={featured}
              onChange={(e) =>
                setFeatured(e.target.checked)
              }
              className="h-5 w-5"
            />

            <span className="font-semibold">
              Featured stamp
            </span>
          </label>

          {error && (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 font-semibold text-red-200">
              {error}
            </div>
          )}

          {message && (
            <div className="rounded-xl border border-green-500/40 bg-green-500/10 p-4 font-semibold text-green-200">
              {message}
            </div>
          )}

          <button
            disabled={saving}
            type="submit"
            className="w-full rounded-2xl bg-lime-400 px-6 py-4 text-lg font-black text-slate-950 transition hover:bg-lime-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving
              ? "Adding Stamp..."
              : "Add Stamp"}
          </button>
        </form>
      </div>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-200">
        {label}
      </span>

      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-lime-400";