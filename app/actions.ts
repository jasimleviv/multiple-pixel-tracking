"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  createCampaign,
  deleteRecipientTracking,
  ignoreTrackingClient,
  reincludeTrackingClient,
  resetRecipientReport,
} from "@/lib/tracking";
import { createSession, isAuthenticated } from "@/lib/auth";

async function requireDashboardAuth() {
  if (!(await isAuthenticated())) {
    redirect("/login");
  }
}

export async function createCampaignAction(formData: FormData) {
  await requireDashboardAuth();
  const result = await createCampaign(formData);

  if (!result.ok) {
    redirect(`/?error=${encodeURIComponent(result.message)}`);
  }

  revalidatePath("/");
  redirect("/?created=1");
}

export async function excludeTrackingClientAction(formData: FormData) {
  await requireDashboardAuth();
  await ignoreTrackingClient({
    ipAddress: String(formData.get("ipAddress") ?? ""),
    userAgent: String(formData.get("userAgent") ?? "") || null,
  });

  revalidatePath("/");
}

export async function reincludeTrackingClientAction(formData: FormData) {
  await requireDashboardAuth();
  await reincludeTrackingClient(Number(formData.get("id")));
  revalidatePath("/");
}

export async function resetRecipientReportAction(formData: FormData) {
  await requireDashboardAuth();
  await resetRecipientReport(Number(formData.get("recipientId")));
  revalidatePath("/");
}

export async function deleteRecipientTrackingAction(formData: FormData) {
  await requireDashboardAuth();
  await deleteRecipientTracking(Number(formData.get("recipientId")));
  revalidatePath("/");
}

export async function loginAction(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const ok = await createSession(password);

  if (!ok) {
    redirect("/login?error=1");
  }

  redirect("/");
}
