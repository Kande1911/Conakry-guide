"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { authClient } from "@/lib/auth-client";
import type { ReviewSummary } from "@/lib/reviews/service";

type PublicReview = {
  id: string;
  rating: number;
  comment: string;
  createdAt: string;
  updatedAt: string;
  authorName: string;
  authorImage: string | null;
};

type OwnReview = {
  id: string;
  rating: number;
  comment: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type ReviewsResponse = {
  success: boolean;
  data?: PublicReview[];
  pagination?: { page: number; pageSize: number; hasMore: boolean };
  summary?: ReviewSummary;
  message?: string;
};

const initialSummary: ReviewSummary = {
  average: null,
  count: 0,
  distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
};

function Stars({ value, size = "normal" }: { value: number; size?: "normal" | "large" }) {
  return (
    <span className={`stars${size === "large" ? " stars-large" : ""}`} aria-label={`${value} sur 5`}>
      {[1, 2, 3, 4, 5].map((star) => <span aria-hidden="true" className={star <= value ? "star-filled" : "star-empty"} key={star}>★</span>)}
    </span>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(value));
}

export function ReviewPanel({ establishmentId }: { establishmentId: string }) {
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [summary, setSummary] = useState(initialSummary);
  const [ownReview, setOwnReview] = useState<OwnReview | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  const loadReviews = useCallback(async (targetPage = 1, append = false) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/establishments/${encodeURIComponent(establishmentId)}/reviews?page=${targetPage}`, { cache: "no-store" });
      const payload = await response.json() as ReviewsResponse;
      if (!response.ok || !payload.success) throw new Error(payload.message ?? "Impossible de charger les avis.");
      setReviews((current) => append ? [...current, ...(payload.data ?? [])] : payload.data ?? []);
      setSummary(payload.summary ?? initialSummary);
      setHasMore(payload.pagination?.hasMore ?? false);
      setPage(targetPage);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Impossible de charger les avis.");
    } finally {
      setLoading(false);
    }
  }, [establishmentId]);

  const loadOwnReview = useCallback(async () => {
    if (!session) {
      setOwnReview(null);
      return;
    }
    try {
      const response = await fetch(`/api/establishments/${encodeURIComponent(establishmentId)}/reviews/me`, { cache: "no-store" });
      if (response.status === 401 || response.status === 503) return;
      const payload = await response.json() as { success: boolean; data: OwnReview | null };
      if (!response.ok || !payload.success) return;
      setOwnReview(payload.data);
      if (payload.data) {
        setRating(payload.data.rating);
        setComment(payload.data.comment);
      }
    } catch {
      // Public reviews remain available even if the private review lookup is unavailable.
    }
  }, [establishmentId, session]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadReviews(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadReviews]);
  useEffect(() => {
    const timer = window.setTimeout(() => { void loadOwnReview(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadOwnReview]);

  async function submitReview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setSubmitting(true);
    try {
      const method = ownReview ? "PATCH" : "POST";
      const response = await fetch(
        ownReview
          ? `/api/establishments/${encodeURIComponent(establishmentId)}/reviews/me`
          : `/api/establishments/${encodeURIComponent(establishmentId)}/reviews`,
        {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rating, comment }),
        },
      );
      const payload = await response.json() as { success: boolean; message?: string };
      if (!response.ok || !payload.success) throw new Error(payload.message ?? "Impossible d’enregistrer votre avis.");
      setNotice(ownReview ? "Votre avis a été mis à jour." : "Votre avis a été publié. Merci de partager votre expérience !");
      await Promise.all([loadReviews(), loadOwnReview()]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Impossible d’enregistrer votre avis.");
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteReview() {
    setError("");
    setNotice("");
    setSubmitting(true);
    try {
      const response = await fetch(`/api/establishments/${encodeURIComponent(establishmentId)}/reviews/me`, { method: "DELETE" });
      if (!response.ok) {
        const payload = await response.json() as { message?: string };
        throw new Error(payload.message ?? "Impossible de retirer l’avis.");
      }
      setNotice("Votre avis a été retiré.");
      await Promise.all([loadReviews(), loadOwnReview()]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Impossible de retirer l’avis.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="reviews-section" id="avis" aria-labelledby="reviews-title">
      <div className="reviews-heading">
        <div><div className="eyebrow">LA PAROLE À LA COMMUNAUTÉ</div><h2 id="reviews-title">Avis <em>& expériences.</em></h2></div>
        <div className="review-overview">
          <strong>{summary.average?.toFixed(1) ?? "—"}</strong>
          <div><Stars value={Math.round(summary.average ?? 0)} /><span>{summary.count} avis</span></div>
        </div>
      </div>

      <div className="review-layout">
        <div className="review-list-column">
          {error && !reviews.length ? <div className="inline-error" role="status">{error}</div> : null}
          {loading && !reviews.length ? <div className="review-loading"><span /><span /><span /></div> : null}
          {!loading && !error && reviews.length === 0 ? (
            <div className="review-empty"><span aria-hidden="true">✳</span><p>Pas encore d’avis. Vous pouvez être le premier à partager votre expérience.</p></div>
          ) : null}
          <div className="review-list">
            {reviews.map((review) => (
              <article className="review-card" key={review.id}>
                <div className="review-author">
                  {review.authorImage ? (
                    // Profile photos are supplied by the auth provider and can use arbitrary HTTPS hosts.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt="" className="review-avatar" src={review.authorImage} loading="lazy" />
                  ) : <span aria-hidden="true" className="review-avatar review-avatar-fallback">{review.authorName.slice(0, 1).toUpperCase()}</span>}
                  <div><strong>{review.authorName}</strong><time dateTime={review.createdAt}>{formatDate(review.createdAt)}</time></div>
                  <Stars value={review.rating} />
                </div>
                <p>{review.comment}</p>
                {review.updatedAt !== review.createdAt ? <small className="edited-label">Modifié le {formatDate(review.updatedAt)}</small> : null}
              </article>
            ))}
          </div>
          {hasMore ? <button className="button button-outline load-more" disabled={loading} onClick={() => void loadReviews(page + 1, true)} type="button">{loading ? "Chargement…" : "Afficher plus d’avis"}</button> : null}
        </div>

        <aside className="review-aside">
          <div className="rating-breakdown">
            <h3>Les notes</h3>
            {[5, 4, 3, 2, 1].map((value) => {
              const amount = summary.distribution[value as 1 | 2 | 3 | 4 | 5];
              const percent = summary.count ? amount / summary.count * 100 : 0;
              return <div className="breakdown-row" key={value}><span>{value} <b>★</b></span><div><i style={{ width: `${percent}%` }} /></div><small>{amount}</small></div>;
            })}
          </div>

          <div className="review-form-card">
            <div className="eyebrow">VOTRE EXPÉRIENCE</div>
            <h3>{ownReview ? "Modifier votre avis" : "Vous connaissez cette adresse ?"}</h3>
            {sessionPending ? <p className="muted-copy">Vérification de votre compte…</p> : session ? (
              <form className="review-form" onSubmit={submitReview}>
                {ownReview?.status === "removed" ? <p className="review-removed-note">Votre avis est retiré. En le modifiant, vous le republiez.</p> : null}
                <fieldset>
                  <legend>Votre note</legend>
                  <div className="rating-picker" role="radiogroup" aria-label="Choisir une note sur cinq">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <button
                        aria-checked={rating === value}
                        aria-label={`${value} étoile${value > 1 ? "s" : ""}`}
                        className={value <= rating ? "selected" : ""}
                        key={value}
                        onClick={() => setRating(value)}
                        role="radio"
                        type="button"
                      >★</button>
                    ))}
                  </div>
                </fieldset>
                <label htmlFor="review-comment">Votre commentaire</label>
                <textarea id="review-comment" maxLength={5000} onChange={(event) => setComment(event.target.value)} placeholder="Qu’avez-vous aimé ? Que conseilleriez-vous ?" required rows={4} value={comment} />
                <div className="review-form-foot"><span>{comment.length}/5000</span><button className="button button-dark" disabled={submitting} type="submit">{submitting ? "Enregistrement…" : ownReview ? "Enregistrer" : "Publier mon avis"}</button></div>
                {ownReview && ownReview.status !== "removed" ? <button className="remove-review" disabled={submitting} onClick={() => void deleteReview()} type="button">Retirer mon avis</button> : null}
              </form>
            ) : (
              <>
                <p>Connectez-vous pour partager votre expérience et aider la communauté.</p>
                <Link className="button button-dark review-login" href={`/login?next=${encodeURIComponent(`/establishments/${establishmentId}#avis`)}`}>Se connecter pour noter</Link>
              </>
            )}
            {error && (reviews.length > 0 || session) ? <p className="form-error" role="alert">{error}</p> : null}
            {notice ? <p className="form-success" role="status">{notice}</p> : null}
          </div>
        </aside>
      </div>
    </section>
  );
}
