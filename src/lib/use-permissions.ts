"use client";

import { useMemo } from "react";

import { usePermissionsContext } from "@/components/providers/permissions-provider";
import type { Permission } from "@/server/auth/permissions";

export function useHasPermission(permission: Permission): boolean {
  const { permissions } = usePermissionsContext();
  return useMemo(() => permissions.includes(permission), [permission, permissions]);
}

export function useCurrentRole() {
  const { role } = usePermissionsContext();
  return role;
}
