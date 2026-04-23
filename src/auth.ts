import { redirect } from "next/navigation";

import { getSupabaseServerClient } from "@/lib/supabase/server";

export type AppSession = {
  user: {
    id: string;
    email: string | null;
    name: string | null;
    image: string | null;
  };
};

export async function auth(): Promise<AppSession | null> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  return {
    user: {
      id: data.user.id,
      email: data.user.email ?? null,
      name: (data.user.user_metadata?.name as string | undefined) ?? null,
      image: null,
    },
  };
}

export async function signOut(options?: { redirectTo?: string }) {
  const supabase = await getSupabaseServerClient({ mutableCookies: true });
  await supabase.auth.signOut();

  if (options?.redirectTo) {
    redirect(options.redirectTo);
  }
}

