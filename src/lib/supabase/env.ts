import { clientEnv } from "@/env/client";

export function getSupabaseUrl(): string {
  return clientEnv.NEXT_PUBLIC_SUPABASE_URL;
}

export function getSupabaseAnonKey(): string {
  return clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}
