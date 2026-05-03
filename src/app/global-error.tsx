"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-background p-8 text-foreground">
        <div className="mx-auto max-w-xl rounded-lg border bg-card p-8 text-card-foreground">
          <h1 className="text-xl font-semibold">Unexpected application error</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Something failed at the application level. Please retry.
          </p>
          <button
            type="button"
            className="mt-4 rounded-md border px-3 py-2 text-sm"
            onClick={() => reset()}
          >
            Retry
          </button>
        </div>
      </body>
    </html>
  );
}
