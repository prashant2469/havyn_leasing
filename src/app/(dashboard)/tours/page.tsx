import { redirect } from "next/navigation";
import { tryOrgContext } from "@/server/auth/context";

export default async function ToursPage() {
  const ctx = await tryOrgContext();
  if (!ctx) {
    redirect("/login");
  }
  redirect("/leasing/calendar");
}
