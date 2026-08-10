"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import SiteHeader from "@/components/SiteHeader";
const CATEGORIES = [
  { value: "bug", label: "🐞 Report a Bug" },
  { value: "feature", label: "💡 Suggest a Feature" },
  { value: "love", label: "❤️ Tell Us What You Love" },
  { value: "destination", label: "🗺️ Missing Destination" },
  { value: "general", label: "⭐ General Feedback" },
];

export default function FeedbackPage() {
  const [category, setCategory] = useState("bug");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [sent, setSent] = useState(false);

  async function submitFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!subject.trim() || !message.trim()) {
      setStatusMessage("Please add a subject and message.");
      return;
    }

    try {
      setIsSending(true);
      setStatusMessage("");

      const supabase = createClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        console.warn(
          "Could not read signed-in user:",
          userError.message
        );
      }

      const { error: insertError } = await supabase
        .from("feedback")
        .insert({
          user_id: user?.id ?? null,
          name: name.trim() || null,
          email:
            email.trim() ||
            user?.email ||
            null,
          category,
          subject: subject.trim(),
          message: message.trim(),
          app_version: "1.0.0",
          status: "new",
        });

      if (insertError) throw insertError;

      setSent(true);
      setStatusMessage(
        "Thank you. Your feedback was sent."
      );
      setSubject("");
      setMessage("");
      setCategory("bug");
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? error.message
          : "Your feedback could not be sent."
      );
    } finally {
      setIsSending(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#061426] text-white">
      <SiteHeader />

    <section
  className="relative h-[42vh] min-h-[380px] overflow-hidden"
  style={{
    backgroundImage: "url('/images/lighthouse1.jpg')",
    backgroundSize: "90%",
    backgroundPosition: "center 45%",
    backgroundRepeat: "no-repeat",
  }}
>
  <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/30 to-[#061426]" />

  <div className="relative mx-auto flex h-full max-w-7xl items-end px-8 pb-14">
    <div className="max-w-4xl">
      <p className="text-sm font-black uppercase tracking-[0.35em] text-cyan-300">
        HELP US IMPROVE
      </p>

      <h1 className="mt-3 text-6xl font-black text-white drop-shadow-lg">
        Feedback
      </h1>

      <p className="mt-5 max-w-3xl text-xl leading-8 text-white">
        Help shape the future of TrippinDays. Tell us what you love,
        report bugs, suggest new features, or recommend amazing places
        travelers should discover.
      </p>
    </div>
  </div>
</section>

      <section className="mx-auto grid max-w-6xl gap-8 px-6 py-10 pb-24 lg:grid-cols-[0.85fr_1.15fr]">
        <aside className="rounded-[2rem] border border-white/10 bg-black/35 p-7 shadow-2xl backdrop-blur-md">
          <p className="text-sm font-black uppercase tracking-widest text-sky-300">
            What happens next
          </p>

          <h2 className="mt-3 text-3xl font-black">
            Your ideas shape the app
          </h2>

          <div className="mt-6 space-y-4">
            <InfoCard
              icon="🐞"
              title="Bug reports"
              text="Tell us what happened, what you expected, and what device you were using."
            />

            <InfoCard
              icon="💡"
              title="Feature ideas"
              text="Share the travel tools, categories, or improvements you want next."
            />

            <InfoCard
              icon="🗺️"
              title="Missing places"
              text="Suggest parks, ghost towns, places of worship, landmarks, or hidden gems."
            />

            <InfoCard
              icon="❤️"
              title="What works"
              text="Knowing what you love helps us protect the best parts of TrippinDays."
            />
          </div>
        </aside>

        <section className="rounded-[2rem] border border-white/10 bg-black/35 p-7 shadow-2xl backdrop-blur-md">
          {sent ? (
            <div className="rounded-3xl border border-emerald-400/25 bg-emerald-500/10 p-8 text-center">
              <div className="text-6xl">
                ✅
              </div>

              <h2 className="mt-5 text-4xl font-black text-emerald-300">
                Feedback Received
              </h2>

              <p className="mt-4 leading-8 text-white/75">
                Thank you for helping shape
                TrippinDays.
              </p>

              <button
                type="button"
                onClick={() => {
                  setSent(false);
                  setStatusMessage("");
                }}
                className="mt-7 rounded-2xl bg-emerald-500 px-6 py-4 font-black transition hover:bg-emerald-400"
              >
                Send More Feedback
              </button>
            </div>
          ) : (
            <form onSubmit={submitFeedback}>
              <div>
                <label
                  htmlFor="category"
                  className="text-sm font-black uppercase tracking-widest text-white/55"
                >
                  Feedback Type
                </label>

                <select
                  id="category"
                  value={category}
                  onChange={(event) =>
                    setCategory(
                      event.target.value
                    )
                  }
                  className="mt-3 w-full rounded-2xl border border-white/10 bg-[#061426]/95 px-4 py-4 font-bold text-white outline-none focus:border-cyan-400"
                >
                  {CATEGORIES.map((item) => (
                    <option
                      key={item.value}
                      value={item.value}
                    >
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <Field
                  label="Your Name"
                  value={name}
                  onChange={setName}
                  placeholder="Optional"
                />

                <Field
                  label="Email"
                  value={email}
                  onChange={setEmail}
                  placeholder="Optional"
                  type="email"
                />
              </div>

              <div className="mt-5">
                <Field
                  label="Subject"
                  value={subject}
                  onChange={setSubject}
                  placeholder="What should we know?"
                  required
                />
              </div>

              <div className="mt-5">
                <label
                  htmlFor="message"
                  className="text-sm font-black uppercase tracking-widest text-white/55"
                >
                  Message
                </label>

                <textarea
                  id="message"
                  value={message}
                  onChange={(event) =>
                    setMessage(
                      event.target.value
                    )
                  }
                  placeholder="Describe the issue, idea, destination, or improvement..."
                  rows={9}
                  required
                  maxLength={5000}
                  className="mt-3 w-full resize-y rounded-2xl border border-white/10 bg-[#061426]/95 px-4 py-4 leading-7 text-white outline-none placeholder:text-white/30 focus:border-cyan-400"
                />

                <p className="mt-2 text-right text-sm text-white/35">
                  {message.length}/5000
                </p>
              </div>

              <button
                type="submit"
                disabled={isSending}
                className="mt-6 w-full rounded-2xl bg-cyan-400 px-6 py-4 text-lg font-black text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSending
                  ? "Sending Feedback..."
                  : "Send Feedback"}
              </button>

              {statusMessage && (
                <div
                  className={`mt-5 rounded-2xl p-4 font-bold ${
                    statusMessage
                      .toLowerCase()
                      .includes("thank")
                      ? "bg-emerald-500/15 text-emerald-300"
                      : "bg-amber-500/15 text-amber-200"
                  }`}
                >
                  {statusMessage}
                </div>
              )}
            </form>
          )}
        </section>
      </section>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
  required?: boolean;
}) {
  const id = label
    .toLowerCase()
    .replace(/\s+/g, "-");

  return (
    <div>
      <label
        htmlFor={id}
        className="text-sm font-black uppercase tracking-widest text-white/55"
      >
        {label}
      </label>

      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        placeholder={placeholder}
        required={required}
        maxLength={200}
        className="mt-3 w-full rounded-2xl border border-white/10 bg-[#061426]/95 px-4 py-4 text-white outline-none placeholder:text-white/30 focus:border-cyan-400"
      />
    </div>
  );
}

function InfoCard({
  icon,
  title,
  text,
}: {
  icon: string;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-white/5 bg-black/25 p-5">
      <div className="text-3xl">
        {icon}
      </div>

      <h3 className="mt-3 text-xl font-black">
        {title}
      </h3>

      <p className="mt-2 leading-7 text-white/60">
        {text}
      </p>
    </div>
  );
}