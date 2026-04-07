"use client";

import { AISuggestedAction } from "@prisma/client";
import {
  CalendarPlus,
  CheckCircle,
  ClipboardList,
  Clock,
  FileText,
  Loader2,
  MessageSquare,
  UserCheck,
  X,
  Zap,
} from "lucide-react";
import { useActionState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { suggestedActionLabel } from "@/domains/ai/constants";
import {
  acceptSuggestedActionAction,
  dismissSuggestedActionAction,
} from "@/server/actions/ai-copilot";
import { cn } from "@/lib/utils";

const actionIcon: Record<string, React.ReactNode> = {
  REPLY_NOW: <MessageSquare className="h-4 w-4" />,
  ASK_QUALIFICATION: <ClipboardList className="h-4 w-4" />,
  OFFER_TOUR_TIMES: <CalendarPlus className="h-4 w-4" />,
  SEND_APPLICATION_INVITE: <FileText className="h-4 w-4" />,
  HAND_OFF_TO_HUMAN: <UserCheck className="h-4 w-4" />,
  FOLLOW_UP_24H: <Clock className="h-4 w-4" />,
  MARK_QUALIFIED: <CheckCircle className="h-4 w-4" />,
  OTHER: <Zap className="h-4 w-4" />,
};

function SingleAction({ action }: { action: AISuggestedAction }) {
  const [acceptState, acceptActionFn, acceptPending] = useActionState(
    acceptSuggestedActionAction,
    null,
  );
  const [dismissState, dismissActionFn, dismissPending] = useActionState(
    dismissSuggestedActionAction,
    null,
  );

  const isActioned = acceptState?.success || dismissState?.success;

  if (isActioned) return null;

  return (
    <div className="flex items-start gap-3 py-2 group">
      <div className="text-violet-500 mt-0.5 shrink-0">{actionIcon[action.actionType]}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-tight">{action.title}</p>
        {action.description && (
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            {action.description}
          </p>
        )}
        {(acceptState?.success === false || dismissState?.success === false) && (
          <p className="text-destructive text-xs mt-1">
            {acceptState?.error ?? dismissState?.error}
          </p>
        )}
      </div>
      <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <form action={acceptActionFn}>
          <input type="hidden" name="actionId" value={action.id} />
          <Button
            type="submit"
            size="sm"
            variant="default"
            className="h-7 px-2 gap-1 text-xs"
            disabled={acceptPending}
            title="Accept"
          >
            {acceptPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <CheckCircle className="h-3 w-3" />
            )}
            Do it
          </Button>
        </form>
        <form action={dismissActionFn}>
          <input type="hidden" name="actionId" value={action.id} />
          <Button
            type="submit"
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            disabled={dismissPending}
            title="Dismiss"
          >
            {dismissPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <X className="h-3 w-3" />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}

interface SuggestedActionCardProps {
  actions: AISuggestedAction[];
  className?: string;
}

export function SuggestedActionCard({ actions, className }: SuggestedActionCardProps) {
  const pending = actions.filter((a) => a.status === "PENDING");

  if (pending.length === 0) {
    return (
      <Card className={cn("border-border/60", className)}>
        <CardContent className="pt-4 pb-4">
          <p className="text-muted-foreground text-sm text-center">No pending actions.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("border-border/60", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="h-4 w-4 text-violet-500" />
            Suggested Actions
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            {pending.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="divide-y divide-border/50">
        {pending.map((action) => (
          <SingleAction key={action.id} action={action} />
        ))}
      </CardContent>
    </Card>
  );
}
