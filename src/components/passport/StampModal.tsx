"use client";

import type { PassportStamp } from "@/lib/passportTypes";

type StampModalProps = {
  stamp: PassportStamp | null;
  earnedAt?: string | null;
  photoUrl?: string | null;
  onClose: () => void;
};

export default function StampModal({
  stamp,
  earnedAt,
  photoUrl,
  onClose,
}: StampModalProps) {
  if (!stamp) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[2rem] bg-white p-8 text-center text-slate-950 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <img
          src={stamp.image_url || "/stamps/default-stamp.png"}
          alt={`${stamp.name} passport stamp`}
          className="mx-auto h-64 w-64 object-contain drop-shadow-2xl"
        />

        <p className="mt-5 text-sm font-black uppercase tracking-[0.25em] text-sky-600">
          Stamp Collected
        </p>

        <h2 className="mt-3 text-3xl font-black">{stamp.name}</h2>
        <p className="mt-2 text-slate-500">{stamp.location}</p>

        {earnedAt && (
          <p className="mt-3 text-sm font-bold text-slate-500">
            Earned {new Date(earnedAt).toLocaleDateString()}
          </p>
        )}

        {stamp.description && (
          <p className="mt-5 leading-7 text-slate-600">
            {stamp.description}
          </p>
        )}

        {photoUrl && (
          <img
            src={photoUrl}
            alt={`Verification photo for ${stamp.name}`}
            className="mt-6 h-56 w-full rounded-2xl object-cover"
          />
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-7 w-full rounded-2xl bg-slate-950 px-5 py-4 font-black text-white"
        >
          Close
        </button>
      </div>
    </div>
  );
}
