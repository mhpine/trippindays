import { NextResponse } from "next/server";

export async function POST() {
  try {
    const token = process.env.DUFFEL_ACCESS_TOKEN;

    if (!token) {
      return NextResponse.json(
        { error: "Duffel access token is missing." },
        { status: 500 }
      );
    }

    const response = await fetch(
      "https://api.duffel.com/identity/component_client_keys",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
          "Duffel-Version": "v2",
        },
        body: JSON.stringify({}),
        cache: "no-store",
      }
    );

    const payload = await response.json();

    if (!response.ok) {
      console.error("Duffel client key error:", payload);

      return NextResponse.json(
        {
          error:
            payload?.errors?.[0]?.message ||
            "Could not create Duffel payment client key.",
        },
        { status: response.status }
      );
    }

    return NextResponse.json({
      clientKey: payload?.data?.component_client_key || "",
    });
  } catch (error) {
    console.error("Duffel client key API error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not create Duffel payment client key.",
      },
      { status: 500 }
    );
  }
}