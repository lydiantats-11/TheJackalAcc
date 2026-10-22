import { audienceParam } from "@/lib/site/path-params";

/** Every page under a path checks the path first: only /politis and /epixeiriseis exist. */
export default async function PathLayout({ children, params }: { children: React.ReactNode; params: Promise<{ aud: string }> }) {
  await audienceParam(params);
  return <>{children}</>;
}
