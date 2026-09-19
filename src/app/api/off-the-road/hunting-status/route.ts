"use server";

import { NextRequest, NextResponse } from "next/server";

type HuntPlanInput = {
  key: string;
  huntType: string;
  speciesFocus: string;
};

type HuntStatusResult = {
  key: string;
  status: "open" | "closed" | "unknown";
  species: string;
  season: string;
  unit: string;
  license: string;
  bagLimit: string;
  shootingHours: string;
  access: string;
  closures: string;
  reason: string;
  officialUrl: string;
};

const STATE_OFFICIAL_DOMAINS: Record<string, string[]> = {
  AL: ["outdooralabama.com"],
  AK: ["adfg.alaska.gov"],
  AZ: ["azgfd.com"],
  AR: ["agfc.com"],
  CA: ["wildlife.ca.gov"],
  CO: ["cpw.state.co.us"],
  CT: ["portal.ct.gov"],
  DE: ["dnrec.delaware.gov"],
  FL: ["myfwc.com"],
  GA: ["georgiawildlife.com"],
  HI: ["dlnr.hawaii.gov"],
  ID: ["idfg.idaho.gov"],
  IL: ["dnr.illinois.gov"],
  IN: ["in.gov"],
  IA: ["iowadnr.gov"],
  KS: ["ksoutdoors.com"],
  KY: ["fw.ky.gov"],
  LA: ["wlf.louisiana.gov"],
  ME: ["maine.gov"],
  MD: ["dnr.maryland.gov"],
  MA: ["mass.gov"],
  MI: ["michigan.gov"],
  MN: ["dnr.state.mn.us"],
  MS: ["mdwfp.com"],
  MO: ["mdc.mo.gov"],
  MT: ["fwp.mt.gov"],
  NE: ["outdoornebraska.gov"],
  NV: ["ndow.org"],
  NH: ["wildlife.nh.gov"],
  NJ: ["dep.nj.gov"],
  NM: ["wildlife.dgf.nm.gov"],
  NY: ["dec.ny.gov"],
  NC: ["ncwildlife.gov"],
  ND: ["gf.nd.gov"],
  OH: ["ohiodnr.gov"],
  OK: ["wildlifedepartment.com"],
  OR: ["myodfw.com"],
  PA: ["pa.gov"],
  RI: ["dem.ri.gov"],
  SC: ["dnr.sc.gov"],
  SD: ["gfp.sd.gov"],
  TN: ["tn.gov"],
  TX: ["tpwd.texas.gov"],
  UT: ["wildlife.utah.gov"],
  VT: ["vtfishandwildlife.com"],
  VA: ["dwr.virginia.gov"],
  WA: ["wdfw.wa.gov"],
  WV: ["wvdnr.gov"],
  WI: ["dnr.wisconsin.gov"],
  WY: ["wgfd.wyo.gov"],
};

const cache = new Map<
  string,
  { expiresAt: number; results: HuntStatusResult[] }
>();

function safeString(value: unknown) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function normalizePlans(value: unknown): HuntPlanInput[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => ({
      key: safeString(item?.key),
      huntType: safeString(item?.huntType),
      speciesFocus: safeString(item?.speciesFocus),
    }))
    .filter(
      (item) =>
        item.key &&
        item.huntType &&
        item.speciesFocus
    )
    .slice(0, 8);
}

