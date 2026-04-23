"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";

import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CredentialsLoginForm({ callbackUrl }: { callbackUrl?: string }) {
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
    const callbackCandidate = formData.get("callbackUrl");
    const redirectTo = String(callbackCandidate ?? callbackUrl ?? "/leasing");

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        redirectTo,
      });

      if (result?.error) {
        setErrorMessage("Invalid email or password.");
        return;
      }

      window.location.assign(result?.url || redirectTo);
    } catch {
      setErrorMessage("Unable to sign in right now. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input type="hidden" name="callbackUrl" value={callbackUrl || "/leasing"} />
      <div className="space-y-1">
        <Label htmlFor="login-email">Email</Label>
        <Input
          id="login-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue="havynrecruiting@gmail.com"
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
          defaultValue="test123"
        />
      </div>
      {errorMessage ? <p className="text-destructive text-xs">{errorMessage}</p> : null}
      <button type="submit" className={buttonVariants({ className: "w-full" })} disabled={pending}>
        {pending ? "Signing in..." : "Sign in with email"}
      </button>
    </form>
  );
}
