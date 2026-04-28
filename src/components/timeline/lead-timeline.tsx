"use client";

import type { TimelineEntry } from "@/domains/timeline/types";
import { Badge } from "@/components/ui/badge";

export function LeadTimeline({ entries }: { entries: TimelineEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-muted-foreground text-sm">No timeline events yet.</p>;
  }

  return (
    <ul className="space-y-3">
      {entries.map((e) => (
        <li key={e.id} className="rounded-md border p-3">
          <div className="mb-1 flex items-center justify-between gap-2">
            <Badge variant="outline">{e.type}</Badge>
            <span className="text-muted-foreground text-xs">
              {new Date(e.at).toLocaleString()}
            </span>
          </div>
          {e.type === "message" ? (
            <div className="space-y-1 text-sm">
              <p className="text-muted-foreground text-xs">
                {e.direction} · {e.channel} · {e.authorType}
              </p>
              <p className="whitespace-pre-wrap">{e.body}</p>
            </div>
          ) : null}
          {e.type === "activity" ? <p className="font-mono text-xs">{e.verb}</p> : null}
          {e.type === "tour" ? (
            <p className="text-sm">
              {e.status} · {new Date(e.scheduledAt).toLocaleString()}
            </p>
          ) : null}
          {e.type === "application" ? <p className="text-sm">{e.status}</p> : null}
          {e.type === "qualification" ? (
            <p className="text-sm">
              <span className="font-mono">{e.key}</span>:{" "}
              {typeof e.value === "string" ? e.value : JSON.stringify(e.value)}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
