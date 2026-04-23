import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

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
          jar.set(item.name, item.value, item.options);
        }
      },
    },
  });
}

