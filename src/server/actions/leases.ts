"use server";

import { revalidatePath } from "next/cache";

import { requireOrgContext } from "@/server/auth/context";
import { createLeaseFromApplication } from "@/server/services/leases/lease.service";
import { createLeaseFromApplicationSchema } from "@/server/validation/lease";

export async function createLeaseFromApplicationAction(_prev: unknown, formData: FormData) {
  try {
    const ctx = await requireOrgContext();
    const raw = {
      applicationId: formData.get("applicationId"),
      unitId: formData.get("unitId"),
      residentId: formData.get("residentId"),
      startDate: formData.get("startDate"),
      endDate: formData.get("endDate") || undefined,
      rentAmount: formData.get("rentAmount"),
      depositAmount: formData.get("depositAmount") || undefined,
    };
    const input = createLeaseFromApplicationSchema.parse({
      ...raw,
      endDate: raw.endDate === "" ? null : raw.endDate,
      depositAmount: raw.depositAmount === "" ? null : Number(raw.depositAmount),
    });
    const lease = await createLeaseFromApplication(ctx, input);
    revalidatePath("/leases");
    revalidatePath(`/leases/${lease.id}`);
    revalidatePath("/leasing/leads");
    revalidatePath("/properties");
    return { ok: true as const, leaseId: lease.id };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create lease";
    return { ok: false as const, message };
  }
}
