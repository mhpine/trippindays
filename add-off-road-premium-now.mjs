import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function fail(msg) {
  console.error("\nERROR:", msg);
  process.exit(1);
}

function read(rel) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) fail(`Missing ${rel}`);
  return fs.readFileSync(p, "utf8");
}

function writeWithBackup(rel, text) {
  const p = path.join(root, rel);
  const backup = `${p}.before-off-road-premium.bak`;
  if (!fs.existsSync(backup)) fs.copyFileSync(p, backup);
  fs.writeFileSync(p, text, "utf8");
  console.log("UPDATED ", rel);
}

if (!fs.existsSync(path.join(root, "package.json"))) {
  fail("Run this from the TrippinDays project root (the folder with package.json).");
}

const plannerRel = "src/components/off-the-road/OffTheRoadPlanner.tsx";
let planner = read(plannerRel);

if (planner.includes('id="off-road-premium"') && planner.includes("Trail Intelligence+")) {
  console.log("Off the Road Premium UI is already present.");
} else {
  // Import createClient
  if (!planner.includes('import { createClient } from "@/lib/supabase/client";')) {
    const anchor = 'import SiteQuickAccess from "@/components/SiteQuickAccess";';
    if (!planner.includes(anchor)) fail("Could not find SiteQuickAccess import.");
    planner = planner.replace(
      anchor,
      anchor + '\nimport { createClient } from "@/lib/supabase/client";'
    );
  }

  // Premium state
  if (!planner.includes("const [premiumLoading, setPremiumLoading]")) {
    const anchor = '  const [checkingHuntSeasons, setCheckingHuntSeasons] = useState(false);';
    if (!planner.includes(anchor)) fail("Could not find hunting-season state anchor.");
    planner = planner.replace(
      anchor,
      `${anchor}
  const [signedIn, setSignedIn] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [premiumLoading, setPremiumLoading] = useState(true);`
    );
  }

  // Selected result
  if (!planner.includes("const selectedResult = useMemo(")) {
    const anchor = `  const selectedActivity = useMemo(
    () => ACTIVITIES.find((item) => item.name === activity) ?? ACTIVITIES[0],
    [activity]
  );`;
    if (!planner.includes(anchor)) fail("Could not find selectedActivity block.");
    planner = planner.replace(
      anchor,
      `${anchor}

  const selectedResult = useMemo(
    () =>
      results.find((item) => item.id === selectedId) ??
      results[0] ??
      null,
    [results, selectedId]
  );`
    );
  }

  // Premium access check
  if (!planner.includes("Off the Road Premium access check failed")) {
    const anchor = "  const huntingRegion = useMemo(";
    const idx = planner.indexOf(anchor);
    if (idx < 0) fail("Could not find huntingRegion block.");

    const effect = `  useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    async function loadPremiumAccess() {
      setPremiumLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!mounted) return;

      setSignedIn(Boolean(user));

      if (!user) {
        setIsPremium(false);
        setPremiumLoading(false);
        return;
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("is_premium")
        .eq("id", user.id)
        .maybeSingle();

      if (!mounted) return;

      if (error) {
        console.error("Off the Road Premium access check failed:", error);
        setIsPremium(false);
      } else {
        setIsPremium(profile?.is_premium === true);
      }

      setPremiumLoading(false);
    }

    void loadPremiumAccess();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void loadPremiumAccess();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

`;
    planner = planner.slice(0, idx) + effect + planner.slice(idx);
  }

  // Helpers
  if (!planner.includes("function requireOffRoadPremium()")) {
    const anchor = "  function planVerifiedHunt(";
    const idx = planner.indexOf(anchor);
    if (idx < 0) fail("Could not find planVerifiedHunt.");

    const helpers = `  function requireOffRoadPremium() {
    if (premiumLoading) {
      setMessage("Checking your Premium access...");
      return false;
    }

    if (!signedIn) {
      window.location.href = "/login?mode=signup&redirect=/off-the-road";
      return false;
    }

    if (!isPremium) {
      window.location.href = "/premium";
      return false;
    }

    return true;
  }

  function openPremiumUpgrade() {
    if (!signedIn) {
      window.location.href = "/login?mode=signup&redirect=/off-the-road";
      return;
    }

    window.location.href = "/premium";
  }

  function sendPremiumTripRequest(requestText: string) {
    try {
      localStorage.setItem("trippindays-request", requestText);
      sessionStorage.setItem("trippindays-request", requestText);
      window.location.assign("/trip");
    } catch {
      window.location.assign(
        \`/trip?request=\${encodeURIComponent(requestText)}\`
      );
    }
  }

  function launchOffRoadPremium(
    mode: "intel" | "full" | "basecamp"
  ) {
    if (!requireOffRoadPremium()) return;

    if (!selectedResult) {
      setMessage("Run an Off the Road search and select a destination first.");
      document.getElementById("off-road-planner")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      return;
    }

    const requestText = \`
Starting Location: \${startingLocation}

Destination: \${selectedResult.name}
Region: \${selectedResult.region || ""}
Activity: \${activity}
Skill Level: \${skill}
When: \${when}
Search Radius: \${radius} miles
Estimated Distance From Start: \${Math.round(selectedResult.distanceMiles)} miles
Difficulty: \${selectedResult.difficulty || "Varies"}

Trip Request:
\${mode === "intel"
  ? "OFF THE ROAD PREMIUM — TRAIL INTELLIGENCE."
  : mode === "basecamp"
    ? "OFF THE ROAD PREMIUM — BASECAMP WEEKEND."
    : "OFF THE ROAD PREMIUM — FULL ADVENTURE."}

Build a complete Premium Off the Road plan for this exact destination and activity.

Include:
- route and realistic mileage
- terrain and elevation considerations
- weather and seasonal conditions
- trailhead / road / OHV / access considerations
- permits, passes and vehicle-rule checks
- food and fuel
- equipment and safety checklist
- emergency fallback
- estimated costs
- backup plan for weather, closures or unsafe conditions
- final Check Before Leaving section

Do not invent live closures, permit availability, avalanche ratings or road conditions.
\`.trim();

    sendPremiumTripRequest(requestText);
  }

`;
    planner = planner.slice(0, idx) + helpers + planner.slice(idx);
  }

  // Protect full hunting trip
  if (!planner.includes("if (!requireOffRoadPremium())")) {
    const target = `    if (status.status !== "open") {
      return;
    }`;
    if (!planner.includes(target)) fail("Could not find hunting open-status guard.");
    planner = planner.replace(
      target,
      `${target}

    if (!requireOffRoadPremium()) {
      return;
    }`
    );
  }

  if (!planner.includes("OFF THE ROAD PREMIUM — VERIFIED HUNTING EXPEDITION")) {
    planner = planner.replace(
      "PREPLANNED REGIONAL HUNTING TRIP.",
      "OFF THE ROAD PREMIUM — VERIFIED HUNTING EXPEDITION.\\nPREPLANNED REGIONAL HUNTING TRIP."
    );
  }

  // Component
  if (!planner.includes("function PremiumOffRoadCard")) {
    const anchor = "\nexport default function OffTheRoadPlanner() {";
    if (!planner.includes(anchor)) fail("Could not find OffTheRoadPlanner component export.");

    const comp = `
function PremiumOffRoadCard({
  icon,
  title,
  description,
  buttonLabel,
  disabled,
  onClick,
}: {
  icon: string;
  title: string;
  description: string;
  buttonLabel: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <article className="flex min-h-[250px] flex-col rounded-3xl border border-white/10 bg-white/10 p-5 backdrop-blur">
      <div className="text-4xl">{icon}</div>
      <div className="mt-4 text-lg font-black">{title}</div>
      <p className="mt-2 flex-1 text-sm font-semibold leading-6 text-stone-200">
        {description}
      </p>
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className="mt-5 w-full rounded-2xl bg-white px-4 py-3 text-xs font-black text-[#26331f] transition hover:bg-orange-100 disabled:cursor-wait disabled:opacity-60"
      >
        {disabled ? "CHECKING ACCESS..." : buttonLabel}
      </button>
    </article>
  );
}
`;
    planner = planner.replace(anchor, comp + anchor);
  }

  // Visible UI section
  if (!planner.includes('id="off-road-premium"')) {
    const anchor = `        <OffRoadToolkit />

        {/* REGIONAL PREPLANNED HUNTING TRIPS */}`;

    if (!planner.includes(anchor)) {
      fail("Could not find the OffRoadToolkit / hunting section insertion point.");
    }

    const section = `        <OffRoadToolkit />

        {/* OFF THE ROAD PREMIUM */}
        <section
          id="off-road-premium"
          className="overflow-hidden rounded-3xl border border-[#314024]/20 bg-[#1f2b1b] text-white shadow-xl"
        >
          <div className="grid gap-0 lg:grid-cols-[.78fr_1.22fr]">
            <div className="border-b border-white/10 p-6 sm:p-8 lg:border-b-0 lg:border-r">
              <div className="text-xs font-black uppercase tracking-[0.24em] text-orange-300">
                ⭐ Off the Road Premium
              </div>

              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                Go beyond finding a trail.
              </h2>

              <p className="mt-4 max-w-xl text-sm font-semibold leading-6 text-stone-200">
                Turn a destination into a complete field-ready adventure with
                deeper terrain planning, basecamp weekends, safety fallbacks,
                costs and trip logistics.
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                {premiumLoading ? (
                  <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-black">
                    Checking Premium...
                  </span>
                ) : isPremium ? (
                  <span className="rounded-full bg-emerald-400 px-3 py-1.5 text-xs font-black text-emerald-950">
                    ✓ PREMIUM ACTIVE
                  </span>
                ) : (
                  <span className="rounded-full bg-orange-500 px-3 py-1.5 text-xs font-black text-white">
                    🔒 PREMIUM FEATURES
                  </span>
                )}
              </div>

              {!isPremium && !premiumLoading && (
                <button
                  type="button"
                  onClick={openPremiumUpgrade}
                  className="mt-6 rounded-2xl bg-orange-500 px-5 py-3 text-sm font-black text-white transition hover:bg-orange-600"
                >
                  {signedIn
                    ? "UNLOCK OFF THE ROAD PREMIUM →"
                    : "SIGN IN TO UNLOCK →"}
                </button>
              )}
            </div>

            <div className="grid gap-4 p-5 sm:grid-cols-3 sm:p-6">
              <PremiumOffRoadCard
                icon="🧭"
                title="Trail Intelligence+"
                description="Deeper terrain, elevation, snow, access, permits, daylight and safety planning."
                buttonLabel={isPremium ? "BUILD INTEL →" : "🔒 PREMIUM"}
                disabled={premiumLoading}
                onClick={() =>
                  isPremium
                    ? launchOffRoadPremium("intel")
                    : openPremiumUpgrade()
                }
              />

              <PremiumOffRoadCard
                icon="🏕️"
                title="Basecamp Weekend+"
                description="Build a complete 2-night / 3-day outdoor weekend with a basecamp, costs and backup plans."
                buttonLabel={isPremium ? "BUILD WEEKEND →" : "🔒 PREMIUM"}
                disabled={premiumLoading}
                onClick={() =>
                  isPremium
                    ? launchOffRoadPremium("basecamp")
                    : openPremiumUpgrade()
                }
              />

              <PremiumOffRoadCard
                icon="🗺️"
                title="Full Adventure+"
                description="Turn a selected destination into a complete itinerary with route, food, fuel, gear, costs and fallbacks."
                buttonLabel={isPremium ? "BUILD ADVENTURE →" : "🔒 PREMIUM"}
                disabled={premiumLoading}
                onClick={() =>
                  isPremium
                    ? launchOffRoadPremium("full")
                    : openPremiumUpgrade()
                }
              />
            </div>
          </div>
        </section>

        {/* REGIONAL PREPLANNED HUNTING TRIPS */}`;

    planner = planner.replace(anchor, section);
  }

  writeWithBackup(plannerRel, planner);
}

