"use client";

import { RecommendationStatus } from "@prisma/client";
import { useActionState, useEffect } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { markRecommendationStatusAction } from "@/server/actions/recommendations";

type RecommendationRow = {
  id: string;
  leadId: string;
  score: number;
  status: RecommendationStatus;
  listing: {
    id: string;
    title: string;
    monthlyRent: string;
    bedrooms: number | null;
    bathrooms: number | null;
    availableFrom: string | null;
    unit: { unitNumber: string; property: { name: string } };
  };
};

function money(v: string): string {
  const n = Number(v);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function RecommendationStatusForm({
  recommendationId,
  leadId,
  status,
  label,
  onDone,
}: {
  recommendationId: string;
  leadId: string;
  status: RecommendationStatus;
  label: string;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(markRecommendationStatusAction, null);
  useEffect(() => {
    if (state?.ok) onDone();
  }, [state?.ok, onDone]);

  return (
    <form action={action}>
      <input type="hidden" name="recommendationId" value={recommendationId} />
      <input type="hidden" name="leadId" value={leadId} />
      <input type="hidden" name="status" value={status} />
      <Button size="sm" variant="outline" disabled={pending}>
        {label}
      </Button>
    </form>
  );
}

export function RecommendationCard({
  recommendation,
  onDone,
}: {
  recommendation: RecommendationRow;
  onDone: () => void;
}) {
  return (
    <div className="rounded-md border p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="font-medium">{recommendation.listing.title}</p>
        <Badge variant="outline">{Math.round(recommendation.score * 100)}%</Badge>
      </div>
      <p className="text-muted-foreground text-xs">
        {recommendation.listing.unit.property.name} · Unit {recommendation.listing.unit.unitNumber}
      </p>
      <p className="mt-1 text-sm">
        {money(recommendation.listing.monthlyRent)}
        {recommendation.listing.bedrooms != null ? ` · ${recommendation.listing.bedrooms} bd` : ""}
        {recommendation.listing.bathrooms != null ? ` · ${recommendation.listing.bathrooms} ba` : ""}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <RecommendationStatusForm
          recommendationId={recommendation.id}
          leadId={recommendation.leadId}
          status={RecommendationStatus.SHARED_WITH_PROSPECT}
          label="Mark shared"
          onDone={onDone}
        />
        <RecommendationStatusForm
          recommendationId={recommendation.id}
          leadId={recommendation.leadId}
          status={RecommendationStatus.PROSPECT_INTERESTED}
          label="Interested"
          onDone={onDone}
        />
        <RecommendationStatusForm
          recommendationId={recommendation.id}
          leadId={recommendation.leadId}
          status={RecommendationStatus.DISMISSED}
          label="Dismiss"
          onDone={onDone}
        />
      </div>
    </div>
  );
}
