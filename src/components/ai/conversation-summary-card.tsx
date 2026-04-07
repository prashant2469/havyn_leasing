"use client";

import { ConversationSummary } from "@prisma/client";
import { AlertCircle, Bot, ChevronDown, ChevronUp, Clock, Lightbulb, Loader2 } from "lucide-react";
import { useActionState, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { urgencyColor, urgencyLabel } from "@/domains/ai/constants";
import { runCopilotAnalysisAction } from "@/server/actions/ai-copilot";
import { cn } from "@/lib/utils";

interface ConversationSummaryCardProps {
  summary: ConversationSummary | null;
  leadId: string;
  conversationId: string;
  compact?: boolean;
}

export function ConversationSummaryCard({
  summary,
  leadId,
  conversationId,
  compact = false,
}: ConversationSummaryCardProps) {
  const [expanded, setExpanded] = useState(!compact);
  const [state, action, pending] = useActionState(
    runCopilotAnalysisAction,
    null as Awaited<ReturnType<typeof runCopilotAnalysisAction>> | null,
  );

  const displaySummary = state?.success ? state.data.summary : summary;

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Bot className="h-4 w-4 text-violet-500" />
            AI Summary
          </CardTitle>
          <div className="flex items-center gap-1">
            {displaySummary && (
              <Badge
                variant={
                  (urgencyColor[displaySummary.urgency] as
                    | "destructive"
                    | "default"
                    | "outline"
                    | "secondary") ?? "outline"
                }
                className="text-xs"
              >
                {urgencyLabel[displaySummary.urgency]}
              </Badge>
            )}
            {compact && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => setExpanded((v) => !v)}
              >
                {expanded ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-3">
          {displaySummary ? (
            <>
              <p className="text-sm leading-relaxed">{displaySummary.summaryText}</p>

              {displaySummary.currentIntent && (
                <div className="flex items-start gap-2 text-sm">
                  <span className="text-muted-foreground shrink-0 mt-0.5">Intent:</span>
                  <span className="capitalize">{displaySummary.currentIntent}</span>
                </div>
              )}

              {Array.isArray(displaySummary.qualificationGaps) &&
                displaySummary.qualificationGaps.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                      Qualification gaps
                    </p>
                    <ul className="space-y-1">
                      {(displaySummary.qualificationGaps as string[]).map((gap) => (
                        <li key={gap} className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                          <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                          {gap}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

              {displaySummary.recommendedNextStep && (
                <>
                  <Separator />
                  <div className="flex items-start gap-2 text-sm">
                    <Lightbulb className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                    <span>{displaySummary.recommendedNextStep}</span>
                  </div>
                </>
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 text-muted-foreground text-xs">
                  <Clock className="h-3 w-3" />
                  {new Date(displaySummary.generatedAt).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {displaySummary.modelId && (
                    <span className="text-muted-foreground/60 ml-1">
                      · {displaySummary.modelId}
                    </span>
                  )}
                </div>
              </div>
            </>
          ) : (
            <p className="text-muted-foreground text-sm">
              No summary yet. Run AI analysis to generate one.
            </p>
          )}

          <form action={action}>
            <input type="hidden" name="leadId" value={leadId} />
            <input type="hidden" name="conversationId" value={conversationId} />
            <Button
              type="submit"
              variant="outline"
              size="sm"
              disabled={pending}
              className={cn("w-full gap-2", pending && "opacity-70")}
            >
              {pending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Bot className="h-3.5 w-3.5" />
              )}
              {pending ? "Analyzing…" : displaySummary ? "Refresh analysis" : "Run AI analysis"}
            </Button>
          </form>

          {state && !state.success && (
            <p className="text-destructive text-xs">{state.error}</p>
          )}
        </CardContent>
      )}
    </Card>
  );
}
