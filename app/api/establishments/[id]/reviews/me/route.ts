import { NextResponse } from "next/server";

import { isDatabaseConfigured } from "@/db";
import { AuthConfigurationError, getRequestSession } from "@/lib/auth-session";
import {
  getOwnReview,
  consumeReviewWriteLimit,
  removeOwnReview,
  updateOwnReview,
} from "@/lib/reviews/service";
import {
  isValidEstablishmentId,
  parseReviewInput,
  ReviewInputError,
} from "@/lib/reviews/validation";

type RouteContext = { params: Promise<{ id: string }> };

function jsonError(message: string, status: number) {
  return NextResponse.json({ success: false, message }, { status });
}

async function getAuthenticatedUser(request: Request) {
  try {
    const session = await getRequestSession(request);
    return session?.user ?? null;
  } catch (error) {
    if (error instanceof AuthConfigurationError) return null;
    throw error;
  }
}

export async function GET(request: Request, context: RouteContext) {
  if (!isDatabaseConfigured()) return jsonError("Le service des avis n’est pas configuré.", 503);
  const { id } = await context.params;
  if (!isValidEstablishmentId(id)) return jsonError("Identifiant d’établissement invalide.", 400);

  let user;
  try {
    user = await getAuthenticatedUser(request);
  } catch {
    return jsonError("Impossible de vérifier la session.", 503);
  }
  if (!user) return jsonError("Connectez-vous pour consulter votre avis.", 401);

  try {
    const data = await getOwnReview(user.id, id);
    return NextResponse.json({ success: true, data });
  } catch {
    return jsonError("Impossible de charger votre avis pour le moment.", 503);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  if (!isDatabaseConfigured()) return jsonError("Le service des avis n’est pas configuré.", 503);
  const { id } = await context.params;
  if (!isValidEstablishmentId(id)) return jsonError("Identifiant d’établissement invalide.", 400);

  let user;
  try {
    user = await getAuthenticatedUser(request);
  } catch {
    return jsonError("Impossible de vérifier la session.", 503);
  }
  if (!user) return jsonError("Connectez-vous pour modifier un avis.", 401);

  let input;
  try {
    input = await parseReviewInput(request);
  } catch (error) {
    if (error instanceof ReviewInputError) return jsonError(error.message, error.status);
    return jsonError("Le contenu de l’avis est invalide.", 400);
  }

  try {
    const quota = await consumeReviewWriteLimit(user.id);
    if (!quota.allowed) {
      return NextResponse.json(
        { success: false, message: "Vous avez modifié trop d’avis récemment. Réessayez dans quelques minutes." },
        { status: 429, headers: { "Retry-After": String(quota.retryAfter) } },
      );
    }
    const data = await updateOwnReview(user.id, id, input);
    if (!data) return jsonError("Aucun avis à modifier pour cet établissement.", 404);
    return NextResponse.json({ success: true, data });
  } catch {
    return jsonError("Impossible de modifier l’avis pour le moment.", 503);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  if (!isDatabaseConfigured()) return jsonError("Le service des avis n’est pas configuré.", 503);
  const { id } = await context.params;
  if (!isValidEstablishmentId(id)) return jsonError("Identifiant d’établissement invalide.", 400);

  let user;
  try {
    user = await getAuthenticatedUser(request);
  } catch {
    return jsonError("Impossible de vérifier la session.", 503);
  }
  if (!user) return jsonError("Connectez-vous pour supprimer un avis.", 401);

  try {
    const quota = await consumeReviewWriteLimit(user.id);
    if (!quota.allowed) {
      return NextResponse.json(
        { success: false, message: "Vous avez modifié trop d’avis récemment. Réessayez dans quelques minutes." },
        { status: 429, headers: { "Retry-After": String(quota.retryAfter) } },
      );
    }
    const removed = await removeOwnReview(user.id, id);
    if (!removed) return jsonError("Aucun avis à supprimer pour cet établissement.", 404);
    return new Response(null, { status: 204 });
  } catch {
    return jsonError("Impossible de supprimer l’avis pour le moment.", 503);
  }
}
