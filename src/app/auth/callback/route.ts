import { NextRequest, NextResponse } from "next/server";

import { normalizeAuthRedirect } from "@/lib/auth-redirect";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const callbackUrl = normalizeAuthRedirect(request.nextUrl.searchParams.get("callbackUrl"));
  const errorRedirect = new URL(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`, request.url);

  if (!code) {
    return NextResponse.redirect(errorRedirect);
  }

  const supabase = await getSupabaseServerClient({ mutableCookies: true });
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(errorRedirect);
  }

  const destination = new URL(callbackUrl, request.url);
  return NextResponse.redirect(destination);
}
