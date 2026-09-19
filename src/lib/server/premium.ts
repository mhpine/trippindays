import "server-only";
import { createClient } from "@supabase/supabase-js";

export type PremiumFeature =
  | "epic-road-trip"
  | "premium-remix"
  | "off-road-trail-intelligence"
  | "off-road-full-adventure"
  | "off-road-basecamp-weekend"
  | "off-road-hunting-expedition";

export type PremiumAccess = {
  authenticated: boolean;
  isPremium: boolean;
  userId: string | null;
  reason:
    | "premium"
    | "not_authenticated"
    | "not_premium"
    | "server_not_configured"
    | "profile_check_failed";
};

function bearerToken(request: Request) {
  const authHeader =
    request.headers.get("authorization") || "";

  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return "";
  }

  return authHeader.slice(7).trim();
}

export function premiumFeatureFromTripRequest(
  tripRequest: string
): PremiumFeature | null {
  const text = String(tripRequest || "");

  if (
    /EPIC ROAD TRIP\s*[—-]\s*PREMIUM LONG-DISTANCE MODE/i.test(
      text
    ) ||
    /PREMIUM LONG-DISTANCE MODE/i.test(text)
  ) {
    return "epic-road-trip";
  }

  if (
    /Remix my existing TrippinDays adventure/i.test(text) &&
    /REMIX STYLE:/i.test(text)
  ) {
    return "premium-remix";
  }

  if (
    /OFF THE ROAD PREMIUM\s*[—-]\s*TRAIL INTELLIGENCE/i.test(
      text
    )
  ) {
    return "off-road-trail-intelligence";
  }

  if (
    /OFF THE ROAD PREMIUM\s*[—-]\s*FULL ADVENTURE/i.test(
      text
    )
  ) {
    return "off-road-full-adventure";
  }

  if (
    /OFF THE ROAD PREMIUM\s*[—-]\s*BASECAMP WEEKEND/i.test(
      text
    )
  ) {
    return "off-road-basecamp-weekend";
  }

  if (
    /OFF THE ROAD PREMIUM\s*[—-]\s*VERIFIED HUNTING EXPEDITION/i.test(
      text
    )
  ) {
    return "off-road-hunting-expedition";
  }

  return null;
}

export async function getPremiumAccess(
  request: Request
): Promise<PremiumAccess> {
  const accessToken = bearerToken(request);

  if (!accessToken) {
    return {
      authenticated: false,
      isPremium: false,
      userId: null,
      reason: "not_authenticated",
    };
  }

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const serverKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !serverKey) {
    console.error(
      "Premium verification is not configured on the server."
    );

    return {
      authenticated: false,
      isPremium: false,
      userId: null,
      reason: "server_not_configured",
    };
  }

  const supabase = createClient(
    supabaseUrl,
    serverKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(accessToken);

  if (userError || !user) {
    return {
      authenticated: false,
      isPremium: false,
      userId: null,
      reason: "not_authenticated",
    };
  }

  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from("profiles")
    .select("is_premium")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error(
      "Premium profile check failed:",
      profileError
    );

    return {
      authenticated: true,
      isPremium: false,
      userId: user.id,
      reason: "profile_check_failed",
    };
  }

  const isPremium =
    profile?.is_premium === true;

  return {
    authenticated: true,
    isPremium,
    userId: user.id,
    reason: isPremium ? "premium" : "not_premium",
  };
}
