"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import { createClient } from "@/lib/supabase/client";
type PhotoItem = {
  id: string;
  name: string;
  url: string;
};

type VideoItem = {
  id: string;
  title: string;
  youtubeUrl: string;
};

type MobileTab = "photos" | "journal" | "videos";

function getYouTubeEmbedUrl(url: string) {
  try {
    const parsed = new URL(url);

    if (parsed.hostname.includes("youtu.be")) {
      const id = parsed.pathname.replace("/", "");
      return id ? `https://www.youtube.com/embed/${id}` : "";
    }

    if (parsed.hostname.includes("youtube.com")) {
      const id = parsed.searchParams.get("v");

      if (id) {
        return `https://www.youtube.com/embed/${id}`;
      }

      const parts = parsed.pathname.split("/").filter(Boolean);
      const shortsIndex = parts.indexOf("shorts");
      const embedIndex = parts.indexOf("embed");

      if (shortsIndex >= 0 && parts[shortsIndex + 1]) {
        return `https://www.youtube.com/embed/${parts[shortsIndex + 1]}`;
      }

      if (embedIndex >= 0 && parts[embedIndex + 1]) {
        return `https://www.youtube.com/embed/${parts[embedIndex + 1]}`;
      }
    }
  } catch {
    return "";
  }

  return "";
}

export default function JournalPage() {
const [tripTitle, setTripTitle] = useState("");
const [tripDate, setTripDate] = useState("");
const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [favoriteMoment, setFavoriteMoment] = useState("");
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [youtubeInput, setYoutubeInput] = useState("");
  const [videoTitle, setVideoTitle] = useState("");
  const [mobileTab, setMobileTab] = useState<MobileTab>("journal");
  const [message, setMessage] = useState(
    "Add photos, write your story, and link your YouTube videos."
  );

  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
const [journalSearch, setJournalSearch] = useState("");
 const tripStats = useMemo(
  () => [
    ["Photos", String(photos.length)],
    ["Videos", String(videos.length)],
  ],
  [photos.length, videos.length]
);
const [earnedStamps, setEarnedStamps] = useState<
  {
    stamp_slug: string;
    earned_at: string;
  }[]
>([]);
  useEffect(() => {
  void loadEarnedStamps();
  void loadSavedJournals();
}, []);
type SavedJournal = {
  id: string;
  trip_title: string | null;
  trip_date: string | null;
  location: string | null;
  notes: string | null;
  favorite_moment: string | null;
  videos: VideoItem[];
  created_at: string;
};

const [savedJournals, setSavedJournals] = useState<SavedJournal[]>([]);
const [selectedJournal, setSelectedJournal] = useState<SavedJournal | null>(null);
const [savingJournal, setSavingJournal] = useState(false);
const filteredJournals = savedJournals.filter((journal) => {
  const search = journalSearch.toLowerCase().trim();

  if (!search) return true;

  return (
    (journal.trip_title ?? "").toLowerCase().includes(search) ||
    (journal.location ?? "").toLowerCase().includes(search) ||
    (journal.notes ?? "").toLowerCase().includes(search)
  );
});
async function loadEarnedStamps() {
  try {
    const supabase = createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) throw userError;

    if (!user) {
      setEarnedStamps([]);
      return;
    }

    const { data, error } = await supabase
      .from("user_stamps")
      .select("stamp_slug, earned_at")
      .eq("user_id", user.id)
      .order("earned_at", { ascending: false });

    if (error) throw error;

    setEarnedStamps(data ?? []);
  } catch (error) {
    console.error("Could not load earned stamps:", error);
  }
}

