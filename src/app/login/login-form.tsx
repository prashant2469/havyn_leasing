"use client";

import Link from "next/link";
import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { signInWithPasswordAction } from "@/server/actions/auth";

export function LoginForm({ callbackUrl }: { callbackUrl?: string }) {
  const router = useRouter();
  const [pendingGoogle, setPendingGoogle] = useState(false);
  const [pendingEmail, startEmailTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const redirectPath = callbackUrl || "/leasing";

  async function onGoogleSignIn() {
    setErrorMessage(null);
    setPendingGoogle(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const callbackParam = encodeURIComponent(redirectPath);
      const redirectTo = `${window.location.origin}/auth/callback?callbackUrl=${callbackParam}`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });
      if (error) {
        setErrorMessage(error.message || "Unable to start Google sign-in.");
      }
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : "Unable to start Google sign-in right now.");
    } finally {
      setPendingGoogle(false);
    }
  }

  function onEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    const formData = new FormData(event.currentTarget);
    formData.set("callbackUrl", redirectPath);

    startEmailTransition(async () => {
      try {
        const result = await signInWithPasswordAction(formData);
        if (!result.ok) {
          setErrorMessage(result.error || "Invalid email or password.");
          return;
        }

        router.replace(result.redirectTo);
        router.refresh();
      } catch (e) {
        setErrorMessage(e instanceof Error ? e.message : "Unable to sign in right now. Please try again.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <Button type="button" variant="outline" className="w-full" onClick={onGoogleSignIn} disabled={pendingGoogle}>
        {pendingGoogle ? "Opening Google..." : "Continue with Google"}
      </Button>
      <div className="text-muted-foreground text-center text-xs">or sign in with email</div>
      <form onSubmit={onEmailSubmit} className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="login-email">Email</Label>
          <Input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@company.com"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="login-password">Password</Label>
          <Input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="Enter your password"
          />
        </div>
        <div className="flex items-center justify-between">
          <Link href="/login/forgot-password" className="text-xs text-primary underline-offset-4 hover:underline">
            Forgot password?
          </Link>
          <Button type="submit" disabled={pendingEmail}>
            {pendingEmail ? "Signing in..." : "Sign in"}
          </Button>
        </div>
      </form>
      {errorMessage ? <p className="text-destructive text-xs">{errorMessage}</p> : null}
    </div>
  );
}
