"use server";

import { revalidatePath } from "next/cache";

import { requireOrgContext } from "@/server/auth/context";
import { Permission } from "@/server/auth/permissions";
import { requirePermission } from "@/server/auth/require-permission";
import { updateGoogleSelectedCalendar } from "@/server/services/google/google-calendar.service";

export async function updateGoogleCalendarSelectionAction(_prev: unknown, formData: FormData) {
  try {
    const ctx = await requireOrgContext();
    await requirePermission(ctx, Permission.SETTINGS_EDIT);
    const calendarId = String(formData.get("calendarId") ?? "").trim();
    if (!calendarId) throw new Error("Calendar is required");
    await updateGoogleSelectedCalendar(ctx.organizationId, ctx.userId, calendarId);
    revalidatePath("/settings");
    return { ok: true as const };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update calendar";
    return { ok: false as const, message };
  }
}
