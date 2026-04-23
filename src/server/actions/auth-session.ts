"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { z } from "zod";

import { signIn, signOut } from "@/auth";
import { normalizeAuthRedirect } from "@/lib/auth-redirect";
import { ACTIVE_ORG_COOKIE } from "@/server/auth/constants";

const credentialsSignInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  callbackUrl: z.string().optional(),
});

export async function signOutAction() {
  const jar = await cookies();
  jar.delete(ACTIVE_ORG_COOKIE);
  await signOut({ redirectTo: "/login" });
}

export async function signInWithCredentialsAction(_prev: unknown, formData: FormData) {
  try {
    const input = credentialsSignInSchema.parse({
      email: String(formData.get("email") ?? "").trim().toLowerCase(),
      password: String(formData.get("password") ?? ""),
      callbackUrl: String(formData.get("callbackUrl") ?? "/leasing"),
    });
    const callbackUrl = normalizeAuthRedirect(input.callbackUrl);

    const result = await signIn("credentials", {
      email: input.email,
      password: input.password,
      redirect: false,
      redirectTo: callbackUrl,
    });

    if (result && typeof result === "object" && "error" in result && result.error) {
      return { ok: false as const, message: "Invalid email or password." };
    }

    redirect(callbackUrl);
  } catch (error) {
    if (error instanceof AuthError) {
      return { ok: false as const, message: "Invalid email or password." };
    }
    const message =
      error instanceof z.ZodError
        ? "Enter a valid email and password."
        : error instanceof Error
          ? error.message
          : "Unable to sign in.";
    return { ok: false as const, message };
  }
}
