"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard-error]", error);
  }, [error]);

  return (
    <div className="rounded-lg border bg-card p-8 text-card-foreground">
      <h2 className="text-lg font-semibold">Dashboard failed to load</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Something went wrong while loading this workspace. Try again.
      </p>
      <Button className="mt-4" onClick={() => reset()}>
        Try again
      </Button>
    </div>
  );
}
