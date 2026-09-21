"use client";

import type { PassportStamp } from "@/lib/passportTypes";

type StampGridProps = {
  stamps: PassportStamp[];
  unlockedSlugs: string[];
  onOpenUnlocked: (stamp: PassportStamp) => void;
};

export default function StampGrid({
  stamps,
  unlockedSlugs,
  onOpenUnlocked,
}: StampGridProps) {
  function openStamp(stamp: PassportStamp) {
    const unlocked = unlockedSlugs.includes(stamp.slug);

    if (unlocked) {
      onOpenUnlocked(stamp);
      return;
    }

    window.location.href = `/verify-stamp/${stamp.slug}`;
  }

  return (
    <>
     
      <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {stamps.map((stamp) => {
          const unlocked = unlockedSlugs.includes(stamp.slug);

          return (
            <button
              key={stamp.id}
              type="button"
              onClick={() => openStamp(stamp)}
              className="relative min-h-[270px] overflow-hidden rounded-[2rem] border-2 border-dashed border-cyan-400/55 bg-[#08203b]/80 p-6 text-center transition hover:-translate-y-1 hover:border-cyan-300 hover:bg-[#0b2949]"
            >
              {unlocked ? (
                <>
                  <div className="flex h-32 items-center justify-center">
                    <img
                      src={
                        stamp.image_url ||
                        "/stamps/default-stamp.png"
                      }
                      alt={`${stamp.name} passport stamp`}
                      className="h-28 w-28 object-contain drop-shadow-xl"
                    />
                  </div>

                  <h3 className="mt-4 text-lg font-black uppercase text-white">
                    {stamp.name}
                  </h3>

                  <p className="mt-2 text-sm font-bold text-cyan-300">
                    {stamp.location}
                  </p>

                  <p className="mt-5 text-xs font-black uppercase tracking-wider text-emerald-300">
                    ✓ Collected
                  </p>
                </>
              ) : (
                <>
                  <div className="flex h-20 items-center justify-center text-4xl">
                    🔒
                  </div>

                  <h3 className="text-lg font-black uppercase text-white">
                    {stamp.name}
                  </h3>

                  <p className="mt-2 text-sm font-bold text-cyan-300">
                    {stamp.location}
                  </p>

                  <p className="mt-6 text-xs font-black uppercase tracking-wider text-white">
                    Visit to Unlock
                  </p>

                  <p className="mt-2 text-xs font-bold text-cyan-300">
                    GPS + Photo
                  </p>
                </>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}