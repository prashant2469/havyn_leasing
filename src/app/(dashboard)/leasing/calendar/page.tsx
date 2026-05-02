import Link from "next/link";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { tryOrgContext } from "@/server/auth/context";
import { listToursForOrg } from "@/server/services/leasing/tour.service";

function dayLabel(dateIso: string) {
  return new Date(`${dateIso}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default async function LeasingCalendarPage() {
  const ctx = await tryOrgContext();
  if (!ctx) redirect("/login");

  const tours = await listToursForOrg(ctx);
  const scheduled = tours.filter((t) => t.status === "SCHEDULED");
  const byDate = scheduled.reduce<Record<string, typeof scheduled>>((acc, t) => {
    const key = new Date(t.scheduledAt).toISOString().slice(0, 10);
    acc[key] = acc[key] ?? [];
    acc[key].push(t);
    return acc;
  }, {});
  const dateKeys = Object.keys(byDate).sort();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tour calendar"
        description="Weekly scheduling view for confirmed tours across the portfolio."
        actions={
          <Link href="/leasing/inbox" className={buttonVariants({ variant: "outline" })}>
            Open pipeline board
          </Link>
        }
      />

      {dateKeys.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-sm text-muted-foreground">
            No scheduled tours yet. Create tours from the pipeline board workspace.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {dateKeys.map((d) => (
            <Card key={d} className="h-full">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{dayLabel(d)}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {byDate[d]
                  .sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt))
                  .map((tour) => (
                    <Link
                      key={tour.id}
                      href={`/leasing/inbox?leadId=${tour.leadId}`}
                      className="block rounded-md border p-2 hover:bg-muted/40"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium">
                          {new Date(tour.scheduledAt).toLocaleTimeString([], {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </p>
                        <Badge variant="outline">{tour.status}</Badge>
                      </div>
                      <p className="text-sm">
                        {tour.lead.firstName} {tour.lead.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground">{tour.listing?.title ?? "No listing"}</p>
                    </Link>
                  ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upcoming and past tours</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {tours.map((tour) => (
            <div
              key={tour.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
            >
              <div>
                <p className="font-medium">
                  {tour.lead.firstName} {tour.lead.lastName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(tour.scheduledAt).toLocaleString()} · {tour.listing?.title ?? "No listing"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{tour.status}</Badge>
                <Link
                  href={`/leasing/inbox?leadId=${tour.leadId}`}
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                >
                  Open lead
                </Link>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
