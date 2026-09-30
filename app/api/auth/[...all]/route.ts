import { NextResponse } from "next/server";
import { toNextJsHandler } from "better-auth/next-js";

import { isDatabaseConfigured } from "@/db";
import { isAuthConfigured } from "@/lib/auth-session";

async function getHandlers() {
  if (!isDatabaseConfigured() || !isAuthConfigured()) {
    return null;
  }

  const { auth } = await import("@/lib/auth");
  return toNextJsHandler(auth);
}

function unavailable() {
  return NextResponse.json(
    { success: false, message: "Le service de compte n’est pas configuré." },
    { status: 503 },
  );
}

export async function GET(request: Request) {
  const handlers = await getHandlers();
  return handlers ? handlers.GET(request) : unavailable();
}

export async function POST(request: Request) {
  const handlers = await getHandlers();
  return handlers ? handlers.POST(request) : unavailable();
}
