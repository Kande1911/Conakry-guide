import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";

import { getDatabase, isDatabaseConfigured } from "@/db";

export async function GET() {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ status: "degraded" }, { status: 503 });
  }

  try {
    await getDatabase().execute(sql`select 1`);
    return NextResponse.json({ status: "ok" });
  } catch {
    return NextResponse.json({ status: "degraded" }, { status: 503 });
  }
}
