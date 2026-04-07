"use client";

import {
  AIEscalationFlag,
  AIReplyDraft,
  AISuggestedAction,
  ConversationReplyMode,
  ConversationSummary,
  LeadInboxStage,
  LeadPrioritySignal,
  ListingChannelType,
  QualificationAnswer,
  type LeadStatus,
} from "@prisma/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useActionState, useEffect, useMemo, useState } from "react";

import { ConversationSummaryCard } from "@/components/ai/conversation-summary-card";
import { EscalationBadge } from "@/components/ai/escalation-badge";
import { PriorityIndicator } from "@/components/ai/priority-indicator";
import { QualificationSnapshot } from "@/components/ai/qualification-snapshot";
import { ReplyDraftPanel } from "@/components/ai/reply-draft-panel";
import { SuggestedActionCard } from "@/components/ai/suggested-action-card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { replyModeLabel } from "@/domains/channels/constants";
import { leadStatusLabel } from "@/domains/leasing/constants";
import { inboxQueueOrder, inboxStageLabel } from "@/domains/leasing/inbox";
import { channelTypeIcon, channelTypeLabel } from "@/domains/listings/constants";
import { cn } from "@/lib/utils";
import { updateConversationReplyModeAction } from "@/server/actions/channel";
import { updateLeadInboxStageAction } from "@/server/actions/leads";

type LeadBrief = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  status: LeadStatus;
  nextActionAt: string | null;
  sourceChannelType: ListingChannelType | null;
  listing: { id: string; title: string } | null;
  primaryUnit: { unitNumber: string } | null;
};

type MessageRow = {
  id: string;
  direction: string;
  channel: string;
  body: string;
  sentAt: string;
  authorType: string;
  isAiGenerated: boolean;
};

type ActivityRow = {
  id: string;
  verb: string;
  createdAt: string;
};

type AIActionBrief = {
  id: string;
  type: string;
  status: string;
  createdAt: string;
};

type ReplyStrategy = {
  replyMode: ConversationReplyMode;
  canReplyInChannel: boolean;
  canRedirect: boolean;
  requiresManual: boolean;
  hint: string;
};

type CopilotContext = {
  summary: ConversationSummary | null;
  activeDraft: AIReplyDraft | null;
  pendingActions: AISuggestedAction[];
  openEscalations: AIEscalationFlag[];
  prioritySignal: LeadPrioritySignal | null;
  qualifications: QualificationAnswer[];
};

type LeadDetail = {
  lead: LeadBrief & {
    inboxStage: LeadInboxStage;
    source: string | null;
    sourceChannelType: ListingChannelType | null;
    sourceAttribution: unknown;
    firstResponseAt: string | null;
    lastResponseAt: string | null;
    listing: {
      id: string;
      title: string;
      status: string;
      unit: { unitNumber: string; property: { name: string } };
    } | null;
    tours: { id: string; scheduledAt: string; status: string; notes: string | null }[];
    qualifications: { id: string; key: string; value: unknown; source: string }[];
  };
  conversation: {
    id: string;
    channelType: ListingChannelType | null;
    replyMode: ConversationReplyMode;
    externalThreadId: string | null;
    messages: MessageRow[];
  } | null;
  activities: ActivityRow[];
  aiActions: AIActionBrief[];
  replyStrategy: ReplyStrategy | null;
  copilotContext: CopilotContext | null;
};

const nativeSelectClass =
  "border-input bg-background focus-visible:ring-ring h-8 w-full rounded-md border px-2 text-xs shadow-xs outline-none focus-visible:ring-2";

function ReplyModeBadge({ mode }: { mode: ConversationReplyMode }) {
  const colors: Record<ConversationReplyMode, string> = {
    IN_CHANNEL_REPLY: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    REDIRECT_TO_OWNED_CHANNEL:
      "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    MANUAL_ONLY: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
  };
  return (
    <span
      className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", colors[mode])}
    >
      {replyModeLabel[mode]}
    </span>
  );
}

