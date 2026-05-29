import { createHash, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "pixel_dashboard_session";

function authSecret() {
  return process.env.AUTH_SECRET || process.env.DASHBOARD_PASSWORD || "local-dev-secret";
}

function sessionToken(password: string) {
  return createHash("sha256").update(`${password}:${authSecret()}`).digest("hex");
}

export function isAuthConfigured() {
  return Boolean(process.env.DASHBOARD_PASSWORD);
}

export async function isAuthenticated() {
  const expectedPassword = process.env.DASHBOARD_PASSWORD;

  if (!expectedPassword) {
    return true;
  }

  const cookieStore = await cookies();
  const value = cookieStore.get(COOKIE_NAME)?.value;

  if (!value) {
    return false;
  }

  const expected = sessionToken(expectedPassword);
  const actualBuffer = Buffer.from(value);
  const expectedBuffer = Buffer.from(expected);

  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

export async function createSession(password: string) {
  const expectedPassword = process.env.DASHBOARD_PASSWORD;

  if (!expectedPassword || password !== expectedPassword) {
    return false;
  }

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, sessionToken(password), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });

  return true;
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
