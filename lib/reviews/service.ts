import "server-only";

import { and, count, desc, eq, inArray, max, sql } from "drizzle-orm";

import { getDatabase } from "@/db";
import { reviewModerationLogs, reviewWriteLimits, reviews, users } from "@/db/schema";
import type { ReviewInput } from "./validation";

const PUBLIC_REVIEW_STATUSES = "published";
const REVIEW_WRITE_WINDOW_MS = 10 * 60 * 1000;
const REVIEW_WRITE_LIMIT = 5;

export async function consumeReviewWriteLimit(userId: string) {
  const now = Date.now();
  const windowStartMs = Math.floor(now / REVIEW_WRITE_WINDOW_MS) * REVIEW_WRITE_WINDOW_MS;
  const windowStart = new Date(windowStartMs);
  const [entry] = await getDatabase()
    .insert(reviewWriteLimits)
    .values({ userId, windowStart, hits: 1 })
    .onConflictDoUpdate({
      target: reviewWriteLimits.userId,
      set: {
        windowStart,
        hits: sql`
          CASE
            WHEN ${reviewWriteLimits.windowStart} = ${windowStart} THEN ${reviewWriteLimits.hits} + 1
            ELSE 1
          END
        `,
      },
      setWhere: sql`
        ${reviewWriteLimits.windowStart} <> ${windowStart}
        OR ${reviewWriteLimits.hits} < ${REVIEW_WRITE_LIMIT}
      `,
    })
    .returning({ hits: reviewWriteLimits.hits });

  return {
    allowed: Boolean(entry),
    retryAfter: Math.max(1, Math.ceil((windowStartMs + REVIEW_WRITE_WINDOW_MS - now) / 1000)),
  };
}

export type ReviewSummary = {
  average: number | null;
  count: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
};

function emptySummary(): ReviewSummary {
  return { average: null, count: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };
}

function summariesFromRows(
  rows: Array<{ establishmentId: string; rating: number; count: number }>,
): Record<string, ReviewSummary> {
  const summaries: Record<string, ReviewSummary> = {};
  for (const row of rows) {
    const summary = (summaries[row.establishmentId] ??= emptySummary());
    summary.distribution[row.rating as 1 | 2 | 3 | 4 | 5] = row.count;
    summary.count += row.count;
    summary.average = (summary.average ?? 0) + row.rating * row.count;
  }
  for (const summary of Object.values(summaries)) {
    summary.average = summary.count
      ? Math.round(((summary.average ?? 0) / summary.count) * 10) / 10
      : null;
  }
  return summaries;
}

export async function getReviewSummaries(establishmentIds: string[]) {
  if (establishmentIds.length === 0) return {};
  const rows = await getDatabase()
    .select({ establishmentId: reviews.establishmentId, rating: reviews.rating, count: count() })
    .from(reviews)
    .where(
      and(
        inArray(reviews.establishmentId, establishmentIds),
        eq(reviews.status, PUBLIC_REVIEW_STATUSES),
      ),
    )
    .groupBy(reviews.establishmentId, reviews.rating);
  return summariesFromRows(rows);
}

export async function getRecentlyReviewedEstablishmentIds(establishmentIds: string[], limit = 6) {
  if (establishmentIds.length === 0 || limit < 1) return [];

  const rows = await getDatabase()
    .select({
      establishmentId: reviews.establishmentId,
      lastReviewedAt: max(reviews.createdAt),
    })
    .from(reviews)
    .where(
      and(
        inArray(reviews.establishmentId, establishmentIds),
        eq(reviews.status, PUBLIC_REVIEW_STATUSES),
      ),
    )
    .groupBy(reviews.establishmentId)
    .orderBy(desc(max(reviews.createdAt)), desc(reviews.establishmentId))
    .limit(limit);

  return rows.map(({ establishmentId }) => establishmentId);
}

export async function listPublicReviews(establishmentId: string, page: number) {
  const db = getDatabase();
  const [rows, ratingRows] = await Promise.all([
    db
    .select({
      id: reviews.id,
      rating: reviews.rating,
      comment: reviews.comment,
      createdAt: reviews.createdAt,
      updatedAt: reviews.updatedAt,
      authorName: users.name,
      authorImage: users.image,
    })
    .from(reviews)
    .innerJoin(users, eq(reviews.userId, users.id))
    .where(
      and(
        eq(reviews.establishmentId, establishmentId),
        eq(reviews.status, PUBLIC_REVIEW_STATUSES),
      ),
    )
    .orderBy(desc(reviews.createdAt), desc(reviews.id))
    .limit(21)
    .offset((page - 1) * 20),
    db
      .select({ rating: reviews.rating, count: count() })
      .from(reviews)
      .where(
        and(
          eq(reviews.establishmentId, establishmentId),
          eq(reviews.status, PUBLIC_REVIEW_STATUSES),
        ),
      )
      .groupBy(reviews.rating),
  ]);

  const summary = summariesFromRows(
    ratingRows.map((row) => ({ ...row, establishmentId })),
  )[establishmentId] ?? emptySummary();

  return {
    data: rows.slice(0, 20),
    pagination: { page, pageSize: 20, hasMore: rows.length > 20 },
    summary,
  };
}

