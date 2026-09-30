import { NextResponse } from "next/server";

import { isDatabaseConfigured } from "@/db";
import { getPublicError } from "@/lib/external-api/errors";
import {
  ESTABLISHMENT_PAGE_SIZE,
  getEstablishmentPage,
} from "@/lib/external-api/service";
import {
  getRecentlyReviewedEstablishmentIds,
  getReviewSummaries,
} from "@/lib/reviews/service";

function integerParameter(value: string | null, fallback: number, maximum: number) {
  if (value === null) return fallback;
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed <= maximum ? parsed : null;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const limit = integerParameter(params.get("limit"), ESTABLISHMENT_PAGE_SIZE, ESTABLISHMENT_PAGE_SIZE);
  const offset = integerParameter(params.get("offset"), 0, 1_000_000);
  const minRatingValue = params.get("minRating");
  const minRating = minRatingValue === null ? undefined : Number(minRatingValue);

  if (
    limit === null ||
    offset === null ||
    (minRatingValue !== null && (!Number.isFinite(minRating) || minRating! < 1 || minRating! > 5))
  ) {
    return NextResponse.json(
      { success: false, message: "Les paramètres de recherche sont invalides." },
      { status: 400 },
    );
  }

  try {
    const page = await getEstablishmentPage({
      query: params.get("q") ?? undefined,
      category: params.get("category") ?? undefined,
      location: params.get("location") ?? undefined,
      minRating,
      limit,
      offset,
    });
    let summaries = {};
    let recentEstablishmentIds: string[] = [];
    if (isDatabaseConfigured() && page.data.length) {
      try {
        const ids = page.data.map(({ id }) => id);
        [summaries, recentEstablishmentIds] = await Promise.all([
          getReviewSummaries(ids),
          getRecentlyReviewedEstablishmentIds(ids, ids.length),
        ]);
      } catch {
        summaries = {};
        recentEstablishmentIds = [];
      }
    }

    return NextResponse.json({
      success: true,
      data: page.data,
      summaries,
      recentEstablishmentIds,
      pagination: {
        count: page.count,
        limit: page.limit,
        offset: page.offset,
        hasMore: page.offset + page.limit < page.count,
      },
    });
  } catch (error) {
    const result = getPublicError(error);
    return NextResponse.json(
      { success: false, message: result.message },
      { status: result.status },
    );
  }
}
