import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY;

  if (!url || !key) {
    throw new Error("Supabase server credentials are missing.");
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function metadataUserId(metadata?: Stripe.Metadata | null) {
  return (
    metadata?.userId ||
    metadata?.user_id ||
    metadata?.supabaseUserId ||
    metadata?.supabase_user_id ||
    ""
  ).trim();
}

function customerIdFrom(value: string | Stripe.Customer | Stripe.DeletedCustomer | null) {
  if (!value) return "";
  return typeof value === "string" ? value : value.id;
}

function subscriptionIdFrom(
  value: string | Stripe.Subscription | null
) {
  if (!value) return "";
  return typeof value === "string" ? value : value.id;
}

async function lookupUserByCustomerId(customerId: string) {
  if (!customerId) return "";

  const supabase = adminClient();
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  return data?.id || "";
}

async function setPremiumState(args: {
  userId: string;
  isPremium: boolean;
  customerId?: string;
  subscriptionId?: string;
  status?: string;
  currentPeriodEnd?: number | null;
}) {
  if (!args.userId) return;

  const supabase = adminClient();
  const update = {
    is_premium: args.isPremium,
    stripe_customer_id: args.customerId || null,
    stripe_subscription_id: args.subscriptionId || null,
    premium_status: args.status || (args.isPremium ? "active" : "inactive"),
    premium_current_period_end:
      args.currentPeriodEnd && args.currentPeriodEnd > 0
        ? new Date(args.currentPeriodEnd * 1000).toISOString()
        : null,
    premium_updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("profiles")
    .update(update)
    .eq("id", args.userId);

  if (error) throw error;
}

async function handleSubscription(subscription: Stripe.Subscription) {
  const customerId = customerIdFrom(subscription.customer);
  const userId =
    metadataUserId(subscription.metadata) ||
    (await lookupUserByCustomerId(customerId));

  if (!userId) {
    console.warn(
      "Stripe subscription webhook could not map subscription to a TrippinDays user:",
      subscription.id
    );
    return;
  }

  const active =
    subscription.status === "active" ||
    subscription.status === "trialing";

  const periodEnd = Number(
    (subscription as unknown as { current_period_end?: number })
      .current_period_end || 0
  );

  await setPremiumState({
    userId,
    isPremium: active,
    customerId,
    subscriptionId: subscription.id,
    status: subscription.status,
    currentPeriodEnd: periodEnd,
  });
}

export async function POST(request: NextRequest) {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();

  if (!secretKey || !webhookSecret) {
    return NextResponse.json(
      { error: "Stripe webhook is not configured." },
      { status: 500 }
    );
  }

  const stripe = new Stripe(secretKey);
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing Stripe signature." },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    const body = await request.text();
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      webhookSecret
    );
  } catch (error) {
    console.error("Stripe webhook signature error:", error);
    return NextResponse.json(
      { error: "Invalid Stripe webhook signature." },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = customerIdFrom(session.customer);
        let userId =
          metadataUserId(session.metadata) ||
          session.client_reference_id ||
          "";

        if (!userId) {
          userId = await lookupUserByCustomerId(customerId);
        }

        const subscriptionId = subscriptionIdFrom(session.subscription);
        let status = "paid";
        let active =
          session.payment_status === "paid" ||
          session.payment_status === "no_payment_required";
        let currentPeriodEnd = 0;

        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(
            subscriptionId
          );

          userId = userId || metadataUserId(subscription.metadata);
          status = subscription.status;
          active =
            subscription.status === "active" ||
            subscription.status === "trialing";
          currentPeriodEnd = Number(
            (subscription as unknown as { current_period_end?: number })
              .current_period_end || 0
          );
        }

        if (userId) {
          await setPremiumState({
            userId,
            isPremium: active,
            customerId,
            subscriptionId,
            status,
            currentPeriodEnd,
          });
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await handleSubscription(
          event.data.object as Stripe.Subscription
        );
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = customerIdFrom(invoice.customer);
        const userId = await lookupUserByCustomerId(customerId);

        if (userId) {
          await setPremiumState({
            userId,
            isPremium: false,
            customerId,
            status: "payment_failed",
          });
        }
        break;
      }

      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Stripe Premium webhook processing error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Webhook processing failed.",
      },
      { status: 500 }
    );
  }
}
