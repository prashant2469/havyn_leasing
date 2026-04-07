"use client";

import { AIEscalationFlag } from "@prisma/client";
import { ShieldAlert } from "lucide-react";
import { useActionState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  escalationReasonLabel,
  escalationStatusColor,
  escalationStatusLabel,
} from "@/domains/ai/constants";
import { resolveEscalationAction } from "@/server/actions/ai-copilot";

interface EscalationBadgeProps {
  flags: AIEscalationFlag[];
}

function ResolveEscalationForm({ flagId }: { flagId: string }) {
  const [state, action, pending] = useActionState(resolveEscalationAction, null);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="flagId" value={flagId} />
      <div className="space-y-1.5">
        <Label htmlFor="resolutionNote">Resolution note (optional)</Label>
        <Textarea
          id="resolutionNote"
          name="resolutionNote"
          placeholder="Describe how this was resolved…"
          rows={3}
        />
      </div>
      {state && !state.success && (
        <p className="text-destructive text-sm">{state.error}</p>
      )}
      <DialogFooter className="gap-2">
        <Button
          type="submit"
          name="isFalsePositive"
          value="true"
          variant="outline"
          disabled={pending}
        >
          False positive
        </Button>
        <Button type="submit" name="isFalsePositive" value="false" disabled={pending}>
          {pending ? "Resolving…" : "Mark resolved"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function EscalationBadge({ flags }: EscalationBadgeProps) {
  if (flags.length === 0) return null;

  const openFlag = flags[0];
  const colorClass =
    openFlag.status === "OPEN"
      ? "bg-red-500 hover:bg-red-600"
      : "bg-yellow-500 hover:bg-yellow-600";

  return (
    <Dialog>
      <DialogTrigger>
        <Badge
          className={`gap-1 text-xs text-white cursor-pointer ${colorClass}`}
        >
          <ShieldAlert className="h-3 w-3" />
          {escalationStatusLabel[openFlag.status]}:{" "}
          {escalationReasonLabel[openFlag.reason]}
          {flags.length > 1 && ` +${flags.length - 1}`}
        </Badge>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-red-500" />
            Escalation flag
          </DialogTitle>
          <DialogDescription>
            {escalationReasonLabel[openFlag.reason]}
          </DialogDescription>
        </DialogHeader>
        {openFlag.notes && (
          <p className="text-muted-foreground text-sm rounded-md bg-muted p-3">
            {openFlag.notes}
          </p>
        )}
        <ResolveEscalationForm flagId={openFlag.id} />
      </DialogContent>
    </Dialog>
  );
}
