import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { normalizeAuthRedirect } from "@/lib/auth-redirect";

import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ callbackUrl?: string }>;
}) {
  const session = await auth();
  if (session?.user?.email) {
    redirect("/");
  }

  const callbackUrl = normalizeAuthRedirect((await searchParams)?.callbackUrl);

  return (
    <div className="bg-muted/30 flex min-h-svh flex-col items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-xl">Sign in to Havyn</CardTitle>
          <CardDescription>Use Google or your invited email account to access the leasing dashboard.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <LoginForm callbackUrl={callbackUrl} />
          <p className="text-muted-foreground text-center text-xs">
            Authentication is powered by Supabase.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
