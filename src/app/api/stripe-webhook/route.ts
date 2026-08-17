import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";



const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  return NextResponse.json(
    { error: "STRIPE_SECRET_KEY is missing." },
    { status: 500 }
  );
}

const stripe = new Stripe(stripeSecretKey);
  if (!signature) {
    return NextResponse.json(
      { error: "Missing Stripe signature." },
      { status: 400 }
    );
  }

  const body = await request.text();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (error) {
    console.error("Webhook signature error:", error);

    return NextResponse.json(
      { error: "Invalid webhook signature." },
      { status: 400 }
    );
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    const userId =
      session.metadata?.user_id || session.client_reference_id;

    if (!userId) {
      console.error("No TrippinDays user ID on Stripe session.");
      return NextResponse.json({ received: true });
    }

    const customerId =
      typeof session.customer === "string"
        ? session.customer
        : session.customer?.id ?? null;

    const subscriptionId =
      typeof session.subscription === "string"
        ? session.subscription
        : session.subscription?.id ?? null;

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        is_premium: true,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
      })
      .eq("id", userId);

    if (error) {
      console.error("Supabase Premium update failed:", error);

      return NextResponse.json(
        { error: "Unable to activate Premium." },
        { status: 500 }
      );
    }
  }
if (event.type === "customer.subscription.deleted") {
  const subscription = event.data.object;

  const { error } = await supabaseAdmin
    .from("profiles")
    .update({
      is_premium: false,
    })
    .eq("stripe_subscription_id", subscription.id);

  if (error) {
    console.error("Supabase Premium cancellation update failed:", error);

    return NextResponse.json(
      { error: "Unable to deactivate Premium." },
      { status: 500 }
    );
  }

  console.log("Premium deactivated for subscription:", subscription.id);
}
  return NextResponse.json({ received: true });
}