"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";

import { signOut } from "@/auth";
import { normalizeAuthRedirect } from "@/lib/auth-redirect";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { ACTIVE_ORG_COOKIE } from "@/server/auth/constants";
import { checkSlidingWindow } from "@/server/security/rate-limit";

function getRequestIpFromHeaders(value: string | null): string {
  if (!value) return "unknown";
  return value.split(",")[0]?.trim() || "unknown";
}

async function getRequestIp() {
  const h = await headers();
  return getRequestIpFromHeaders(h.get("x-forwarded-for") || h.get("x-real-ip") || h.get("cf-connecting-ip"));
}

export async function signInWithPasswordAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const callbackUrl = normalizeAuthRedirect(String(formData.get("callbackUrl") ?? ""));

  if (!email || !password) {
    return { ok: false as const, error: "Email and password are required." };
  }

  const ip = await getRequestIp();
  const rate = await checkSlidingWindow({
    namespace: "auth-signin",
    identifier: `${ip}:${email}`,
    limit: 5,
    window: "1 m",
  });

  if (!rate.success) {
    return { ok: false as const, error: "Too many attempts. Please wait a minute and try again." };
  }

  const supabase = await getSupabaseServerClient({ mutableCookies: true });
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { ok: false as const, error: error.message || "Invalid email or password." };
  }

  revalidatePath("/", "layout");
  return { ok: true as const, redirectTo: callbackUrl || "/leasing" };
}

export async function requestPasswordResetAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) {
    return { ok: false as const, error: "Email is required." };
  }

  const ip = await getRequestIp();
  const rate = await checkSlidingWindow({
    namespace: "auth-forgot-password",
    identifier: `${ip}:${email}`,
    limit: 5,
    window: "1 m",
  });

  if (!rate.success) {
    return { ok: false as const, error: "Too many reset requests. Please wait a minute and try again." };
  }

  const h = await headers();
  const origin = h.get("origin") || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const redirectTo = `${origin.replace(/\/$/, "")}/login/reset-password`;

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) {
    return { ok: false as const, error: error.message || "Could not send reset email." };
  }

  return { ok: true as const };
}

export async function signOutAction() {
  const jar = await cookies();
  jar.delete(ACTIVE_ORG_COOKIE);
  await signOut({ redirectTo: "/login" });
}
