import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("en", { maximumFractionDigits: 0 }).format(value);
}

export function formatPercent(value: number) {
  return `${new Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(value)}%`;
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
