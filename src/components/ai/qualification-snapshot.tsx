"use client";

import { QualificationAnswer } from "@prisma/client";
import { Bot, CheckCircle2, User } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QUALIFICATION_KEYS, type QualificationKey } from "@/domains/leasing/qualification-keys";
import { cn } from "@/lib/utils";

const QUAL_LABEL: Record<QualificationKey, string> = {
  moveInDate: "Move-in",
  bedrooms: "Bedrooms",
  pets: "Pets",
  monthlyBudget: "Budget",
  occupants: "Occupants",
  propertyInterest: "Property / area",
};

const QUAL_DISPLAY_KEYS = QUALIFICATION_KEYS.map((key) => ({ key, label: QUAL_LABEL[key] }));

interface QualificationSnapshotProps {
  qualifications: QualificationAnswer[];
  className?: string;
}

export function QualificationSnapshot({ qualifications, className }: QualificationSnapshotProps) {
  const byKey = Object.fromEntries(qualifications.map((q) => [q.key, q]));
  const answered = QUAL_DISPLAY_KEYS.filter((d) => byKey[d.key]);
  const missing = QUAL_DISPLAY_KEYS.filter((d) => !byKey[d.key]);

  return (
    <Card className={cn("border-border/60", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-violet-500" />
          Qualification Snapshot
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {answered.length === 0 && (
          <p className="text-muted-foreground text-sm">No qualification data captured yet.</p>
        )}

        {answered.length > 0 && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            {answered.map(({ key, label }) => {
              const q = byKey[key]!;
              const isAI = q.source === "AI_EXTRACTED";
              return (
                <div key={key} className="flex items-start justify-between gap-1">
                  <span className="text-xs text-muted-foreground truncate">{label}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-xs font-medium">
                      {String(q.value) === "true"
                        ? "Yes"
                        : String(q.value) === "false"
                          ? "No"
                          : String(q.value)}
                    </span>
                    {isAI ? (
                      <span title="AI extracted — not yet confirmed">
                        <Bot className="h-3 w-3 text-violet-400" aria-hidden />
                      </span>
                    ) : (
                      <span title="User confirmed">
                        <User className="h-3 w-3 text-green-500" aria-hidden />
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {missing.length > 0 && (
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              Missing
            </p>
            <div className="flex flex-wrap gap-1">
              {missing.map(({ label }) => (
                <Badge key={label} variant="outline" className="text-xs text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700">
                  {label}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 text-xs text-muted-foreground border-t border-border/50 pt-2">
          <span className="flex items-center gap-1">
            <Bot className="h-3 w-3 text-violet-400" aria-hidden /> AI extracted
          </span>
          <span className="flex items-center gap-1">
            <User className="h-3 w-3 text-green-500" aria-hidden /> User confirmed
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
