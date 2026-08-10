"use client";

import { useEffect, useState } from "react";

export default function LaunchSplash() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Has the splash already played since the app/browser was opened?
    const alreadyPlayed = sessionStorage.getItem("trippindays-splash-played");

    if (alreadyPlayed) {
      return;
    }

    // Mark it immediately so page navigation won't replay it
    sessionStorage.setItem("trippindays-splash-played", "true");
    setShow(true);

    const timer = setTimeout(() => {
      setShow(false);
    }, 2800);

    return () => clearTimeout(timer);
  }, []);

  if (!show) return null;

  return (
    <div className="launchSplash">
      <div className="launchWords">
        <div className="launchWord plan">PLAN.</div>
        <div className="launchWord pack">PACK.</div>
        <div className="launchWord go">GO.</div>
        <div className="launchBrand">TrippinDays</div>
      </div>
    </div>
  );
}