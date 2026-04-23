"use server";

import { revalidatePath } from "next/cache";

import { requireOrgContext } from "@/server/auth/context";
import { Permission } from "@/server/auth/permissions";
import { requirePermission } from "@/server/auth/require-permission";
import { createResident } from "@/server/services/residents/resident.service";
import { createResidentSchema } from "@/server/validation/resident";

export async function createResidentAction(_prev: unknown, formData: FormData) {
  try {
    const ctx = await requireOrgContext();
    await requirePermission(ctx, Permission.SETTINGS_EDIT);
    const raw = {
      firstName: formData.get("firstName"),
      lastName: formData.get("lastName"),
      email: formData.get("email") || undefined,
      phone: formData.get("phone") || undefined,
    };
    const input = createResidentSchema.parse(raw);
    await createResident(ctx, input);
    revalidatePath("/settings");
    revalidatePath("/leases");
    return { ok: true as const };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create resident";
    return { ok: false as const, message };
  }
}
