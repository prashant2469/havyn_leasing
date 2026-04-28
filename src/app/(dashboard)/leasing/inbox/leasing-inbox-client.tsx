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
import { EscalationBadge } from "@/components/ai/escalation-badge";
import { PriorityIndicator } from "@/components/ai/priority-indicator";
import { QualificationSnapshot } from "@/components/ai/qualification-snapshot";
import { ReplyDraftPanel } from "@/components/ai/reply-draft-panel";
import { SuggestedActionCard } from "@/components/ai/suggested-action-card";
import { ConversationThread } from "@/components/communications/conversation-thread";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { replyModeLabel } from "@/domains/channels/constants";
import { leadStatusLabel } from "@/domains/leasing/constants";
import {
  COMBINED_NEW_NAV_ID,
  type InboxNavId,
  inboxBoardOrder,
  inboxStageLabel,
  labelForInboxNavId,
  stageColor,
  stagesForInboxNavId,
} from "@/domains/leasing/inbox";
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
  _count?: { recommendations: number };
};

type WorkQueueFilter = "all" | "needs_attention";

const NO_FIRST_REPLY_STALE_MS = 2 * 60 * 60 * 1000;

function leadMatchesWorkQueue(l: LeadBrief, f: WorkQueueFilter): boolean {
  if (f === "all") return true;
  return leadNeedsAttention(l);
}

function leadNeedsAttention(l: LeadBrief): boolean {
  return (
    leadHasNoFirstReply(l) ||
    leadHasOverdueNextAction(l) ||
    leadHasTourInNext48h(l) ||
    leadHasActiveApplication(l)
  );
}

function leadHasNoFirstReply(l: LeadBrief): boolean {
  if (l.firstResponseAt) return false;
  return Date.now() - new Date(l.createdAt).getTime() >= NO_FIRST_REPLY_STALE_MS;
}

function leadHasOverdueNextAction(l: LeadBrief): boolean {
  if (!l.nextActionAt) return false;
  return new Date(l.nextActionAt).getTime() < Date.now();
}

function leadHasTourInNext48h(l: LeadBrief): boolean {
  const t = l.tours[0]?.scheduledAt;
  if (!t) return false;
  const ts = new Date(t).getTime();
  const now = Date.now();
  return ts >= now - 3_600_000 && ts <= now + 48 * 3_600_000;
}

function leadHasActiveApplication(l: LeadBrief): boolean {
  const st = l.applications[0]?.status;
  return st === ApplicationStatus.SUBMITTED || st === ApplicationStatus.IN_REVIEW;
}

function workQueueUrgencyScore(l: LeadBrief): number {
  let s = 0;
  if (leadHasOverdueNextAction(l)) s += 100;
  if (leadHasNoFirstReply(l)) s += 80;
  if (leadHasTourInNext48h(l)) s += 50;
  if (leadHasActiveApplication(l)) s += 30;
  return s;
}

