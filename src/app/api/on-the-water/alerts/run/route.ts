import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { createECDH } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type WaterAlertRow = {
  id: string;
  user_id: string;
  spot_key: string;
  name: string;
  latitude: number;
  longitude: number;
  activity: string;
  water_type: string | null;
  target_species: string[] | null;
  seasonal_status: string | null;
  seasonal_note: string | null;
  seasonal_last_checked_at: string | null;
  seasonal_last_sent_at: string | null;
  alert_level: "good" | "excellent";
  threshold: number;
  enabled: boolean;
  was_triggered: boolean | null;
  last_sent_at: string | null;
};

type PushSubscriptionRow = {
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

type ConditionSnapshot = {
  score: number;
  label: string;
  wind: number | null;
  gust: number | null;
  wave: number | null;
  period: number | null;
  waterTemp: number | null;
};

type SeasonalFishingSnapshot = {
  targetSpecies: string[];
  seasonalStatus: string;
  seasonalNote: string;
};

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const SEASONAL_REFRESH_MS = 6 * 60 * 60 * 1000;

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}

function lowIsGood(
  value: number | null,
  good: number,
  bad: number
) {
  if (value == null) return 0.65;
  if (value <= good) return 1;
  if (value >= bad) return 0;

  return clamp(1 - (value - good) / (bad - good));
}

function rangeIsGood(
  value: number | null,
  idealMin: number,
  idealMax: number,
  hardMin: number,
  hardMax: number
) {
  if (value == null) return 0.6;

  if (value >= idealMin && value <= idealMax) {
    return 1;
  }

  if (value < idealMin) {
    if (value <= hardMin) return 0;
    return clamp(
      (value - hardMin) / (idealMin - hardMin)
    );
  }

  if (value >= hardMax) return 0;

  return clamp(
    1 -
      (value - idealMax) /
        (hardMax - idealMax)
  );
}

