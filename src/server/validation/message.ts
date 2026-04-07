import { MessageChannel } from "@prisma/client";
import { z } from "zod";

export const logOutboundMessageSchema = z.object({
  leadId: z.string().cuid(),
  channel: z.nativeEnum(MessageChannel),
  body: z.string().min(1).max(20000),
});

export type LogOutboundMessageInput = z.infer<typeof logOutboundMessageSchema>;