async function loadSavedJournals() {
  try {
    const supabase = createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) throw userError;

    if (!user) {
      setSavedJournals([]);
      return;
    }

    const { data, error } = await supabase
      .from("journals")
      .select(
        "id, trip_title, trip_date, location, notes, favorite_moment, videos, created_at"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    setSavedJournals((data ?? []) as SavedJournal[]);
  } catch (error) {
    console.error("Could not load journals:", error);
  }
}
  function addPhotos(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);

    if (files.length === 0) {
      return;
    }

    const newPhotos = files.map((file) => ({
      id: `${file.name}-${file.lastModified}-${crypto.randomUUID()}`,
      name: file.name,
      url: URL.createObjectURL(file),
    }));

    setPhotos((current) => [...newPhotos, ...current]);
    setMessage(
      `${newPhotos.length} photo${newPhotos.length === 1 ? "" : "s"} added.`
    );

    event.target.value = "";
  }

  function removePhoto(id: string) {
    setPhotos((current) => {
      const match = current.find((photo) => photo.id === id);

      if (match) {
        URL.revokeObjectURL(match.url);
      }

      return current.filter((photo) => photo.id !== id);
    });
  }

  function addYouTubeVideo() {
    const embedUrl = getYouTubeEmbedUrl(youtubeInput.trim());

    if (!embedUrl) {
      setMessage("That does not look like a valid YouTube link.");
      return;
    }

    setVideos((current) => [
      {
        id: crypto.randomUUID(),
        title: videoTitle.trim() || `Trip Video ${current.length + 1}`,
        youtubeUrl: embedUrl,
      },
      ...current,
    ]);

    setYoutubeInput("");
    setVideoTitle("");
    setMessage("YouTube video added to your journal.");
  }

  function removeVideo(id: string) {
    setVideos((current) => current.filter((video) => video.id !== id));
  }

  function newJournalEntry() {
    photos.forEach((photo) => URL.revokeObjectURL(photo.url));

    setTripTitle("");
    setTripDate("");
    setLocation("");
    setNotes("");
    setFavoriteMoment("");
    setPhotos([]);
    setVideos([]);
    setYoutubeInput("");
    setVideoTitle("");
    setMobileTab("journal");
    setMessage("New journal entry created. Add your trip details.");
  }