function workQueueBadges(l: LeadBrief): { key: string; label: string; className: string }[] {
  const out: { key: string; label: string; className: string }[] = [];
  if (leadHasOverdueNextAction(l)) {
    out.push({
      key: "due",
      label: "Due",
      className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    });
  }
  if (leadHasNoFirstReply(l)) {
    out.push({
      key: "noreply",
      label: "No reply",
      className: "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200",
    });
  }
  if (leadHasTourInNext48h(l)) {
    out.push({
      key: "tour",
      label: "Tour",
      className: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",
    });
  }
  if (leadHasActiveApplication(l)) {
    out.push({
      key: "app",
      label: "App",
      className: "bg-violet-100 text-violet-900 dark:bg-violet-900/30 dark:text-violet-200",
    });
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
    <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", colors[mode])}>
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

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const absMin = Math.round(diffMs / 60_000);
  if (absMin < 60) return `${absMin}m ago`;
  const absHr = Math.round(absMin / 60);
  if (absHr < 24) return `${absHr}h ago`;
  const absDay = Math.round(absHr / 24);
  return `${absDay}d ago`;
}

function stageForLead(l: LeadBrief): InboxNavId {
  if (l.inboxStage === LeadInboxStage.NEW_INQUIRY || l.inboxStage === LeadInboxStage.NEW_LEADS) {
    return COMBINED_NEW_NAV_ID;
  }
  return l.inboxStage;
}

function cardAccentClass(stage: InboxNavId) {
  if (stage === COMBINED_NEW_NAV_ID) return "border-l-blue-500";
  if (stage === LeadInboxStage.AWAITING_RESPONSE) return "border-l-amber-500";
  if (stage === LeadInboxStage.TOUR_SCHEDULED) return "border-l-cyan-500";
  if (stage === LeadInboxStage.APPLICATION_STARTED) return "border-l-violet-500";
  if (stage === LeadInboxStage.NEEDS_HUMAN_REVIEW) return "border-l-orange-500";
  return "border-l-slate-500";
}

export function LeasingInboxClient() {
  const qc = useQueryClient();
  const [channelFilter, setChannelFilter] = useState<ListingChannelType | "ALL">("ALL");
  const [workQueueFilter, setWorkQueueFilter] = useState<WorkQueueFilter>("needs_attention");
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const leadsQuery = useQuery({
    queryKey: ["leads", "inbox-board", channelFilter],
    queryFn: async () => {
      const url = new URL("/api/leads", window.location.origin);
      const allStages = Array.from(
        new Set(inboxBoardOrder.flatMap((id) => stagesForInboxNavId(id))),
      );
      url.searchParams.set("stages", allStages.join(","));
      if (channelFilter !== "ALL") url.searchParams.set("channel", channelFilter);
      const res = await fetch(url.toString());
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load inbox");
      return json as { leads: LeadBrief[] };
    },
  });

  const leadsRaw = useMemo(() => leadsQuery.data?.leads ?? [], [leadsQuery.data]);

  const leads = useMemo(() => {
    const filtered = leadsRaw.filter((l) => leadMatchesWorkQueue(l, workQueueFilter));
    return [...filtered].sort((a, b) => {
      const u = workQueueUrgencyScore(b) - workQueueUrgencyScore(a);
      if (u !== 0) return u;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [leadsRaw, workQueueFilter]);

  const leadsByStage = useMemo(() => {
    const map: Record<InboxNavId, LeadBrief[]> = {
      [COMBINED_NEW_NAV_ID]: [],
      [LeadInboxStage.NEW_INQUIRY]: [],
      [LeadInboxStage.NEW_LEADS]: [],
      [LeadInboxStage.AWAITING_RESPONSE]: [],
      [LeadInboxStage.TOUR_SCHEDULED]: [],
      [LeadInboxStage.APPLICATION_STARTED]: [],
      [LeadInboxStage.NEEDS_HUMAN_REVIEW]: [],
      [LeadInboxStage.COLD_LEADS]: [],
    };
    for (const lead of leads) {
      map[stageForLead(lead)].push(lead);
    }
    return map;
  }, [leads]);

  const detailQueryActive = useQuery({
    queryKey: ["lead-detail", selectedLeadId],
    enabled: Boolean(selectedLeadId),
    queryFn: async () => {
      const res = await fetch(`/api/leads/${selectedLeadId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load lead");
      return json as LeadDetail;
    },
  });

  const detail = detailQueryActive.data;

  return (
    <div className="space-y-4">
      <div className="border-border bg-muted/20 flex flex-wrap items-center gap-2 rounded-lg border p-3">
        <Badge variant="outline">Pipeline board</Badge>
        <Button
          type="button"
          size="sm"
          variant={workQueueFilter === "needs_attention" ? "default" : "outline"}
          onClick={() => setWorkQueueFilter("needs_attention")}
        >
          Needs attention
        </Button>
        <Button
          type="button"
          size="sm"
          variant={workQueueFilter === "all" ? "default" : "outline"}
          onClick={() => setWorkQueueFilter("all")}
        >
          Show all
        </Button>
        <div className="ml-auto w-full sm:w-52">
          <select
            className={nativeSelectClass}
            value={channelFilter}
            onChange={(e) => {
              setChannelFilter(e.target.value as ListingChannelType | "ALL");
              setSelectedLeadId(null);
              setSheetOpen(false);
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
      </div>

      {leadsQuery.isLoading ? (
        <div className="rounded-lg border p-6 text-sm text-muted-foreground">Loading inbox board…</div>
      ) : leadsQuery.isError ? (
        <div className="rounded-lg border p-6 text-sm text-destructive">
          {leadsQuery.error instanceof Error ? leadsQuery.error.message : "Could not load inbox board"}
        </div>
      ) : (
        <div className="overflow-x-auto pb-2">
          <div className="grid min-w-[1180px] grid-cols-6 gap-3">
            {inboxBoardOrder.map((stage) => {
              const stageLeads = leadsByStage[stage] ?? [];
              return (
                <section key={stage} className="border-border bg-card min-h-[620px] rounded-lg border">
                  <header
                    className={cn(
                      "sticky top-0 z-10 flex items-center justify-between rounded-t-lg border-b px-3 py-2 text-xs font-semibold uppercase tracking-wide",
                      stageColor[stage],
                    )}
                  >
                    <span>{labelForInboxNavId(stage)}</span>
                    <span className="rounded bg-background/70 px-1.5 py-0.5 text-[10px] font-medium">
                      {stageLeads.length}
                    </span>
                  </header>
                  <ScrollArea className="h-[560px]">
                    <div className="space-y-2 p-2">
                      {stageLeads.length === 0 ? (
                        <p className="px-2 py-3 text-xs text-muted-foreground">No leads in this stage.</p>
                      ) : (
                        stageLeads.map((lead) => {
                          const priority = lead.prioritySignal;
                          const badges = workQueueBadges(lead);
                          const hasEscalation = (lead.escalationFlags?.length ?? 0) > 0;
                          const isActive = selectedLeadId === lead.id && sheetOpen;
                          const cardStage = stageForLead(lead);

                          return (
                            <button
                              key={lead.id}
                              type="button"
                              onClick={() => {
                                setSelectedLeadId(lead.id);
                                setSheetOpen(true);
                              }}
                              className={cn(
                                "hover:bg-muted/40 w-full rounded-md border border-border bg-background p-2 text-left transition-colors",
                                "border-l-4",
                                cardAccentClass(cardStage),
                                isActive && "ring-1 ring-primary/50",
                              )}
                            >
                              <div className="flex items-start justify-between gap-1">
                                <p className="truncate text-sm font-semibold">
                                  {lead.firstName} {lead.lastName}
                                </p>
                                {hasEscalation ? (
                                  <span
                                    className="h-2 w-2 shrink-0 rounded-full bg-red-500"
                                    title="Escalation open"
                                  />
                                ) : null}
                              </div>
                              <p className="truncate text-xs text-muted-foreground">
                                {lead.listing?.title ??
                                  (lead.primaryUnit ? `Unit ${lead.primaryUnit.unitNumber}` : "—")}
                              </p>
                              <div className="mt-2 flex flex-wrap items-center gap-1">
                                {badges.map((b) => (
                                  <span
                                    key={b.key}
                                    className={cn("rounded px-1 py-0 text-[9px] font-medium", b.className)}
                                  >
                                    {b.label}
                                  </span>
                                ))}
                                {(lead._count?.recommendations ?? 0) > 0 ? (
                                  <span className="rounded bg-blue-100 px-1 py-0 text-[9px] font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                    {lead._count?.recommendations} recs
                                  </span>
                                ) : null}
                                <ChannelBadge channelType={lead.sourceChannelType} />
                              </div>
                              {priority && priority.priorityTier !== "NORMAL" ? (
                                <div className="mt-2">
                                  <PriorityIndicator
                                    tier={
                                      priority.priorityTier as
                                        | "URGENT"
                                        | "HIGH"
                                        | "NORMAL"
                                        | "LOW"
                                        | "COLD"
                                    }
                                    isAtRisk={priority.isAtRisk}
                                    needsImmediateResponse={priority.needsImmediateResponse}
                                  />
                                </div>
                              ) : null}
                              <p className="mt-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                                Updated {timeAgo(lead.updatedAt)}
                              </p>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </ScrollArea>
                </section>
              );
            })}
          </div>
        </div>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-3xl" showCloseButton>
          <SheetHeader className="border-b px-4 py-3">
            {!selectedLeadId ? (
              <>
                <SheetTitle>Lead details</SheetTitle>
                <SheetDescription>Select a lead from the board.</SheetDescription>
              </>
            ) : detailQueryActive.isLoading ? (
              <>
                <SheetTitle>Loading lead…</SheetTitle>
                <SheetDescription>Fetching conversation and context.</SheetDescription>
              </>
            ) : !detail ? (
              <>
                <SheetTitle>Lead unavailable</SheetTitle>
                <SheetDescription>Try another lead card.</SheetDescription>
              </>
            ) : (
              <>
                <SheetTitle>
                  {detail.lead.firstName} {detail.lead.lastName}
                </SheetTitle>
                <SheetDescription>
                  {detail.lead.email ?? "No email"} · {detail.lead.phone ?? "No phone"}
                </SheetDescription>
              </>
            )}
          </SheetHeader>

          {!selectedLeadId ? null : detailQueryActive.isLoading ? (
            <div className="p-4 text-sm text-muted-foreground">Loading context…</div>
          ) : !detail ? (
            <div className="p-4 text-sm text-muted-foreground">Could not load lead context.</div>
          ) : (
            <div className="grid min-h-0 flex-1 gap-0 md:grid-cols-[1fr_300px]">
              <section className="border-border flex min-h-0 flex-col border-r">
                <div className="border-border flex items-center gap-2 border-b px-3 py-2">
                  <Badge variant="secondary">{leadStatusLabel[detail.lead.status]}</Badge>
                  <Badge variant="outline">{inboxStageLabel[detail.lead.inboxStage]}</Badge>
                  {detail.lead.sourceChannelType && (
                    <ChannelBadge channelType={detail.lead.sourceChannelType} />
                  )}
                  <div className="ml-auto flex items-center gap-2">
                    {detail.conversation?.channelType && (
                      <ChannelBadge channelType={detail.conversation.channelType} />
                    )}
                    {detail.conversation ? (
                      <ReplyModeBadge mode={detail.conversation.replyMode} />
                    ) : null}
                  </div>
                </div>

                {detail.replyStrategy ? (
                  <div className="border-border bg-muted/20 border-b px-3 py-1.5 text-xs">
                    <span className="text-muted-foreground">{detail.replyStrategy.hint}</span>
                  </div>
                ) : null}

                <ScrollArea className="flex-1 p-3">
                  <div className="space-y-4">
                    <ConversationThread messages={detail.conversation?.messages ?? []} />
                    <Link
                      href={`/leasing/leads/${detail.lead.id}`}
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                    >
                      Open full workspace
                    </Link>
                  </div>
                </ScrollArea>

                <InlineOutboundComposer
                  leadId={detail.lead.id}
                  onDone={() => {
                    void qc.invalidateQueries({ queryKey: ["lead-detail", detail.lead.id] });
                    void qc.invalidateQueries({ queryKey: ["leads", "inbox-board"] });
                  }}
                />
              </section>

              <aside className="bg-muted/10 min-h-0">
                <ScrollArea className="h-full p-3">
                  <div className="space-y-3 text-sm">
                    {detail.conversation ? (
                      <ConversationSummaryCard
                        summary={detail.copilotContext?.summary ?? null}
                        leadId={detail.lead.id}
                        conversationId={detail.conversation.id}
                        compact
                      />
                    ) : null}

                    {detail.copilotContext?.prioritySignal ? (
                      <PriorityIndicator
                        tier={detail.copilotContext.prioritySignal.priorityTier}
                        isHotLead={detail.copilotContext.prioritySignal.isHotLead}
                        isAtRisk={detail.copilotContext.prioritySignal.isAtRisk}
                        needsImmediateResponse={detail.copilotContext.prioritySignal.needsImmediateResponse}
                        showFlags
                      />
                    ) : null}

                    {detail.copilotContext?.openEscalations?.length ? (
                      <EscalationBadge flags={detail.copilotContext.openEscalations} />
                    ) : null}

                    <details open className="rounded-md border border-border/60 bg-background p-2">
                      <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Reply tools
                      </summary>
                      <div className="mt-3 space-y-3">
                        {detail.conversation ? (
                          <ReplyDraftPanel
                            draft={detail.copilotContext?.activeDraft ?? null}
                            conversationId={detail.conversation.id}
                            onSent={() => {
                              void qc.invalidateQueries({ queryKey: ["lead-detail", detail.lead.id] });
                            }}
                          />
                        ) : null}

                        {detail.copilotContext ? (
                          <SuggestedActionCard actions={detail.copilotContext.pendingActions} />
                        ) : null}

                        {detail.conversation ? (
                          <ReplyModeForm
                            key={`${detail.conversation.id}-${detail.conversation.replyMode}`}
                            conversationId={detail.conversation.id}
                            currentMode={detail.conversation.replyMode}
                            onDone={() => {
                              void qc.invalidateQueries({ queryKey: ["lead-detail", detail.lead.id] });
                            }}
                          />
                        ) : null}

                        <InboxMoveForm
                          key={`${detail.lead.id}-${detail.lead.inboxStage}`}
                          leadId={detail.lead.id}
                          initialStage={detail.lead.inboxStage}
                          onDone={() => {
                            void qc.invalidateQueries({ queryKey: ["leads", "inbox-board"] });
                            void qc.invalidateQueries({ queryKey: ["lead-detail", detail.lead.id] });
                          }}
                        />
                      </div>
                    </details>

                    <details className="rounded-md border border-border/60 bg-background p-2">
                      <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Qualification and listing
                      </summary>
                      <div className="mt-3 space-y-3">
                        {detail.copilotContext ? (
                          <QualificationSnapshot qualifications={detail.copilotContext.qualifications} />
                        ) : null}
                        <div>
                          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Listing
                          </p>
                          {detail.lead.listing ? (
                            <p>
                              {detail.lead.listing.title}
                              <span className="block text-xs text-muted-foreground">
                                {detail.lead.listing.unit.property.name} ·{" "}
                                {detail.lead.listing.unit.unitNumber}
                              </span>
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground">No listing linked.</p>
                          )}
                        </div>
                        {detail.lead.tours.length > 0 ? (
                          <div>
                            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
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
                        ) : null}
                      </div>
                    </details>

                    <details className="rounded-md border border-border/60 bg-background p-2">
                      <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Activity
                      </summary>
                      <div className="mt-3">
                        <ul className="max-h-40 space-y-1 overflow-auto text-xs">
                          {detail.activities.slice(0, 12).map((a) => (
                            <li key={a.id} className="text-muted-foreground">
                              <span className="font-mono text-foreground">{a.verb}</span> ·{" "}
                              {new Date(a.createdAt).toLocaleString()}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </details>
                  </div>
                </ScrollArea>
              </aside>
            </div>
          )}
        </SheetContent>
      </Sheet>
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
      {state && !state.success ? <p className="text-destructive text-xs">{state.error}</p> : null}
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
      {state && !state.ok ? <p className="text-destructive text-xs">{state.message}</p> : null}
    </form>
  );
}
