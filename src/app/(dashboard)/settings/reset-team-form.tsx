"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { resetTeamToOwnerOnlyAction } from "@/server/actions/team";

export function ResetTeamForm({ canReset }: { canReset: boolean }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(resetTeamToOwnerOnlyAction, null);

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state?.ok, router]);

  if (!canReset) return null;

  return (
    <form action={action} className="rounded-md border border-destructive/30 bg-destructive/5 p-3 space-y-2">
      <p className="text-xs text-muted-foreground">
        Emergency reset: remove all other members in this organization and make your account the only OWNER.
      </p>
      <Button type="submit" variant="destructive" disabled={pending}>
        {pending ? "Resetting team..." : "Reset team to owner-only"}
      </Button>
      {state && !state.ok ? <p className="text-destructive text-xs">{state.message}</p> : null}
      {state?.ok ? <p className="text-xs text-green-600">{state.message}</p> : null}
    </form>
  );
}
