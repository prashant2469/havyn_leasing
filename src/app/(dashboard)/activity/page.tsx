import { PageHeader } from "@/components/shell/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { tryOrgContext } from "@/server/auth/context";
import { listRecentActivity } from "@/server/services/activity/activity.service";

export default async function ActivityPage() {
  const ctx = await tryOrgContext();
  if (!ctx) {
    return <PageHeader title="Activity" description="Configure dev auth on the dashboard home first." />;
  }

  const events = await listRecentActivity(ctx, 80);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Activity"
        description="Append-only event stream from recordActivity / logActivity. Filter by entity in a later iteration."
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent events</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Verb</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Actor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground py-8 text-center">
                    No activity yet.
                  </TableCell>
                </TableRow>
              ) : (
                events.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {new Date(e.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{e.verb}</TableCell>
                    <TableCell className="text-sm">
                      {e.entityType} · {e.entityId.slice(0, 8)}…
                    </TableCell>
                    <TableCell className="text-sm">
                      {e.actor?.name ?? e.actor?.email ?? "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
