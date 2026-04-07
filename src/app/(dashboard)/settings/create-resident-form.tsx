"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createResidentAction } from "@/server/actions/residents";

export function CreateResidentForm() {
  const router = useRouter();
  const [state, action, pending] = useActionState(createResidentAction, null);

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state?.ok, router]);

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button type="button" size="sm" variant="secondary">
            Add resident
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New resident</DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="rfname">First name</Label>
              <Input id="rfname" name="firstName" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rlname">Last name</Label>
              <Input id="rlname" name="lastName" required />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="remail">Email</Label>
            <Input id="remail" name="email" type="email" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rphone">Phone</Label>
            <Input id="rphone" name="phone" />
          </div>
          {state && !state.ok ? (
            <p className="text-destructive text-sm">{state.message}</p>
          ) : null}
          {state?.ok ? <p className="text-sm text-green-600">Resident created.</p> : null}
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Saving…" : "Create"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
