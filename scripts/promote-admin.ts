import "./load-env";
import postgres from "postgres";

/** Usage: npm run admin:promote -- someone@example.com   (run from a trusted machine only) */
async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) throw new Error("usage: npm run admin:promote -- <email>");
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  try {
    const rows = await sql`UPDATE users SET role = 'admin', updated_at = now() WHERE lower(email) = ${email} AND deleted_at IS NULL RETURNING id`;
    if (rows.length === 0) throw new Error("no such user — register first");
    await sql`INSERT INTO audit_logs (action, entity_type, entity_id, details) VALUES ('role_granted', 'user', ${rows[0]!.id}, ${sql.json({ role: "admin", via: "cli" })})`;
    console.log(`${email} is now an admin`);
  } finally {
    await sql.end();
  }
}
main().catch((e) => { console.error(e.message); process.exit(1); });
