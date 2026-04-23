"use client";

import { createContext, useContext } from "react";
import type { MembershipRole } from "@prisma/client";

import type { Permission } from "@/server/auth/permissions";

type PermissionsContextValue = {
  role: MembershipRole | null;
  permissions: Permission[];
};

const PermissionsContext = createContext<PermissionsContextValue>({
  role: null,
  permissions: [],
});

export function PermissionsProvider({
  value,
  children,
}: {
  value: PermissionsContextValue;
  children: React.ReactNode;
}) {
  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>;
}

export function usePermissionsContext(): PermissionsContextValue {
  return useContext(PermissionsContext);
}
