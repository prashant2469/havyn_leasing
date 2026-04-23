import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { getSupabaseAnonKey, getSupabaseUrl } from "./env";

export async function getSupabaseServerClient() {
  const jar = await cookies();

  return createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return jar.getAll();
      },
      setAll(items) {
        for (const item of items) {
          try {
            jar.set(item.name, item.value, item.options);
          } catch {
            // Ignore write failures in read-only render contexts.
          }
        }
      },
    },
  });
}

