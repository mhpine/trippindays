import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

function fail(message) {
  console.error("\nERROR:", message);
  process.exit(1);
}

function read(rel) {
  const full = path.join(projectRoot, rel);
  if (!fs.existsSync(full)) {
    fail(`Missing ${rel}`);
  }
  return fs.readFileSync(full, "utf8");
}

function backupAndWrite(rel, text) {
  const full = path.join(projectRoot, rel);
  const backup = `${full}.before-premium-lockdown.bak`;

  if (!fs.existsSync(backup)) {
    fs.copyFileSync(full, backup);
  }

  fs.writeFileSync(full, text, "utf8");
  console.log("UPDATED ", rel);
}

if (!fs.existsSync(path.join(projectRoot, "package.json"))) {
  fail(
    "Run this from the TrippinDays project root — the folder that contains package.json."
  );
}

/* =========================================================
   PATCH /api/plan — Premium enforcement happens SERVER SIDE.
========================================================= */

{
  const rel = "src/app/api/plan/route.ts";
  let text = read(rel);

  if (!text.includes("@/lib/server/premium")) {
    const importLine =
      'import { NextResponse } from "next/server";';

    if (!text.includes(importLine)) {
      fail(
        `${rel}: could not find the NextResponse import. No changes were made to this file.`
      );
    }

    text = text.replace(
      importLine,
      `${importLine}
import {
  getPremiumAccess,
  premiumFeatureFromTripRequest,
} from "@/lib/server/premium";`
    );
  }

  if (!text.includes("SERVER PREMIUM GATE")) {
    const marker =
      "    const tripRequest = body.tripRequest;";

    if (!text.includes(marker)) {
      fail(
        `${rel}: could not find "const tripRequest = body.tripRequest;".`
      );
    }

    const gate = `${marker}

/* =========================================================
   SERVER PREMIUM GATE
   Never trust the browser's isPremium state.
========================================================= */
const premiumFeature =
  typeof tripRequest === "string"
    ? premiumFeatureFromTripRequest(tripRequest)
    : null;

if (premiumFeature) {
  const premiumAccess =
    await getPremiumAccess(request);

  if (!premiumAccess.authenticated) {
    return NextResponse.json(
      {
        error: "Sign in is required for this Premium feature.",
        code: "PREMIUM_SIGN_IN_REQUIRED",
        premiumFeature,
      },
      { status: 401 }
    );
  }

  if (!premiumAccess.isPremium) {
    return NextResponse.json(
      {
        error: "TrippinDays Premium is required for this feature.",
        code: "PREMIUM_REQUIRED",
        premiumFeature,
      },
      { status: 403 }
    );
  }
}
/* END SERVER PREMIUM GATE */`;

    text = text.replace(marker, gate);
  }

  backupAndWrite(rel, text);
}

/* =========================================================
   PATCH trip/page.tsx — send the Supabase access token to
   /api/plan so the server can verify Premium.
========================================================= */

{
  const rel = "src/app/trip/page.tsx";
  let text = read(rel);

  if (!text.includes('from "@/lib/supabase/client"')) {
    fail(
      `${rel}: createClient import was not found. I stopped rather than guessing.`
    );
  }

  if (!text.includes("getPlanAuthHeaders")) {
    const componentMarker =
      /export\s+default\s+function\s+[A-Za-z0-9_]+\s*\([^)]*\)\s*\{/;

    const match = text.match(componentMarker);

    if (!match || match.index == null) {
      fail(
        `${rel}: could not find the page component.`
      );
    }

    const helper = `async function getPlanAuthHeaders() {
  const supabase = createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  return {
    "Content-Type": "application/json",
    ...(session?.access_token
      ? {
          Authorization:
            \`Bearer \${session.access_token}\`,
        }
      : {}),
  };
}

`;

    text =
      text.slice(0, match.index) +
      helper +
      text.slice(match.index);
  }

  const planFetchRegex =
    /(fetch\(\s*["']\/api\/plan["']\s*,\s*\{\s*method\s*:\s*["']POST["']\s*,\s*)headers\s*:\s*\{\s*["']Content-Type["']\s*:\s*["']application\/json["']\s*,?\s*\}\s*,/g;

  let replacements = 0;

  text = text.replace(
    planFetchRegex,
    (whole, prefix) => {
      replacements += 1;
      return `${prefix}headers: await getPlanAuthHeaders(),`;
    }
  );

  // A prior run may already have converted every /api/plan request.
  const planFetchCount =
    (text.match(/fetch\(\s*["']\/api\/plan["']/g) || [])
      .length;

  const authenticatedPlanFetchCount =
    (text.match(
      /fetch\(\s*["']\/api\/plan["'][\s\S]{0,220}?headers:\s*await getPlanAuthHeaders\(\)/g
    ) || []).length;

  if (
    planFetchCount > 0 &&
    authenticatedPlanFetchCount !== planFetchCount
  ) {
    fail(
      `${rel}: found ${planFetchCount} /api/plan calls but only ${authenticatedPlanFetchCount} were safely patched. Restore the backup and send me this file.`
    );
  }

  backupAndWrite(rel, text);

  console.log(
    `         ${planFetchCount} /api/plan request(s) now send the Supabase bearer token.`
  );
}

/* =========================================================
   Sanity check Water Premium implementation if present.
========================================================= */

{
  const rel =
    "src/app/api/on-the-water/search/route.ts";
  const full = path.join(projectRoot, rel);

  if (fs.existsSync(full)) {
    const text = fs.readFileSync(full, "utf8");

    if (
      text.includes("is_premium") &&
      text.toLowerCase().includes("authorization")
    ) {
      console.log(
        "OK      ",
        rel,
        "(already server-verifies Premium)"
      );
    } else {
      console.warn(
        "WARNING ",
        rel,
        "does not look server-Premium-locked. Send me this route before production."
      );
    }
  }
}

console.log(`
PREMIUM LOCKDOWN PATCH COMPLETE

Backups:
- src/app/api/plan/route.ts.before-premium-lockdown.bak
- src/app/trip/page.tsx.before-premium-lockdown.bak

SERVER-LOCKED NOW:
- Epic Road Trip requests
- Premium Trip Remix requests
- Existing On the Water Premium search remains server-verified when its route already contains the Premium verifier

IMPORTANT DATABASE STEP:
Apply:
supabase/migrations/20260919000000_lock_premium_profile_fields.sql

That prevents browser/client sessions from changing is_premium or Stripe billing IDs.
`);
