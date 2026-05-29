import type { NextRequest } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { getClickDestination, isValidTrackingId, recordClick } from "@/lib/tracking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  const limited = rateLimit(`${ipAddress}:click`, 240, 60_000);
  let destinationUrl = await getClickDestination(trackingId);

  if (limited.allowed && isValidTrackingId(trackingId)) {
    try {
      destinationUrl = await recordClick({
        trackingId,
        ipAddress,
        userAgent: request.headers.get("user-agent"),
        country: request.headers.get("x-vercel-ip-country") || null,
      });
    } catch (error) {
      console.error("Failed to record click", error);
    }
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: destinationUrl,
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}
