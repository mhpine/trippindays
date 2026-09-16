import OnTheWaterHeader from "@/components/on-the-water/OnTheWaterHeader";
import OnTheWaterHero from "@/components/on-the-water/OnTheWaterHero";
import OnTheWaterPlanner from "@/components/on-the-water/OnTheWaterPlanner";
import WaterToolkit from "@/components/on-the-water/WaterToolkit";

export default function OnTheWaterPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <OnTheWaterHeader />
      <OnTheWaterHero />
      <OnTheWaterPlanner />
      <WaterToolkit />
    </main>
  );
}