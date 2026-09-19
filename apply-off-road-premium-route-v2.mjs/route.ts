import "server-only";

import { NextResponse } from "next/server";
import { POST as planPost } from "@/app/api/plan/route";
import {
  getPremiumAccess,
  premiumFeatureFromTripRequest,
} from "@/lib/server/premium";

const ALLOWED = new Set([
  "off-road-trail-intelligence",
  "off-road-full-adventure",
  "off-road-basecamp-weekend",
  "off-road-hunting-expedition",
]);

export async function POST(request: Request) {
  const access = await getPremiumAccess(request);

  if (!access.authenticated) {
    return NextResponse.json(
      { error: "Sign in is required.", code: "PREMIUM_SIGN_IN_REQUIRED" },
      { status: 401 }
    );
  }

  if (!access.isPremium) {
    return NextResponse.json(
      { error: "Off the Road Premium is required.", code: "PREMIUM_REQUIRED" },
      { status: 403 }
    );
  }

  const body = await request.json();
  const tripRequest =
    typeof body?.tripRequest === "string" ? body.tripRequest : "";

  const feature = premiumFeatureFromTripRequest(tripRequest);

  if (!feature || !ALLOWED.has(feature)) {
    return NextResponse.json(
      { error: "Invalid Off the Road Premium request." },
      { status: 400 }
    );
  }

  const headers = new Headers({
    "Content-Type": "application/json",
  });

  const authorization = request.headers.get("authorization");

  if (authorization) {
    headers.set("Authorization", authorization);
  }

  const forwarded = new Request(
    new URL("/api/plan", request.url),
    {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }
  );

  return planPost(forwarded);
}