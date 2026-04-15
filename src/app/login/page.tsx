import Link from "next/link";
import { redirect } from "next/navigation";

import { auth, signIn } from "@/auth";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const hasGoogle = Boolean(
  process.env.AUTH_GOOGLE_ID?.trim() && process.env.AUTH_GOOGLE_SECRET?.trim(),
);

export default async function LoginPage() {
  const session = await auth();
  if (session?.user?.id) {
    redirect("/");
  }

  return (
    <div className="bg-muted/30 flex min-h-svh flex-col items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-xl">Sign in to Havyn</CardTitle>
          <CardDescription>
            Access is limited to users who have been invited to an organization. Sign in with the
            Google account that matches your Havyn user email.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {hasGoogle ? (
            <form
              action={async () => {
                "use server";
                await signIn("google", { redirectTo: "/" });
              }}
            >
              <button type="submit" className={buttonVariants({ className: "w-full" })}>
                Continue with Google
              </button>
            </form>
          ) : (
            <p className="text-muted-foreground text-sm">
              Set <code className="bg-muted rounded px-1">AUTH_GOOGLE_ID</code> and{" "}
              <code className="bg-muted rounded px-1">AUTH_GOOGLE_SECRET</code> in{" "}
              <code className="bg-muted rounded px-1">.env.local</code>, or use{" "}
              <code className="bg-muted rounded px-1">DEV_ORGANIZATION_ID</code> +{" "}
              <code className="bg-muted rounded px-1">DEV_USER_ID</code> in development after{" "}
              <code className="bg-muted rounded px-1">npm run db:seed</code>.
            </p>
          )}
          <p className="text-muted-foreground text-center text-xs">
            No account yet? Ask an org admin to add your email, then sign in here.
          </p>
          <Link href="/" className="text-muted-foreground text-center text-sm hover:underline">
            Back to home
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
