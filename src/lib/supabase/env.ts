const publicSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseUrl = process.env.SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

export function getSupabaseUrl(): string {
  const resolved = publicSupabaseUrl || supabaseUrl;
  if (!resolved) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) environment variable.");
  }
  return resolved;
}

export function getSupabaseAnonKey(): string {
  if (!supabaseAnonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable.");
  }
  return supabaseAnonKey;
}

