"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import SiteHeader from "../../components/SiteHeader";
type CommunityPost = {
  id: string;
  user_id: string;
  trip_id: string | null;
  title: string;
  caption: string | null;
  destination: string | null;
  image_url: string | null;
  is_public: boolean;
  created_at: string;
};

export default function CommunityPage() {
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [destination, setDestination] = useState("");
  const [caption, setCaption] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void loadCommunity();
  }, []);

  async function loadCommunity() {
    try {
      setLoading(true);
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);

      const { data, error } = await supabase
        .from("community_posts")
        .select("*")
        .eq("is_public", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPosts((data ?? []) as CommunityPost[]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Community posts could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setMessage("Please choose an image file.");
      return;
    }

    if (file.size > 6 * 1024 * 1024) {
      setMessage("The photo must be smaller than 6 MB.");
      return;
    }

    if (preview) URL.revokeObjectURL(preview);
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
    setMessage("");
  }

  async function createPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!title.trim()) {
      setMessage("Give your adventure a title.");
      return;
    }

    try {
      setPosting(true);
      setMessage("");
      const supabase = createClient();

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;

      if (!user) {
        window.location.href = "/login?redirect=/community";
        return;
      }

      let imageUrl: string | null = null;

      if (photo) {
        const extension = photo.name.split(".").pop()?.toLowerCase() || "jpg";
        const photoPath = `${user.id}/${crypto.randomUUID()}.${extension}`;

        const { error: uploadError } = await supabase.storage
          .from("community-photos")
          .upload(photoPath, photo, { cacheControl: "3600", upsert: false });

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from("community-photos")
          .getPublicUrl(photoPath);

        imageUrl = publicUrlData.publicUrl;
      }

      const { error: insertError } = await supabase
        .from("community_posts")
        .insert({
          user_id: user.id,
          title: title.trim(),
          destination: destination.trim() || null,
          caption: caption.trim() || null,
          image_url: imageUrl,
          is_public: true,
        });

      if (insertError) throw insertError;

      setTitle("");
      setDestination("");
      setCaption("");
      setPhoto(null);
      if (preview) URL.revokeObjectURL(preview);
      setPreview(null);
      setMessage("Adventure shared with the TrippinDays community!");
      await loadCommunity();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Your adventure could not be shared.");
    } finally {
      setPosting(false);
    }
  }

  async function deletePost(post: CommunityPost) {
    if (!userId || post.user_id !== userId) return;
    if (!window.confirm("Delete this community post?")) return;

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("community_posts")
        .delete()
        .eq("id", post.id)
        .eq("user_id", userId);

      if (error) throw error;
      setPosts((current) => current.filter((item) => item.id !== post.id));
      setMessage("Post deleted.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The post could not be deleted.");
    }
  }

  return (
    <main className="min-h-screen bg-[#061426] text-white">
      <SiteHeader />

      <section
        className="relative overflow-hidden border-b border-white/10"
        style={{
          backgroundImage: "url('/images/campfire.png')",
          backgroundSize: "cover",
backgroundRepeat: "no-repeat",
backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-[#061426]/95 via-[#061426]/70 to-[#061426]/25" />
        <div className="relative mx-auto max-w-7xl px-6 py-16 sm:py-24">
          <p className="text-sm font-black uppercase tracking-[0.28em] text-cyan-300">TrippinDays Community</p>
          <h1 className="mt-4 max-w-4xl text-5xl font-black sm:text-7xl">Share the adventure.</h1>
          <p className="mt-5 max-w-2xl text-xl leading-8 text-white/80">
            Show other travelers where you went, what you found, and why the trip was worth taking.
          </p>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-8 px-6 py-10 lg:grid-cols-[390px_1fr]">
        <aside>
          <div className="sticky top-6 rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl">
            <p className="text-sm font-black uppercase tracking-widest text-sky-300">Share an adventure</p>
            <h2 className="mt-2 text-3xl font-black">Add to the community</h2>

            {!userId && (
              <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4 text-amber-100">
                Sign in to share your own trips. You can still browse public adventures.
              </div>
            )}

            <form onSubmit={createPost} className="mt-6 space-y-5">
              <Field label="Adventure Title" value={title} onChange={setTitle} placeholder="Rainier Waterfall Adventure" required />
              <Field label="Destination" value={destination} onChange={setDestination} placeholder="Mount Rainier, Washington" />

              <div>
                <label htmlFor="caption" className="text-xs font-black uppercase tracking-widest text-white/50">Tell us about it</label>
                <textarea
                  id="caption"
                  value={caption}
                  onChange={(event) => setCaption(event.target.value)}
                  rows={5}
                  maxLength={1200}
                  placeholder="What did you discover? What should another traveler know?"
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-white outline-none placeholder:text-white/30 focus:border-cyan-400"
                />
                <p className="mt-1 text-right text-xs text-white/30">{caption.length}/1200</p>
              </div>

              <div>
                <label htmlFor="community-photo" className="text-xs font-black uppercase tracking-widest text-white/50">Adventure Photo</label>
                <input
                  id="community-photo"
                  type="file"
                  accept="image/*"
                  onChange={choosePhoto}
                  className="mt-2 block w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white"
                />
                {preview && <img src={preview} alt="Community post preview" className="mt-4 h-48 w-full rounded-2xl object-cover" />}
              </div>

              <button type="submit" disabled={posting} className="w-full rounded-2xl bg-cyan-400 px-5 py-4 text-lg font-black text-slate-950 transition hover:bg-cyan-300 disabled:opacity-50">
                {posting ? "Sharing..." : "🌎 Share Adventure"}
              </button>
            </form>
          </div>
        </aside>

        <section>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-black uppercase tracking-widest text-sky-300">Recent Adventures</p>
              <h2 className="mt-2 text-4xl font-black">See where everyone&apos;s trippin&apos;</h2>
            </div>
            <button type="button" onClick={() => void loadCommunity()} className="rounded-full border border-white/15 px-5 py-2 font-bold hover:bg-white/10">↻ Refresh</button>
          </div>

          {message && <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 font-bold text-white/80">{message}</div>}

          {loading ? (
            <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-10 text-center">
              <div className="animate-bounce text-6xl">🌎</div>
              <p className="mt-4 text-xl font-black">Loading adventures...</p>
            </div>
          ) : posts.length === 0 ? (
            <div className="mt-8 rounded-3xl border border-dashed border-white/15 bg-white/5 p-12 text-center">
              <div className="text-6xl">🚗</div>
              <h3 className="mt-4 text-3xl font-black">Be the first to share an adventure</h3>
              <p className="mt-3 text-white/60">Community trips will appear here.</p>
            </div>
          ) : (
            <div className="mt-8 grid gap-6 xl:grid-cols-2">
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  canDelete={post.user_id === userId}
                  onDelete={() => void deletePost(post)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function PostCard({ post, canDelete, onDelete }: { post: CommunityPost; canDelete: boolean; onDelete: () => void }) {
  return (
    <article className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 shadow-xl">
      {post.image_url ? (
        <img src={post.image_url} alt={post.title} className="h-64 w-full object-cover" />
      ) : (
        <div className="flex h-48 items-center justify-center bg-gradient-to-br from-sky-900 to-slate-950 text-7xl">🌄</div>
      )}

      <div className="p-6">
        {post.destination && <p className="text-sm font-black uppercase tracking-widest text-cyan-300">📍 {post.destination}</p>}
        <h3 className="mt-2 text-3xl font-black">{post.title}</h3>
        {post.caption && <p className="mt-4 whitespace-pre-wrap leading-7 text-white/70">{post.caption}</p>}

        <div className="mt-6 flex items-center justify-between gap-3 border-t border-white/10 pt-4">
          <p className="text-sm text-white/35">{formatDate(post.created_at)}</p>
          {canDelete && (
            <button type="button" onClick={onDelete} className="rounded-full border border-red-400/20 px-4 py-2 text-sm font-bold text-red-300 hover:bg-red-500/10">Delete</button>
          )}
        </div>
      </div>
    </article>
  );
}

function Field({ label, value, onChange, placeholder, required = false }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; required?: boolean }) {
  const id = label.toLowerCase().replace(/\s+/g, "-");

  return (
    <div>
      <label htmlFor={id} className="text-xs font-black uppercase tracking-widest text-white/50">{label}</label>
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        maxLength={160}
        className="mt-2 w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-white outline-none placeholder:text-white/30 focus:border-cyan-400"
      />
    </div>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}