export async function getOwnReview(userId: string, establishmentId: string) {
  const [row] = await getDatabase()
    .select({
      id: reviews.id,
      rating: reviews.rating,
      comment: reviews.comment,
      status: reviews.status,
      createdAt: reviews.createdAt,
      updatedAt: reviews.updatedAt,
    })
    .from(reviews)
    .where(and(eq(reviews.userId, userId), eq(reviews.establishmentId, establishmentId)))
    .limit(1);

  return row ?? null;
}

export async function listOwnReviews(userId: string, page: number) {
  const rows = await getDatabase()
    .select({
      id: reviews.id,
      establishmentId: reviews.establishmentId,
      rating: reviews.rating,
      comment: reviews.comment,
      status: reviews.status,
      createdAt: reviews.createdAt,
      updatedAt: reviews.updatedAt,
    })
    .from(reviews)
    .where(eq(reviews.userId, userId))
    .orderBy(desc(reviews.updatedAt))
    .limit(21)
    .offset((page - 1) * 20);

  return { data: rows.slice(0, 20), pagination: { page, pageSize: 20, hasMore: rows.length > 20 } };
}

export async function listReviewsForModeration(status: "published" | "hidden", page: number) {
  const rows = await getDatabase()
    .select({
      id: reviews.id,
      establishmentId: reviews.establishmentId,
      rating: reviews.rating,
      comment: reviews.comment,
      status: reviews.status,
      createdAt: reviews.createdAt,
      updatedAt: reviews.updatedAt,
      authorName: users.name,
    })
    .from(reviews)
    .innerJoin(users, eq(reviews.userId, users.id))
    .where(eq(reviews.status, status))
    .orderBy(desc(reviews.createdAt))
    .limit(21)
    .offset((page - 1) * 20);

  return { data: rows.slice(0, 20), pagination: { page, pageSize: 20, hasMore: rows.length > 20 } };
}

export async function setReviewModerationStatus(
  reviewId: string,
  actorUserId: string,
  nextStatus: "published" | "hidden",
) {
  return getDatabase().transaction(async (tx) => {
    const [current] = await tx
      .select({ status: reviews.status })
      .from(reviews)
      .where(eq(reviews.id, reviewId))
      .for("update")
      .limit(1);

    if (!current) return null;
    if (current.status === nextStatus) return { id: reviewId, status: nextStatus };

    await tx
      .update(reviews)
      .set({ status: nextStatus, updatedAt: new Date() })
      .where(eq(reviews.id, reviewId));
    await tx.insert(reviewModerationLogs).values({
      reviewId,
      actorUserId,
      previousStatus: current.status,
      nextStatus,
    });

    return { id: reviewId, status: nextStatus };
  });
}

export async function createReview(
  userId: string,
  establishmentId: string,
  input: ReviewInput,
) {
  const [row] = await getDatabase()
    .insert(reviews)
    .values({ userId, establishmentId, ...input })
    .returning({
      id: reviews.id,
      rating: reviews.rating,
      comment: reviews.comment,
      createdAt: reviews.createdAt,
      updatedAt: reviews.updatedAt,
    });

  return row;
}

export async function updateOwnReview(
  userId: string,
  establishmentId: string,
  input: ReviewInput,
) {
  const [row] = await getDatabase()
    .update(reviews)
    .set({
      ...input,
      status: sql`CASE WHEN ${reviews.status} = 'removed' THEN 'published' ELSE ${reviews.status} END`,
      updatedAt: new Date(),
    })
    .where(and(eq(reviews.userId, userId), eq(reviews.establishmentId, establishmentId)))
    .returning({
      id: reviews.id,
      rating: reviews.rating,
      comment: reviews.comment,
      status: reviews.status,
      createdAt: reviews.createdAt,
      updatedAt: reviews.updatedAt,
    });

  return row ?? null;
}

export async function removeOwnReview(userId: string, establishmentId: string) {
  const [row] = await getDatabase()
    .update(reviews)
    .set({ status: "removed", updatedAt: new Date() })
    .where(and(eq(reviews.userId, userId), eq(reviews.establishmentId, establishmentId)))
    .returning({ id: reviews.id });

  return Boolean(row);
}

export function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  if ("code" in error && error.code === "23505") return true;
  return "cause" in error && isUniqueViolation(error.cause);
}
