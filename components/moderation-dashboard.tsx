"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { authClient } from "@/lib/auth-client";

type ModerationReview = {
  id: string;
  establishmentId: string;
  rating: number;
  comment: string;
  status: "published" | "hidden" | "removed";
  createdAt: string;
  updatedAt: string;
  authorName: string;
};

type Payload = {
  success: boolean;
  data?: ModerationReview[];
  pagination?: { page: number; pageSize: number; hasMore: boolean };
  message?: string;
};

export function ModerationDashboard() {
  const { data: session, isPending } = authClient.useSession();
  const [status, setStatus] = useState<"hidden" | "published">("hidden");
  const [reviews, setReviews] = useState<ModerationReview[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [pendingId, setPendingId] = useState("");

  const load = useCallback(async (nextPage = 1, append = false) => {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/reviews?status=${status}&page=${nextPage}`, { cache: "no-store" });
      const payload = await response.json() as Payload;
      if (!response.ok || !payload.success) throw new Error(payload.message ?? "Impossible de charger les avis.");
      setReviews((current) => append ? [...current, ...(payload.data ?? [])] : payload.data ?? []);
      setPage(nextPage);
      setHasMore(payload.pagination?.hasMore ?? false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Impossible de charger les avis.");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    if (!session || session.user.role !== "admin") return;
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [session, load]);

  async function changeStatus(review: ModerationReview, nextStatus: "hidden" | "published") {
    setPendingId(review.id);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/reviews/${review.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const payload = await response.json() as { success: boolean; message?: string };
      if (!response.ok || !payload.success) throw new Error(payload.message ?? "Impossible de modérer cet avis.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Impossible de modérer cet avis.");
    } finally {
      setPendingId("");
    }
  }

  if (isPending) return <main className="page-container"><div className="profile-skeleton" /></main>;
  if (!session || session.user.role !== "admin") {
    return (
      <main className="page-container profile-page">
        <div className="eyebrow">CONAKRY GUIDE · MODÉRATION</div>
        <h1 className="page-heading">Espace <em>réservé.</em></h1>
        <div className="profile-locked"><span aria-hidden="true">⌑</span><h2>Accès réservé à l’équipe de modération.</h2><p>Cette page nécessite un compte administrateur.</p><Link className="button button-dark" href="/">Retour à l’accueil</Link></div>
      </main>
    );
  }

  return (
    <main className="page-container profile-page">
      <div className="eyebrow">CONAKRY GUIDE · MODÉRATION</div>
      <div className="profile-heading-row"><div><h1 className="page-heading">Garder le <em>bon esprit.</em></h1><p>Masquez un avis qui ne respecte pas les règles, ou republiez-le après vérification.</p></div></div>
      <div className="moderation-toolbar" role="tablist" aria-label="Filtrer les avis">
        <button aria-selected={status === "hidden"} onClick={() => setStatus("hidden")} role="tab" type="button">À examiner</button>
        <button aria-selected={status === "published"} onClick={() => setStatus("published")} role="tab" type="button">Avis publiés</button>
      </div>
      {message ? <div className="inline-error" role="alert">{message}</div> : null}
      {loading && !reviews.length ? <div className="review-loading"><span /><span /><span /></div> : null}
      {!loading && !message && reviews.length === 0 ? <div className="profile-empty"><span aria-hidden="true">✳</span><h3>Tout est à jour.</h3><p>Aucun avis dans cette section pour le moment.</p></div> : null}
      <div className="moderation-list">
        {reviews.map((review) => (
          <article className="moderation-card" key={review.id}>
            <div className="moderation-card-top"><div><span className={`review-status status-${review.status}`}>{review.status === "hidden" ? "Masqué" : "Publié"}</span><span className="moderation-author">par {review.authorName}</span></div><span className="profile-review-rating"><span>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</span><strong>{review.rating}/5</strong></span></div>
            <p>{review.comment}</p>
            <div className="moderation-card-bottom"><Link href={`/establishments/${encodeURIComponent(review.establishmentId)}`}>Fiche {review.establishmentId} <span aria-hidden="true">↗</span></Link><button className="button button-outline" disabled={pendingId === review.id} onClick={() => void changeStatus(review, status === "hidden" ? "published" : "hidden")} type="button">{pendingId === review.id ? "Mise à jour…" : status === "hidden" ? "Publier l’avis" : "Masquer l’avis"}</button></div>
          </article>
        ))}
      </div>
      {hasMore ? <button className="button button-outline profile-load-more" disabled={loading} onClick={() => void load(page + 1, true)} type="button">Afficher plus</button> : null}
    </main>
  );
}
