import { redirect } from "next/navigation";
import { tryOrgContext } from "@/server/auth/context";

export default async function ApplicationsPipelinePage() {
  const ctx = await tryOrgContext();
  if (!ctx) {
    redirect("/login");
  }
  redirect("/leasing/inbox");
}
