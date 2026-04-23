import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import { auth } from "@/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { normalizeAuthRedirect } from "@/lib/auth-redirect";

import { CredentialsLoginForm } from "./credentials-login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ callbackUrl?: string }>;
}) {
  const session = await auth();
  if (session?.user?.email) {
    redirect("/");
  }

  const jar = await cookies();
  for (const cookieName of [
    "authjs.session-token",
    "__Secure-authjs.session-token",
    "authjs.callback-url",
    "__Secure-authjs.callback-url",
    "authjs.csrf-token",
    "__Host-authjs.csrf-token",
  ]) {
    jar.delete(cookieName);
  }

  const callbackUrl = normalizeAuthRedirect((await searchParams)?.callbackUrl);

  return (
    <div className="bg-muted/30 flex min-h-svh flex-col items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-xl">Sign in to Havyn</CardTitle>
          <CardDescription>Access your leasing dashboard with your invited account.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <CredentialsLoginForm callbackUrl={callbackUrl} />
          <p className="text-muted-foreground text-center text-xs">
            Authentication is powered by Supabase email/password.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