// Patch shared Premium helper if it exists.
const helperRel = "src/lib/server/premium.ts";
if (fs.existsSync(path.join(root, helperRel))) {
  let helper = read(helperRel);

  const additions = [
    ["off-road-trail-intelligence", /OFF THE ROAD PREMIUM\\s*[—-]\\s*TRAIL INTELLIGENCE/i],
    ["off-road-full-adventure", /OFF THE ROAD PREMIUM\\s*[—-]\\s*FULL ADVENTURE/i],
    ["off-road-basecamp-weekend", /OFF THE ROAD PREMIUM\\s*[—-]\\s*BASECAMP WEEKEND/i],
    ["off-road-hunting-expedition", /OFF THE ROAD PREMIUM\\s*[—-]\\s*VERIFIED HUNTING EXPEDITION/i],
  ];

  if (!helper.includes("off-road-trail-intelligence")) {
    const marker = `  return null;`;
    const idx = helper.lastIndexOf(marker);
    if (idx < 0) fail("Could not patch src/lib/server/premium.ts");

    const block = `
  if (/OFF THE ROAD PREMIUM\\s*[—-]\\s*TRAIL INTELLIGENCE/i.test(text)) {
    return "off-road-trail-intelligence";
  }

  if (/OFF THE ROAD PREMIUM\\s*[—-]\\s*FULL ADVENTURE/i.test(text)) {
    return "off-road-full-adventure";
  }

  if (/OFF THE ROAD PREMIUM\\s*[—-]\\s*BASECAMP WEEKEND/i.test(text)) {
    return "off-road-basecamp-weekend";
  }

  if (/OFF THE ROAD PREMIUM\\s*[—-]\\s*VERIFIED HUNTING EXPEDITION/i.test(text)) {
    return "off-road-hunting-expedition";
  }

`;
    helper = helper.slice(0, idx) + block + helper.slice(idx);

    // Expand PremiumFeature union if present.
    if (helper.includes('export type PremiumFeature =')) {
      helper = helper.replace(
        '  | "premium-remix";',
        `  | "premium-remix"
  | "off-road-trail-intelligence"
  | "off-road-full-adventure"
  | "off-road-basecamp-weekend"
  | "off-road-hunting-expedition";`
      );
    }

    writeWithBackup(helperRel, helper);
  } else {
    console.log("Premium helper already contains Off the Road feature markers.");
  }
} else {
  console.warn("WARNING: src/lib/server/premium.ts was not found. The UI was added, but send me your current Premium helper before production.");
}

console.log(`
DONE.

You should now see this section on /off-the-road:
⭐ Off the Road Premium
- Trail Intelligence+
- Basecamp Weekend+
- Full Adventure+

IMPORTANT:
This patch edits your CURRENT OffTheRoadPlanner.tsx in place.
It does NOT replace your hunting image paths.
`);
