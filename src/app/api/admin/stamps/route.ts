import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

const secretKey =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(supabaseUrl, secretKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

function makeSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getText(form: FormData, key: string) {
  return String(form.get(key) || "").trim();
}

function isSafeSlug(value: string) {
  return (
    value.length > 0 &&
    value.length <= 100 &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
  );
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "You must be signed in." },
        { status: 401 }
      );
    }

    const token = authHeader.replace("Bearer ", "");

    const {
      data: { user },
      error: userError,
    } = await admin.auth.getUser(token);

    if (userError || !user?.email) {
      return NextResponse.json(
        { error: "Unable to verify your account." },
        { status: 401 }
      );
    }

    const allowedAdmins = (
      process.env.TRIPPINDAYS_ADMIN_EMAILS || ""
    )
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);

    if (!allowedAdmins.includes(user.email.toLowerCase())) {
      return NextResponse.json(
        { error: "Admin access required." },
        { status: 403 }
      );
    }

    const form = await request.formData();

    const name = getText(form, "name");

    // SECURITY / DATA-INTEGRITY RULE:
    // Never trust or store a slug supplied by the browser.
    // The slug is always generated from the stamp name on the server.
    const slug = makeSlug(name);

    const location = getText(form, "location");
    const state = getText(form, "state");
    const country = getText(form, "country") || "USA";

    const category = getText(form, "category");
    const description = getText(form, "description");
    const difficulty =
      getText(form, "difficulty") || "Easy";

    const latitudeText = getText(form, "latitude");
    const longitudeText = getText(form, "longitude");
    const unlockRadiusText = getText(form, "unlock_radius");

    const featured =
      getText(form, "featured") === "true";

    const image = form.get("image");

    if (!name) {
      return NextResponse.json(
        { error: "Stamp name is required." },
        { status: 400 }
      );
    }

    if (name.length > 120) {
      return NextResponse.json(
        { error: "Stamp name is too long." },
        { status: 400 }
      );
    }

    if (!isSafeSlug(slug)) {
      return NextResponse.json(
        { error: "Unable to create a safe stamp slug from that name." },
        { status: 400 }
      );
    }

    if (!location) {
      return NextResponse.json(
        { error: "Location is required." },
        { status: 400 }
      );
    }

    if (location.length > 180) {
      return NextResponse.json(
        { error: "Location is too long." },
        { status: 400 }
      );
    }

    if (description.length > 1000) {
      return NextResponse.json(
        { error: "Description is too long." },
        { status: 400 }
      );
    }

    if (!(image instanceof File) || image.size === 0) {
      return NextResponse.json(
        { error: "Please choose a stamp image." },
        { status: 400 }
      );
    }

    const allowedTypes = [
      "image/png",
      "image/jpeg",
      "image/webp",
    ];

    if (!allowedTypes.includes(image.type)) {
      return NextResponse.json(
        { error: "Stamp image must be PNG, JPG, or WebP." },
        { status: 400 }
      );
    }

    if (image.size > 8 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Stamp image must be smaller than 8 MB." },
        { status: 400 }
      );
    }

    const latitude =
      latitudeText === "" ? null : Number(latitudeText);

    const longitude =
      longitudeText === "" ? null : Number(longitudeText);

    const unlockRadius =
      unlockRadiusText === ""
        ? 1609
        : Number(unlockRadiusText);

    if (
      latitude !== null &&
      (!Number.isFinite(latitude) ||
        latitude < -90 ||
        latitude > 90)
    ) {
      return NextResponse.json(
        { error: "Latitude must be between -90 and 90." },
        { status: 400 }
      );
    }

    if (
      longitude !== null &&
      (!Number.isFinite(longitude) ||
        longitude < -180 ||
        longitude > 180)
    ) {
      return NextResponse.json(
        { error: "Longitude must be between -180 and 180." },
        { status: 400 }
      );
    }

    if (
      !Number.isFinite(unlockRadius) ||
      unlockRadius < 1 ||
      unlockRadius > 100000
    ) {
      return NextResponse.json(
        { error: "Unlock radius must be between 1 and 100000 meters." },
        { status: 400 }
      );
    }

    const {
      data: existing,
      error: existingError,
    } = await admin
      .from("stamps")
      .select("id, slug")
      .eq("slug", slug)
      .maybeSingle();

    if (existingError) {
      return NextResponse.json(
        { error: existingError.message },
        { status: 500 }
      );
    }

    if (existing) {
      return NextResponse.json(
        {
          error:
            "A stamp with this name/slug already exists. Nothing was changed.",
        },
        { status: 409 }
      );
    }

    const bucketName = "stamps";

    const {
      data: buckets,
      error: bucketError,
    } = await admin.storage.listBuckets();

    if (bucketError) {
      return NextResponse.json(
        { error: bucketError.message },
        { status: 500 }
      );
    }

    const bucketExists = buckets?.some(
      (bucket) => bucket.name === bucketName
    );

    if (!bucketExists) {
      const {
        error: createBucketError,
      } = await admin.storage.createBucket(
        bucketName,
        { public: false }
      );

      if (createBucketError) {
        return NextResponse.json(
          { error: createBucketError.message },
          { status: 500 }
        );
      }
    }

    const extension =
      image.name.split(".").pop()?.toLowerCase() || "png";

    const storagePath =
      `${slug}/${Date.now()}-stamp.${extension}`;

    const bytes = Buffer.from(await image.arrayBuffer());

    const {
      error: uploadError,
    } = await admin.storage
      .from(bucketName)
      .upload(storagePath, bytes, {
        contentType: image.type,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: uploadError.message },
        { status: 500 }
      );
    }

    const imageUrl =
      `/api/stamp-image/${storagePath}`;

    const {
      data: stamp,
      error: insertError,
    } = await admin
      .from("stamps")
      .insert({
        slug,
        name,
        location,
        state: state || null,
        country,
        category: category || null,
        description: description || null,
        difficulty,
        featured,
        status: "approved",
        latitude,
        longitude,
        unlock_radius: unlockRadius,
        image_url: imageUrl,
      })
      .select()
      .single();

    if (insertError) {
      await admin.storage
        .from(bucketName)
        .remove([storagePath]);

      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      stamp,
    });
  } catch (error) {
    console.error("Stamp manager error:", error);

    return NextResponse.json(
      { error: "Unable to add stamp." },
      { status: 500 }
    );
  }
}
