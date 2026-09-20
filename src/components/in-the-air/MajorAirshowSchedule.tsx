"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import useTrippinDaysLocation from "@/hooks/useTrippinDaysLocation";

type EventType =
  | "Airshow"
  | "Military Demonstration"
  | "Warbird Event"
  | "Fly-In"
  | "Balloon Festival"
  | "Aviation Festival";

type AirshowEvent = {
  id: string;

  name: string;

  city: string;
  region: string;

  venue: string;

  latitude:
    | number
    | null;

  longitude:
    | number
    | null;

  distanceMiles:
    | number
    | null;

  startDate: string;
  endDate:
    | string
    | null;

  startTime:
    | string
    | null;

  eventType:
    EventType;

  performers:
    string[];

  ticketUrl:
    | string
    | null;

  imageUrl:
    | string
    | null;

  priceFrom:
    | number
    | null;

  currency:
    | string
    | null;

  source: string;
};

type Filter =
  | "All"
  | "Military"
  | "Airshows"
  | "Balloons";

function formatDate(
  value: string
) {
  const [
    year,
    month,
    day,
  ] =
    value
      .split("-")
      .map(Number);

  const date =
    new Date(
      year,
      month - 1,
      day,
      12
    );

  return new Intl.DateTimeFormat(
    "en-US",
    {
      month:
        "short",

      day:
        "numeric",

      year:
        "numeric",
    }
  ).format(date);
}

function formatTime(
  value:
    | string
    | null
) {
  if (!value) {
    return null;
  }

  const [
    hourValue,
    minuteValue,
  ] =
    value
      .split(":")
      .map(Number);

  if (
    !Number.isFinite(
      hourValue
    )
  ) {
    return value;
  }

  const suffix =
    hourValue >= 12
      ? "PM"
      : "AM";

  const hour =
    hourValue === 0
      ? 12
      : hourValue > 12
        ? hourValue - 12
        : hourValue;

  return `${hour}:${String(
    minuteValue || 0
  ).padStart(
    2,
    "0"
  )} ${suffix}`;
}

function eventBadge(
  type: EventType
) {
  if (
    type ===
    "Military Demonstration"
  ) {
    return "🇺🇸";
  }

  if (
    type ===
    "Balloon Festival"
  ) {
    return "🎈";
  }

  if (
    type ===
    "Warbird Event"
  ) {
    return "🛩️";
  }

  if (
    type ===
    "Fly-In"
  ) {
    return "✈️";
  }

  return "🛫";
}

