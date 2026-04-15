"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type PublicContactValues = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

type PublicContactFieldsProps = {
  idPrefix: string;
  values: PublicContactValues;
  onChange: (patch: Partial<PublicContactValues>) => void;
  /** When true, show copy that email is required for this flow (tour request / booking). */
  emailRequiredForFlow?: boolean;
};

export function PublicContactFields({
  idPrefix,
  values,
  onChange,
  emailRequiredForFlow,
}: PublicContactFieldsProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-firstName`}>First name</Label>
          <Input
            id={`${idPrefix}-firstName`}
            autoComplete="given-name"
            required
            placeholder="Alex"
            value={values.firstName}
            onChange={(e) => onChange({ firstName: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-lastName`}>Last name</Label>
          <Input
            id={`${idPrefix}-lastName`}
            autoComplete="family-name"
            required
            placeholder="Rivera"
            value={values.lastName}
            onChange={(e) => onChange({ lastName: e.target.value })}
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-email`}>
            Email
            {emailRequiredForFlow ? <span className="text-destructive"> *</span> : null}
          </Label>
          <Input
            id={`${idPrefix}-email`}
            type="email"
            autoComplete="email"
            placeholder="you@email.com"
            value={values.email}
            onChange={(e) => onChange({ email: e.target.value })}
            required={emailRequiredForFlow}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-phone`}>Phone</Label>
          <Input
            id={`${idPrefix}-phone`}
            type="tel"
            autoComplete="tel"
            placeholder="+1 …"
            value={values.phone}
            onChange={(e) => onChange({ phone: e.target.value })}
          />
        </div>
      </div>
      {!emailRequiredForFlow ? (
        <p className="text-muted-foreground text-xs">Provide at least one of email or phone.</p>
      ) : (
        <p className="text-muted-foreground text-xs">Email is required so we can confirm your tour.</p>
      )}
    </div>
  );
}
