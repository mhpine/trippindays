import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: Request) {
  try {
    const { plan } = await request.json();
const supabase = await createClient();

const {
  data: { user },
} = await supabase.auth.getUser();

if (!user) {
  return NextResponse.json(
    { error: "You must be signed in to upgrade." },
    { status: 401 }
  );
}
    let priceId: string | undefined;

    if (plan === "monthly") {
      priceId = process.env.STRIPE_MONTHLY_PRICE_ID;
    }

    if (plan === "yearly") {
      priceId = process.env.STRIPE_YEARLY_PRICE_ID;
    }

    if (!priceId) {
      return NextResponse.json(
        { error: "Invalid Premium plan." },
        { status: 400 }
      );
    }

    const origin =
      request.headers.get("origin") || "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
client_reference_id: user.id,

metadata: {
  user_id: user.id,
  plan,
},
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],

      success_url: `${origin}/premium/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/premium`,

      
    });

    return NextResponse.json({
      url: session.url,
    });
  } catch (error) {
    console.error("Stripe checkout error:", error);

    return NextResponse.json(
      { error: "Unable to start Premium checkout." },
      { status: 500 }
    );
  }
}