function currentConditionScore(
  activityName: string,
  values: {
    wind: number | null;
    gust: number | null;
    wave: number | null;
    period: number | null;
  }
) {
  const { wind, gust, wave, period } = values;

  let score = 50;

  if (activityName === "Surfing") {
    score =
      rangeIsGood(wave, 2, 6, 0.5, 10) * 35 +
      rangeIsGood(period, 9, 16, 5, 22) * 25 +
      lowIsGood(wind, 8, 22) * 25 +
      lowIsGood(gust, 15, 32) * 15;
  } else if (activityName === "Personal Water Craft") {
    score =
      lowIsGood(wind, 8, 20) * 40 +
      lowIsGood(gust, 14, 30) * 30 +
      lowIsGood(wave, 1, 5) * 30;
  } else if (activityName === "Fishing") {
    score =
      lowIsGood(wind, 10, 24) * 45 +
      lowIsGood(gust, 16, 32) * 30 +
      lowIsGood(wave, 2, 6) * 25;
  } else if (activityName === "Kayak / Paddle") {
    score =
      lowIsGood(wind, 6, 18) * 45 +
      lowIsGood(gust, 10, 25) * 30 +
      lowIsGood(wave, 0.75, 3) * 25;
  } else if (activityName === "Sailing") {
    score =
      rangeIsGood(wind, 8, 18, 2, 30) * 60 +
      lowIsGood(gust, 22, 38) * 30 +
      lowIsGood(wave, 3, 8) * 10;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

function currentConditionLabel(score: number) {
  if (score >= 90) return "Excellent Conditions";
  if (score >= 80) return "Great Conditions";
  if (score >= 70) return "Good Conditions";
  if (score >= 55) return "Fair Conditions";
  return "Poor Conditions";
}

async function loadConditions(
  request: NextRequest,
  alert: WaterAlertRow
): Promise<ConditionSnapshot> {
  const origin = new URL(request.url).origin;
  const url = new URL(
    "/api/on-the-water/conditions",
    origin
  );

  url.searchParams.set("lat", String(alert.latitude));
  url.searchParams.set("lon", String(alert.longitude));

  const response = await fetch(url, {
    cache: "no-store",
  });

  const data = await response.json();

  if (!response.ok || !data?.success) {
    throw new Error(
      data?.error ||
        `Conditions request failed with ${response.status}`
    );
  }

  const weather = data?.weather?.current || null;
  const marine = data?.marine?.current || null;

  const wind =
    typeof weather?.windSpeedMph === "number"
      ? weather.windSpeedMph
      : null;
  const gust =
    typeof weather?.windGustMph === "number"
      ? weather.windGustMph
      : null;
  const wave =
    typeof marine?.waveHeightFt === "number"
      ? marine.waveHeightFt
      : null;
  const period =
    typeof marine?.wavePeriodSeconds === "number"
      ? marine.wavePeriodSeconds
      : null;
  const waterTemp =
    typeof marine?.waterTemperatureF === "number"
      ? marine.waterTemperatureF
      : null;

  const score = currentConditionScore(alert.activity, {
    wind,
    gust,
    wave,
    period,
  });

  return {
    score,
    label: currentConditionLabel(score),
    wind,
    gust,
    wave,
    period,
    waterTemp,
  };
}


async function loadSeasonalFishing(
  request: NextRequest,
  alert: WaterAlertRow
): Promise<SeasonalFishingSnapshot> {
  const origin = new URL(request.url).origin;
  const url = new URL(
    "/api/on-the-water/fishing-season",
    origin
  );

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify({
      name: alert.name,
      region: "",
      waterType: alert.water_type || "Either",
      targetSpecies: alert.target_species || [],
    }),
  });

  const text = await response.text();
  let data: any = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(
      `Seasonal fishing request returned invalid data (${response.status}).`
    );
  }

  if (!response.ok || !data?.success) {
    throw new Error(
      data?.error ||
        `Seasonal fishing request failed with ${response.status}`
    );
  }

  return {
    targetSpecies: Array.isArray(data.targetSpecies)
      ? data.targetSpecies
          .filter(
            (value: unknown): value is string =>
              typeof value === "string"
          )
          .slice(0, 4)
      : [],
    seasonalStatus:
      typeof data.seasonalStatus === "string"
        ? data.seasonalStatus
        : "Unknown",
    seasonalNote:
      typeof data.seasonalNote === "string"
        ? data.seasonalNote
        : "",
  };
}

function seasonalIsHot(status: string | null | undefined) {
  return status === "Active" || status === "Peak";
}

function isAuthorized(request: NextRequest) {
  /*
   * Local development is intentionally easier to test.
   * This only bypasses the cron secret on localhost while
   * NODE_ENV is not production. Production still requires
   * the exact CRON_SECRET bearer token.
   */
  const host = request.nextUrl.hostname;
  const isLocalDev =
    process.env.NODE_ENV !== "production" &&
    (host === "localhost" || host === "127.0.0.1");

  if (isLocalDev) {
    return true;
  }

  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return false;
  }

  const auth = request.headers.get("authorization") || "";
  return auth === `Bearer ${cronSecret}`;
}

