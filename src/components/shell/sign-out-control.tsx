"use client";

import { signOutAction } from "@/server/actions/auth-session";

import { cn } from "@/lib/utils";

export function SignOutControl({ className }: { className?: string }) {
  return (
    <form action={signOutAction}>
      <button type="submit" className={cn(className)}>
        Sign out
      </button>
    </form>
  );
}