function schemaFor(plans: HuntPlanInput[]) {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      results: {
        type: "array",
        minItems: plans.length,
        maxItems: plans.length,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            key: { type: "string" },
            status: {
              type: "string",
              enum: ["open", "closed", "unknown"],
            },
            species: { type: "string" },
            season: { type: "string" },
            unit: { type: "string" },
            license: { type: "string" },
            bagLimit: { type: "string" },
            shootingHours: { type: "string" },
            access: { type: "string" },
            closures: { type: "string" },
            reason: { type: "string" },
            officialUrl: { type: "string" },
          },
          required: [
            "key",
            "status",
            "species",
            "season",
            "unit",
            "license",
            "bagLimit",
            "shootingHours",
            "access",
            "closures",
            "reason",
            "officialUrl",
          ],
        },
      },
    },
    required: ["results"],
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const location = safeString(body?.location);
    const stateCode = safeString(body?.stateCode).toUpperCase();
    const stateName = safeString(body?.stateName);
    const regionName = safeString(body?.regionName);
    const country = safeString(body?.country) || "United States";
    const agencyName = safeString(body?.agencyName);
    const agencyUrl = safeString(body?.agencyUrl);
    const date =
      safeString(body?.date) ||
      new Date().toISOString().slice(0, 10);

    const latitude =
      typeof body?.latitude === "number" &&
      Number.isFinite(body.latitude)
        ? body.latitude
        : null;

    const longitude =
      typeof body?.longitude === "number" &&
      Number.isFinite(body.longitude)
        ? body.longitude
        : null;

    const plans = normalizePlans(body?.plans);

    if (!location || plans.length === 0) {
      return NextResponse.json(
        {
          error:
            "Starting location and hunting plans are required.",
        },
        { status: 400 }
      );
    }

    const cacheKey = JSON.stringify({
      location,
      stateCode,
      date,
      plans: plans.map((plan) => [
        plan.huntType,
        plan.speciesFocus,
      ]),
    });

    const cached = cache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      return NextResponse.json({
        success: true,
        cached: true,
        checkedAt: new Date().toISOString(),
        results: cached.results,
      });
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "OPENAI_API_KEY is not configured for live hunting-season verification.",
        },
        { status: 500 }
      );
    }

    const allowedDomains =
      STATE_OFFICIAL_DOMAINS[stateCode] || [];

    const webTool: Record<string, unknown> = {
      type: "web_search",
      search_context_size: "medium",
    };

    if (allowedDomains.length > 0) {
      webTool.filters = {
        allowed_domains: allowedDomains,
      };
    }

    const planText = plans
      .map(
        (plan, index) =>
          `${index + 1}. KEY: ${plan.key}
HUNT TYPE: ${plan.huntType}
CATEGORY / SPECIES FOCUS: ${plan.speciesFocus}`
      )
      .join("\n\n");

    const prompt = `
Today is ${date}.

The traveler is starting from:
Location: ${location}
${latitude != null ? `Latitude: ${latitude}` : ""}
${longitude != null ? `Longitude: ${longitude}` : ""}
State / Province: ${stateName || stateCode || "Unknown"}
Region: ${regionName || "Unknown"}
Country: ${country}
Official wildlife agency already identified by the app: ${agencyName || "Unknown"}
Agency URL: ${agencyUrl || "Unknown"}

You are performing a CURRENT HUNTING-SEASON LEGALITY CHECK for these TrippinDays cards:

${planText}

SEARCH REQUIREMENTS:
- You MUST use current official wildlife-agency or government sources.
- When an allowed official domain is supplied by the web-search tool, use only that domain.
- Do not rely on blogs, outfitters, forums, social media, Wikipedia, or old cached summaries.
- Determine whether there is at least one CURRENTLY LEGAL hunting opportunity in the requested category that is reasonably relevant to the traveler's starting region on ${date}.
- "open" means you found official current evidence for a specific species and a valid season that includes ${date}. Also identify the relevant unit/GMU/zone when the official rules require one.
- "closed" means official current regulations clearly show that no hunt matching that card is in season for the relevant jurisdiction/date.
- "unknown" means the official sources are insufficient, ambiguous, inaccessible, or the legal answer depends on missing details that you cannot safely resolve.
- NEVER turn "unknown" into "open".
- If a card is broad (for example Big Game), choose a specific legal species in that category only when the official source verifies it is open now.
- If seasons vary by unit/zone, identify a relevant unit/zone or return unknown.
- If method restrictions affect legality and no method is specified, do not assume a legal method. Mention the restriction in the license/reason fields.
- Do not claim private property is accessible.
- Current emergency closures or access restrictions override a nominally open season.
- Keep each field concise and useful for a trip card / legal check.

Return one result for EVERY KEY supplied above, using exactly the same key text.
    `.trim();

    const openAIResponse = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-5.6-luna",
          reasoning: {
            effort: "low",
          },
          tools: [webTool],
          tool_choice: "required",
          include: [
            "web_search_call.action.sources",
          ],
          input: prompt,
          text: {
            format: {
              type: "json_schema",
              name: "regional_hunting_status",
              strict: true,
              schema: schemaFor(plans),
            },
          },
        }),
      }
    );

    const raw = await openAIResponse.json();

    if (!openAIResponse.ok) {
      console.error(
        "Hunting season OpenAI error:",
        raw
      );

      return NextResponse.json(
        {
          error:
            raw?.error?.message ||
            "Live hunting-season verification failed.",
        },
        { status: 502 }
      );
    }

    const outputText =
      typeof raw?.output_text === "string"
        ? raw.output_text
        : Array.isArray(raw?.output)
          ? raw.output
              .flatMap((item: any) =>
                Array.isArray(item?.content)
                  ? item.content
                  : []
              )
              .filter(
                (item: any) =>
                  item?.type === "output_text" &&
                  typeof item?.text === "string"
              )
              .map((item: any) => item.text)
              .join("")
          : "";

    if (!outputText) {
      throw new Error(
        "The hunting-season verifier returned no structured result."
      );
    }

    const parsed = JSON.parse(outputText);
    const rawResults = Array.isArray(parsed?.results)
      ? parsed.results
      : [];

    const byKey = new Map(
      rawResults.map((item: any) => [
        safeString(item?.key),
        item,
      ])
    );

    const results: HuntStatusResult[] =
      plans.map((plan) => {
        const item: any = byKey.get(plan.key);

        return {
          key: plan.key,
          status:
            item?.status === "open" ||
            item?.status === "closed"
              ? item.status
              : "unknown",
          species: safeString(item?.species),
          season: safeString(item?.season),
          unit: safeString(item?.unit),
          license: safeString(item?.license),
          bagLimit: safeString(item?.bagLimit),
          shootingHours: safeString(
            item?.shootingHours
          ),
          access: safeString(item?.access),
          closures: safeString(item?.closures),
          reason:
            safeString(item?.reason) ||
            "Official season status could not be confirmed.",
          officialUrl:
            safeString(item?.officialUrl) ||
            agencyUrl,
        };
      });

    cache.set(cacheKey, {
      expiresAt: Date.now() + 6 * 60 * 60 * 1000,
      results,
    });

    return NextResponse.json({
      success: true,
      checkedAt: new Date().toISOString(),
      stateCode,
      stateName,
      regionName,
      results,
    });
  } catch (error) {
    console.error(
      "HUNTING STATUS ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not verify current hunting seasons.",
      },
      { status: 500 }
    );
  }
}
