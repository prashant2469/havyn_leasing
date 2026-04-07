import { UnitStatus } from "@prisma/client";

export const unitStatusLabel: Record<UnitStatus, string> = {
  VACANT: "Vacant",
  NOTICE: "Notice",
  OCCUPIED: "Occupied",
  DOWN: "Down",
};
