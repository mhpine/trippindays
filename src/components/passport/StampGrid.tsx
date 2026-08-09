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
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {stamps.map((stamp) => {
        const unlocked = unlockedSlugs.includes(stamp.slug);

        return (
          <button
            key={stamp.id}
            type="button"
            onClick={() => {
              if (unlocked) {
                onOpenUnlocked(stamp);
              } else {
                window.location.href = `/verify-stamp/${stamp.slug}`;
              }
            }}
            className={`relative aspect-[1.05/1] overflow-hidden rounded-[1.6rem] border-4 border-dashed p-4 text-center shadow-lg transition ${
              unlocked
                ? "-rotate-2 border-sky-300 bg-sky-50 text-sky-900 hover:rotate-0 hover:scale-105"
                : "border-white/15 bg-white/5 text-white/45 hover:border-cyan-300/40 hover:bg-white/10"
            }`}
          >
            {!unlocked && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#061426]/80 p-3 backdrop-blur-[1px]">
                <div className="text-3xl">🔒</div>

                <p className="mt-2 text-sm font-black uppercase tracking-wide text-white">
                  {stamp.name}
                </p>

                <p className="mt-1 text-xs font-bold text-cyan-300">
                  {stamp.location}
                </p>

                <p className="mt-3 text-[11px] font-black uppercase tracking-wider text-white/80">
                  Visit to Unlock
                </p>

                <p className="mt-1 text-[10px] font-bold text-cyan-300/80">
                  GPS + Photo
                </p>
              </div>
            )}

            <img
              src={stamp.image_url || "/stamps/default-stamp.png"}
              alt={`${stamp.name} passport stamp`}
              className={`mx-auto h-24 w-24 object-contain drop-shadow-lg ${
                unlocked ? "" : "grayscale opacity-5"
              }`}
            />

            <p className="mt-3 text-sm font-black uppercase tracking-wide">
              {stamp.name}
            </p>

            <p className="mt-1 text-xs font-bold opacity-65">
              {stamp.location}
            </p>
          </button>
        );
      })}
    </div>
  );
}