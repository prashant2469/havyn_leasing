"use client";

import { Button } from "@/components/ui/button";

export function PublicListingStickyCta() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/90 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_30px_rgba(0,0,0,0.06)] backdrop-blur-md md:hidden">
      <Button
        type="button"
        className="h-11 w-full text-base font-medium shadow-sm"
        onClick={() => document.getElementById("get-in-touch")?.scrollIntoView({ behavior: "smooth", block: "start" })}
      >
        Get in touch
      </Button>
    </div>
  );
}
