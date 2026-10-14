import { currentUser } from "@/lib/auth/session";
import { exportMyData } from "@/lib/data/user";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (!user) return Response.json({ error: "unauthenticated" }, { status: 401 });
  const data = await exportMyData(sql(), user);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": 'attachment; filename="my-data.json"',
      "cache-control": "no-store",
    },
  });
}
