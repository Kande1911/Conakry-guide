import "dotenv/config";

import pg from "pg";

const { Pool } = pg;
const email = process.argv[2]?.trim();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}
if (!email || email.length > 254 || !email.includes("@")) {
  throw new Error("Usage: npm run admin:promote -- <existing-account-email>");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 5_000 });
try {
  const result = await pool.query(
    'UPDATE "user" SET role = $1, updated_at = now() WHERE email = $2 RETURNING id',
    ["admin", email],
  );
  if (result.rowCount !== 1) throw new Error("No account found for that email");
  console.log(`Administrator role granted to ${email}`);
} finally {
  await pool.end();
}
