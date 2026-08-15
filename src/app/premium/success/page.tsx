"use client";

export default function PremiumSuccessPage() {
  return (
    <main className="min-h-screen bg-[#061426] px-6 py-16 text-white">
      <div className="mx-auto max-w-2xl rounded-[2rem] border border-emerald-400/30 bg-emerald-400/10 p-8 text-center shadow-2xl">
        <div className="text-6xl">🎉</div>

        <p className="mt-5 text-sm font-black uppercase tracking-[0.3em] text-emerald-300">
          Payment Successful
        </p>

        <h1 className="mt-3 text-4xl font-black sm:text-5xl">
          Welcome to TrippinDays Premium
        </h1>

        <p className="mx-auto mt-5 max-w-xl text-lg leading-8 text-white/75">
          Your Premium subscription is being activated. You now have access to
          the upgraded TrippinDays experience.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <a
            href="/"
            className="rounded-2xl bg-sky-500 px-6 py-4 font-black hover:bg-sky-400"
          >
            Plan an Adventure
          </a>

          <a
            href="/profile"
            className="rounded-2xl border border-white/20 px-6 py-4 font-black hover:bg-white/10"
          >
            My Account
          </a>

          <a
            href="/premium"
            className="rounded-2xl border border-amber-300/30 px-6 py-4 font-black text-amber-300 hover:bg-amber-400/10"
          >
            Premium Features
          </a>
        </div>
      </div>
    </main>
  );
}