"use server";

import { cookies } from "next/headers";

import { signOut } from "@/auth";
import { ACTIVE_ORG_COOKIE } from "@/server/auth/constants";

export async function signOutAction() {
  const jar = await cookies();
  jar.delete(ACTIVE_ORG_COOKIE);
  await signOut({ redirectTo: "/login" });
}
