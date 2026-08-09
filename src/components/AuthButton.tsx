"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AuthButton() {
  const [isLoading, setIsLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    async function checkUser() {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error) {
        console.error("Could not check user:", error.message);
      }

      setEmail(user?.email ?? null);
      setIsLoading(false);
    }

    checkUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null);
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function signOut() {
    const supabase = createClient();

    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Sign-out error:", error.message);
      return;
    }

    setEmail(null);
    window.location.href = "/";
  }

  if (isLoading) {
    return (
      <span className="rounded-full border border-white/20 px-5 py-2 font-black text-white/40">
        Checking...
      </span>
    );
  }

  if (!email) {
    return (
      <a
        href="/login"
        className="rounded-full border border-white/20 px-5 py-2 font-black text-white transition hover:bg-white/10"
      >
        Sign In
      </a>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <a
        href="/passport"
        className="rounded-full border border-cyan-400/40 bg-cyan-400/10 px-5 py-2 font-black text-cyan-200 transition hover:bg-cyan-400/20"
      >
        My Account
      </a>

      <button
        type="button"
        onClick={signOut}
        className="rounded-full border border-white/20 px-5 py-2 font-black text-white/70 transition hover:bg-white/10 hover:text-white"
      >
        Sign Out
      </button>
    </div>
  );
}