"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function StampsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/stamps");
  }, [router]);

  return (
    <main className="min-h-screen flex items-center justify-center">
      <p>Opening Stamp Manager...</p>
    </main>
  );
}