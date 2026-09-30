import "dotenv/config";

import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;
const migrationDirectory = fileURLToPath(new URL("../drizzle/migrations/", import.meta.url));

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to run database migrations");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  connectionTimeoutMillis: 5_000,
});
const client = await pool.connect();
let lockAcquired = false;

try {
  await client.query("SELECT pg_advisory_lock(718402, 1)");
  lockAcquired = true;
  await client.query(`
    CREATE TABLE IF NOT EXISTS _schema_migrations (
      name text PRIMARY KEY,
      checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const names = (await readdir(migrationDirectory))
    .filter((name) => /^\d{4}_[a-z0-9_-]+\.sql$/.test(name))
    .sort();

  for (const name of names) {
    const migration = await readFile(new URL(`../drizzle/migrations/${name}`, import.meta.url), "utf8");
    const checksum = createHash("sha256").update(migration).digest("hex");
    const applied = await client.query(
      "SELECT checksum FROM _schema_migrations WHERE name = $1",
      [name],
    );

    if (applied.rowCount) {
      if (applied.rows[0].checksum !== checksum) {
        throw new Error(`Applied migration was modified: ${name}`);
      }
      console.log(`Already applied: ${name}`);
      continue;
    }

    await client.query("BEGIN");
    try {
      await client.query(migration);
      await client.query(
        "INSERT INTO _schema_migrations (name, checksum) VALUES ($1, $2)",
        [name, checksum],
      );
      await client.query("COMMIT");
      console.log(`Applied: ${name}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
} finally {
  if (lockAcquired) {
    await client.query("SELECT pg_advisory_unlock(718402, 1)");
  }
  client.release();
  await pool.end();
}
