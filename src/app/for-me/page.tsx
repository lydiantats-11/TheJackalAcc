import { redirect } from "next/navigation";

/** «Για Εμένα» is now «Ο λογαριασμός μου» inside each path; without a path, the visitor chooses one first. */
export default function OldForMe() {
  redirect("/");
}
