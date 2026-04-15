"use client";

import {
  AIActionStatus,
  AIActionType,
  AIEscalationFlag,
  AIReplyDraft,
  AISuggestedAction,
  ApplicationStatus,
  ConversationReplyMode,
  ConversationSummary,
  LeadInboxStage,
  LeadPrioritySignal,
  LeadStatus,
  ListingChannelType,
  MessageChannel,
  NextActionType,
  QualificationAnswer,
  TourStatus,
} from "@prisma/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";

import { ConversationSummaryCard } from "@/components/ai/conversation-summary-card";
import { EscalationBadge } from "@/components/ai/escalation-badge";
import { PriorityIndicator } from "@/components/ai/priority-indicator";
import { QualificationSnapshot } from "@/components/ai/qualification-snapshot";
import { ReplyDraftPanel } from "@/components/ai/reply-draft-panel";
import { SuggestedActionCard } from "@/components/ai/suggested-action-card";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { replyModeLabel } from "@/domains/channels/constants";
import { inboxStageLabel } from "@/domains/leasing/inbox";
import {
  applicationStatusLabel,
  leadStatusLabel,
  tourStatusLabel,
} from "@/domains/leasing/constants";
import { APPLICATION_INTAKE_LABELS } from "@/domains/leasing/application-intake";
import { channelTypeIcon, channelTypeLabel } from "@/domains/listings/constants";
import {
  createPlaceholderAIActionsAction,
  reviewAIActionAction,
} from "@/server/actions/ai-actions";
import { updateConversationReplyModeAction } from "@/server/actions/channel";
import { createApplicationAction, updateApplicationStatusAction } from "@/server/actions/applications";
import { requestHumanHandoffAction } from "@/server/actions/handoff";
import { createLeaseFromApplicationAction } from "@/server/actions/leases";
import { updateLeadInboxStageAction, updateLeadStatusAction } from "@/server/actions/leads";
import { logInboundPlaceholderAction, logOutboundMessageAction } from "@/server/actions/messages";
import { upsertQualificationAction } from "@/server/actions/qualification";
import { createTourAction, updateTourStatusAction } from "@/server/actions/tours";

const aiActionTypeLabel: Record<AIActionType, string> = {
  DRAFT_REPLY: "Draft reply",
  CONVERSATION_SUMMARY: "Summary",
  SUGGESTED_NEXT_ACTION: "Next action",
  QUALIFICATION_EXTRACT: "Qualification extract",
  ESCALATION_FLAG: "Escalation",
};

type LeadPayload = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  // V2 channel attribution
  sourceChannelType: ListingChannelType | null;
  sourceChannelRefId: string | null;
  sourceAttribution: unknown;
  firstResponseAt: string | null;
  lastResponseAt: string | null;
  status: LeadStatus;
  inboxStage: LeadInboxStage;
  nextActionAt: string | null;
  nextActionType: NextActionType | null;
  property: { id: string; name: string } | null;
  primaryUnit: { id: string; unitNumber: string } | null;
  listing: {
    id: string;
    title: string;
    status: string;
    unit: { unitNumber: string; property: { name: string } };
  } | null;
  tours: {
    id: string;
    scheduledAt: string;
    status: TourStatus;
    notes: string | null;
  }[];
  applications: {
    id: string;
    status: ApplicationStatus;
    payload: unknown;
    lease: { id: string; status: string } | null;
  }[];
  qualifications: { id: string; key: string; value: unknown; source: string }[];
};

type MessageRow = {
  id: string;
  direction: string;
  channel: string;
  body: string;
  sentAt: string;
  authorType: string;
  isAiGenerated: boolean;
  authorUser: { name: string | null; email: string } | null;
};

type ActivityRow = {
  id: string;
  verb: string;
  createdAt: string;
  actor: { name: string | null; email: string } | null;
  payloadAfter: unknown;
};

type AIActionRow = {
  id: string;
  type: AIActionType;
  status: AIActionStatus;
  content: unknown;
  createdAt: string;
  reviewedBy: { name: string | null } | null;
};

const nativeSelectClass =
  "border-input bg-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-2";

type CopilotContext = {
  summary: ConversationSummary | null;
  activeDraft: AIReplyDraft | null;
  pendingActions: AISuggestedAction[];
  openEscalations: AIEscalationFlag[];
  prioritySignal: LeadPrioritySignal | null;
  qualifications: QualificationAnswer[];
};

type IntakeDefaults = Partial<Record<keyof typeof APPLICATION_INTAKE_LABELS, string>>;

