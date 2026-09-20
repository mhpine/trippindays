"use client";

import SiteHeader from "@/components/SiteHeader";
import SiteQuickAccess from "@/components/SiteQuickAccess";

import InTheAirHero from "@/components/in-the-air/InTheAirHero";
import InTheAirPlanner from "@/components/in-the-air/InTheAirPlanner";
import MajorAirshowSchedule from "@/components/in-the-air/MajorAirshowSchedule";
import AirToolkit from "@/components/in-the-air/AirToolkit";

export default function InTheAirPage() {
  return (
    <main className="min-h-screen bg-slate-50">

      <SiteHeader />

      <InTheAirHero />

      <InTheAirPlanner />

      <MajorAirshowSchedule />

      <SiteQuickAccess />

      <AirToolkit />

    </main>
  );
}