async function runAlerts(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  function cleanVapidPrivateKey(value?: string) {
    return (value || "")
      .trim()
      .replace(/^['"]|['"]$/g, "")
      .replace(/^Private\s+Key\s*:\s*/i, "")
      .replace(/\s+/g, "")
      .replace(/=+$/g, "");
  }

  function base64UrlToBuffer(value: string) {
    const base64 = value
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const padding = "=".repeat((4 - (base64.length % 4)) % 4);
    return Buffer.from(base64 + padding, "base64");
  }

  function bufferToBase64Url(value: Buffer) {
    return value
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
  }

  function deriveVapidPublicKey(privateKey: string) {
    const privateBytes = base64UrlToBuffer(privateKey);

    if (privateBytes.length !== 32) {
      throw new Error(
        `VAPID private key is invalid (${privateBytes.length} bytes; expected 32).`
      );
    }

    const ecdh = createECDH("prime256v1");
    ecdh.setPrivateKey(privateBytes);
    const publicBytes = ecdh.getPublicKey(undefined, "uncompressed");

    if (publicBytes.length !== 65) {
      throw new Error("Could not derive a valid VAPID public key.");
    }

    return bufferToBase64Url(publicBytes);
  }

  const vapidPrivateKey = cleanVapidPrivateKey(
    process.env.VAPID_PRIVATE_KEY
  );
  const vapidSubject = process.env.VAPID_SUBJECT?.trim();

  const missing = [
    !supabaseUrl && "NEXT_PUBLIC_SUPABASE_URL",
    !serviceRoleKey &&
      "SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY",
    !vapidPrivateKey && "VAPID_PRIVATE_KEY",
    !vapidSubject && "VAPID_SUBJECT",
  ].filter(Boolean);

  if (missing.length > 0) {
    return NextResponse.json(
      {
        success: false,
        error: `Missing server environment variables: ${missing.join(
          ", "
        )}`,
      },
      { status: 500 }
    );
  }

  const supabase = createClient(
    supabaseUrl!,
    serviceRoleKey!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );

  const vapidPublicKey = deriveVapidPublicKey(
    vapidPrivateKey!
  );

  webpush.setVapidDetails(
    vapidSubject!,
    vapidPublicKey,
    vapidPrivateKey!
  );

  const { data: alertsData, error: alertsError } =
    await supabase
      .from("water_condition_alerts")
      .select(
        "id,user_id,spot_key,name,latitude,longitude,activity,water_type,target_species,seasonal_status,seasonal_note,seasonal_last_checked_at,seasonal_last_sent_at,alert_level,threshold,enabled,was_triggered,last_sent_at"
      )
      .eq("enabled", true);

  if (alertsError) {
    return NextResponse.json(
      {
        success: false,
        error: alertsError.message,
      },
      { status: 500 }
    );
  }

  const alerts = (alertsData || []) as WaterAlertRow[];

  if (alerts.length === 0) {
    return NextResponse.json({
      success: true,
      checked: 0,
      triggered: 0,
      pushesSent: 0,
      message: "No enabled water alerts to check.",
    });
  }

  const userIds = Array.from(
    new Set(alerts.map((alert) => alert.user_id))
  );

  const { data: premiumProfiles, error: premiumError } =
    await supabase
      .from("profiles")
      .select("id,is_premium")
      .in("id", userIds)
      .eq("is_premium", true);

  if (premiumError) {
    return NextResponse.json(
      {
        success: false,
        error: premiumError.message,
      },
      { status: 500 }
    );
  }

  const premiumUserIds = new Set(
    (premiumProfiles || []).map((profile: any) => profile.id)
  );

  const eligibleAlerts = alerts.filter((alert) =>
    premiumUserIds.has(alert.user_id)
  );

  if (eligibleAlerts.length === 0) {
    return NextResponse.json({
      success: true,
      checked: 0,
      triggered: 0,
      pushesSent: 0,
      skippedNonPremium: alerts.length,
      message: "No enabled Premium water alerts to check.",
    });
  }

  const eligibleUserIds = Array.from(
    new Set(eligibleAlerts.map((alert) => alert.user_id))
  );

  const { data: subscriptionsData, error: subscriptionsError } =
    await supabase
      .from("water_push_subscriptions")
      .select("user_id,endpoint,p256dh,auth")
      .in("user_id", eligibleUserIds);

  if (subscriptionsError) {
    return NextResponse.json(
      {
        success: false,
        error: subscriptionsError.message,
      },
      { status: 500 }
    );
  }

  const subscriptions =
    (subscriptionsData || []) as PushSubscriptionRow[];

  const subscriptionsByUser = new Map<
    string,
    PushSubscriptionRow[]
  >();

  for (const subscription of subscriptions) {
    const existing =
      subscriptionsByUser.get(subscription.user_id) || [];
    existing.push(subscription);
    subscriptionsByUser.set(subscription.user_id, existing);
  }

  let checked = 0;
  let triggered = 0;
  let pushesSent = 0;
  let deadSubscriptionsRemoved = 0;
  let failedChecks = 0;
  let pushErrors = 0;
  let seasonalChecked = 0;
  let seasonalTriggered = 0;
  let seasonalPushesSent = 0;

  const errors: string[] = [];

  for (const alert of eligibleAlerts) {
    try {
      const snapshot = await loadConditions(request, alert);
      checked += 1;

      const isTriggered = snapshot.score >= alert.threshold;

      if (isTriggered) {
        triggered += 1;
      }

      const lastSentMs = alert.last_sent_at
        ? new Date(alert.last_sent_at).getTime()
        : 0;

      const crossedThreshold =
        isTriggered && alert.was_triggered !== true;

      const cooldownExpired =
        isTriggered && Date.now() - lastSentMs >= SIX_HOURS_MS;

      const shouldSend =
        isTriggered && (crossedThreshold || cooldownExpired);

      let sentForThisAlert = 0;

      if (shouldSend) {
        const userSubscriptions =
          subscriptionsByUser.get(alert.user_id) || [];

        const payload = JSON.stringify({
          title: `${alert.name}: ${snapshot.label}`,
          body: `${alert.activity} conditions are ${snapshot.score}/100. Your ${
            alert.alert_level === "excellent"
              ? "Excellent"
              : "Good"
          } alert threshold has been reached.`,
          tag: `trippindays-water-${alert.spot_key}`,
          url: "/on-the-water",
          data: {
            spotKey: alert.spot_key,
            score: snapshot.score,
            activity: alert.activity,
            waterType: alert.water_type,
          },
        });

        for (const subscription of userSubscriptions) {
          try {
            await webpush.sendNotification(
              {
                endpoint: subscription.endpoint,
                keys: {
                  p256dh: subscription.p256dh,
                  auth: subscription.auth,
                },
              },
              payload
            );

            pushesSent += 1;
            sentForThisAlert += 1;
          } catch (error: any) {
            const statusCode = Number(error?.statusCode || 0);

            if (statusCode === 404 || statusCode === 410) {
              await supabase
                .from("water_push_subscriptions")
                .delete()
                .eq("user_id", alert.user_id)
                .eq("endpoint", subscription.endpoint);

              deadSubscriptionsRemoved += 1;
            } else {
              pushErrors += 1;
              errors.push(
                `${alert.name}: push failed (${statusCode || "unknown"})`
              );
            }
          }
        }
      }

      const update: Record<string, unknown> = {
        last_score: snapshot.score,
        last_label: snapshot.label,
        last_checked_at: new Date().toISOString(),
        was_triggered: isTriggered,
        updated_at: new Date().toISOString(),
      };

      /*
       * Fishing alerts also watch typical regional seasonal
       * opportunity. This is deliberately separate from current
       * fishing regulations: every notification tells the traveler
       * to check official rules before leaving.
       */
      if (alert.activity === "Fishing") {
        const lastSeasonalCheckMs =
          alert.seasonal_last_checked_at
            ? new Date(
                alert.seasonal_last_checked_at
              ).getTime()
            : 0;

        const shouldRefreshSeasonal =
          !lastSeasonalCheckMs ||
          Date.now() - lastSeasonalCheckMs >=
            SEASONAL_REFRESH_MS;

        if (shouldRefreshSeasonal) {
          try {
            const seasonal = await loadSeasonalFishing(
              request,
              alert
            );
            seasonalChecked += 1;

            const wasHot = seasonalIsHot(
              alert.seasonal_status
            );
            const isHot = seasonalIsHot(
              seasonal.seasonalStatus
            );

            if (isHot) {
              seasonalTriggered += 1;
            }

            update.target_species =
              seasonal.targetSpecies;
            update.seasonal_status =
              seasonal.seasonalStatus;
            update.seasonal_note =
              seasonal.seasonalNote;
            update.seasonal_last_checked_at =
              new Date().toISOString();

            const enteredActiveWindow =
              isHot && !wasHot;

            if (enteredActiveWindow) {
              const userSubscriptions =
                subscriptionsByUser.get(
                  alert.user_id
                ) || [];

              const speciesLabel =
                seasonal.targetSpecies.length > 0
                  ? seasonal.targetSpecies.join(
                      ", "
                    )
                  : "Fishing";

              const payload = JSON.stringify({
                title: `${speciesLabel}: ${seasonal.seasonalStatus}`,
                body: `${alert.name}: ${seasonal.seasonalNote} Check current official regulations before fishing.`,
                tag: `trippindays-fishing-season-${alert.spot_key}`,
                url: "/on-the-water",
                data: {
                  spotKey: alert.spot_key,
                  activity: "Fishing",
                  waterType: alert.water_type,
                  targetSpecies:
                    seasonal.targetSpecies,
                  seasonalStatus:
                    seasonal.seasonalStatus,
                },
              });

              let seasonalSentForThisAlert = 0;

              for (const subscription of userSubscriptions) {
                try {
                  await webpush.sendNotification(
                    {
                      endpoint:
                        subscription.endpoint,
                      keys: {
                        p256dh:
                          subscription.p256dh,
                        auth: subscription.auth,
                      },
                    },
                    payload
                  );

                  pushesSent += 1;
                  seasonalPushesSent += 1;
                  seasonalSentForThisAlert += 1;
                } catch (error: any) {
                  const statusCode = Number(
                    error?.statusCode || 0
                  );

                  if (
                    statusCode === 404 ||
                    statusCode === 410
                  ) {
                    await supabase
                      .from(
                        "water_push_subscriptions"
                      )
                      .delete()
                      .eq(
                        "user_id",
                        alert.user_id
                      )
                      .eq(
                        "endpoint",
                        subscription.endpoint
                      );

                    deadSubscriptionsRemoved += 1;
                  } else {
                    pushErrors += 1;
                    errors.push(
                      `${alert.name}: seasonal push failed (${statusCode || "unknown"})`
                    );
                  }
                }
              }

              if (
                seasonalSentForThisAlert > 0
              ) {
                update.seasonal_last_sent_at =
                  new Date().toISOString();
              }
            }
          } catch (error) {
            errors.push(
              `${alert.name}: seasonal fishing check failed (${
                error instanceof Error
                  ? error.message
                  : "unknown error"
              })`
            );
          }
        }
      }

      if (sentForThisAlert > 0) {
        update.last_sent_at = new Date().toISOString();
      }

      const { error: updateError } = await supabase
        .from("water_condition_alerts")
        .update(update)
        .eq("id", alert.id);

      if (updateError) {
        errors.push(
          `${alert.name}: could not save alert state (${updateError.message})`
        );
      }
    } catch (error) {
      failedChecks += 1;
      errors.push(
        `${alert.name}: ${
          error instanceof Error ? error.message : "Condition check failed"
        }`
      );
    }
  }

  return NextResponse.json({
    success: true,
    checked,
    triggered,
    pushesSent,
    failedChecks,
    pushErrors,
    deadSubscriptionsRemoved,
    seasonalChecked,
    seasonalTriggered,
    seasonalPushesSent,
    skippedNonPremium: alerts.length - eligibleAlerts.length,
    errors: errors.slice(0, 20),
  });
}

async function handleAlertRunnerRequest(request: NextRequest) {
  try {
    return await runAlerts(request);
  } catch (error) {
    console.error("On the Water background alert runner error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Background alert runner failed.",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return handleAlertRunnerRequest(request);
}

export async function POST(request: NextRequest) {
  return handleAlertRunnerRequest(request);
}
