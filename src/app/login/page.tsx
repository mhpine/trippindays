"use client";

import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Mode = "signin" | "signup";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [redirectTo, setRedirectTo] = useState("/");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    setRedirectTo(params.get("redirect") || "/");

    if (params.get("mode") === "signup") {
      setMode("signup");
    }
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setMessage("");

    const supabase = createClient();

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}${redirectTo}`,
        },
      });

      if (error) {
        setMessage(error.message);
        setLoading(false);
        return;
      }

      setMessage(
        "Account created. Check your email to confirm your account, then sign in."
      );

      setMode("signin");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    if (!data.user || !data.session) {
      setMessage("Sign-in succeeded, but no login session was created.");
      setLoading(false);
      return;
    }

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session) {
      setMessage(
        "You signed in, but TrippinDays could not save your login session."
      );
      setLoading(false);
      return;
    }

    window.location.replace(redirectTo);
  }

  return (
    <main
      className="flex min-h-screen items-center justify-center bg-cover bg-center px-6 py-12 text-white"
      style={{
        backgroundImage:
          "linear-gradient(90deg, rgba(3,10,21,.94), rgba(3,10,21,.70)), url('/images/banner1.png')",
      }}
    >
      <section className="w-full max-w-md rounded-[2rem] border border-white/10 bg-[#071426]/85 p-7 shadow-2xl backdrop-blur-xl sm:p-9">
        <a href="/" className="text-3xl font-black tracking-tight">
          Trippin<span className="text-sky-400">Days</span>
        </a>

        <p className="mt-8 text-sm font-black uppercase tracking-[0.25em] text-sky-300">
          {mode === "signin" ? "Welcome back" : "Create your account"}
        </p>

        <h1 className="mt-3 text-4xl font-black">
          {mode === "signin" ? "Sign in" : "Join TrippinDays"}
        </h1>

        <p className="mt-3 leading-7 text-white/60">
          Plan trips without an account. Sign in to save trips, use your
          passport, and keep a permanent travel journal.
        </p>

        <div className="mt-7 grid grid-cols-2 rounded-2xl bg-white/5 p-1">
          <button
            type="button"
            onClick={() => {
              setMode("signin");
              setMessage("");
            }}
            className={`rounded-xl px-4 py-3 font-black transition ${
              mode === "signin"
                ? "bg-white text-slate-950"
                : "text-white/55 hover:text-white"
            }`}
          >
            Sign In
          </button>

          <button
            type="button"
            onClick={() => {
              setMode("signup");
              setMessage("");
            }}
            className={`rounded-xl px-4 py-3 font-black transition ${
              mode === "signup"
                ? "bg-white text-slate-950"
                : "text-white/55 hover:text-white"
            }`}
          >
            Create Account
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-7 space-y-4">
          <label className="block">
            <span className="text-sm font-bold text-white/70">Email</span>

            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-4 text-white outline-none placeholder:text-white/30 focus:border-sky-400"
            />
          </label>

          <label className="block">
            <span className="text-sm font-bold text-white/70">Password</span>

            <input
              type="password"
              required
              minLength={6}
              autoComplete={
                mode === "signin" ? "current-password" : "new-password"
              }
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 6 characters"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-4 text-white outline-none placeholder:text-white/30 focus:border-sky-400"
            />
          </label>

          {message && (
            <div className="rounded-2xl bg-white/10 p-4 text-sm leading-6 text-sky-100">
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-sky-500 px-5 py-4 text-lg font-black transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading
              ? "Please wait..."
              : mode === "signin"
                ? "Sign In"
                : "Create Free Account"}
          </button>
        </form>

        <a
          href="/"
          className="mt-4 block w-full rounded-2xl border border-white/15 px-5 py-4 text-center font-black text-white/75 transition hover:bg-white/10 hover:text-white"
        >
          Continue as Guest
        </a>

        <p className="mt-6 text-center text-xs leading-5 text-white/35">
          Guest trips are not saved. An account is required for journals,
          passport stamps, saved trips, photos, and account syncing.
        </p>
      </section>
    </main>
  );
}