async function saveJournal() {
  try {
    setMessage("Saving journal...");

    const supabase = createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) throw userError;

    if (!user) {
      window.location.href = "/login?redirect=/journal";
      return;
    }

    const { error } = await supabase
      .from("journals")
      .insert({
        user_id: user.id,
        trip_title: tripTitle.trim() || null,
        trip_date: tripDate || null,
        location: location.trim() || null,
        notes: notes.trim() || null,
        favorite_moment: favoriteMoment.trim() || null,
        videos,
      });

    if (error) throw error;

    setMessage("✓ Journal saved!");
  } catch (error) {
    console.error("Journal save error:", error);

    setMessage(
      error instanceof Error
        ? error.message
        : "The journal could not be saved."
    );
  }
}

  function printJournal() {
    window.print();
  }

  return (
    <main className="min-h-screen bg-[#081525] text-white">
     <SiteHeader />

      <section
        className="relative overflow-hidden bg-cover bg-center"
        style={{
          backgroundImage:
            "linear-gradient(90deg, rgba(4,13,28,.96), rgba(4,13,28,.68), rgba(4,13,28,.24)), url('/images/beach.png')",
        }}
      >
        <div className="mx-auto max-w-7xl px-6 py-16">
          <p className="text-sm font-black uppercase tracking-[0.28em] text-emerald-300">
            Travel Journal
          </p>

          <h1 className="mt-4 text-5xl font-black sm:text-6xl">
            Save the story behind the trip.
          </h1>

          <p className="mt-5 max-w-2xl text-lg leading-8 text-white/70">
            Photos on the left, your journal in the center, and YouTube videos
            on the right.
          </p>

          <p className="mt-5 text-sm font-bold text-emerald-300">{message}</p>
        </div>
      </section>

      <div className="no-print mx-auto max-w-7xl px-6 pt-6 lg:hidden">
        <div className="grid grid-cols-3 rounded-2xl bg-white/5 p-1">
          {[
            ["photos", "📷 Photos"],
            ["journal", "📝 Journal"],
            ["videos", "🎥 Videos"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setMobileTab(value as MobileTab)}
              className={`rounded-xl px-3 py-3 text-sm font-black ${
                mobileTab === value
                  ? "bg-white text-slate-950"
                  : "text-white/60"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[260px_minmax(0,1fr)_300px]">
        <aside
          className={`no-print rounded-[2rem] border border-white/10 bg-[#10263f] p-5 shadow-2xl ${
            mobileTab !== "photos" ? "hidden lg:block" : ""
          }`}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black">Photos</h2>
            <span className="text-sm text-white/45">{photos.length}</span>
          </div>

          <div className="mt-5 grid gap-3">
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="rounded-2xl bg-sky-500 px-4 py-3 font-black transition hover:bg-sky-400"
            >
              📷 Take Photo
            </button>

            <button
              type="button"
              onClick={() => uploadInputRef.current?.click()}
              className="rounded-2xl bg-white/10 px-4 py-3 font-black transition hover:bg-white/15"
            >
              ⬆️ Upload Photos
            </button>

            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={addPhotos}
            />

            <input
              ref={uploadInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={addPhotos}
            />
          </div>

          <div className="mt-5 max-h-[680px] space-y-4 overflow-y-auto pr-1">
            {photos.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/15 p-6 text-center text-sm text-white/40">
                Your trip photos will appear here.
              </div>
            ) : (
              photos.map((photo) => (
                <article
                  key={photo.id}
                  className="group relative overflow-hidden rounded-2xl"
                >
                  <img
                    src={photo.url}
                    alt={photo.name}
                    className="h-44 w-full object-cover"
                  />

                  <button
                    type="button"
                    onClick={() => removePhoto(photo.id)}
                    className="absolute right-2 top-2 rounded-full bg-black/65 px-3 py-1 text-sm font-black opacity-0 transition group-hover:opacity-100"
                  >
                    Remove
                  </button>
                </article>
              ))
            )}
          </div>
        </aside>

        <section
          className={`journal-page rounded-[2rem] bg-[#fffdf7] p-6 text-slate-900 shadow-2xl sm:p-9 ${
            mobileTab !== "journal" ? "hidden lg:block" : ""
          }`}
        >
          <div className="grid gap-4 sm:grid-cols-[2fr_1-fr]">
            <label>
              <span className="text-xs font-black uppercase tracking-wider text-slate-400">
                Trip title
              </span>
              <input
                value={tripTitle}
                onChange={(event) => setTripTitle(event.target.value)}
                placeholder="Name this adventure"
                className="mt-2 w-full border-b border-slate-200 bg-transparent pb-3 text-2xl font-black outline-none placeholder:text-slate-300"
              />
            </label>

            <label>
              <span className="text-xs font-black uppercase tracking-wider text-slate-400">
                Date
              </span>
              <input
  type="date"
  value={tripDate}
  onChange={(event) => setTripDate(event.target.value)}
  className="mt-2 w-full border-b border-slate-200 bg-transparent pb-3 font-bold text-slate-900 outline-none"
/>
            </label>
          </div>

          <label className="mt-6 block">
            <span className="text-xs font-black uppercase tracking-wider text-slate-400">
              Location
            </span>
            <input
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Where did you go?"
              className="mt-2 w-full border-b border-slate-200 bg-transparent pb-3 font-bold outline-none placeholder:text-slate-300"
            />
          </label>

          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {tripStats.map(([label, value]) => (
              <div
                key={label}
                className="rounded-2xl bg-slate-100 p-4 text-center"
              >
                <p className="text-xl font-black">{value}</p>
                <p className="mt-1 text-xs font-bold uppercase tracking-wider text-slate-400">
                  {label}
                </p>
              </div>
            ))}
          </div>

          <label className="mt-8 block">
            <span className="text-xs font-black uppercase tracking-wider text-slate-400">
              My trip story
            </span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="We left just after sunrise..."
              className="mt-3 min-h-[340px] w-full resize-none rounded-3xl bg-[#f4efe5] p-6 font-serif text-lg leading-9 outline-none placeholder:text-slate-400"
            />
          </label>

          <label className="mt-6 block">
            <span className="text-xs font-black uppercase tracking-wider text-slate-400">
              Favorite moment
            </span>
            <textarea
              value={favoriteMoment}
              onChange={(event) => setFavoriteMoment(event.target.value)}
              placeholder="The moment I never want to forget..."
              className="mt-3 min-h-28 w-full resize-none rounded-2xl border border-amber-200 bg-amber-50 p-5 font-serif text-lg italic outline-none"
            />
          </label>

        {earnedStamps.length > 0 && (
  <div className="mt-8 rounded-3xl bg-[#10263f] p-6 text-white">
    <p className="text-xs font-black uppercase tracking-[0.22em] text-sky-300">
      Passport Stamps
    </p>

    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      {earnedStamps.map((stamp) => (
        <div
          key={`${stamp.stamp_slug}-${stamp.earned_at}`}
          className="rounded-2xl border border-white/10 bg-white/5 p-4"
        >
          <p className="text-lg font-black capitalize">
            {stamp.stamp_slug.replaceAll("-", " ")}
          </p>

          <p className="mt-1 text-sm text-white/55">
            Earned{" "}
            {new Date(stamp.earned_at).toLocaleDateString()}
          </p>
        </div>
      ))}
    </div>
  </div>
)}

          <div className="no-print mt-8 grid gap-3 sm:grid-cols-3">
            <button
              type="button"
              onClick={newJournalEntry}
              className="rounded-2xl bg-emerald-600 px-5 py-4 font-black text-white transition hover:bg-emerald-500"
            >
              + New Entry
            </button>

            <button
  type="button"
  onClick={saveJournal}
  disabled={savingJournal}
  className={`rounded-2xl px-5 py-4 font-black text-white transition ${
    savingJournal
      ? "bg-slate-500"
      : message.includes("✓")
      ? "bg-emerald-600"
      : "bg-slate-950 hover:bg-slate-800"
  }`}
>
  {savingJournal
    ? "Saving..."
    : message.includes("✓")
    ? "✓ Saved"
    : "Save Journal"}
</button>
   

            <button
              type="button"
              onClick={printJournal}
              className="rounded-2xl bg-amber-600 px-5 py-4 font-black text-white"
            >
              🖨️ Print Journal
            </button>
          </div>
        </section>

        <aside
          className={`no-print rounded-[2rem] border border-white/10 bg-[#10263f] p-5 shadow-2xl ${
            mobileTab !== "videos" ? "hidden lg:block" : ""
          }`}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black">Videos</h2>
            <span className="text-sm text-white/45">{videos.length}</span>
          </div>

          <div className="mt-5 space-y-3">
            <input
              value={videoTitle}
              onChange={(event) => setVideoTitle(event.target.value)}
              placeholder="Video title"
              className="w-full rounded-2xl bg-white/10 px-4 py-3 outline-none placeholder:text-white/35"
            />

            <input
              value={youtubeInput}
              onChange={(event) => setYoutubeInput(event.target.value)}
              placeholder="Paste YouTube link"
              className="w-full rounded-2xl bg-white/10 px-4 py-3 outline-none placeholder:text-white/35"
            />

            <button
              type="button"
              onClick={addYouTubeVideo}
              className="w-full rounded-2xl bg-red-500 px-4 py-3 font-black transition hover:bg-red-400"
            >
              ▶ Add YouTube Video
            </button>
          </div>

          <div className="mt-5 max-h-[680px] space-y-4 overflow-y-auto pr-1">
            {videos.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/15 p-6 text-center text-sm text-white/40">
                Your YouTube videos will appear here.
              </div>
            ) : (
              videos.map((video) => (
                <article
                  key={video.id}
                  className="overflow-hidden rounded-2xl bg-black/20"
                >
                  <iframe
                    src={video.youtubeUrl}
                    title={video.title}
                    className="aspect-video w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />

                  <div className="flex items-center justify-between gap-3 p-3">
                    <p className="truncate text-sm font-black">{video.title}</p>

                    <button
                      type="button"
                      onClick={() => removeVideo(video.id)}
                      className="text-xs font-bold text-red-300"
                    >
                      Remove
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </aside>
      </section>

      <nav className="no-print border-t border-white/10 bg-[#081525]">
        <div className="mx-auto grid max-w-3xl grid-cols-5 px-4 py-3 text-center text-xs">
          {[
            ["⌂", "Home", "/"],
            ["📍", "Plan Trip", "/"],
            ["🛂", "Passport", "/passport"],
            ["📖", "Journal", "/journal"],
            ["👤", "Profile", "/profile"],
          ].map(([icon, label, href]) => (
            <a
              key={label}
              href={href}
              className={`rounded-2xl px-2 py-2 font-bold transition ${
                label === "Journal"
                  ? "bg-emerald-500/15 text-emerald-300"
                  : "text-white/45 hover:bg-white/5 hover:text-white"
              }`}
            >
              <div className="text-2xl">{icon}</div>
              <p className="mt-1">{label}</p>
            </a>
          ))}
        </div>
      </nav>

      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }

          body {
            background: white !important;
          }

          .journal-page {
            box-shadow: none !important;
            border-radius: 0 !important;
            min-height: 100vh;
            padding: 0.5in !important;
          }
        }
      `}</style>
    <div className="no-print mt-20  mb-10 w-full rounded-3xl border border-slate-200 bg-slate-50 p-4">
  <div className="flex flex-wrap items-center justify-between gap-4">
    <div>
      <p className="text-xs font-black uppercase tracking-[0.22em] text-sky-600">
        My Journals
      </p>

      <h2 className="mt-1 text-2xl font-black text-slate-900">
        Past Adventures
      </h2>
    </div>

    <span className="rounded-full bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm">
      {savedJournals.length} Saved
    </span>
  </div>

  <input
    type="search"
    value={journalSearch}
    onChange={(event) => setJournalSearch(event.target.value)}
    placeholder="Search by trip, location, or journal notes..."
    className="mt-5 w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 font-bold text-slate-900 outline-none focus:border-sky-400"
  />

  {filteredJournals.length === 0 ? (
    <p className="mt-5 text-slate-500">
      {savedJournals.length === 0
        ? "You haven't saved any journals yet."
        : "No journals match your search."}
    </p>
  ) : (
  <div className="mt-3 grid max-h-[125px] gap-2 overflow-y-auto pr-2">
      {filteredJournals.map((journal) => (
        <button
  key={journal.id}
  type="button"
onClick={() => setSelectedJournal(journal)}
  className="flex min-h-[54px] items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2 text-left transition hover:border-sky-300"
>
  <div className="min-w-0 flex-1">
    <span className="font-black text-slate-900">
      {journal.trip_title || "Untitled Adventure"}
    </span>

    {journal.location && (
      <span className="ml-3 text-sm text-slate-500">
        {journal.location}
      </span>
    )}
  </div>

  {journal.trip_date && (
    <span className="shrink-0 text-sm font-bold text-slate-500">
      {journal.trip_date}
    </span>
  )}
</button>
      ))}
    </div>
  )}
</div>
{selectedJournal && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
    <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-[#fffdf7] p-6 text-slate-900 shadow-2xl sm:p-8">

      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-sky-600">
            Saved Journal
          </p>

          <h2 className="mt-2 text-3xl font-black">
            {selectedJournal.trip_title || "Untitled Adventure"}
          </h2>

          <p className="mt-2 text-slate-500">
            {selectedJournal.location || "No location"}
            {selectedJournal.trip_date
              ? ` • ${selectedJournal.trip_date}`
              : ""}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setSelectedJournal(null)}
          className="rounded-full bg-slate-100 px-4 py-2 font-black hover:bg-slate-200"
        >
          ✕
        </button>
      </div>

      {selectedJournal.notes && (
        <div className="mt-8">
          <p className="text-xs font-black uppercase tracking-widest text-slate-400">
            My Story
          </p>

          <p className="mt-3 whitespace-pre-wrap text-lg leading-8">
            {selectedJournal.notes}
          </p>
        </div>
      )}

      {selectedJournal.favorite_moment && (
        <div className="mt-8 rounded-2xl bg-amber-50 p-5">
          <p className="text-xs font-black uppercase tracking-widest text-amber-700">
            Favorite Moment
          </p>

          <p className="mt-2 text-lg">
            {selectedJournal.favorite_moment}
          </p>
        </div>
      )}

      {selectedJournal.videos &&
        selectedJournal.videos.length > 0 && (
          <div className="mt-8">
            <p className="text-xs font-black uppercase tracking-widest text-slate-400">
              Videos
            </p>

            <div className="mt-3 grid gap-3">
              {selectedJournal.videos.map((video) => (
                <a
                  key={video.id}
                  href={video.youtubeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-2xl border border-slate-200 p-4 font-bold text-sky-700 hover:bg-slate-50"
                >
                  ▶ {video.title}
                </a>
              ))}
            </div>
          </div>
        )}

      <button
        type="button"
        onClick={() => setSelectedJournal(null)}
        className="mt-8 w-full rounded-2xl bg-slate-900 px-5 py-3 font-black text-white hover:bg-slate-800"
      >
        Back to My Journals
      </button>

    </div>
  </div>
)}
</main>
  );
}