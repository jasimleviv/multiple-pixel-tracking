import { clsx, type ClassValue } from "clsx";
import { createHash } from "crypto";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (configured) {
    return configured.replace(/\/$/, "");
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return "http://localhost:3000";
}

export function trackingPixelHtml(url: string) {
  return `<img src="${url}" width="1" height="1" alt="" style="display:block;border:0;outline:0;" />`;
}

export function clientFingerprint(input: {
  eventType: "open" | "click";
  trackingId: string;
  ipAddress: string;
  userAgent: string | null;
}) {
  return createHash("sha256")
    .update([input.eventType, input.trackingId, input.ipAddress, input.userAgent ?? ""].join("\u001f"))
    .digest("hex");
}
