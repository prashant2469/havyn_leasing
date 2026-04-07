"use client";

import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

import { AppThemeProvider } from "@/components/providers/theme-provider";

export function RootProviders({ children }: { children: React.ReactNode }) {
  return (
    <AppThemeProvider>
      <TooltipProvider>
        {children}
        <Toaster />
      </TooltipProvider>
    </AppThemeProvider>
  );
}
