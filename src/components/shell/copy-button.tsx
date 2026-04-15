"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function CopyTextButton({
  text,
  label = "Copy",
  className,
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const [done, setDone] = useState(false);

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      className={cn(className)}
      disabled={!text}
      onClick={async () => {
        if (!text) return;
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 2000);
        } catch {
          /* ignore */
        }
      }}
    >
      {done ? "Copied" : label}
    </Button>
  );
}
