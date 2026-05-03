import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { serverEnv } from "@/env/server";

import { getSupabaseAnonKey, getSupabaseUrl } from "./env";

export async function getSupabaseServerClient(options?: { mutableCookies?: boolean }) {
  const mutableCookies = options?.mutableCookies ?? false;
  const jar = await cookies();

  return createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return jar.getAll();
      },
      setAll(items) {
        if (!mutableCookies) return;
        for (const item of items) {
          const options = serverEnv.NODE_ENV === "production" ? { ...item.options, secure: true } : item.options;
          jar.set(item.name, item.value, options);
        }
      },
    },
  });
}
