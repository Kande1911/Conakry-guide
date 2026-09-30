import { NextResponse } from "next/server";

import { isDatabaseConfigured } from "@/db";
import { AuthConfigurationError, getRequestSession } from "@/lib/auth-session";
import { listOwnReviews } from "@/lib/reviews/service";

export async function GET(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { success: false, message: "Le service des avis n’est pas configuré." },
      { status: 503 },
    );
  }

  let session;
  try {
    session = await getRequestSession(request);
  } catch (error) {
    const message = error instanceof AuthConfigurationError
      ? "Le service de compte n’est pas configuré."
      : "Impossible de vérifier la session.";
    return NextResponse.json({ success: false, message }, { status: 503 });
  }

  if (!session) {
    return NextResponse.json(
      { success: false, message: "Connectez-vous pour consulter vos avis." },
      { status: 401 },
    );
  }

  const rawPage = new URL(request.url).searchParams.get("page") ?? "1";
  if (!/^\d{1,6}$/.test(rawPage)) {
    return NextResponse.json({ success: false, message: "Le numéro de page est invalide." }, { status: 400 });
  }
  const page = Number(rawPage);
  if (!Number.isSafeInteger(page) || page < 1 || page > 100_000) {
    return NextResponse.json({ success: false, message: "Le numéro de page est invalide." }, { status: 400 });
  }

  try {
    const result = await listOwnReviews(session.user.id, page);
    return NextResponse.json({ success: true, ...result });
  } catch {
    return NextResponse.json(
      { success: false, message: "Impossible de charger vos avis pour le moment." },
      { status: 503 },
    );
  }
}
