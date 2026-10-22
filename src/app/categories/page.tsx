import { redirect } from "next/navigation";

/** Categories now live inside each path's Opportunities page (only the categories that path has). */
export default function OldCategories() {
  redirect("/");
}
