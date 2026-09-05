"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type SavedTrip = {
  id: string;
  title: string | null;
  starting_location: string | null;
  destination: string | null;
  image_url: string | null;
  budget: number | null;
  time_available: string | null;
  travelers: string | null;
  trip_request: string | null;
  itinerary: string | null;
  status: string | null;
  created_at: string | null;
  spendingTotal?: number;
};

function getTripStartDate(tripRequest: string | null): string | null {
  if (!tripRequest) return null;

  const match = tripRequest.match(/^Start Date:\s*(.+)$/im);
  if (!match?.[1]) return null;

  const raw = match[1].trim();
  const parsed = new Date(`${raw}T12:00:00`);

  return Number.isNaN(parsed.getTime()) ? null : raw;
}

function getTripStatus(startDate: string | null): "Upcoming" | "Completed" | "Saved" {
  if (!startDate) return "Saved";

  const tripDay = new Date(`${startDate}T23:59:59`);
  const today = new Date();

  if (Number.isNaN(tripDay.getTime())) return "Saved";
  return tripDay.getTime() >= today.getTime() ? "Upcoming" : "Completed";
}

function money(value: number | null | undefined) {
  return `$${Math.max(0, Number(value) || 0).toFixed(2)}`;
}

export default function SavedTripsPage() {
  const [trips, setTrips] = useState<SavedTrip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    void loadSavedTrips();
  }, []);

  async function loadSavedTrips() {
    const supabase = createClient();

    try {
      setIsLoading(true);
      setError("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setError("Sign in to view your saved trips.");
        setTrips([]);
        return;
      }

      const { data, error: tripsError } = await supabase
        .from("trips")
        .select(
          "id, title, starting_location, destination, image_url, budget, time_available, travelers, trip_request, itinerary, status, created_at"
        )
        .eq("user_id", user.id)
        .eq("status", "saved")
        .order("created_at", { ascending: false });

      if (tripsError) throw tripsError;

      const loadedTrips = (data || []) as SavedTrip[];
      const tripIds = loadedTrips.map((trip) => trip.id);

      let spendingByTrip: Record<string, number> = {};

      if (tripIds.length > 0) {
        const { data: expenses, error: expensesError } = await supabase
          .from("trip_expenses")
          .select("trip_id, amount, test_mode")
          .eq("user_id", user.id)
          .in("trip_id", tripIds);

        if (expensesError) {
          console.error("Could not load saved trip spending:", expensesError);
        } else {
          spendingByTrip = (expenses || []).reduce<Record<string, number>>(
            (totals, expense: any) => {
              if (expense.test_mode === true) return totals;
              totals[expense.trip_id] =
                (totals[expense.trip_id] || 0) + (Number(expense.amount) || 0);
              return totals;
            },
            {}
          );
        }
      }

      setTrips(
        loadedTrips.map((trip) => ({
          ...trip,
          spendingTotal: spendingByTrip[trip.id] || 0,
        }))
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load your saved trips."
      );
      setTrips([]);
    } finally {
      setIsLoading(false);
    }
  }

  function openTrip(trip: SavedTrip) {
    // The Trip page reads the saved row directly from Supabase by ID.
    // That means it shows the SAME saved itinerary instead of generating a new one.
    window.location.href = `/trip?savedTrip=${encodeURIComponent(trip.id)}`;
  }

  async function deleteTrip(id: string) {
    const okay = window.confirm("Remove this trip from Saved Trips?");
    if (!okay) return;

    const supabase = createClient();

    try {
      setDeletingId(id);
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setError("Sign in to manage your saved trips.");
        return;
      }

      const { error: deleteError } = await supabase
        .from("trips")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

      if (deleteError) throw deleteError;

      setTrips((current) => current.filter((trip) => trip.id !== id));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not remove the saved trip."
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.25em] text-sky-300">
              TrippinDays
            </p>
            <h1 className="mt-2 text-4xl font-black sm:text-5xl">Saved Trips</h1>
            <p className="mt-3 max-w-2xl text-white/65">
              Your future adventures live here. Open the exact itinerary you saved and keep tracking what you spend before the trip begins.
            </p>
          </div>

          <a
            href="/"
            className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 font-black transition hover:bg-white/10"
          >
            ← Plan Another Trip
          </a>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-5 text-rose-100">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-10 text-center">
            <div className="text-4xl">🧳</div>
            <p className="mt-4 font-black">Loading your saved trips...</p>
          </div>
        ) : trips.length === 0 && !error ? (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-10 text-center">
            <div className="text-5xl">🗺️</div>
            <h2 className="mt-4 text-2xl font-black">No saved trips yet</h2>
            <p className="mt-2 text-white/60">
              Build an adventure and tap Save Trip. It will appear here.
            </p>
            <a
              href="/"
              className="mt-6 inline-flex rounded-2xl bg-sky-500 px-6 py-3 font-black text-white hover:bg-sky-400"
            >
              Plan an Adventure
            </a>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {trips.map((trip) => (
              <article
                key={trip.id}
                className="overflow-hidden rounded-3xl border border-white/10 bg-white/5"
              >
                {trip.image_url ? (
                  <div
                    className="h-44 bg-cover bg-center"
                    style={{ backgroundImage: `url(${trip.image_url})` }}
                  />
                ) : (
                  <div className="flex h-44 items-center justify-center bg-slate-900 text-6xl">
                    🚗
                  </div>
                )}

                <div className="p-6">
                  <p className="text-xs font-black uppercase tracking-widest text-sky-300">
                    Saved Adventure
                  </p>
                  <h2 className="mt-2 text-2xl font-black">
                    {trip.title || trip.destination || "TrippinDays Adventure"}
                  </h2>

                  {(() => {
                    const startDate = getTripStartDate(trip.trip_request);
                    const tripStatus = getTripStatus(startDate);
                    const spent = trip.spendingTotal || 0;
                    const remaining =
                      trip.budget !== null
                        ? Math.max(Number(trip.budget) - spent, 0)
                        : null;

                    return (
                      <>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide ${
                              tripStatus === "Upcoming"
                                ? "bg-emerald-500/15 text-emerald-300"
                                : tripStatus === "Completed"
                                  ? "bg-white/10 text-white/60"
                                  : "bg-sky-500/15 text-sky-300"
                            }`}
                          >
                            {tripStatus}
                          </span>
                          {startDate && (
                            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white/75">
                              📅 {new Date(`${startDate}T12:00:00`).toLocaleDateString()}
                            </span>
                          )}
                        </div>

                        <div className="mt-4 space-y-2 text-sm text-white/65">
                          {trip.starting_location && (
                            <p>
                              <span className="font-bold text-white/90">From:</span>{" "}
                              {trip.starting_location}
                            </p>
                          )}
                          {trip.destination && (
                            <p>
                              <span className="font-bold text-white/90">To:</span>{" "}
                              {trip.destination}
                            </p>
                          )}
                          {trip.time_available && (
                            <p>
                              <span className="font-bold text-white/90">Time:</span>{" "}
                              {trip.time_available}
                            </p>
                          )}
                        </div>

                        <div className="mt-5 grid grid-cols-3 gap-2">
                          <div className="rounded-2xl bg-black/20 p-3 text-center">
                            <p className="text-[10px] font-black uppercase tracking-wide text-white/45">
                              Budget
                            </p>
                            <p className="mt-1 font-black">
                              {trip.budget !== null ? money(trip.budget) : "—"}
                            </p>
                          </div>

                          <div className="rounded-2xl bg-black/20 p-3 text-center">
                            <p className="text-[10px] font-black uppercase tracking-wide text-white/45">
                              Spent
                            </p>
                            <p className="mt-1 font-black text-emerald-300">
                              {money(spent)}
                            </p>
                          </div>

                          <div className="rounded-2xl bg-black/20 p-3 text-center">
                            <p className="text-[10px] font-black uppercase tracking-wide text-white/45">
                              Remaining
                            </p>
                            <p className="mt-1 font-black text-sky-300">
                              {remaining !== null ? money(remaining) : "—"}
                            </p>
                          </div>
                        </div>

                        {trip.created_at && (
                          <p className="mt-4 text-xs text-white/35">
                            Saved {new Date(trip.created_at).toLocaleDateString()}
                          </p>
                        )}
                      </>
                    );
                  })()}

                  <button
                    type="button"
                    onClick={() => openTrip(trip)}
                    className="mt-6 w-full rounded-2xl bg-sky-500 px-5 py-4 font-black hover:bg-sky-400"
                  >
                    🗺️ Open Trip & Spending
                  </button>

                  <button
                    type="button"
                    onClick={() => void deleteTrip(trip.id)}
                    disabled={deletingId === trip.id}
                    className="mt-3 w-full rounded-2xl border border-white/15 bg-white/5 px-5 py-3 font-bold text-white/70 hover:bg-white/10 disabled:opacity-50"
                  >
                    {deletingId === trip.id ? "Removing..." : "Remove Saved Trip"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
