"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import SiteHeader from "@/components/SiteHeader";

type SavedTrip = {
  id: string;
  title: string;
  destination: string | null;
  starting_location: string | null;
  created_at: string;
};

export default function ProfilePage() {
  const [email, setEmail] = useState("");
  const [trips, setTrips] = useState<SavedTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void loadProfile();
  }, []);

  async function loadProfile() {
    try {
      setLoading(true);

      const supabase = createClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!user) {
        window.location.href = "/login?redirect=/profile";
        return;
      }

      setEmail(user.email || "");

      const { data, error } = await supabase
        .from("trips")
        .select("id, title, destination, starting_location, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setTrips(data || []);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not load your account."
      );
    } finally {
      setLoading(false);
    }
  }

  function openTrip(id: string) {
    window.location.href = `/trip?savedTrip=${encodeURIComponent(id)}`;
  }

  async function deleteTrip(id: string) {
    const confirmed = window.confirm("Delete this saved trip?");

    if (!confirmed) return;

    try {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { error } = await supabase
        .from("trips")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) throw error;

      setTrips((current) =>
        current.filter((trip) => trip.id !== id)
      );

      setMessage("Trip deleted.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not delete the trip."
      );
    }
  }

  return (
    <main className="min-h-screen bg-[#061426] text-white">
      <SiteHeader />

      <section className="mx-auto max-w-7xl px-6 py-12">
        <p className="text-sm font-black uppercase tracking-[0.25em] text-cyan-300">
          My TrippinDays
        </p>

        <h1 className="mt-3 text-5xl font-black">
          My Account
        </h1>

        <p className="mt-3 text-white/60">
          {email}
        </p>

        <div className="mt-10 grid gap-5 sm:grid-cols-3">
          <StatCard
            label="Saved Trips"
            value={String(trips.length)}
          />

          <StatCard
            label="Account"
            value="Active"
          />

          <StatCard
            label="Plan"
            value="Free"
          />
        </div>

        <section className="mt-12">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-black uppercase tracking-widest text-sky-300">
                Adventures
              </p>

              <h2 className="mt-2 text-3xl font-black">
                My Saved Trips
              </h2>
            </div>

            <a
              href="/"
              className="rounded-2xl bg-cyan-400 px-5 py-3 font-black text-slate-950 hover:bg-cyan-300"
            >
              Plan New Trip
            </a>
          </div>

          {loading ? (
            <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-8">
              Loading your trips...
            </div>
          ) : trips.length === 0 ? (
            <div className="mt-8 rounded-3xl border border-dashed border-white/20 bg-white/5 p-10 text-center">
              <div className="text-6xl">🚗</div>

              <h3 className="mt-4 text-2xl font-black">
                No saved adventures yet
              </h3>

              <p className="mt-3 text-white/60">
                Plan a trip and tap Save Trip to add it here.
              </p>
            </div>
          ) : (
            <div className="mt-8 grid gap-5 md:grid-cols-2">
              {trips.map((trip) => (
                <article
                  key={trip.id}
                  className="rounded-3xl border border-white/10 bg-white/5 p-6 transition hover:border-cyan-300/40 hover:bg-white/10"
                >
                  <p className="text-xs font-black uppercase tracking-widest text-cyan-300">
                    Saved Adventure
                  </p>

                  <button
                    type="button"
                    onClick={() => openTrip(trip.id)}
                    className="mt-3 block text-left text-2xl font-black text-white transition hover:text-cyan-300 hover:underline"
                  >
                    {trip.title}
                  </button>

                  {trip.destination && (
                    <p className="mt-2 text-white/70">
                      📍 {trip.destination}
                    </p>
                  )}

                  {trip.starting_location && (
                    <p className="mt-2 text-white/50">
                      From {trip.starting_location}
                    </p>
                  )}

                  <p className="mt-4 text-sm text-white/35">
                    {new Date(
                      trip.created_at
                    ).toLocaleDateString()}
                  </p>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => openTrip(trip.id)}
                      className="rounded-xl bg-cyan-400 px-4 py-2 font-black text-slate-950 hover:bg-cyan-300"
                    >
                      Open Itinerary
                    </button>

                    <button
                      type="button"
                      onClick={() => void deleteTrip(trip.id)}
                      className="rounded-xl border border-red-400/30 px-4 py-2 font-bold text-red-300 hover:bg-red-500/10"
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}

          {message && (
            <div className="mt-6 rounded-2xl bg-white/10 p-4 font-bold">
              {message}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <p className="text-sm font-bold text-white/45">
        {label}
      </p>

      <p className="mt-2 text-3xl font-black">
        {value}
      </p>
    </div>
  );
}