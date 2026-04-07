import { PageHeader } from "@/components/shell/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AiCopilotPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="AI leasing copilot"
        description="V1 defines data shapes, review states, and activity logging — not vendor integrations."
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">AIAction model</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground space-y-2 text-sm">
            <p>
              Draft replies, summaries, next actions, qualification extracts, and escalation flags are
              stored as typed rows with <code className="rounded bg-muted px-1">PENDING_REVIEW</code>{" "}
              by default.
            </p>
            <p>Human review writes reviewer id + timestamp and emits activity events.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Where to plug in models</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground space-y-2 text-sm">
            <p>
              Add a worker or route handler that reads conversation + listing context, calls your model
              API, and persists <code className="rounded bg-muted px-1">AIAction</code> rows.
            </p>
            <p>Keep orchestration out of React — use the server service layer.</p>
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Lead workspace</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            <p>
              Use the <strong>Copilot</strong> tab on any lead to generate placeholders and exercise the
              review flow. Approve/reject/dismiss actions are already logged to the activity timeline.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
