"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { setActiveOrganizationAction } from "@/server/actions/org";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type OrgOption = { organizationId: string; name: string };

export function OrgSwitcher({ orgs, currentOrgId }: { orgs: OrgOption[]; currentOrgId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (orgs.length <= 1) return null;

  return (
    <form className="min-w-0 max-w-[200px] sm:max-w-[260px]">
      <Select
        disabled={pending}
        value={currentOrgId}
        onValueChange={(organizationId) => {
          if (!organizationId) return;
          startTransition(async () => {
            const fd = new FormData();
            fd.set("organizationId", organizationId);
            await setActiveOrganizationAction(fd);
            router.refresh();
          });
        }}
      >
        <SelectTrigger aria-label="Active organization" className="h-8 text-xs">
          <SelectValue placeholder="Organization" />
        </SelectTrigger>
        <SelectContent>
          {orgs.map((o) => (
            <SelectItem key={o.organizationId} value={o.organizationId}>
              {o.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </form>
  );
}
