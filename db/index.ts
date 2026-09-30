import "server-only";

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

declare global {
  var conakryGuidePgPool: Pool | undefined;
}

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

function getPool(): Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured");
  }

  const configuredMax = Number(process.env.DATABASE_POOL_MAX ?? 10);
  const max = Number.isInteger(configuredMax) && configuredMax >= 1 && configuredMax <= 50
    ? configuredMax
    : 10;

  globalThis.conakryGuidePgPool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

  return globalThis.conakryGuidePgPool;
}

export function getDatabase() {
  return drizzle({ client: getPool(), schema });
}
