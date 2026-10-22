import { redirect } from "next/navigation";

/** The mixed listing no longer exists (owner decision, 22 Oct 2026): visitors choose a path first. */
export default function OldOpportunities() {
  redirect("/");
}
