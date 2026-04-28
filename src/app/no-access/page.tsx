import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { signOutAction } from "@/server/actions/auth-session";
import { tryOrgContext } from "@/server/auth/context";

export default async function NoAccessPage() {
  const session = await auth();
  if (!session?.user?.email) {
    redirect("/login");
  }

  const ctx = await tryOrgContext();
  if (ctx) {
    redirect("/");
  }

  return (
    <div className="bg-muted/30 flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-xl">No organization access</CardTitle>
          <CardDescription>
            Your account is authenticated, but it has not been granted access to an organization yet.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-muted-foreground">
            Ask an owner/admin to invite you from Settings → Team, then use the invite email to set your password.
          </p>
          <div className="flex items-center gap-2">
            <form action={signOutAction}>
              <Button type="submit" variant="outline">
                Sign out
              </Button>
            </form>
            <Link href="/login" className={buttonVariants()}>
              Back to login
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
