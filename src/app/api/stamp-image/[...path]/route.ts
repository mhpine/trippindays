import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL!;

const secretKey =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(
  supabaseUrl,
  secretKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

export async function GET(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ path: string[] }>;
  }
) {
  try {
    const { path } = await params;

    if (!path || path.length === 0) {
      return new NextResponse(
        "Missing stamp image path",
        { status: 400 }
      );
    }

    const storagePath = path
      .map((part) => decodeURIComponent(part))
      .join("/");

    const { data, error } = await admin.storage
      .from("stamps")
      .download(storagePath);

    if (error || !data) {
      console.error(
        "Stamp image download error:",
        error
      );

      return new NextResponse(
        "Stamp image not found",
        { status: 404 }
      );
    }

    const arrayBuffer =
      await data.arrayBuffer();

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type":
          data.type || getContentType(storagePath),

        "Cache-Control":
          "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error(
      "Stamp image route error:",
      error
    );

    return new NextResponse(
      "Unable to load stamp image",
      { status: 500 }
    );
  }
}

function getContentType(path: string) {
  const lower = path.toLowerCase();

  if (lower.endsWith(".png")) {
    return "image/png";
  }

  if (
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg")
  ) {
    return "image/jpeg";
  }

  if (lower.endsWith(".webp")) {
    return "image/webp";
  }

  return "application/octet-stream";
}