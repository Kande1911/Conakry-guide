import { NextResponse } from "next/server";

import { isDatabaseConfigured } from "@/db";
import { AuthConfigurationError, getRequestSession } from "@/lib/auth-session";
import {
  createReview,
  consumeReviewWriteLimit,
  isUniqueViolation,
  listPublicReviews,
} from "@/lib/reviews/service";
import {
  isValidEstablishmentId,
  parseReviewInput,
  ReviewInputError,
} from "@/lib/reviews/validation";

type RouteContext = { params: Promise<{ id: string }> };

function unavailable() {
  return NextResponse.json(
    { success: false, message: "Le service des avis n’est pas configuré." },
    { status: 503 },
  );
}

function invalidId() {
  return NextResponse.json(
    { success: false, message: "Identifiant d’établissement invalide." },
    { status: 400 },
  );
}

export async function GET(request: Request, context: RouteContext) {
  if (!isDatabaseConfigured()) return unavailable();

  const { id } = await context.params;
  if (!isValidEstablishmentId(id)) return invalidId();

  const rawPage = new URL(request.url).searchParams.get("page") ?? "1";
  if (!/^\d{1,6}$/.test(rawPage)) {
    return NextResponse.json(
      { success: false, message: "Le numéro de page est invalide." },
      { status: 400 },
    );
  }
  const page = Number(rawPage);
  if (!Number.isSafeInteger(page) || page < 1 || page > 100_000) {
    return NextResponse.json(
      { success: false, message: "Le numéro de page est invalide." },
      { status: 400 },
    );
  }

  try {
    const result = await listPublicReviews(id, page);
    return NextResponse.json({ success: true, ...result });
  } catch {
    return NextResponse.json(
      { success: false, message: "Impossible de charger les avis pour le moment." },
      { status: 503 },
    );
  }
}

export async function POST(request: Request, context: RouteContext) {
  if (!isDatabaseConfigured()) return unavailable();

  const { id } = await context.params;
  if (!isValidEstablishmentId(id)) return invalidId();

  let input;
  try {
    input = await parseReviewInput(request);
  } catch (error) {
    if (error instanceof ReviewInputError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { success: false, message: "Le contenu de l’avis est invalide." },
      { status: 400 },
    );
  }

  let session;
  try {
    session = await getRequestSession(request);
  } catch (error) {
    if (!(error instanceof AuthConfigurationError)) {
      return NextResponse.json(
        { success: false, message: "Impossible de vérifier la session." },
        { status: 503 },
      );
    }
    return unavailable();
  }

  if (!session) {
    return NextResponse.json(
      { success: false, message: "Connectez-vous pour publier un avis." },
      { status: 401 },
    );
  }

  let quota;
  try {
    quota = await consumeReviewWriteLimit(session.user.id);
  } catch {
    return NextResponse.json(
      { success: false, message: "Impossible de vérifier la limite de publication." },
      { status: 503 },
    );
  }
  if (!quota.allowed) {
    return NextResponse.json(
      { success: false, message: "Vous avez publié trop d’avis récemment. Réessayez dans quelques minutes." },
      { status: 429, headers: { "Retry-After": String(quota.retryAfter) } },
    );
  }

  try {
    const data = await createReview(session.user.id, id, input);
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json(
        { success: false, message: "Vous avez déjà publié un avis pour cet établissement." },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { success: false, message: "Impossible d’enregistrer l’avis pour le moment." },
      { status: 503 },
    );
  }
}
