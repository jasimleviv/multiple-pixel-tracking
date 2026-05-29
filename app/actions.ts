"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createCampaign } from "@/lib/tracking";
import { createSession } from "@/lib/auth";

export async function createCampaignAction(formData: FormData) {
  const result = await createCampaign(formData);

  if (!result.ok) {
    redirect(`/?error=${encodeURIComponent(result.message)}`);
  }

  revalidatePath("/");
  redirect("/?created=1");
}

export async function loginAction(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const ok = await createSession(password);

  if (!ok) {
    redirect("/login?error=1");
  }

  redirect("/");
}
