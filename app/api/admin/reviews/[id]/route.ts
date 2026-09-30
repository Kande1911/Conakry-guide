import { NextResponse } from "next/server";

import { isDatabaseConfigured } from "@/db";
import { AuthConfigurationError, getRequestSession } from "@/lib/auth-session";
import { setReviewModerationStatus } from "@/lib/reviews/service";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ success: false, message: "La base de données n’est pas configurée." }, { status: 503 });
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
    return NextResponse.json({ success: false, message: "Connectez-vous avec un compte administrateur." }, { status: 401 });
  }
  if (session.user.role !== "admin") {
    return NextResponse.json({ success: false, message: "Accès réservé à l’administration." }, { status: 403 });
  }

  const { id } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ success: false, message: "Identifiant d’avis invalide." }, { status: 400 });
  }

  let body: unknown;
  try {
    const contentLength = Number(request.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > 2048) {
      return NextResponse.json({ success: false, message: "La requête est trop volumineuse." }, { status: 413 });
    }
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: "Le contenu JSON est invalide." }, { status: 400 });
  }
  if (typeof body !== "object" || body === null || !("status" in body)) {
    return NextResponse.json({ success: false, message: "Le statut est manquant." }, { status: 400 });
  }
  const status = body.status;
  if (status !== "published" && status !== "hidden") {
    return NextResponse.json({ success: false, message: "Le statut demandé est invalide." }, { status: 400 });
  }

  try {
    const data = await setReviewModerationStatus(id, session.user.id, status);
    if (!data) return NextResponse.json({ success: false, message: "Avis introuvable." }, { status: 404 });
    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json({ success: false, message: "Impossible de modifier le statut de l’avis." }, { status: 503 });
  }
}
