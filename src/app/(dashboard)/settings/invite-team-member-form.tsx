"use client";

import { MembershipRole } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { inviteTeamMemberAction } from "@/server/actions/team";

const nativeSelectClass =
  "border-input bg-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-2";

const inviteRoleOptions: MembershipRole[] = [
  MembershipRole.MANAGER,
  MembershipRole.STAFF,
  MembershipRole.ADMIN,
];

export function InviteTeamMemberForm({ canInvite }: { canInvite: boolean }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(inviteTeamMemberAction, null);

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state?.ok, router]);

  if (!canInvite) {
    return <p className="text-muted-foreground text-xs">You do not have permission to invite members.</p>;
  }

  return (
    <form action={action} className="grid gap-3 md:grid-cols-[1fr_160px_auto] md:items-end">
      <div className="space-y-1">
        <Label htmlFor="invite-email">Email</Label>
        <Input id="invite-email" name="email" type="email" required placeholder="teammate@company.com" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="invite-role">Role</Label>
        <select id="invite-role" name="role" defaultValue={MembershipRole.STAFF} className={nativeSelectClass}>
          {inviteRoleOptions.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Inviting..." : "Invite"}
      </Button>
      {state && !state.ok ? <p className="text-destructive text-xs md:col-span-3">{state.message}</p> : null}
      {state?.ok ? <p className="text-xs text-green-600 md:col-span-3">Invite sent.</p> : null}
    </form>
  );
}