function intakeDefaultsFromQualifications(
  qualifications: { key: string; value: unknown }[],
): IntakeDefaults {
  const byKey = Object.fromEntries(qualifications.map((q) => [q.key, q.value]));
  const out: IntakeDefaults = {};
  if (byKey.moveInDate != null) {
    const s = String(byKey.moveInDate);
    out.desiredLeaseStart = s.length >= 10 ? s.slice(0, 10) : s;
  }
  if (byKey.occupants != null) {
    const n = Number(byKey.occupants);
    if (Number.isFinite(n)) out.occupants = String(Math.trunc(n));
  }
  if (byKey.pets != null) {
    out.petsDescription = String(byKey.pets);
  }
  if (byKey.monthlyBudget != null) {
    const n = Number(byKey.monthlyBudget);
    if (Number.isFinite(n)) out.monthlyIncome = String(n);
  }
  return out;
}

function applicationIntakeHasContent(payload: unknown): boolean {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return false;
  return Object.values(payload as Record<string, unknown>).some((v) => {
    if (v === undefined || v === null) return false;
    if (typeof v === "number") return true;
    return String(v).trim() !== "";
  });
}

function ApplicationIntakeReadback({ payload }: { payload: unknown }) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return <p className="text-muted-foreground text-sm">No intake details saved.</p>;
  }
  const p = payload as Record<string, unknown>;
  const knownKeys = Object.keys(APPLICATION_INTAKE_LABELS) as (keyof typeof APPLICATION_INTAKE_LABELS)[];
  const lines: { label: string; value: string }[] = [];
  for (const key of knownKeys) {
    const v = p[key];
    if (v === undefined || v === null) continue;
    const s = typeof v === "number" ? String(v) : String(v).trim();
    if (!s) continue;
    lines.push({ label: APPLICATION_INTAKE_LABELS[key], value: s });
  }
  const known = new Set(knownKeys as unknown as string[]);
  const extras = Object.entries(p).filter(([k]) => !known.has(k));

  return (
    <div className="space-y-4 text-sm">
      {lines.length === 0 && extras.length === 0 ? (
        <p className="text-muted-foreground">No intake fields recorded.</p>
      ) : (
        <dl className="grid gap-3 sm:grid-cols-2">
          {lines.map(({ label, value }) => (
            <div key={label} className="space-y-0.5">
              <dt className="text-muted-foreground text-xs font-medium">{label}</dt>
              <dd className="text-foreground break-words">{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {extras.length > 0 ? (
        <div className="space-y-2 border-t pt-3">
          <p className="text-muted-foreground text-xs font-medium">Additional data</p>
          <ul className="text-muted-foreground list-disc space-y-1 pl-4 text-xs">
            {extras.map(([k, v]) => (
              <li key={k}>
                <span className="font-mono">{k}</span>:{" "}
                {typeof v === "object" ? JSON.stringify(v) : String(v)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function ApplicationCreateForm({
  leadId,
  defaults,
  onDone,
}: {
  leadId: string;
  defaults: IntakeDefaults;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(createApplicationAction, null);
  useEffect(() => {
    if (state?.ok) onDone();
  }, [state?.ok, onDone]);
  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="leadId" value={leadId} />
      {state && !state.ok ? <p className="text-destructive text-sm">{state.message}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <p className="text-muted-foreground text-xs">
            All fields are optional. Anything you enter is stored on the application record for your team.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="employer">Employer</Label>
          <Input id="employer" name="employer" defaultValue={defaults.employer} autoComplete="organization" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="jobTitle">Job title</Label>
          <Input id="jobTitle" name="jobTitle" defaultValue={defaults.jobTitle} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="monthlyIncome">Monthly income</Label>
          <Input
            id="monthlyIncome"
            name="monthlyIncome"
            type="number"
            min={0}
            step={1}
            defaultValue={defaults.monthlyIncome}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="otherIncome">Other income</Label>
          <Input
            id="otherIncome"
            name="otherIncome"
            type="number"
            min={0}
            step={1}
            defaultValue={defaults.otherIncome}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="desiredLeaseStart">Desired lease start</Label>
          <Input id="desiredLeaseStart" name="desiredLeaseStart" type="date" defaultValue={defaults.desiredLeaseStart} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="leaseTermMonths">Lease term (months)</Label>
          <Input
            id="leaseTermMonths"
            name="leaseTermMonths"
            type="number"
            min={1}
            max={120}
            step={1}
            defaultValue={defaults.leaseTermMonths}
            placeholder="e.g. 12"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="occupants">Occupants</Label>
          <Input
            id="occupants"
            name="occupants"
            type="number"
            min={1}
            max={50}
            step={1}
            defaultValue={defaults.occupants}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="petsDescription">Pets</Label>
          <Textarea id="petsDescription" name="petsDescription" rows={2} defaultValue={defaults.petsDescription} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="vehicleParking">Vehicle / parking</Label>
          <Input id="vehicleParking" name="vehicleParking" defaultValue={defaults.vehicleParking} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="emergencyContactName">Emergency contact name</Label>
          <Input id="emergencyContactName" name="emergencyContactName" defaultValue={defaults.emergencyContactName} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="emergencyContactPhone">Emergency contact phone</Label>
          <Input
            id="emergencyContactPhone"
            name="emergencyContactPhone"
            type="tel"
            defaultValue={defaults.emergencyContactPhone}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="additionalNotes">Additional notes</Label>
          <Textarea id="additionalNotes" name="additionalNotes" rows={3} defaultValue={defaults.additionalNotes} />
        </div>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Starting…" : "Start application"}
      </Button>
    </form>
  );
}

export function LeadWorkspace({
  lead,
  conversation,
  activities,
  aiActions,
  copilotContext,
  residents,
  properties,
}: {
  lead: LeadPayload;
  conversation: {
    id: string;
    channelType: ListingChannelType | null;
    replyMode: ConversationReplyMode;
    externalThreadId: string | null;
    messages: MessageRow[];
  } | null;
  activities: ActivityRow[];
  aiActions: AIActionRow[];
  copilotContext: CopilotContext | null;
  residents: { id: string; firstName: string; lastName: string }[];
  properties: {
    id: string;
    name: string;
    units: { id: string; unitNumber: string }[];
  }[];
}) {
  const router = useRouter();
  const leadId = lead.id;

  const flatUnits = properties.flatMap((p) =>
    p.units.map((u) => ({ ...u, propertyName: p.name })),
  );

  const primaryApplication = lead.applications[0] ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${lead.firstName} ${lead.lastName}`}
        description="Leasing workspace: inbox stage, tours, application, communications, qualification, activity, and AI copilot (review-gated)."
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="default">{inboxStageLabel[lead.inboxStage]}</Badge>
        <Badge variant="secondary">{leadStatusLabel[lead.status]}</Badge>
        {lead.listing ? (
          <Badge variant="outline">
            {lead.listing.title} · {lead.listing.unit.property.name} #{lead.listing.unit.unitNumber}
          </Badge>
        ) : null}
        {lead.property ? <Badge variant="outline">{lead.property.name}</Badge> : null}
        {lead.primaryUnit ? <Badge variant="outline">Unit {lead.primaryUnit.unitNumber}</Badge> : null}
        {copilotContext?.prioritySignal && copilotContext.prioritySignal.priorityTier !== "NORMAL" && (
          <PriorityIndicator
            tier={copilotContext.prioritySignal.priorityTier}
            isHotLead={copilotContext.prioritySignal.isHotLead}
            isAtRisk={copilotContext.prioritySignal.isAtRisk}
            needsImmediateResponse={copilotContext.prioritySignal.needsImmediateResponse}
            showFlags
          />
        )}
        {copilotContext?.openEscalations && copilotContext.openEscalations.length > 0 && (
          <EscalationBadge flags={copilotContext.openEscalations} />
        )}
      </div>

      <Tabs defaultValue="overview" className="gap-4">
        <TabsList variant="line" className="flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="qualification">Qualification</TabsTrigger>
          <TabsTrigger value="tours">Tours</TabsTrigger>
          <TabsTrigger value="application">Application</TabsTrigger>
          <TabsTrigger value="communications">Communications</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="copilot">Copilot</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Contact</CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground space-y-1 text-sm">
                <p>Email: {lead.email ?? "—"}</p>
                <p>Phone: {lead.phone ?? "—"}</p>
                <p>Source: {lead.source ?? "—"}</p>
              </CardContent>
            </Card>

            {/* V2: Source attribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Channel attribution</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {lead.sourceChannelType ? (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Source channel:</span>
                      <span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs font-medium">
                        {channelTypeIcon[lead.sourceChannelType]}
                        {channelTypeLabel[lead.sourceChannelType]}
                      </span>
                    </div>
                    {lead.sourceChannelRefId && (
                      <p className="text-muted-foreground text-xs">
                        External ref: <code>{lead.sourceChannelRefId}</code>
                      </p>
                    )}
                    {lead.firstResponseAt && (
                      <p className="text-muted-foreground text-xs">
                        First contact:{" "}
                        {new Date(lead.firstResponseAt).toLocaleDateString()}
                      </p>
                    )}
                    {lead.lastResponseAt && (
                      <p className="text-muted-foreground text-xs">
                        Last response:{" "}
                        {new Date(lead.lastResponseAt).toLocaleDateString()}
                      </p>
                    )}
                    {conversation && (
                      <div className="flex items-center gap-2 pt-1">
                        <span className="text-muted-foreground">Reply mode:</span>
                        <span className="rounded bg-muted px-2 py-0.5 text-xs">
                          {replyModeLabel[conversation.replyMode]}
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-muted-foreground">
                    No structured channel attribution. Lead may have been created manually.
                  </p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Inbox queue</CardTitle>
              </CardHeader>
              <CardContent>
                <InboxStageForm
                  key={`${leadId}-inbox-${lead.inboxStage}`}
                  leadId={leadId}
                  initialStage={lead.inboxStage}
                  onDone={() => router.refresh()}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Pipeline status</CardTitle>
              </CardHeader>
              <CardContent>
                <LeadStatusForm
                  key={`${leadId}-status-${lead.status}`}
                  leadId={leadId}
                  initialStatus={lead.status}
                  onDone={() => router.refresh()}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Human handoff</CardTitle>
              </CardHeader>
              <CardContent>
                <HandoffForm leadId={leadId} onDone={() => router.refresh()} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="qualification" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Captured answers</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Key</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Source</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lead.qualifications.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-muted-foreground py-6 text-center">
                        No qualification data yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    lead.qualifications.map((q) => (
                      <TableRow key={q.id}>
                        <TableCell className="font-mono text-xs">{q.key}</TableCell>
                        <TableCell className="max-w-md text-sm">
                          {typeof q.value === "string"
                            ? q.value
                            : JSON.stringify(q.value, null, 0)}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">{q.source}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Add / update field</CardTitle>
            </CardHeader>
            <CardContent>
              <QualificationUpsertForm leadId={leadId} onDone={() => router.refresh()} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tours" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Schedule tour</CardTitle>
            </CardHeader>
            <CardContent>
              <TourCreateForm
                leadId={leadId}
                listingId={lead.listing?.id}
                onDone={() => router.refresh()}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tours</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="w-[200px]">Update</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lead.tours.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-muted-foreground py-6 text-center">
                        No tours scheduled.
                      </TableCell>
                    </TableRow>
                  ) : (
                    lead.tours.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell>
                          {new Date(t.scheduledAt).toLocaleString(undefined, {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </TableCell>
                        <TableCell>{tourStatusLabel[t.status]}</TableCell>
                        <TableCell className="max-w-xs truncate">{t.notes ?? "—"}</TableCell>
                        <TableCell>
                          <TourStatusForm
                            key={`${t.id}-${t.status}`}
                            tourId={t.id}
                            defaultStatus={t.status}
                            onDone={() => router.refresh()}
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="application" className="space-y-4">
          {!primaryApplication ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Application</CardTitle>
              </CardHeader>
              <CardContent>
                <ApplicationCreateForm
                  leadId={leadId}
                  defaults={intakeDefaultsFromQualifications(lead.qualifications)}
                  onDone={() => router.refresh()}
                />
              </CardContent>
            </Card>
          ) : (
            <>
              {applicationIntakeHasContent(primaryApplication.payload) ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Submitted application intake</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ApplicationIntakeReadback payload={primaryApplication.payload} />
                  </CardContent>
                </Card>
              ) : null}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Application status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground text-sm">
                    Current:{" "}
                    <strong>{applicationStatusLabel[primaryApplication.status]}</strong>
                    {primaryApplication.lease ? (
                      <>
                        {" "}
                        · Lease{" "}
                        <Link
                          className="text-primary underline"
                          href={`/leases/${primaryApplication.lease.id}`}
                        >
                          {primaryApplication.lease.id.slice(0, 8)}…
                        </Link>
                      </>
                    ) : null}
                  </p>
                  <ApplicationStatusForm
                    key={`${primaryApplication.id}-${primaryApplication.status}`}
                    applicationId={primaryApplication.id}
                    defaultStatus={primaryApplication.status}
                    onDone={() => router.refresh()}
                  />
                </CardContent>
              </Card>
              {primaryApplication.status === ApplicationStatus.APPROVED &&
              !primaryApplication.lease ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Create lease</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <LeaseCreateForm
                      applicationId={primaryApplication.id}
                      residents={residents}
                      units={flatUnits}
                      onDone={() => router.refresh()}
                    />
                  </CardContent>
                </Card>
              ) : null}
            </>
          )}
        </TabsContent>

        <TabsContent value="communications" className="space-y-4">
          {/* V2: Channel + reply mode context header */}
          {conversation && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Channel context</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap items-start gap-6 text-sm">
                <div className="space-y-1">
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">
                    Channel
                  </p>
                  {conversation.channelType ? (
                    <span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs font-medium">
                      {channelTypeIcon[conversation.channelType]}
                      {channelTypeLabel[conversation.channelType]}
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-xs">Unknown</span>
                  )}
                </div>
                <div className="space-y-1 min-w-[200px]">
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">
                    Reply mode
                  </p>
                  <ReplyModeUpdateForm
                    key={`${conversation.id}-${conversation.replyMode}`}
                    conversationId={conversation.id}
                    currentMode={conversation.replyMode}
                    onDone={() => router.refresh()}
                  />
                </div>
                {conversation.externalThreadId && (
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-xs uppercase tracking-wide">
                      External thread
                    </p>
                    <code className="text-xs">{conversation.externalThreadId}</code>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Thread</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[320px] pr-3">
                <div className="space-y-4">
                  {(conversation?.messages ?? []).length === 0 ? (
                    <p className="text-muted-foreground text-sm">No messages yet.</p>
                  ) : (
                    conversation!.messages.map((m) => (
                      <div key={m.id} className="space-y-1 text-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{m.direction}</Badge>
                          <Badge variant="secondary">{m.channel}</Badge>
                          <Badge variant={m.isAiGenerated ? "default" : "outline"}>
                            {m.isAiGenerated ? "AI" : m.authorType}
                          </Badge>
                          <span className="text-muted-foreground text-xs">
                            {new Date(m.sentAt).toLocaleString()}
                          </span>
                        </div>
                        <p className="whitespace-pre-wrap">{m.body}</p>
                        <Separator />
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Log outbound</CardTitle>
              </CardHeader>
              <CardContent>
                <OutboundForm leadId={leadId} onDone={() => router.refresh()} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Log inbound (manual)</CardTitle>
              </CardHeader>
              <CardContent>
                <InboundForm leadId={leadId} onDone={() => router.refresh()} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Activity log</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Verb</TableHead>
                    <TableHead>Actor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activities.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-muted-foreground py-6 text-center">
                        No activity yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    activities.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="whitespace-nowrap text-sm">
                          {new Date(a.createdAt).toLocaleString()}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{a.verb}</TableCell>
                        <TableCell>{a.actor?.name ?? a.actor?.email ?? "—"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="copilot" className="space-y-4">
          {/* Run Analysis */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Left column: summary + draft + actions */}
            <div className="space-y-4">
              {conversation ? (
                <>
                  <ConversationSummaryCard
                    summary={copilotContext?.summary ?? null}
                    leadId={leadId}
                    conversationId={conversation.id}
                  />
                  <ReplyDraftPanel
                    draft={copilotContext?.activeDraft ?? null}
                    conversationId={conversation.id}
                    onSent={() => router.refresh()}
                  />
                </>
              ) : (
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-muted-foreground text-sm">
                      No conversation yet. Ingest an inquiry first to enable AI analysis.
                    </p>
                  </CardContent>
                </Card>
              )}

              <SuggestedActionCard actions={copilotContext?.pendingActions ?? []} />
            </div>

            {/* Right column: qualification + priority + escalations */}
            <div className="space-y-4">
              <QualificationSnapshot qualifications={copilotContext?.qualifications ?? []} />

              {copilotContext?.prioritySignal && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Priority signal</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <PriorityIndicator
                      tier={copilotContext.prioritySignal.priorityTier}
                      isHotLead={copilotContext.prioritySignal.isHotLead}
                      isAtRisk={copilotContext.prioritySignal.isAtRisk}
                      needsImmediateResponse={copilotContext.prioritySignal.needsImmediateResponse}
                      isQualifiedForTour={copilotContext.prioritySignal.isQualifiedForTour}
                      showFlags
                    />
                    {copilotContext.prioritySignal.scoreRaw !== null && (
                      <p className="text-xs text-muted-foreground">
                        Score: {((copilotContext.prioritySignal.scoreRaw ?? 0) * 100).toFixed(0)}/100
                      </p>
                    )}
                    {Array.isArray(copilotContext.prioritySignal.signals) && (copilotContext.prioritySignal.signals as string[]).length > 0 && (
                      <ul className="text-xs text-muted-foreground space-y-0.5">
                        {(copilotContext.prioritySignal.signals as string[]).map((s) => (
                          <li key={s} className="flex items-center gap-1">
                            <span className="h-1 w-1 rounded-full bg-muted-foreground/50" />
                            {s}
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="text-xs text-muted-foreground/60">
                      Computed {new Date(copilotContext.prioritySignal.computedAt).toLocaleString()}
                    </p>
                  </CardContent>
                </Card>
              )}

              {copilotContext?.openEscalations && copilotContext.openEscalations.length > 0 && (
                <Card className="border-red-300 dark:border-red-800">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-red-600 dark:text-red-400">
                      Open escalations ({copilotContext.openEscalations.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <EscalationBadge flags={copilotContext.openEscalations} />
                  </CardContent>
                </Card>
              )}

              {!copilotContext && (
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-muted-foreground text-sm">
                      Run AI analysis from the Summary card above to populate all copilot signals.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* Legacy V1 AI Actions — kept for backward compat */}
          {aiActions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">Legacy V1 AI actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {aiActions.map((a) => (
                    <Card key={a.id}>
                      <CardHeader className="pb-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge>{aiActionTypeLabel[a.type]}</Badge>
                          <Badge variant="outline">{a.status}</Badge>
                          <span className="text-muted-foreground text-xs">
                            {new Date(a.createdAt).toLocaleString()}
                          </span>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <pre className="bg-muted max-h-32 overflow-auto rounded-md p-2 text-xs">
                          {JSON.stringify(a.content, null, 2)}
                        </pre>
                        {a.status === AIActionStatus.PENDING_REVIEW ? (
                          <div className="flex flex-wrap gap-2 mt-2">
                            <ReviewAIActionButton
                              actionId={a.id}
                              leadId={leadId}
                              decision={AIActionStatus.APPROVED}
                              label="Approve"
                              onDone={() => router.refresh()}
                            />
                            <ReviewAIActionButton
                              actionId={a.id}
                              leadId={leadId}
                              decision={AIActionStatus.REJECTED}
                              label="Reject"
                              variant="secondary"
                              onDone={() => router.refresh()}
                            />
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InboxStageForm({
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
    <form action={action} className="space-y-3">
      <input type="hidden" name="leadId" value={leadId} />
      <div className="space-y-2">
        <Label htmlFor="inbox-stage">Queue</Label>
        <select
          id="inbox-stage"
          name="inboxStage"
          required
          defaultValue={initialStage}
          className={nativeSelectClass}
        >
          {Object.values(LeadInboxStage).map((s) => (
            <option key={s} value={s}>
              {inboxStageLabel[s]}
            </option>
          ))}
        </select>
      </div>
      {state && !state.ok ? <p className="text-destructive text-sm">{state.message}</p> : null}
      <Button type="submit" size="sm" disabled={pending}>
        Move in inbox
      </Button>
    </form>
  );
}

function HandoffForm({ leadId, onDone }: { leadId: string; onDone: () => void }) {
  const [state, action, pending] = useActionState(requestHumanHandoffAction, null);
  useEffect(() => {
    if (state?.ok) onDone();
  }, [state?.ok, onDone]);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="leadId" value={leadId} />
      <div className="space-y-2">
        <Label htmlFor="handoff-reason">Reason (optional)</Label>
        <Input id="handoff-reason" name="reason" placeholder="e.g. pricing exception" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="to-user">Assign to user id (optional)</Label>
        <Input id="to-user" name="toUserId" placeholder="cuid…" />
      </div>
      {state && !state.ok ? <p className="text-destructive text-sm">{state.message}</p> : null}
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        Log handoff
      </Button>
    </form>
  );
}

function QualificationUpsertForm({ leadId, onDone }: { leadId: string; onDone: () => void }) {
  const [state, action, pending] = useActionState(upsertQualificationAction, null);
  useEffect(() => {
    if (state?.ok) onDone();
  }, [state?.ok, onDone]);
  return (
    <form action={action} className="grid max-w-lg gap-3">
      <input type="hidden" name="leadId" value={leadId} />
      <div className="space-y-2">
        <Label htmlFor="q-key">Key</Label>
        <Input id="q-key" name="key" required placeholder="monthlyIncome" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="q-value">Value (string or JSON)</Label>
        <Input id="q-value" name="value" required placeholder='5200 or {"min":5200}' />
      </div>
      {state && !state.ok ? <p className="text-destructive text-sm">{state.message}</p> : null}
      <Button type="submit" size="sm" disabled={pending}>
        Save
      </Button>
    </form>
  );
}

function LeadStatusForm({
  leadId,
  initialStatus,
  onDone,
}: {
  leadId: string;
  initialStatus: LeadStatus;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(updateLeadStatusAction, null);
  useEffect(() => {
    if (state?.ok) onDone();
  }, [state?.ok, onDone]);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="leadId" value={leadId} />
      <div className="space-y-2">
        <Label htmlFor="lead-status">Status</Label>
        <select
          id="lead-status"
          name="status"
          required
          defaultValue={initialStatus}
          className={nativeSelectClass}
        >
          {Object.values(LeadStatus).map((s) => (
            <option key={s} value={s}>
              {leadStatusLabel[s]}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="nextActionAt">Next action time</Label>
        <Input id="nextActionAt" name="nextActionAt" type="datetime-local" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="nextActionType">Next action type</Label>
        <select id="nextActionType" name="nextActionType" className={nativeSelectClass}>
          <option value="">None</option>
          {Object.values(NextActionType).map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      {state && !state.ok ? <p className="text-destructive text-sm">{state.message}</p> : null}
      <Button type="submit" size="sm" disabled={pending}>
        Update lead
      </Button>
    </form>
  );
}

function TourCreateForm({
  leadId,
  listingId,
  onDone,
}: {
  leadId: string;
  listingId?: string;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(createTourAction, null);
  useEffect(() => {
    if (state?.ok) onDone();
  }, [state?.ok, onDone]);
  return (
    <form action={action} className="flex max-w-md flex-col gap-3">
      <input type="hidden" name="leadId" value={leadId} />
      {listingId ? <input type="hidden" name="listingId" value={listingId} /> : null}
      <div className="space-y-2">
        <Label htmlFor="scheduledAt">Scheduled</Label>
        <Input id="scheduledAt" name="scheduledAt" type="datetime-local" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Input id="notes" name="notes" />
      </div>
      {state && !state.ok ? <p className="text-destructive text-sm">{state.message}</p> : null}
      <Button type="submit" disabled={pending}>
        Schedule
      </Button>
    </form>
  );
}

function TourStatusForm({
  tourId,
  defaultStatus,
  onDone,
}: {
  tourId: string;
  defaultStatus: TourStatus;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(updateTourStatusAction, null);
  useEffect(() => {
    if (state?.ok) onDone();
  }, [state?.ok, onDone]);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="tourId" value={tourId} />
      <select
        name="status"
        defaultValue={defaultStatus}
        className={`${nativeSelectClass} w-[160px]`}
      >
        {Object.values(TourStatus).map((s) => (
          <option key={s} value={s}>
            {tourStatusLabel[s]}
          </option>
        ))}
      </select>
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        Save
      </Button>
      {state && !state.ok ? (
        <span className="text-destructive text-xs">{state.message}</span>
      ) : null}
    </form>
  );
}

function ApplicationStatusForm({
  applicationId,
  defaultStatus,
  onDone,
}: {
  applicationId: string;
  defaultStatus: ApplicationStatus;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(updateApplicationStatusAction, null);
  useEffect(() => {
    if (state?.ok) onDone();
  }, [state?.ok, onDone]);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="applicationId" value={applicationId} />
      <select
        name="status"
        defaultValue={defaultStatus}
        className={`${nativeSelectClass} w-[200px]`}
      >
        {Object.values(ApplicationStatus).map((s) => (
          <option key={s} value={s}>
            {applicationStatusLabel[s]}
          </option>
        ))}
      </select>
      <Button type="submit" size="sm" disabled={pending}>
        Update
      </Button>
      {state && !state.ok ? (
        <span className="text-destructive text-xs">{state.message}</span>
      ) : null}
    </form>
  );
}

function LeaseCreateForm({
  applicationId,
  residents,
  units,
  onDone,
}: {
  applicationId: string;
  residents: { id: string; firstName: string; lastName: string }[];
  units: { id: string; unitNumber: string; propertyName: string }[];
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(createLeaseFromApplicationAction, null);
  useEffect(() => {
    if (state?.ok) onDone();
  }, [state?.ok, onDone]);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <form action={action} className="grid max-w-lg gap-3">
      <input type="hidden" name="applicationId" value={applicationId} />
      <div className="space-y-2">
        <Label htmlFor="residentId">Resident</Label>
        <select id="residentId" name="residentId" required className={nativeSelectClass}>
          <option value="">Select resident</option>
          {residents.map((r) => (
            <option key={r.id} value={r.id}>
              {r.firstName} {r.lastName}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="unitId">Unit</Label>
        <select id="unitId" name="unitId" required className={nativeSelectClass}>
          <option value="">Select unit</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.propertyName} · {u.unitNumber}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="startDate">Start</Label>
          <Input id="startDate" name="startDate" type="date" required defaultValue={today} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="endDate">End</Label>
          <Input id="endDate" name="endDate" type="date" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="rentAmount">Rent</Label>
          <Input id="rentAmount" name="rentAmount" type="number" step="0.01" min="0" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="depositAmount">Deposit</Label>
          <Input id="depositAmount" name="depositAmount" type="number" step="0.01" min="0" />
        </div>
      </div>
      {state && !state.ok ? <p className="text-destructive text-sm">{state.message}</p> : null}
      <Button type="submit" disabled={pending}>
        Create lease
      </Button>
    </form>
  );
}

function OutboundForm({ leadId, onDone }: { leadId: string; onDone: () => void }) {
  const [state, action, pending] = useActionState(logOutboundMessageAction, null);
  useEffect(() => {
    if (state?.ok) onDone();
  }, [state?.ok, onDone]);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="leadId" value={leadId} />
      <div className="space-y-2">
        <Label htmlFor="out-channel">Channel</Label>
        <select
          id="out-channel"
          name="channel"
          defaultValue={MessageChannel.EMAIL}
          className={nativeSelectClass}
        >
          {Object.values(MessageChannel).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="body">Message</Label>
        <Input id="body" name="body" required />
      </div>
      {state && !state.ok ? <p className="text-destructive text-sm">{state.message}</p> : null}
      <Button type="submit" size="sm" disabled={pending}>
        Log outbound
      </Button>
    </form>
  );
}

function ReplyModeUpdateForm({
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
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="conversationId" value={conversationId} />
      <select
        name="replyMode"
        defaultValue={currentMode}
        className="border-input bg-background focus-visible:ring-ring h-8 rounded-md border px-2 text-xs shadow-xs outline-none focus-visible:ring-2"
      >
        {Object.values(ConversationReplyMode).map((m) => (
          <option key={m} value={m}>
            {replyModeLabel[m]}
          </option>
        ))}
      </select>
      <Button type="submit" size="xs" variant="secondary" disabled={pending}>
        Set
      </Button>
      {state && !state.success ? (
        <span className="text-destructive text-xs">{state.error}</span>
      ) : null}
    </form>
  );
}

function InboundForm({ leadId, onDone }: { leadId: string; onDone: () => void }) {
  const [state, action, pending] = useActionState(logInboundPlaceholderAction, null);
  useEffect(() => {
    if (state?.ok) onDone();
  }, [state?.ok, onDone]);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="leadId" value={leadId} />
      <div className="space-y-2">
        <Label htmlFor="ibody">Inbound text</Label>
        <Input id="ibody" name="body" required />
      </div>
      {state && !state.ok ? <p className="text-destructive text-sm">{state.message}</p> : null}
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        Log inbound
      </Button>
    </form>
  );
}

function PlaceholderAIGenerateForm({ leadId, onDone }: { leadId: string; onDone: () => void }) {
  const [state, action, pending] = useActionState(createPlaceholderAIActionsAction, null);
  useEffect(() => {
    if (state?.ok) onDone();
  }, [state?.ok, onDone]);
  return (
    <form action={action}>
      <input type="hidden" name="leadId" value={leadId} />
      {state && !state.ok ? <p className="text-destructive text-sm">{state.message}</p> : null}
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        Generate placeholder AI actions
      </Button>
    </form>
  );
}

function ReviewAIActionButton({
  actionId,
  leadId,
  decision,
  label,
  variant = "default",
  onDone,
}: {
  actionId: string;
  leadId: string;
  decision: AIActionStatus;
  label: string;
  variant?: "default" | "secondary" | "outline" | "destructive" | "ghost" | "link";
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(reviewAIActionAction, null);
  useEffect(() => {
    if (state?.ok) onDone();
  }, [state?.ok, onDone]);
  return (
    <form action={action}>
      <input type="hidden" name="actionId" value={actionId} />
      <input type="hidden" name="leadId" value={leadId} />
      <input type="hidden" name="decision" value={decision} />
      <Button type="submit" size="sm" variant={variant} disabled={pending}>
        {label}
      </Button>
    </form>
  );
}