export default function MajorAirshowSchedule() {
  const {
    location,
  } =
    useTrippinDaysLocation({
      autoRefreshIfGranted:
        true,
    });

  const [
    events,
    setEvents,
  ] =
    useState<
      AirshowEvent[]
    >([]);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    filter,
    setFilter,
  ] =
    useState<Filter>(
      "All"
    );

  const [
    showAll,
    setShowAll,
  ] =
    useState(false);

  useEffect(() => {
    let cancelled =
      false;

    async function loadSchedule() {
      setLoading(
        true
      );

      setError("");

      try {
        const params =
          new URLSearchParams();

        if (
          location?.latitude !=
          null &&
          location?.longitude !=
          null
        ) {
          params.set(
            "lat",
            String(
              location.latitude
            )
          );

          params.set(
            "lon",
            String(
              location.longitude
            )
          );
        }

        const response =
          await fetch(
            `/api/in-the-air/major-airshows?${params.toString()}`,
            {
              cache:
                "no-store",
            }
          );

        const data =
          await response.json();

        if (
          !response.ok ||
          !data?.success
        ) {
          throw new Error(
            data?.error ||
              "Unable to load the major airshow schedule."
          );
        }

        if (
          cancelled
        ) {
          return;
        }

        setEvents(
          Array.isArray(
            data?.events
          )
            ? data.events
            : []
        );
      } catch (
        error
      ) {
        if (
          cancelled
        ) {
          return;
        }

        setError(
          error instanceof
            Error
            ? error.message
            : "Unable to load the major airshow schedule."
        );
      } finally {
        if (
          !cancelled
        ) {
          setLoading(
            false
          );
        }
      }
    }

    void loadSchedule();

    return () => {
      cancelled =
        true;
    };
  }, [
    location?.latitude,
    location?.longitude,
  ]);

  const filtered =
    useMemo(
      () =>
        events.filter(
          (
            event
          ) => {
            if (
              filter ===
              "Military"
            ) {
              return (
                event.eventType ===
                "Military Demonstration"
              );
            }

            if (
              filter ===
              "Balloons"
            ) {
              return (
                event.eventType ===
                "Balloon Festival"
              );
            }

            if (
              filter ===
              "Airshows"
            ) {
              return (
                event.eventType !==
                "Balloon Festival"
              );
            }

            return true;
          }
        ),
      [
        events,
        filter,
      ]
    );

  const visible =
    showAll
      ? filtered
      : filtered.slice(
          0,
          8
        );

  function planAirshow(
    event: AirshowEvent
  ) {
    const dates =
      event.endDate &&
      event.endDate !==
        event.startDate
        ? `${formatDate(
            event.startDate
          )} through ${formatDate(
            event.endDate
          )}`
        : formatDate(
            event.startDate
          );

    const prompt = `
Plan a complete TrippinDays trip to this scheduled aviation event.

EVENT:
${event.name}

TYPE:
${event.eventType}

DATE:
${dates}

START TIME:
${formatTime(event.startTime) || "Check official event information"}

LOCATION:
${event.city}${event.region ? `, ${event.region}` : ""}

VENUE / AIRPORT:
${event.venue || "Check event information"}

DISTANCE FROM MY CURRENT AREA:
${
  event.distanceMiles != null
    ? `Approximately ${event.distanceMiles} miles`
    : "Calculate from my starting location"
}

PERFORMERS / ATTRACTIONS:
${
  event.performers.length
    ? event.performers.join(", ")
    : "Check the current official event lineup"
}

EVENT INFORMATION:
${event.ticketUrl || "Check the official event source"}

Build a realistic complete trip around this exact event date.

Include:
- realistic departure time
- round-trip driving route
- mileage
- fuel cost
- parking
- admission/tickets only when verified
- food
- lodging when appropriate
- weather
- rain and wind considerations
- arrival time before gates/show start
- nearby attractions
- estimated total trip cost
- backup activities if flying demonstrations are delayed or canceled
- final Check Before Leaving section

Do not invent performers, ticket prices, gates-open times, show times, parking rules, or event availability.

Airshow schedules can change. Tell the traveler to confirm the current official schedule before leaving.
`.trim();

    try {
      localStorage.setItem(
        "trippindays-request",
        prompt
      );

      sessionStorage.setItem(
        "trippindays-request",
        prompt
      );

      window.location.assign(
        "/trip"
      );
    } catch {
      window.location.assign(
        `/trip?request=${encodeURIComponent(
          prompt
        )}`
      );
    }
  }

  return (
    <section
      id="major-airshows"
      className="bg-slate-50 py-10 sm:py-14"
    >
      <div className="mx-auto max-w-[1500px] px-4 sm:px-6 lg:px-8">

        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg">

          {/* HEADER */}

          <div className="bg-[#062b35] p-6 text-white sm:p-8">

            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">

              <div>

                <div className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">
                  🛩️ Aviation Events
                </div>

                <h2 className="mt-2 text-3xl font-black sm:text-4xl">
                  Major Airshow Schedule
                </h2>

                <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-cyan-50/80">
                  Browse upcoming airshows, military flight demonstrations, aviation festivals, warbird events, fly-ins and balloon festivals across the United States.
                </p>

              </div>

              <div className="flex flex-wrap gap-2">

                <a
                  href="https://www.blueangels.navy.mil/show/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-xs font-black transition hover:bg-white/20"
                >
                  🇺🇸 Blue Angels Schedule ↗
                </a>

                <a
                  href="https://www.airforce.com/thunderbirds/schedule"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-xs font-black transition hover:bg-white/20"
                >
                  🇺🇸 Thunderbirds Schedule ↗
                </a>

              </div>

            </div>

          </div>

          {/* FILTERS */}

          <div className="border-b border-slate-200 p-4 sm:px-6">

            <div className="flex gap-2 overflow-x-auto">

              {[
                "All",
                "Military",
                "Airshows",
                "Balloons",
              ].map(
                (
                  item
                ) => (
                  <button
                    key={
                      item
                    }
                    type="button"
                    onClick={() => {
                      setFilter(
                        item as Filter
                      );

                      setShowAll(
                        false
                      );
                    }}
                    className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-black ${
                      filter === item
                        ? "bg-[#078dcf] text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {item}
                  </button>
                )
              )}

            </div>

          </div>

          {/* LOADING */}

          {loading && (
            <div className="p-10 text-center">

              <div className="text-4xl">
                🛩️
              </div>

              <div className="mt-3 font-black text-[#092530]">
                Loading major aviation events...
              </div>

            </div>
          )}

          {/* ERROR */}

          {!loading &&
            error && (
              <div className="m-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-bold text-red-800">
                {error}
              </div>
            )}

          {/* EMPTY */}

          {!loading &&
            !error &&
            filtered.length ===
              0 && (
              <div className="p-10 text-center">

                <div className="text-4xl">
                  🛩️
                </div>

                <div className="mt-3 text-lg font-black text-[#092530]">
                  No matching scheduled events were returned.
                </div>

                <p className="mt-2 text-sm text-slate-500">
                  Try another schedule category or check one of the official military demonstration schedules above.
                </p>

              </div>
            )}

          {/* EVENTS */}

          {!loading &&
            !error &&
            visible.length >
              0 && (
              <div className="grid gap-5 p-5 sm:p-6 md:grid-cols-2 xl:grid-cols-4">

                {visible.map(
                  (
                    event
                  ) => (
                    <article
                      key={
                        event.id
                      }
                      className="flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
                    >

                      {event.imageUrl ? (
                        <div className="relative h-44 overflow-hidden">

                          <img
                            src={
                              event.imageUrl
                            }
                            alt={
                              event.name
                            }
                            className="h-full w-full object-cover"
                          />

                          <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />

                          <div className="absolute bottom-3 left-3 rounded-full bg-black/55 px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-white backdrop-blur">
                            {eventBadge(
                              event.eventType
                            )}{" "}
                            {event.eventType}
                          </div>

                        </div>
                      ) : (
                        <div className="flex h-32 items-center justify-center bg-gradient-to-br from-sky-100 to-cyan-50 text-5xl">
                          {eventBadge(
                            event.eventType
                          )}
                        </div>
                      )}

                      <div className="flex flex-1 flex-col p-5">

                        <div className="text-[10px] font-black uppercase tracking-[0.15em] text-cyan-700">
                          {event.eventType}
                        </div>

                        <h3 className="mt-2 text-lg font-black leading-6 text-[#092530]">
                          {event.name}
                        </h3>

                        <div className="mt-4 space-y-2 text-xs font-semibold text-slate-600">

                          <div>
                            📅{" "}
                            {formatDate(
                              event.startDate
                            )}

                            {event.endDate &&
                              event.endDate !==
                                event.startDate &&
                              ` – ${formatDate(
                                event.endDate
                              )}`}
                          </div>

                          {event.startTime && (
                            <div>
                              🕐{" "}
                              {formatTime(
                                event.startTime
                              )}
                            </div>
                          )}

                          <div>
                            📍{" "}
                            {[
                              event.city,
                              event.region,
                            ]
                              .filter(
                                Boolean
                              )
                              .join(
                                ", "
                              )}
                          </div>

                          {event.venue && (
                            <div>
                              🛩️{" "}
                              {event.venue}
                            </div>
                          )}

                          {event.distanceMiles !=
                            null && (
                            <div>
                              🚗{" "}
                              {event.distanceMiles}{" "}
                              miles away
                            </div>
                          )}

                        </div>

                        {event.performers.length >
                          0 && (
                          <div className="mt-4 flex flex-wrap gap-1.5">

                            {event.performers
                              .slice(
                                0,
                                4
                              )
                              .map(
                                (
                                  performer
                                ) => (
                                  <span
                                    key={
                                      performer
                                    }
                                    className="rounded-full bg-sky-50 px-2.5 py-1 text-[10px] font-black text-sky-800"
                                  >
                                    {performer}
                                  </span>
                                )
                              )}

                          </div>
                        )}

                        <div className="mt-auto grid gap-2 pt-5">

                          {event.ticketUrl && (
                            <a
                              href={
                                event.ticketUrl
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-center text-xs font-black text-cyan-800 hover:bg-cyan-100"
                            >
                              🎟️ Event Info / Tickets ↗
                            </a>
                          )}

                          <button
                            type="button"
                            onClick={() =>
                              planAirshow(
                                event
                              )
                            }
                            className="rounded-xl bg-orange-500 px-4 py-3 text-xs font-black text-white hover:bg-orange-600"
                          >
                            PLAN THIS AIRSHOW →
                          </button>

                        </div>

                      </div>

                    </article>
                  )
                )}

              </div>
            )}

          {/* SHOW MORE */}

          {!loading &&
            !error &&
            filtered.length >
              8 && (
              <div className="border-t border-slate-200 p-5 text-center">

                <button
                  type="button"
                  onClick={() =>
                    setShowAll(
                      !showAll
                    )
                  }
                  className="rounded-xl bg-[#062b35] px-6 py-3 text-sm font-black text-white hover:bg-[#0a4655]"
                >
                  {showAll
                    ? "Show Fewer"
                    : `View All ${filtered.length} Scheduled Events`}
                </button>

              </div>
            )}

          {/* NOTE */}

          <div className="border-t border-slate-200 bg-slate-50 px-5 py-4 text-xs font-semibold leading-5 text-slate-500 sm:px-6">
            Airshow schedules, performers and demonstration times can change because of weather, operations or event decisions. Confirm the latest event information before traveling.
          </div>

        </div>

      </div>
    </section>
  );
}