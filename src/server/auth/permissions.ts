import { MembershipRole } from "@prisma/client";

export enum Permission {
  PROPERTIES_VIEW = "properties.view",
  PROPERTIES_CREATE = "properties.create",
  PROPERTIES_EDIT = "properties.edit",
  PROPERTIES_DELETE = "properties.delete",
  UNITS_VIEW = "units.view",
  UNITS_CREATE = "units.create",
  UNITS_EDIT = "units.edit",
  LISTINGS_VIEW = "listings.view",
  LISTINGS_CREATE = "listings.create",
  LISTINGS_EDIT = "listings.edit",
  LISTINGS_DELETE = "listings.delete",
  LISTINGS_PUBLISH = "listings.publish",
  PHOTOS_UPLOAD = "photos.upload",
  PHOTOS_DELETE = "photos.delete",
  LEADS_VIEW = "leads.view",
  LEADS_MANAGE = "leads.manage",
  LEADS_ASSIGN = "leads.assign",
  LEASES_VIEW = "leases.view",
  LEASES_CREATE = "leases.create",
  LEASES_MANAGE = "leases.manage",
  TOURS_VIEW = "tours.view",
  TOURS_MANAGE = "tours.manage",
  TEAM_VIEW = "team.view",
  TEAM_INVITE = "team.invite",
  TEAM_MANAGE_ROLES = "team.manage_roles",
  SETTINGS_VIEW = "settings.view",
  SETTINGS_EDIT = "settings.edit",
  AI_VIEW = "ai.view",
  AI_MANAGE = "ai.manage",
  ACTIVITY_VIEW = "activity.view",
}

const ALL_PERMISSIONS = Object.values(Permission);

export const ROLE_PERMISSIONS: Record<MembershipRole, Permission[]> = {
  [MembershipRole.OWNER]: ALL_PERMISSIONS,
  [MembershipRole.ADMIN]: ALL_PERMISSIONS,
  [MembershipRole.MANAGER]: [
    Permission.PROPERTIES_VIEW,
    Permission.PROPERTIES_CREATE,
    Permission.PROPERTIES_EDIT,
    Permission.UNITS_VIEW,
    Permission.UNITS_CREATE,
    Permission.UNITS_EDIT,
    Permission.LISTINGS_VIEW,
    Permission.LISTINGS_CREATE,
    Permission.LISTINGS_EDIT,
    Permission.LISTINGS_PUBLISH,
    Permission.PHOTOS_UPLOAD,
    Permission.PHOTOS_DELETE,
    Permission.LEADS_VIEW,
    Permission.LEADS_MANAGE,
    Permission.LEADS_ASSIGN,
    Permission.LEASES_VIEW,
    Permission.LEASES_CREATE,
    Permission.LEASES_MANAGE,
    Permission.TOURS_VIEW,
    Permission.TOURS_MANAGE,
    Permission.SETTINGS_VIEW,
    Permission.AI_VIEW,
    Permission.AI_MANAGE,
    Permission.ACTIVITY_VIEW,
  ],
  [MembershipRole.STAFF]: [
    Permission.PROPERTIES_VIEW,
    Permission.UNITS_VIEW,
    Permission.LISTINGS_VIEW,
    Permission.LEADS_VIEW,
    Permission.LEADS_MANAGE,
    Permission.LEASES_VIEW,
    Permission.TOURS_VIEW,
    Permission.SETTINGS_VIEW,
    Permission.AI_VIEW,
    Permission.ACTIVITY_VIEW,
    Permission.TEAM_VIEW,
  ],
};

export function listRolePermissions(role: MembershipRole): Permission[] {
  return ROLE_PERMISSIONS[role];
}

export function hasPermission(role: MembershipRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
