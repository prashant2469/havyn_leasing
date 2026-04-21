"use client";

import {
  AIEscalationFlag,
  AIReplyDraft,
  AISuggestedAction,
  ApplicationStatus,
  ConversationReplyMode,
  ConversationSummary,
  LeadInboxStage,
  LeadPrioritySignal,
  ListingChannelType,
  NextActionType,
  QualificationAnswer,
  type LeadStatus,
} from "@prisma/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useActionState, useEffect, useMemo, useState } from "react";

import { ConversationSummaryCard } from "@/components/ai/conversation-summary-card";
import { ConversationThread } from "@/components/communications/conversation-thread";
import { EscalationBadge } from "@/components/ai/escalation-badge";
import { PriorityIndicator } from "@/components/ai/priority-indicator";
import { QualificationSnapshot } from "@/components/ai/qualification-snapshot";
import { ReplyDraftPanel } from "@/components/ai/reply-draft-panel";
import { SuggestedActionCard } from "@/components/ai/suggested-action-card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { replyModeLabel } from "@/domains/channels/constants";
import { leadStatusLabel } from "@/domains/leasing/constants";
import { inboxQueueOrder, inboxStageLabel } from "@/domains/leasing/inbox";
import { channelTypeIcon, channelTypeLabel } from "@/domains/listings/constants";
import { cn } from "@/lib/utils";
import { updateConversationReplyModeAction } from "@/server/actions/channel";
import { updateLeadInboxStageAction } from "@/server/actions/leads";
import { logOutboundMessageAction } from "@/server/actions/messages";

type LeadBrief = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  automationPaused: boolean;
  status: LeadStatus;
  inboxStage: LeadInboxStage;
  nextActionAt: string | null;
  nextActionType: NextActionType | null;
  createdAt: string;
  updatedAt: string;
  firstResponseAt: string | null;
  lastResponseAt: string | null;
  sourceChannelType: ListingChannelType | null;
  listing: { id: string; title: string } | null;
  primaryUnit: { unitNumber: string } | null;
  tours: { id: string; scheduledAt: string; status: string }[];
  applications: { id: string; status: ApplicationStatus }[];
  prioritySignal: {
    priorityTier: string;
    isAtRisk: boolean;
    needsImmediateResponse: boolean;
  } | null;
  escalationFlags: { id: string }[];
};

type WorkQueueFilter = "all" | "no_first_reply" | "overdue_next" | "tour_48h" | "app_active";

const NO_FIRST_REPLY_STALE_MS = 2 * 60 * 60 * 1000;

function leadMatchesWorkQueue(l: LeadBrief, f: WorkQueueFilter): boolean {
  if (f === "all") return true;
  const now = Date.now();
  if (f === "no_first_reply") {
    if (l.firstResponseAt) return false;
    return now - new Date(l.createdAt).getTime() >= NO_FIRST_REPLY_STALE_MS;
  }
  if (f === "overdue_next") {
    if (!l.nextActionAt) return false;
    return new Date(l.nextActionAt).getTime() < now;
  }
  if (f === "tour_48h") {
    const t = l.tours[0]?.scheduledAt;
    if (!t) return false;
    const ts = new Date(t).getTime();
    return ts >= now - 3_600_000 && ts <= now + 48 * 3_600_000;
  }
  if (f === "app_active") {
    const st = l.applications[0]?.status;
    return st === ApplicationStatus.SUBMITTED || st === ApplicationStatus.IN_REVIEW;
  }
  return true;
}

function workQueueUrgencyScore(l: LeadBrief): number {
  let s = 0;
  const now = Date.now();
  if (l.nextActionAt && new Date(l.nextActionAt).getTime() < now) s += 100;
  if (!l.firstResponseAt && now - new Date(l.createdAt).getTime() >= NO_FIRST_REPLY_STALE_MS) s += 80;
  const t = l.tours[0]?.scheduledAt;
  if (t) {
    const ts = new Date(t).getTime();
    if (ts >= now - 3_600_000 && ts <= now + 48 * 3_600_000) s += 50;
  }
  const st = l.applications[0]?.status;
  if (st === ApplicationStatus.IN_REVIEW || st === ApplicationStatus.SUBMITTED) s += 30;
  return s;
}

