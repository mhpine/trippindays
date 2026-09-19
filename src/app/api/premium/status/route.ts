import { NextResponse } from "next/server";
import { getPremiumAccess } from "@/lib/server/premium";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const access = await getPremiumAccess(request);

  return NextResponse.json(
    {
      authenticated: access.authenticated,
      isPremium: access.isPremium,
      userId: access.userId,
    },
    {
      status: access.authenticated ? 200 : 401,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
