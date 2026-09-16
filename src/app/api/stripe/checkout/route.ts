import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";

function clean(value: string | undefined) {
  return (value || "").trim();
}

export async function POST(request: NextRequest) {
  try {
    const stripeSecretKey = clean(process.env.STRIPE_SECRET_KEY);
    const monthlyPriceId = clean(process.env.STRIPE_MONTHLY_PRICE_ID);
    const yearlyPriceId = clean(process.env.STRIPE_YEARLY_PRICE_ID);

    if (!stripeSecretKey) {
      return NextResponse.json(
        { error: "Stripe is not configured on the server." },
        { status: 500 }
      );
    }

    const body = await request.json().catch(() => ({}));

    const userId =
      typeof body?.userId === "string"
        ? body.userId.trim()
        : typeof body?.user_id === "string"
          ? body.user_id.trim()
          : "";

    const email =
      typeof body?.email === "string" ? body.email.trim() : "";

    const requestedPlan = String(
      body?.plan ?? body?.billing ?? body?.interval ?? "monthly"
    ).toLowerCase();

    const plan = requestedPlan === "yearly" ? "yearly" : "monthly";
    const priceId = plan === "yearly" ? yearlyPriceId : monthlyPriceId;

    if (!userId) {
      return NextResponse.json(
        { error: "Sign in before starting Premium checkout." },
        { status: 401 }
      );
    }

    if (!priceId) {
      return NextResponse.json(
        { error: `${plan} Premium price is not configured.` },
        { status: 500 }
      );
    }

    const stripe = new Stripe(stripeSecretKey);
    const origin = request.nextUrl.origin;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/premium?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/premium?checkout=cancelled`,
      client_reference_id: userId,
      ...(email ? { customer_email: email } : {}),
      allow_promotion_codes: true,
      metadata: {
        userId,
        user_id: userId,
        plan,
        product: "trippindays-premium",
      },
      subscription_data: {
        metadata: {
          userId,
          user_id: userId,
          plan,
          product: "trippindays-premium",
        },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Premium checkout error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to start Premium checkout.",
      },
      { status: 500 }
    );
  }
}