function workQueueBadges(l: LeadBrief): { key: string; label: string; className: string }[] {
  const out: { key: string; label: string; className: string }[] = [];
  const now = Date.now();
  if (l.nextActionAt && new Date(l.nextActionAt).getTime() < now) {
    out.push({ key: "due", label: "Due", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" });
  }
  if (!l.firstResponseAt && now - new Date(l.createdAt).getTime() >= NO_FIRST_REPLY_STALE_MS) {
    out.push({
      key: "noreply",
      label: "No reply",
      className: "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200",
    });
  }
  const t = l.tours[0]?.scheduledAt;
  if (t) {
    const ts = new Date(t).getTime();
    if (ts >= now - 3_600_000 && ts <= now + 48 * 3_600_000) {
      out.push({ key: "tour", label: "Tour", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" });
    }
  }
  const st = l.applications[0]?.status;
  if (st === ApplicationStatus.IN_REVIEW || st === ApplicationStatus.SUBMITTED) {
    out.push({ key: "app", label: "App", className: "bg-violet-100 text-violet-900 dark:bg-violet-900/30 dark:text-violet-200" });
  }
  return out;
}

type MessageRow = {
  id: string;
  direction: string;
  channel: string;
  body: string;
  sentAt: string;
  authorType: string;
  isAiGenerated: boolean;
  authorUser?: { name: string | null; email: string } | null;
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
  const [stage, setStage] = useState<LeadInboxStage>(LeadInboxStage.NEW_INQUIRY);
  const [channelFilter, setChannelFilter] = useState<ListingChannelType | "ALL">("ALL");
  const [workQueueFilter, setWorkQueueFilter] = useState<WorkQueueFilter>("all");
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

  const leadsRaw = useMemo(() => leadsQuery.data?.leads ?? [], [leadsQuery.data]);

  const leads = useMemo(() => {
    const filtered =
      workQueueFilter === "all"
        ? leadsRaw
        : leadsRaw.filter((l) => leadMatchesWorkQueue(l, workQueueFilter));
    return [...filtered].sort((a, b) => {
      const u = workQueueUrgencyScore(b) - workQueueUrgencyScore(a);
      if (u !== 0) return u;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [leadsRaw, workQueueFilter]);

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
                    setWorkQueueFilter("all");
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
              setWorkQueueFilter("all");
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
          <div className="flex flex-wrap gap-1 border-b px-2 pb-2">
            {(
              [
                ["all", "All"],
                ["no_first_reply", "No reply"],
                ["overdue_next", "Due"],
                ["tour_48h", "Tour 48h"],
                ["app_active", "App"],
              ] as const
            ).map(([id, label]) => (
              <Button
                key={id}
                type="button"
                size="sm"
                variant={workQueueFilter === id ? "default" : "outline"}
                className="h-7 px-2 text-[10px]"
                onClick={() => {
                  setWorkQueueFilter(id);
                  setSelectedLeadId(null);
                }}
              >
                {label}
              </Button>
            ))}
          </div>
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
                  {workQueueFilter === "all"
                    ? "No leads in this queue."
                    : "No leads match this work queue filter."}
                </p>
              ) : (
                <ul className="space-y-1">
                  {leads.map((l) => {
                    const isActive = activeLeadId === l.id;
                    const priority = l.prioritySignal;
                    const hasEscalation = (l.escalationFlags?.length ?? 0) > 0;
                    const badges = workQueueBadges(l);
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
                              {l.automationPaused ? (
                                <span className="text-destructive ml-1 text-[10px] font-normal" title="Automation paused">
                                  (auto off)
                                </span>
                              ) : null}
                            </span>
                            <span className="flex flex-wrap items-center justify-end gap-0.5 shrink-0">
                              {badges.map((b) => (
                                <span
                                  key={b.key}
                                  className={cn("rounded px-1 py-0 text-[9px] font-medium", b.className)}
                                >
                                  {b.label}
                                </span>
                              ))}
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
                              <PriorityIndicator
                                tier={priority.priorityTier as "URGENT" | "HIGH" | "NORMAL" | "LOW" | "COLD"}
                                isAtRisk={priority.isAtRisk}
                                needsImmediateResponse={priority.needsImmediateResponse}
                              />
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
                <ConversationThread messages={detail?.conversation?.messages ?? []} />
                <Link
                  href={activeLeadId ? `/leasing/leads/${activeLeadId}` : "#"}
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                >
                  Open full workspace
                </Link>
              </div>
            )}
          </ScrollArea>
          {detail?.lead ? (
            <InlineOutboundComposer
              leadId={detail.lead.id}
              onDone={() => {
                void qc.invalidateQueries({ queryKey: ["lead-detail", detail.lead.id] });
                void qc.invalidateQueries({ queryKey: ["leads", "inbox"] });
              }}
            />
          ) : null}
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

              <details open className="rounded-md border border-border/60 bg-background/50 p-2">
                <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reply tools</summary>
                <div className="mt-3 space-y-3">
                  {detail.conversation && (
                    <ReplyDraftPanel
                      draft={detail.copilotContext?.activeDraft ?? null}
                      conversationId={detail.conversation.id}
                      onSent={() => {
                        void qc.invalidateQueries({ queryKey: ["lead-detail", detail.lead.id] });
                      }}
                    />
                  )}

                  {detail.copilotContext && (
                    <SuggestedActionCard actions={detail.copilotContext.pendingActions} />
                  )}

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
                </div>
              </details>

              <details className="rounded-md border border-border/60 bg-background/50 p-2">
                <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted-foreground">Qualification and listing</summary>
                <div className="mt-3 space-y-3">
                  {detail.copilotContext && (
                    <QualificationSnapshot qualifications={detail.copilotContext.qualifications} />
                  )}

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

                </div>
              </details>

              <details className="rounded-md border border-border/60 bg-background/50 p-2">
                <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted-foreground">Activity</summary>
                <div className="mt-3">
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
              </details>
            </div>
          )}
        </ScrollArea>
      </aside>
    </div>
  );
}


function InlineOutboundComposer({ leadId, onDone }: { leadId: string; onDone: () => void }) {
  const [state, action, pending] = useActionState(logOutboundMessageAction, null);
  useEffect(() => {
    if (state?.ok) onDone();
  }, [state?.ok, onDone]);

  return (
    <div className="border-border border-t p-3">
      <form action={action} className="space-y-2">
        <input type="hidden" name="leadId" value={leadId} />
        <input type="hidden" name="channel" value="EMAIL" />
        <Textarea name="body" rows={3} placeholder="Write a quick follow-up..." required />
        <div className="flex items-center justify-between gap-2">
          {state && !state.ok ? (
            <p className="text-destructive text-xs">{state.message}</p>
          ) : (
            <span className="text-muted-foreground text-xs">Sends as outbound email log.</span>
          )}
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Sending..." : "Send"}
          </Button>
        </div>
      </form>
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
