import { NextResponse } from "next/server";

import { isDatabaseConfigured } from "@/db";
import { AuthConfigurationError, getRequestSession } from "@/lib/auth-session";
import { listReviewsForModeration } from "@/lib/reviews/service";

async function adminSession(request: Request) {
  try {
    const session = await getRequestSession(request);
    return session?.user.role === "admin" ? session : null;
  } catch (error) {
    if (error instanceof AuthConfigurationError) return null;
    throw error;
  }
}

function pageFromRequest(request: Request) {
  const raw = new URL(request.url).searchParams.get("page") ?? "1";
  if (!/^\d{1,6}$/.test(raw)) return null;
  const page = Number(raw);
  return Number.isSafeInteger(page) && page >= 1 && page <= 100_000 ? page : null;
}

export async function GET(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ success: false, message: "La base de données n’est pas configurée." }, { status: 503 });
  }

  let session;
  try {
    session = await adminSession(request);
  } catch {
    return NextResponse.json({ success: false, message: "Impossible de vérifier la session." }, { status: 503 });
  }
  if (!session) {
    return NextResponse.json({ success: false, message: "Accès réservé à l’administration." }, { status: 403 });
  }

  const page = pageFromRequest(request);
  const rawStatus = new URL(request.url).searchParams.get("status") ?? "hidden";
  if (!page || (rawStatus !== "hidden" && rawStatus !== "published")) {
    return NextResponse.json({ success: false, message: "Les filtres demandés sont invalides." }, { status: 400 });
  }

  try {
    const result = await listReviewsForModeration(rawStatus, page);
    return NextResponse.json({ success: true, ...result });
  } catch {
    return NextResponse.json({ success: false, message: "Impossible de charger les avis à modérer." }, { status: 503 });
  }
}
