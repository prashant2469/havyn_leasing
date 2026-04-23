"use client";

import { MembershipRole } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { removeMemberAction, updateMemberRoleAction } from "@/server/actions/team";

const nativeSelectClass =
  "border-input bg-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-2";

type Props = {
  membershipId: string;
  currentRole: MembershipRole;
  canManageRoles: boolean;
  isCurrentUser: boolean;
};

const roleOptions: MembershipRole[] = [
  MembershipRole.OWNER,
  MembershipRole.ADMIN,
  MembershipRole.MANAGER,
  MembershipRole.STAFF,
];

export function TeamMemberActions({
  membershipId,
  currentRole,
  canManageRoles,
  isCurrentUser,
}: Props) {
  const router = useRouter();
  const [updateState, updateAction, updatePending] = useActionState(updateMemberRoleAction, null);
  const [removeState, removeAction, removePending] = useActionState(removeMemberAction, null);

  useEffect(() => {
    if (updateState?.ok || removeState?.ok) router.refresh();
  }, [updateState?.ok, removeState?.ok, router]);

  if (!canManageRoles) return null;

  return (
    <div className="space-y-2">
      <form action={updateAction} className="flex items-center gap-2">
        <input type="hidden" name="membershipId" value={membershipId} />
        <select
          name="role"
          className={nativeSelectClass}
          defaultValue={currentRole}
          disabled={updatePending}
        >
          {roleOptions.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
        <Button type="submit" size="sm" variant="outline" disabled={updatePending}>
          {updatePending ? "Saving..." : "Save"}
        </Button>
      </form>

      {!isCurrentUser ? (
        <form action={removeAction}>
          <input type="hidden" name="membershipId" value={membershipId} />
          <Button type="submit" size="sm" variant="destructive" disabled={removePending}>
            {removePending ? "Removing..." : "Remove"}
          </Button>
        </form>
      ) : (
        <p className="text-muted-foreground text-xs">Current user</p>
      )}

      {updateState && !updateState.ok ? <p className="text-destructive text-xs">{updateState.message}</p> : null}
      {removeState && !removeState.ok ? <p className="text-destructive text-xs">{removeState.message}</p> : null}
    </div>
  );
}
