"use client";

import { AIReplyDraft } from "@prisma/client";
import {
  Bot,
  CheckCircle,
  Loader2,
  Send,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  XCircle,
} from "lucide-react";
import { useActionState, useEffect, useRef } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { replyDraftStatusColor, replyDraftStatusLabel } from "@/domains/ai/constants";
import {
  approveReplyDraftAction,
  rejectReplyDraftAction,
  sendApprovedDraftAction,
  suggestReplyDraftAction,
} from "@/server/actions/ai-copilot";
import { cn } from "@/lib/utils";

interface ReplyDraftPanelProps {
  draft: AIReplyDraft | null;
  conversationId: string;
  onSent?: () => void;
}

export function ReplyDraftPanel({ draft: initialDraft, conversationId, onSent }: ReplyDraftPanelProps) {
  const [suggestState, suggestAction, suggestPending] = useActionState(
    suggestReplyDraftAction,
    null,
  );
  const [approveState, approveAction, approvePending] = useActionState(
    approveReplyDraftAction,
    null,
  );
  const [rejectState, rejectAction, rejectPending] = useActionState(
    rejectReplyDraftAction,
    null,
  );
  const [sendState, sendAction, sendPending] = useActionState(sendApprovedDraftAction, null);

  // Use latest draft from any action result, fall back to initial
  const activeDraft = initialDraft;
  const isApproved = activeDraft?.status === "APPROVED";
  const isSent = activeDraft?.status === "SENT";
  const isRejected = activeDraft?.status === "REJECTED" || activeDraft?.status === "SUPERSEDED";

  const sentRef = useRef(false);
  useEffect(() => {
    if (sendState?.success && !sentRef.current) {
      sentRef.current = true;
      onSent?.();
    }
  }, [sendState?.success, onSent]);

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-500" />
            AI Draft Reply
          </CardTitle>
          {activeDraft && (
            <Badge
              variant={
                (replyDraftStatusColor[activeDraft.status] as
                  | "default"
                  | "outline"
                  | "secondary"
                  | "destructive") ?? "outline"
              }
              className="text-xs"
            >
              {replyDraftStatusLabel[activeDraft.status]}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {isSent ? (
          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
            <CheckCircle className="h-4 w-4" />
            Draft was sent successfully.
          </div>
        ) : isRejected ? (
          <div className="space-y-2">
            <p className="text-muted-foreground text-sm">Draft was rejected.</p>
            <form action={suggestAction}>
              <input type="hidden" name="conversationId" value={conversationId} />
              <Button type="submit" variant="outline" size="sm" disabled={suggestPending} className="gap-2">
                {suggestPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                Generate new draft
              </Button>
            </form>
          </div>
        ) : activeDraft ? (
          <>
            <div className="bg-muted/50 rounded-md p-3 text-sm leading-relaxed whitespace-pre-wrap font-mono text-xs">
              {activeDraft.body}
            </div>

            {activeDraft.contextNote && (
              <p className="text-muted-foreground text-xs italic">{activeDraft.contextNote}</p>
            )}

            <div className="text-muted-foreground text-xs">
              Channel: <span className="font-medium">{activeDraft.suggestedChannel}</span>
            </div>

            {[approveState, rejectState, sendState].map((s, i) =>
              s && !s.success ? (
                <p key={i} className="text-destructive text-xs">
                  {s.error}
                </p>
              ) : null,
            )}

            {!isApproved ? (
              <div className="flex gap-2">
                <form action={approveAction} className="flex-1">
                  <input type="hidden" name="draftId" value={activeDraft.id} />
                  <Button
                    type="submit"
                    size="sm"
                    className="w-full gap-2"
                    disabled={approvePending}
                  >
                    {approvePending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ThumbsUp className="h-3.5 w-3.5" />
                    )}
                    Approve
                  </Button>
                </form>
                <form action={rejectAction} className="flex-1">
                  <input type="hidden" name="draftId" value={activeDraft.id} />
                  <Button
                    type="submit"
                    variant="outline"
                    size="sm"
                    className="w-full gap-2"
                    disabled={rejectPending}
                  >
                    {rejectPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ThumbsDown className="h-3.5 w-3.5" />
                    )}
                    Reject
                  </Button>
                </form>
              </div>
            ) : (
              <form action={sendAction}>
                <input type="hidden" name="draftId" value={activeDraft.id} />
                <Button
                  type="submit"
                  size="sm"
                  className={cn("w-full gap-2", sendPending && "opacity-70")}
                  disabled={sendPending}
                >
                  {sendPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  {sendPending ? "Sending…" : "Send approved draft"}
                </Button>
              </form>
            )}

            <Separator />

            <form action={suggestAction}>
              <input type="hidden" name="conversationId" value={conversationId} />
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                className="w-full gap-2 text-muted-foreground"
                disabled={suggestPending}
              >
                {suggestPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                Regenerate draft
              </Button>
            </form>
          </>
        ) : (
          <div className="space-y-2">
            <p className="text-muted-foreground text-sm">
              No draft yet. Generate an AI-suggested reply below.
            </p>
            <form action={suggestAction}>
              <input type="hidden" name="conversationId" value={conversationId} />
              <Button
                type="submit"
                variant="outline"
                size="sm"
                className="w-full gap-2"
                disabled={suggestPending}
              >
                {suggestPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Bot className="h-3.5 w-3.5" />
                )}
                {suggestPending ? "Generating…" : "Suggest reply draft"}
              </Button>
            </form>
            {suggestState && !suggestState.success && (
              <p className="text-destructive text-xs">{suggestState.error}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