function ChannelBadge({ channelType }: { channelType: ListingChannelType | null }) {
  if (!channelType) return null;
  return (
    <span
      className="bg-muted text-muted-foreground inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium"
      title={channelTypeLabel[channelType]}
    >
      {channelTypeIcon[channelType]}
      <span>{channelTypeLabel[channelType]}</span>
    </span>
  );
}

export function LeasingInboxClient() {
  const qc = useQueryClient();
  const [stage, setStage] = useState<LeadInboxStage>(LeadInboxStage.NEW_LEADS);
  const [channelFilter, setChannelFilter] = useState<ListingChannelType | "ALL">("ALL");
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

  const leadsQuery = useQuery({
    queryKey: ["leads", "inbox", stage, channelFilter],
    queryFn: async () => {
      const url = new URL("/api/leads", window.location.origin);
      url.searchParams.set("stage", stage);
      if (channelFilter !== "ALL") url.searchParams.set("channel", channelFilter);
      const res = await fetch(url.toString());
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load queue");
      return json as { leads: LeadBrief[] };
    },
  });

  const leads = useMemo(() => leadsQuery.data?.leads ?? [], [leadsQuery.data]);

  const activeLeadId = useMemo(() => {
    if (leads.length === 0) return null;
    if (selectedLeadId && leads.some((l) => l.id === selectedLeadId)) return selectedLeadId;
    return leads[0].id;
  }, [leads, selectedLeadId]);

  const detailQueryActive = useQuery({
    queryKey: ["lead-detail", activeLeadId],
    enabled: Boolean(activeLeadId),
    queryFn: async () => {
      const res = await fetch(`/api/leads/${activeLeadId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load lead");
      return json as LeadDetail;
    },
  });

  const detail = detailQueryActive.data;

  return (
    <div className="border-border grid min-h-[560px] flex-1 gap-0 overflow-hidden rounded-lg border md:grid-cols-[220px_1fr_300px]">
      {/* Queue sidebar */}
      <aside className="border-border bg-muted/30 flex flex-col border-b md:border-r md:border-b-0">
        <div className="p-2">
          <p className="text-muted-foreground px-2 py-1 text-xs font-medium uppercase tracking-wide">
            Queues
          </p>
          <nav className="flex flex-col gap-0.5">
            {inboxQueueOrder.map((s) => {
              const active = s === stage;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setStage(s);
                    setSelectedLeadId(null);
                  }}
                  className={cn(
                    "rounded-md px-2 py-2 text-left text-sm transition-colors",
                    active ? "bg-background font-medium shadow-sm" : "hover:bg-muted/80",
                    s === LeadInboxStage.NEEDS_HUMAN_REVIEW
                      ? "text-orange-600 dark:text-orange-400"
                      : "",
                  )}
                >
                  {s === LeadInboxStage.NEEDS_HUMAN_REVIEW ? "⚠ " : ""}
                  {inboxStageLabel[s]}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Channel filter */}
        <div className="border-border border-t p-2">
          <p className="text-muted-foreground mb-1 px-2 text-xs font-medium uppercase tracking-wide">
            Channel filter
          </p>
          <select
            className={nativeSelectClass}
            value={channelFilter}
            onChange={(e) => {
              setChannelFilter(e.target.value as ListingChannelType | "ALL");
              setSelectedLeadId(null);
            }}
          >
            <option value="ALL">All channels</option>
            {Object.values(ListingChannelType).map((c) => (
              <option key={c} value={c}>
                {channelTypeIcon[c]} {channelTypeLabel[c]}
              </option>
            ))}
          </select>
        </div>
      </aside>

      {/* Lead list + conversation thread */}
      <section className="flex min-h-0 flex-col border-b md:border-r md:border-b-0">
        {/* Lead list */}
        <div className="border-border flex max-h-[200px] flex-col border-b md:max-h-none md:flex-1">
          <p className="text-muted-foreground px-3 py-2 text-xs font-medium uppercase tracking-wide">
            {inboxStageLabel[stage]}
            {channelFilter !== "ALL" && (
              <span className="text-muted-foreground/60 ml-1">
                · {channelTypeLabel[channelFilter as ListingChannelType]}
              </span>
            )}
          </p>
          <ScrollArea className="flex-1">
            <div className="p-2">
              {leadsQuery.isLoading ? (
                <p className="text-muted-foreground px-2 py-4 text-sm">Loading…</p>
              ) : leadsQuery.isError ? (
                <p className="text-destructive px-2 py-4 text-sm">
                  {leadsQuery.error instanceof Error ? leadsQuery.error.message : "Error"}
                </p>
              ) : leads.length === 0 ? (
                <p className="text-muted-foreground px-2 py-4 text-sm">
                  No leads in this queue.
                </p>
              ) : (
                <ul className="space-y-1">
                  {leads.map((l) => {
                    // Detail is only available for the active lead; we can't show priority
                    // for all leads without fetching each, so just show it inline when available
                    const isActive = activeLeadId === l.id;
                    const priority = isActive ? detail?.copilotContext?.prioritySignal : null;
                    const hasEscalation =
                      isActive &&
                      (detail?.copilotContext?.openEscalations.length ?? 0) > 0;
                    return (
                      <li key={l.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedLeadId(l.id)}
                          className={cn(
                            "hover:bg-muted/80 w-full rounded-md px-2 py-2 text-left text-sm",
                            isActive ? "bg-muted font-medium" : "",
                          )}
                        >
                          <span className="flex items-center justify-between gap-1">
                            <span className="block truncate">
                              {l.firstName} {l.lastName}
                            </span>
                            <span className="flex items-center gap-1 shrink-0">
                              {hasEscalation && (
                                <span className="h-2 w-2 rounded-full bg-red-500 shrink-0" title="Escalation open" />
                              )}
                              <ChannelBadge channelType={l.sourceChannelType} />
                            </span>
                          </span>
                          <span className="text-muted-foreground block truncate text-xs">
                            {l.listing?.title ??
                              (l.primaryUnit ? `Unit ${l.primaryUnit.unitNumber}` : "—")}
                          </span>
                          {priority && priority.priorityTier !== "NORMAL" && (
                            <span className="mt-1 block">
                              <PriorityIndicator tier={priority.priorityTier} />
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Conversation thread */}
        <div className="flex min-h-[280px] flex-1 flex-col bg-background">
          <div className="border-border flex items-center gap-2 border-b px-3 py-2">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide flex-1">
              Conversation
            </p>
            {detail?.conversation && (
              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                {detail.conversation.channelType && (
                  <ChannelBadge channelType={detail.conversation.channelType} />
                )}
                <ReplyModeBadge mode={detail.conversation.replyMode} />
                {detail.copilotContext?.openEscalations &&
                  detail.copilotContext.openEscalations.length > 0 && (
                    <EscalationBadge flags={detail.copilotContext.openEscalations} />
                  )}
              </div>
            )}
          </div>

          {/* Reply strategy hint */}
          {detail?.replyStrategy && (
            <div className="border-border bg-muted/20 border-b px-3 py-1.5 text-xs">
              <span className="text-muted-foreground">{detail.replyStrategy.hint}</span>
            </div>
          )}

          <ScrollArea className="flex-1 p-3">
            {!activeLeadId ? (
              <p className="text-muted-foreground text-sm">Select a lead.</p>
            ) : detailQueryActive.isLoading ? (
              <p className="text-muted-foreground text-sm">Loading thread…</p>
            ) : detailQueryActive.isError ? (
              <p className="text-destructive text-sm">Could not load thread.</p>
            ) : (
              <div className="space-y-4">
                {(detail?.conversation?.messages ?? []).length === 0 ? (
                  <p className="text-muted-foreground text-sm">No messages yet.</p>
                ) : (
                  detail!.conversation!.messages.map((m) => (
                    <div key={m.id} className="space-y-1 text-sm">
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="outline" className="text-[10px]">
                          {m.direction}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">
                          {m.channel}
                        </Badge>
                        <Badge
                          variant={m.isAiGenerated ? "default" : "outline"}
                          className="text-[10px]"
                        >
                          {m.isAiGenerated ? "AI" : m.authorType}
                        </Badge>
                        <span className="text-muted-foreground text-[10px]">
                          {new Date(m.sentAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap">{m.body}</p>
                      <Separator />
                    </div>
                  ))
                )}
                <Link
                  href={activeLeadId ? `/leasing/leads/${activeLeadId}` : "#"}
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                >
                  Open full workspace
                </Link>
              </div>
            )}
          </ScrollArea>
        </div>
      </section>

      {/* Lead summary / context panel */}
      <aside className="bg-muted/15 flex min-h-[320px] flex-col md:min-h-0">
        <p className="text-muted-foreground border-border border-b px-3 py-2 text-xs font-medium uppercase tracking-wide">
          Lead context
        </p>
        <ScrollArea className="flex-1 p-3">
          {!activeLeadId ? (
            <p className="text-muted-foreground text-sm">Select a lead for context.</p>
          ) : detailQueryActive.isLoading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : !detail ? (
            <p className="text-muted-foreground text-sm">—</p>
          ) : (
            <div className="space-y-4 text-sm">
              {/* Lead header */}
              <div>
                <p className="text-lg font-semibold">
                  {detail.lead.firstName} {detail.lead.lastName}
                </p>
                <p className="text-muted-foreground text-xs">{detail.lead.email ?? "—"}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge variant="secondary">{leadStatusLabel[detail.lead.status]}</Badge>
                  <Badge variant="outline">{inboxStageLabel[detail.lead.inboxStage]}</Badge>
                  {detail.lead.sourceChannelType && (
                    <ChannelBadge channelType={detail.lead.sourceChannelType} />
                  )}
                </div>
                {detail.copilotContext?.prioritySignal && (
                  <div className="mt-2">
                    <PriorityIndicator
                      tier={detail.copilotContext.prioritySignal.priorityTier}
                      isHotLead={detail.copilotContext.prioritySignal.isHotLead}
                      isAtRisk={detail.copilotContext.prioritySignal.isAtRisk}
                      needsImmediateResponse={detail.copilotContext.prioritySignal.needsImmediateResponse}
                      showFlags
                    />
                  </div>
                )}
              </div>

              {/* AI Summary */}
              {detail.conversation && (
                <ConversationSummaryCard
                  summary={detail.copilotContext?.summary ?? null}
                  leadId={detail.lead.id}
                  conversationId={detail.conversation.id}
                  compact
                />
              )}

              {/* AI Draft Reply */}
              {detail.conversation && (
                <ReplyDraftPanel
                  draft={detail.copilotContext?.activeDraft ?? null}
                  conversationId={detail.conversation.id}
                  onSent={() => {
                    void qc.invalidateQueries({ queryKey: ["lead-detail", detail.lead.id] });
                  }}
                />
              )}

              {/* Suggested next actions */}
              {detail.copilotContext && (
                <SuggestedActionCard actions={detail.copilotContext.pendingActions} />
              )}

              {/* Qualification snapshot */}
              {detail.copilotContext && (
                <QualificationSnapshot qualifications={detail.copilotContext.qualifications} />
              )}

              {/* Reply mode control */}
              {detail.conversation && (
                <ReplyModeForm
                  key={`${detail.conversation.id}-${detail.conversation.replyMode}`}
                  conversationId={detail.conversation.id}
                  currentMode={detail.conversation.replyMode}
                  onDone={() => {
                    void qc.invalidateQueries({ queryKey: ["lead-detail", detail.lead.id] });
                  }}
                />
              )}

              <InboxMoveForm
                key={`${detail.lead.id}-${detail.lead.inboxStage}`}
                leadId={detail.lead.id}
                initialStage={detail.lead.inboxStage}
                onDone={() => {
                  void qc.invalidateQueries({ queryKey: ["leads", "inbox"] });
                  void qc.invalidateQueries({ queryKey: ["lead-detail", detail.lead.id] });
                }}
              />

              {/* Listing */}
              <div>
                <p className="text-muted-foreground mb-1 text-xs font-medium uppercase tracking-wide">
                  Listing
                </p>
                {detail.lead.listing ? (
                  <p>
                    {detail.lead.listing.title}
                    <span className="text-muted-foreground block text-xs">
                      {detail.lead.listing.unit.property.name} ·{" "}
                      {detail.lead.listing.unit.unitNumber}
                    </span>
                  </p>
                ) : (
                  <p className="text-muted-foreground text-xs">No listing linked.</p>
                )}
              </div>

              {/* Tours */}
              {detail.lead.tours.length > 0 && (
                <div>
                  <p className="text-muted-foreground mb-1 text-xs font-medium uppercase tracking-wide">
                    Tours
                  </p>
                  <ul className="space-y-1 text-xs">
                    {detail.lead.tours.map((t) => (
                      <li key={t.id}>
                        {new Date(t.scheduledAt).toLocaleString(undefined, {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}{" "}
                        · {t.status}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Activity */}
              <div>
                <p className="text-muted-foreground mb-1 text-xs font-medium uppercase tracking-wide">
                  Activity
                </p>
                <ul className="max-h-32 space-y-1 overflow-auto text-xs">
                  {detail.activities.slice(0, 12).map((a) => (
                    <li key={a.id} className="text-muted-foreground">
                      <span className="text-foreground font-mono">{a.verb}</span> ·{" "}
                      {new Date(a.createdAt).toLocaleString()}
                    </li>
                  ))}
                </ul>
              </div>

              <Link
                href={`/leasing/leads/${detail.lead.id}`}
                className={cn(buttonVariants({ size: "sm" }), "inline-flex w-full justify-center")}
              >
                Open full workspace
              </Link>
            </div>
          )}
        </ScrollArea>
      </aside>
    </div>
  );
}

function ReplyModeForm({
  conversationId,
  currentMode,
  onDone,
}: {
  conversationId: string;
  currentMode: ConversationReplyMode;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(updateConversationReplyModeAction, null);
  useEffect(() => {
    if (state?.success) onDone();
  }, [state?.success, onDone]);

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="conversationId" value={conversationId} />
      <label className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
        Reply mode
      </label>
      <select name="replyMode" defaultValue={currentMode} className={nativeSelectClass}>
        {Object.values(ConversationReplyMode).map((m) => (
          <option key={m} value={m}>
            {replyModeLabel[m]}
          </option>
        ))}
      </select>
      <Button type="submit" size="sm" variant="secondary" disabled={pending} className="w-full">
        Update reply mode
      </Button>
      {state && !state.success ? (
        <p className="text-destructive text-xs">{state.error}</p>
      ) : null}
    </form>
  );
}

function InboxMoveForm({
  leadId,
  initialStage,
  onDone,
}: {
  leadId: string;
  initialStage: LeadInboxStage;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(updateLeadInboxStageAction, null);
  useEffect(() => {
    if (state?.ok) onDone();
  }, [state?.ok, onDone]);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="leadId" value={leadId} />
      <label className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
        Move queue
      </label>
      <select name="inboxStage" defaultValue={initialStage} className={nativeSelectClass}>
        {Object.values(LeadInboxStage).map((s) => (
          <option key={s} value={s}>
            {inboxStageLabel[s]}
          </option>
        ))}
      </select>
      <Button type="submit" size="sm" variant="secondary" disabled={pending} className="w-full">
        Update
      </Button>
      {state && !state.ok ? (
        <p className="text-destructive text-xs">{state.message}</p>
      ) : null}
    </form>
  );
}
