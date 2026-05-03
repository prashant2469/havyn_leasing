import "server-only";

import { createClient } from "@supabase/supabase-js";

import { clientEnv } from "@/env/client";
import { serverEnv } from "@/env/server";

let cachedAdminClient: ReturnType<typeof createClient> | null = null;

function getSupabaseAdminUrl() {
  return serverEnv.SUPABASE_URL ?? clientEnv.NEXT_PUBLIC_SUPABASE_URL;
}

function getSupabaseServiceRoleKey() {
  const key = serverEnv.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }
  return key;
}

export function getSupabaseAdminClient() {
  if (!cachedAdminClient) {
    cachedAdminClient = createClient(getSupabaseAdminUrl(), getSupabaseServiceRoleKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cachedAdminClient;
}
