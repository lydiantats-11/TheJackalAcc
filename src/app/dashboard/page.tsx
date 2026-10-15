import { redirect } from "next/navigation";

/** The dashboard is now «Για Εμένα / For Me» (design sprint 15 Oct 2026); old links keep working. */
export default async function Dashboard({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  redirect((await searchParams).denied ? "/for-me?denied=1" : "/for-me");
}
