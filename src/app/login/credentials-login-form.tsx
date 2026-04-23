"use client";

import { useActionState } from "react";

import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInWithCredentialsAction } from "@/server/actions/auth-session";

export function CredentialsLoginForm({ callbackUrl }: { callbackUrl?: string }) {
  const [state, action, pending] = useActionState(signInWithCredentialsAction, null);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="callbackUrl" value={callbackUrl || "/"} />
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
      {state && !state.ok ? <p className="text-destructive text-xs">{state.message}</p> : null}
      <button type="submit" className={buttonVariants({ className: "w-full" })} disabled={pending}>
        {pending ? "Signing in..." : "Sign in with email"}
      </button>
    </form>
  );
}
