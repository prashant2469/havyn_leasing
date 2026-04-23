"use client";

import { createBrowserClient } from "@supabase/ssr";

import { getSupabaseAnonKey, getSupabaseUrl } from "./env";

let cachedClient: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabaseBrowserClient() {
  if (!cachedClient) {
    cachedClient = createBrowserClient(getSupabaseUrl(), getSupabaseAnonKey());
  }
  return cachedClient;
}

