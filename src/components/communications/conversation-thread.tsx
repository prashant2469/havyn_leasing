"use client";

import { Fragment, useEffect, useMemo, useRef } from "react";

import { messageChannelLabel, messageDirectionLabel } from "@/domains/channels/constants";
import { cn } from "@/lib/utils";

export type ConversationMessage = {
  id: string;
  direction: string;
  channel: string;
  body: string;
  sentAt: string;
  authorType: string;
  isAiGenerated: boolean;
  authorUser?: { name: string | null; email?: string | null } | null;
};

function formatDayDivider(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date();
  y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function shortTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function ConversationThread({
  messages,
  className,
  emptyLabel = "No messages yet.",
  autoScrollToLatest = true,
}: {
  messages: ConversationMessage[];
  className?: string;
  emptyLabel?: string;
  autoScrollToLatest?: boolean;
}) {
  const endRef = useRef<HTMLDivElement | null>(null);

  const rows = useMemo(() => {
    const out: Array<{
      type: "day" | "msg";
      key: string;
      day?: string;
      message?: ConversationMessage;
      grouped?: boolean;
    }> = [];

    let prevDay = "";
    let prevDir = "";
    let prevTs = 0;

    for (const m of messages) {
      const day = new Date(m.sentAt).toDateString();
      if (day !== prevDay) {
        out.push({ type: "day", key: `day-${m.id}`, day: formatDayDivider(m.sentAt) });
        prevDay = day;
        prevDir = "";
        prevTs = 0;
      }

      const ts = new Date(m.sentAt).getTime();
      const grouped = prevDir === m.direction && ts - prevTs < 3 * 60 * 1000;
      out.push({ type: "msg", key: m.id, message: m, grouped });
      prevDir = m.direction;
      prevTs = ts;
    }

    return out;
  }, [messages]);

  useEffect(() => {
    if (!autoScrollToLatest) return;
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, autoScrollToLatest]);

  if (messages.length === 0) {
    return <p className="text-muted-foreground text-sm">{emptyLabel}</p>;
  }

  return (
    <div className={cn("space-y-3", className)}>
      {rows.map((row) => {
        if (row.type === "day") {
          return (
            <div key={row.key} className="flex items-center gap-3 py-1">
              <div className="bg-border h-px flex-1" />
              <span className="text-muted-foreground text-[10px] uppercase tracking-wide">{row.day}</span>
              <div className="bg-border h-px flex-1" />
            </div>
          );
        }

        const m = row.message!;
        const inbound = m.direction === "INBOUND";

        return (
          <Fragment key={row.key}>
            <div className={cn("flex", inbound ? "justify-start" : "justify-end", row.grouped ? "mt-1" : "mt-2")}>
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm ring-1",
                  inbound
                    ? "bg-muted text-foreground ring-border rounded-bl-md"
                    : "bg-primary/10 text-foreground ring-primary/20 rounded-br-md",
                )}
              >
                {!row.grouped ? (
                  <div className="text-muted-foreground mb-1 flex flex-wrap items-center gap-1 text-[10px]">
                    <span className="font-medium">{messageDirectionLabel[m.direction] ?? m.direction}</span>
                    <span>-</span>
                    <span>{messageChannelLabel[m.channel] ?? m.channel}</span>
                    {m.isAiGenerated ? (
                      <>
                        <span>-</span>
                        <span>AI</span>
                      </>
                    ) : null}
                    {m.authorUser?.name ? (
                      <>
                        <span>-</span>
                        <span>{m.authorUser.name}</span>
                      </>
                    ) : null}
                    <span className="ml-1">{shortTime(m.sentAt)}</span>
                  </div>
                ) : null}
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
              </div>
            </div>
          </Fragment>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}
