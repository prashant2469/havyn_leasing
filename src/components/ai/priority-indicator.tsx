"use client";

import { LeadPriorityTier } from "@prisma/client";
import { AlertTriangle, ArrowDown, ArrowUp, Flame, Snowflake } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { priorityTierColor, priorityTierLabel } from "@/domains/ai/constants";
import { cn } from "@/lib/utils";

const priorityIcon: Record<LeadPriorityTier, React.ReactNode> = {
  URGENT: <AlertTriangle className="h-3 w-3" />,
  HIGH: <Flame className="h-3 w-3" />,
  NORMAL: null,
  LOW: <ArrowDown className="h-3 w-3" />,
  COLD: <Snowflake className="h-3 w-3" />,
};

interface PriorityIndicatorProps {
  tier: LeadPriorityTier;
  isHotLead?: boolean;
  isAtRisk?: boolean;
  needsImmediateResponse?: boolean;
  isQualifiedForTour?: boolean;
  showFlags?: boolean;
  className?: string;
}

export function PriorityIndicator({
  tier,
  isHotLead,
  isAtRisk,
  needsImmediateResponse,
  isQualifiedForTour: _isQualifiedForTour,
  showFlags = false,
  className,
}: PriorityIndicatorProps) {
  const color = priorityTierColor[tier] as "destructive" | "default" | "outline" | "secondary";
  const label = priorityTierLabel[tier];
  const icon = priorityIcon[tier];

  return (
    <div className={cn("flex items-center gap-1.5 flex-wrap", className)}>
      <Badge variant={color} className="gap-1 text-xs">
        {icon}
        {label}
      </Badge>
      {showFlags && (
        <>
          {isHotLead && (
            <Badge variant="default" className="gap-1 text-xs bg-orange-500 hover:bg-orange-600">
              <Flame className="h-3 w-3" />
              Hot lead
            </Badge>
          )}
          {needsImmediateResponse && (
            <Badge variant="destructive" className="gap-1 text-xs">
              <AlertTriangle className="h-3 w-3" />
              Respond now
            </Badge>
          )}
          {isAtRisk && !needsImmediateResponse && (
            <Badge variant="secondary" className="gap-1 text-xs text-amber-700 dark:text-amber-400">
              <ArrowUp className="h-3 w-3 rotate-180" />
              At risk
            </Badge>
          )}
        </>
      )}
    </div>
  );
}
