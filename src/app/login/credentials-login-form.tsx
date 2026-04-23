"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export function CredentialsLoginForm({ callbackUrl }: { callbackUrl?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setPending(true);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const password = String(formData.get("password") ?? "");
    const redirectTo = callbackUrl || "/leasing";

    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (!error) {
        router.replace(redirectTo);
        router.refresh();
        return;
      }

      setErrorMessage(error.message || "Invalid email or password.");
    } catch {
      setErrorMessage("Unable to sign in right now. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
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
      {errorMessage ? <p className="text-destructive text-xs">{errorMessage}</p> : null}
      <button type="submit" className={buttonVariants({ className: "w-full" })} disabled={pending}>
        {pending ? "Signing in..." : "Sign in with email"}
      </button>
    </form>
  );
}
