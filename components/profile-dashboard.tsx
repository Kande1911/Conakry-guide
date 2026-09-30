"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { authClient } from "@/lib/auth-client";

type ProfileReview = {
  id: string;
  establishmentId: string;
  rating: number;
  comment: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type Payload = {
  success: boolean;
  data?: ProfileReview[];
  pagination?: { page: number; pageSize: number; hasMore: boolean };
  message?: string;
};

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(value));
}

export function ProfileDashboard({ reviewsOnly = false }: { reviewsOnly?: boolean }) {
  const { data: session, isPending } = authClient.useSession();
  const [reviews, setReviews] = useState<ProfileReview[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (targetPage = 1, append = false) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/profile/reviews?page=${targetPage}`, { cache: "no-store" });
      const payload = await response.json() as Payload;
      if (!response.ok || !payload.success) throw new Error(payload.message ?? "Impossible de charger vos avis.");
      setReviews((current) => append ? [...current, ...(payload.data ?? [])] : payload.data ?? []);
      setPage(targetPage);
      setHasMore(payload.pagination?.hasMore ?? false);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Impossible de charger vos avis.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [session, load]);

  if (isPending) {
    return <main className="page-container profile-page"><div className="profile-skeleton" /></main>;
  }

  if (!session) {
    return (
      <main className="page-container profile-page">
        <div className="eyebrow">VOTRE ESPACE</div>
        <h1 className="page-heading">Un carnet à <em>vous.</em></h1>
        <div className="profile-locked"><span aria-hidden="true">⌑</span><h2>Connectez-vous pour retrouver vos avis.</h2><p>Votre espace personnel rassemble les notes et les adresses que vous avez partagées.</p><Link className="button button-dark" href="/login?next=%2Fprofile">Se connecter</Link></div>
      </main>
    );
  }

  return (
    <main className="page-container profile-page">
      <div className="eyebrow">VOTRE ESPACE</div>
      <div className="profile-heading-row">
        <div><h1 className="page-heading">Bonjour, <em>{session.user.name.split(" ")[0]}.</em></h1><p>Votre carnet d’adresses et d’expériences.</p></div>
        <Link className="button button-outline" href="/profile/reviews">Gérer mes avis <span aria-hidden="true">→</span></Link>
      </div>

      <section className="profile-summary-card">
        <span className="profile-large-avatar" aria-hidden="true">{session.user.name.slice(0, 1).toUpperCase()}</span>
        <div><span className="eyebrow">MON COMPTE</span><h2>{session.user.name}</h2><p>{session.user.email}</p></div>
        <span className="profile-review-total"><strong>{reviews.length}{hasMore ? "+" : ""}</strong><small>avis partagés</small></span>
      </section>

      <div className="profile-list-heading"><div><div className="eyebrow">MES CONTRIBUTIONS</div><h2>{reviewsOnly ? "Gérer mes avis" : "Mes avis récents"}</h2></div><Link href="/establishments">Découvrir une adresse <span aria-hidden="true">↗</span></Link></div>
      {error ? <div className="inline-error" role="alert">{error}</div> : null}
      {loading && !reviews.length ? <div className="review-loading"><span /><span /><span /></div> : null}
      {!loading && !error && reviews.length === 0 ? <div className="profile-empty"><span aria-hidden="true">✳</span><h3>Votre carnet est encore vide.</h3><p>Partagez un premier avis pour aider quelqu’un à découvrir une belle adresse.</p><Link className="button button-dark" href="/establishments">Explorer les adresses</Link></div> : null}
      <div className="profile-review-list">
        {reviews.map((review) => (
          <article className="profile-review-card" key={review.id}>
            <div className="profile-review-top"><span className={`review-status status-${review.status}`}>{review.status === "published" ? "Publié" : review.status === "hidden" ? "En modération" : "Retiré"}</span><time>{dateLabel(review.updatedAt)}</time></div>
            <div className="profile-review-rating"><span>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</span><strong>{review.rating}/5</strong></div>
            <p>{review.comment}</p>
            <Link href={`/establishments/${encodeURIComponent(review.establishmentId)}#avis`}>Voir ou modifier mon avis <span aria-hidden="true">→</span></Link>
          </article>
        ))}
      </div>
      {hasMore ? <button className="button button-outline profile-load-more" disabled={loading} onClick={() => void load(page + 1, true)} type="button">{loading ? "Chargement…" : "Afficher plus"}</button> : null}
    </main>
  );
}
