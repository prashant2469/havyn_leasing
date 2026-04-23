import Link from "next/link";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { channelTypeLabel } from "@/domains/listings/constants";
import { inboxStageLabel } from "@/domains/leasing/inbox";
import { cn } from "@/lib/utils";
import { tryOrgContext } from "@/server/auth/context";
import {
  getLeasingMetrics,
  leasingMetricsRanges,
  type LeasingMetricsRange,
} from "@/server/services/analytics/leasing-metrics.service";

function parseRange(value?: string): LeasingMetricsRange {
  const parsed = Number(value);
  if (parsed === 7 || parsed === 30 || parsed === 90) return parsed;
  return 30;
}

function pct(value: number | null): string {
  if (value == null) return "—";
  return `${(value * 100).toFixed(1)}%`;
}

function hours(value: number | null): string {
  if (value == null) return "—";
  if (value < 1) return `${Math.round(value * 60)}m`;
  return `${value.toFixed(1)}h`;
}

type AnalysisPageProps = {
  searchParams?: Promise<{ range?: string }> | { range?: string };
};

export default async function AnalysisPage({ searchParams }: AnalysisPageProps) {
  const ctx = await tryOrgContext();
  if (!ctx) {
    redirect("/login");
  }

  const resolvedSearchParams = await Promise.resolve(searchParams);
  const selectedRange = parseRange(resolvedSearchParams?.range);
  const metrics = await getLeasingMetrics(ctx, selectedRange);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analysis"
        description="Operational leasing performance. Default view is last 30 days."
        actions={
          <Link href="/leasing" className={cn(buttonVariants({ variant: "outline" }))}>
            Open leasing workspace
          </Link>
        }
      />

      <div className="flex flex-wrap gap-2">
        {leasingMetricsRanges.map((range) => (
          <Link
            key={range}
            href={`/analysis?range=${range}`}
            className={cn(
              buttonVariants({ variant: range === selectedRange ? "default" : "outline", size: "sm" }),
            )}
          >
            Last {range} days
          </Link>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Median first-response time</CardTitle>
            <CardDescription>Lead created to first team response</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums">{hours(metrics.kpis.medianFirstResponseHours)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Tour completion rate</CardTitle>
            <CardDescription>
              {metrics.kpis.toursCompleted} completed out of {metrics.kpis.toursBooked} booked
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums">{pct(metrics.kpis.tourCompletionRate)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Application to lease conversion</CardTitle>
            <CardDescription>
              {metrics.kpis.convertedApplications} leased from {metrics.kpis.applications} applications
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums">
              {pct(metrics.kpis.applicationToLeaseConversion)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Stage distribution</CardTitle>
            <CardDescription>Current lead stage mix for the selected window</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {metrics.stageDistribution.length === 0 ? (
              <p className="text-muted-foreground text-sm">No lead data in this window.</p>
            ) : (
              metrics.stageDistribution.map((row) => (
                <div key={row.stage} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{inboxStageLabel[row.stage]}</span>
                  <Badge variant="outline">{row.count}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Channel performance</CardTitle>
            <CardDescription>Response and conversion by source channel</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Channel</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="text-right">Responded</TableHead>
                  <TableHead className="text-right">Response rate</TableHead>
                  <TableHead className="text-right">Conversion rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metrics.channelPerformance.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground py-8 text-center text-sm">
                      No channel data in this window.
                    </TableCell>
                  </TableRow>
                ) : (
                  metrics.channelPerformance.map((row) => (
                    <TableRow key={row.channel}>
                      <TableCell>
                        {row.channel === "UNKNOWN" ? "Unknown" : channelTypeLabel[row.channel]}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{row.leads}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.responded}</TableCell>
                      <TableCell className="text-right tabular-nums">{pct(row.responseRate)}</TableCell>
                      <TableCell className="text-right tabular-nums">{pct(row.conversionRate)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Follow-up pressure</CardTitle>
          <CardDescription>Leads with overdue next actions</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-semibold tabular-nums">{metrics.overdueNextActions}</p>
        </CardContent>
      </Card>
    </div>
  );
}
