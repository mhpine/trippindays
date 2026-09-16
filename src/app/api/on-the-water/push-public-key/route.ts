import { NextResponse } from "next/server";
import { createECDH } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanPrivateKey(value?: string) {
  return (value || "")
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .replace(/^Private\s+Key\s*:\s*/i, "")
    .replace(/\s+/g, "")
    .replace(/=+$/g, "");
}

function base64UrlToBuffer(value: string) {
  const base64 = value
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  return Buffer.from(base64 + padding, "base64");
}

function bufferToBase64Url(value: Buffer) {
  return value
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function derivePublicKey(privateKey: string) {
  const privateBytes = base64UrlToBuffer(privateKey);

  if (privateBytes.length !== 32) {
    throw new Error(
      `VAPID private key is invalid (${privateBytes.length} bytes; expected 32).`
    );
  }

  const ecdh = createECDH("prime256v1");
  ecdh.setPrivateKey(privateBytes);
  const publicBytes = ecdh.getPublicKey(undefined, "uncompressed");

  if (publicBytes.length !== 65) {
    throw new Error("Could not derive a valid VAPID public key.");
  }

  return {
    publicKey: bufferToBase64Url(publicBytes),
    publicKeyBytes: Array.from(publicBytes),
  };
}

export async function GET() {
  try {
    const privateKey = cleanPrivateKey(
      process.env.VAPID_PRIVATE_KEY
    );

    if (!privateKey) {
      return NextResponse.json(
        {
          success: false,
          error: "VAPID_PRIVATE_KEY is missing from .env.local.",
        },
        { status: 500 }
      );
    }

    const derived = derivePublicKey(privateKey);

    return NextResponse.json({
      success: true,
      publicKey: derived.publicKey,
      publicKeyBytes: derived.publicKeyBytes,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to derive the device push key.",
      },
      { status: 500 }
    );
  }
}
