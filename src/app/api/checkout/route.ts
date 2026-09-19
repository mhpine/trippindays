import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";

type CheckoutPlan =
  | "single-monthly"
  | "single-yearly"
  | "ultra-monthly"
  | "ultra-yearly";

type PlannerAccess =
  | "trip_planner"
  | "on_the_water"
  | "off_the_road"
  | "in_the_air";

const VALID_PLANNERS: PlannerAccess[] = [
  "trip_planner",
  "on_the_water",
  "off_the_road",
  "in_the_air",
];

export async function POST(request: Request) {
  try {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

    if (!stripeSecretKey) {
      return NextResponse.json(
        { error: "STRIPE_SECRET_KEY is missing." },
        { status: 500 }
      );
    }

    const stripe = new Stripe(stripeSecretKey);

    const body = await request.json();

    const plan = body?.plan as CheckoutPlan | undefined;
    const requestedPlanner = body?.planner as PlannerAccess | undefined;

    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "You must be signed in to upgrade." },
        { status: 401 }
      );
    }

    let priceId: string | undefined;
    let subscriptionTier: "single" | "ultra";
    let billingInterval: "monthly" | "yearly";
    let plannerAccess: PlannerAccess | "all";

    switch (plan) {
      case "single-monthly":
        priceId = process.env.STRIPE_SINGLE_MONTHLY_PRICE_ID;
        subscriptionTier = "single";
        billingInterval = "monthly";
        break;

      case "single-yearly":
        priceId = process.env.STRIPE_SINGLE_YEARLY_PRICE_ID;
        subscriptionTier = "single";
        billingInterval = "yearly";
        break;

      case "ultra-monthly":
        priceId = process.env.STRIPE_ULTRA_MONTHLY_PRICE_ID;
        subscriptionTier = "ultra";
        billingInterval = "monthly";
        break;

      case "ultra-yearly":
        priceId = process.env.STRIPE_ULTRA_YEARLY_PRICE_ID;
        subscriptionTier = "ultra";
        billingInterval = "yearly";
        break;

      default:
        return NextResponse.json(
          { error: "Invalid subscription plan." },
          { status: 400 }
        );
    }

    if (!priceId) {
      return NextResponse.json(
        {
          error: `Stripe price is missing for ${plan}. Check .env.local.`,
        },
        { status: 500 }
      );
    }

    if (subscriptionTier === "single") {
      if (
        !requestedPlanner ||
        !VALID_PLANNERS.includes(requestedPlanner)
      ) {
        return NextResponse.json(
          {
            error:
              "Single Planner subscriptions require a valid planner selection.",
          },
          { status: 400 }
        );
      }

      plannerAccess = requestedPlanner;
    } else {
      plannerAccess = "all";
    }

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    const origin = siteUrl.replace(/\/$/, "");

    const metadata = {
      user_id: user.id,
      subscription_tier: subscriptionTier,
      planner_access: plannerAccess,
      billing_interval: billingInterval,
      checkout_plan: plan,
    };

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",

      client_reference_id: user.id,

      customer_email: user.email || undefined,

      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],

      metadata,

      subscription_data: {
        metadata,
      },

      success_url:
        `${origin}/premium/success?session_id={CHECKOUT_SESSION_ID}`,

      cancel_url: `${origin}/premium`,
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe did not return a checkout URL." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      url: session.url,
    });
  } catch (error) {
    console.error("Stripe checkout error:", error);

    return NextResponse.json(
      { error: "Unable to start subscription checkout." },
      { status: 500 }
    );
  }
}