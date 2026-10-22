import { redirect } from "next/navigation";

/** Guides now live inside each path; without a path, the visitor chooses one first. */
export default function OldGuides() {
  redirect("/");
}
