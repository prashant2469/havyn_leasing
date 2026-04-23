import { redirect } from "next/navigation";

import { auth, signIn } from "@/auth";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { normalizeAuthRedirect } from "@/lib/auth-redirect";

import { CredentialsLoginForm } from "./credentials-login-form";

const hasGoogle = Boolean(
  process.env.AUTH_GOOGLE_ID?.trim() && process.env.AUTH_GOOGLE_SECRET?.trim(),
);

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
          <CardDescription>Access your leasing dashboard with your invited account.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <CredentialsLoginForm callbackUrl={callbackUrl} />
          <div className="text-muted-foreground text-center text-xs">or</div>
          {hasGoogle ? (
            <form
              action={async () => {
                "use server";
                await signIn("google", { redirectTo: callbackUrl });
              }}
            >
              <button type="submit" className={buttonVariants({ className: "w-full" })}>
                Continue with Google
              </button>
            </form>
          ) : (
            <p className="text-muted-foreground text-center text-xs">Google login is available when configured.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
