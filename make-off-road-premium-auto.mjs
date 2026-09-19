import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const rel = "src/components/off-the-road/OffTheRoadPlanner.tsx";
const file = path.join(root, rel);

function fail(message) {
  console.error("\nERROR:", message);
  process.exit(1);
}

if (!fs.existsSync(path.join(root, "package.json"))) {
  fail("Run this from the TrippinDays project root.");
}

if (!fs.existsSync(file)) {
  fail(`Missing ${rel}`);
}

let text = fs.readFileSync(file, "utf8");

if (!text.includes('id="off-road-premium"')) {
  fail("The Off the Road Premium section is not present yet.");
}

if (text.includes("AUTO PREMIUM DESTINATION RESOLUTION")) {
  console.log("Off the Road Premium is already in automatic mode.");
  process.exit(0);
}

const startMarker = `  function launchOffRoadPremium(
    mode: "intel" | "full" | "basecamp"
  ) {`;

const start = text.indexOf(startMarker);
if (start < 0) {
  fail("Could not find launchOffRoadPremium().");
}

const endMarker = "  function planVerifiedHunt(";
const end = text.indexOf(endMarker, start);
if (end < 0) {
  fail("Could not find the end of launchOffRoadPremium().");
}

const replacement = `  /* AUTO PREMIUM DESTINATION RESOLUTION
     Premium buttons are one-tap:
     - use the currently selected result when available
     - otherwise automatically use shared GPS/manual start
     - automatically search the current activity
     - automatically choose the best ranked destination
     - then build the Premium trip
  */
  async function launchOffRoadPremium(
    mode: "intel" | "full" | "basecamp"
  ) {
    if (!requireOffRoadPremium()) return;

    setMessage(
      mode === "intel"
        ? "Premium is finding the best destination and building Trail Intelligence..."
        : mode === "basecamp"
          ? "Premium is finding the best destination and building your Basecamp Weekend..."
          : "Premium is finding the best destination and building your Full Adventure..."
    );

    let chosen = selectedResult;
    let startName = startingLocation.trim();
    let startLatitude = location?.latitude;
    let startLongitude = location?.longitude;

    try {
      // If no manual/current starting point is ready, use the shared
      // TrippinDays device location automatically.
      if (
        !startName ||
        startLatitude == null ||
        startLongitude == null
      ) {
        if (deviceLocation) {
          startName =
            deviceLocation.shortLabel ||
            deviceLocation.label ||
            "Current Location";
          startLatitude = deviceLocation.latitude;
          startLongitude = deviceLocation.longitude;
        } else {
          const current = await useCurrentLocation();

          if (current) {
            startName =
              current.shortLabel ||
              current.label ||
              "Current Location";
            startLatitude = current.latitude;
            startLongitude = current.longitude;

            setUsingDeviceLocation(true);
            setStartingLocation(startName);
            setLocation({
              name: startName,
              state: current.state || undefined,
              latitude: current.latitude,
              longitude: current.longitude,
              source: "gps",
            });
          }
        }
      }

      // AUTO MODE: if the traveler hasn't already selected a result,
      // search the current Off the Road activity and choose rank #1.
      if (!chosen) {
        const response = await fetch("/api/off-the-road/search", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            activity,
            huntType:
              activity === "Hunting"
                ? huntType
                : undefined,
            location: startName || "Current Location",
            latitude: startLatitude,
            longitude: startLongitude,
            radius: Number(radius),
            skill,
            when,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data?.error ||
              "Premium could not find an Off the Road destination."
          );
        }

        const foundResults = Array.isArray(data?.results)
          ? data.results
          : [];

        if (!foundResults.length) {
          setMessage(
            data?.message ||
              \`No matching \${activity.toLowerCase()} destination was found within \${radius} miles. Try a larger radius.\`
          );
          return;
        }

        setResults(foundResults);
        chosen = foundResults[0];
        setSelectedId(chosen.id);

        if (
          typeof data?.origin?.latitude === "number" &&
          typeof data?.origin?.longitude === "number"
        ) {
          const originName =
            data.origin.label ||
            startName ||
            "Current Location";

          setLocation({
            name: originName,
            latitude: data.origin.latitude,
            longitude: data.origin.longitude,
            source:
              startLatitude != null &&
              startLongitude != null
                ? "gps"
                : "search",
          });

          if (!startingLocation.trim()) {
            setStartingLocation(originName);
            startName = originName;
          }
        }
      }

      if (!chosen) {
        setMessage(
          "Premium could not choose a destination. Try another activity or a larger radius."
        );
        return;
      }

      const destinationGps =
        Number.isFinite(chosen.latitude) &&
        Number.isFinite(chosen.longitude)
          ? \`DESTINATION GPS:
Latitude: \${chosen.latitude}
Longitude: \${chosen.longitude}\`
          : "";

      const authoritativeGps =
        startLatitude != null &&
        startLongitude != null
          ? \`AUTHORITATIVE STARTING GPS:
Latitude: \${startLatitude}
Longitude: \${startLongitude}
Use these coordinates as the actual starting point. Do not geocode the words "Current Location".\`
          : "";

      const common = \`
Starting Location: \${startName || startingLocation || "Current Location"}
\${authoritativeGps}

Destination: \${chosen.name}
Region: \${chosen.region || ""}
\${destinationGps}

Activity: \${activity}
Skill Level: \${skill}
When: \${when}
Search Radius: \${radius} miles
Estimated Distance From Start: \${Math.round(chosen.distanceMiles)} miles
Difficulty: \${chosen.difficulty || "Varies"}
Elevation: \${
        chosen.elevationFeet == null
          ? "Unknown"
          : \`\${Math.round(chosen.elevationFeet).toLocaleString()} ft\`
      }
Known Access Note: \${
        chosen.accessNote ||
        "No special access note supplied."
      }
\`.trim();

      let requestText = "";

      if (mode === "intel") {
        requestText = \`\${common}

Trip Request:
OFF THE ROAD PREMIUM — TRAIL INTELLIGENCE.

Create a premium field briefing for this exact destination and activity.

Include:
- current and forecast weather considerations when reliable data is available
- terrain and elevation implications
- snow depth or winter-surface concerns when relevant
- avalanche considerations when relevant
- trailhead, road, OHV, forest-road and access considerations
- permits, passes and vehicle rules that should be checked
- daylight and turnaround planning
- equipment checklist for the selected activity and skill level
- emergency fallback and nearest practical help
- fuel, food and last-service considerations
- concise Check Before Leaving list

Do not invent current closures, permit availability, avalanche ratings or road conditions. Clearly identify anything requiring an official live check.\`;
      } else if (mode === "basecamp") {
        requestText = \`\${common}

Trip Request:
OFF THE ROAD PREMIUM — BASECAMP WEEKEND.

Build a complete 2-night / 3-day Off the Road basecamp adventure around this destination.

Include:
- practical Day 1 travel and arrival
- exactly 2 overnight stays
- logical campground, cabin or lodging base area
- selected activity as the primary adventure
- one or two nearby compatible outdoor activities when practical
- realistic drive times and mileage
- food, fuel and supply stops
- lodging/camping, fuel, food and activity cost estimates
- weather and terrain considerations
- access, permit and vehicle-rule checks
- backup plan for weather, closures or unsafe conditions
- final return home on Day 3 by about 5 PM when realistically possible

Do not invent campsite availability, road openings, permits or closures.\`;
      } else {
        requestText = \`\${common}

Trip Request:
OFF THE ROAD PREMIUM — FULL ADVENTURE.

Build a complete Premium Off the Road itinerary around this exact destination and activity.

Include:
- realistic departure and arrival schedule
- route and mileage
- main adventure with sensible timing
- trailhead / parking / access plan
- weather, terrain and elevation considerations
- food and fuel stops
- lodging or camping when timing calls for it
- estimated total cost and budget breakdown
- permits, passes and vehicle-rule checks
- equipment and safety checklist
- emergency fallback
- backup adventure if access or weather makes the primary plan unsafe
- final Check Before Leaving section

Do not invent current closures, permit availability, business hours or road conditions.\`;
      }

      setMessage(
        \`Premium selected \${chosen.name}. Building your adventure...\`
      );

      sendPremiumTripRequest(requestText.trim());
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Premium could not build this Off the Road adventure."
      );
    }
  }

`;

text =
  text.slice(0, start) +
  replacement +
  text.slice(end);

const backup = `${file}.before-premium-auto.bak`;
if (!fs.existsSync(backup)) {
  fs.copyFileSync(file, backup);
}

fs.writeFileSync(file, text, "utf8");

console.log("UPDATED ", rel);
console.log("");
console.log("OFF THE ROAD PREMIUM AUTO MODE ENABLED");
console.log("");
console.log("Now the 3 Premium buttons will:");
console.log("1. Use the selected destination if there is one.");
console.log("2. Otherwise use shared GPS / starting location.");
console.log("3. Search the selected activity automatically.");
console.log("4. Pick the #1 ranked destination automatically.");
console.log("5. Build the Premium result.");
console.log("");
console.log("Your hunting image paths were not changed.");
