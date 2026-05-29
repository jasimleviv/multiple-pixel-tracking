import type { NextRequest } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { isValidTrackingId, recordOpen } from "@/lib/tracking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const transparentGif = Uint8Array.from([
  71, 73, 70, 56, 57, 97, 1, 0, 1, 0, 128, 0, 0, 0, 0, 0, 255, 255, 255, 33, 249, 4, 1, 0, 0, 0, 0,
  44, 0, 0, 0, 0, 1, 0, 1, 0, 0, 2, 2, 68, 1, 0, 59,
]);

const gifHeaders = {
  "Content-Type": "image/gif",
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

function getIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (
    request.headers.get("x-real-ip") ||
    forwarded ||
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

export async function GET(request: NextRequest) {
  const trackingId = request.nextUrl.searchParams.get("id") ?? "";
  const ipAddress = getIp(request);
  const limited = rateLimit(`${ipAddress}:open`, 240, 60_000);

  if (limited.allowed && isValidTrackingId(trackingId)) {
    recordOpen({
      trackingId,
      ipAddress,
      userAgent: request.headers.get("user-agent"),
      country: request.headers.get("x-vercel-ip-country") || null,
    }).catch((error) => {
      console.error("Failed to record open", error);
    });
  }

  return new Response(transparentGif, { headers: gifHeaders });
}
