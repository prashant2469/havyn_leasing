"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function InboxError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[inbox-error]", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl rounded-lg border bg-card p-8 text-card-foreground">
      <h2 className="text-lg font-semibold">Inbox is temporarily unavailable</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        We could not render the pipeline board right now. Retry to refresh data.
      </p>
      <Button className="mt-4" onClick={() => reset()}>
        Reload inbox
      </Button>
    </div>
  );
}
