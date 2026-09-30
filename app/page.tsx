import Link from "next/link";
import { connection } from "next/server";

import { EstablishmentCard } from "@/components/establishment-card";
import { ServiceMessage } from "@/components/service-message";
import { listEstablishments } from "@/lib/external-api/service";
import { getPublicError } from "@/lib/external-api/errors";
import type { Establishment } from "@/lib/external-api/types";
import {
  getRecentlyReviewedEstablishmentIds,
  getReviewSummaries,
  type ReviewSummary,
} from "@/lib/reviews/service";
import { rankRecommendedEstablishments } from "@/lib/reviews/rankings";

function EstablishmentSection({
  id,
  eyebrow,
  title,
  accent,
  establishments,
  summaries,
  href,
  linkLabel,
  emptyMessage,
  description,
}: {
  id: string;
  eyebrow: string;
  title: string;
  accent: string;
  establishments: Establishment[];
  summaries: Record<string, ReviewSummary>;
  href: string;
  linkLabel: string;
  emptyMessage: string;
  description?: string;
}) {
  return (
    <section className="featured-section home-establishment-section" aria-labelledby={id}>
      <div className="section-heading-row">
        <div>
          <div className="eyebrow">{eyebrow}</div>
          <h2 id={id}>{title} <em>{accent}</em></h2>
          {description ? <p className="section-description">{description}</p> : null}
        </div>
        <Link className="section-link" href={href}>{linkLabel} <span aria-hidden="true">↗</span></Link>
      </div>
      {establishments.length ? (
        <div className="establishment-grid featured-grid">
          {establishments.map((establishment) => (
            <EstablishmentCard key={establishment.id} establishment={establishment} summary={summaries[establishment.id]} />
          ))}
        </div>
      ) : <p className="muted-copy">{emptyMessage}</p>}
    </section>
  );
}

export default async function HomePage() {
  await connection();

  let establishments;
  try {
    establishments = await listEstablishments();
  } catch (error) {
    const publicError = getPublicError(error);
    return (
      <>
        <section className="hero hero-unavailable">
          <div className="hero-content">
            <div className="eyebrow eyebrow-light"><span className="eyebrow-dot" /> LE CARNET DE CONAKRY</div>
            <h1>La ville a tant<br />à <em>vous raconter.</em></h1>
            <p>Des tables de Kaloum aux ruelles de Ratoma, trouvez l’adresse de votre prochaine belle histoire.</p>
            <form action="/establishments" className="hero-search">
              <label htmlFor="home-search">Une envie, un quartier, un nom…</label>
              <div className="hero-search-row">
                <input id="home-search" name="q" placeholder="Ex. brunch, Dixinn, hôtel…" type="search" />
                <button aria-label="Rechercher" type="submit">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></svg>
                  <span>Explorer</span>
                </button>
              </div>
            </form>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="hero-sun" />
            <div className="hero-orbit hero-orbit-one" />
            <div className="hero-orbit hero-orbit-two" />
            <div className="hero-art-label">VOTRE VILLE,<br />VUE AUTREMENT</div>
            <span className="hero-star hero-star-one">✳</span>
            <span className="hero-star hero-star-two">✳</span>
          </div>
        </section>

        <section className="home-content">
          <div className="home-error-wrap"><ServiceMessage message={publicError.message} /></div>
          <div className="home-note">
            <span className="note-icon" aria-hidden="true">✳</span>
            <div><strong>Les bonnes adresses, par les gens d’ici.</strong><p>Chaque lieu raconte un bout de Conakry. À vous de trouver le vôtre.</p></div>
          </div>
        </section>
      </>
    );
  }

  let summaries: Record<string, ReviewSummary> = {};
  let recentlyReviewedIds: string[] = [];
  if (process.env.DATABASE_URL && establishments.length) {
    try {
      const ids = establishments.map(({ id }) => id);
      [summaries, recentlyReviewedIds] = await Promise.all([
        getReviewSummaries(ids),
        getRecentlyReviewedEstablishmentIds(ids, 3),
      ]);
    } catch {
      summaries = {};
      recentlyReviewedIds = [];
    }
  }

  const categories = [...new Set(establishments.map(({ category }) => category))];
  const reviewed = establishments.filter((establishment) => (summaries[establishment.id]?.count ?? 0) > 0);
  const popular = [...reviewed]
    .sort((left, right) => (summaries[right.id].count - summaries[left.id].count) ||
      ((summaries[right.id].average ?? 0) - (summaries[left.id].average ?? 0)))
    .slice(0, 3);
  const topRated = [...reviewed]
    .sort((left, right) => ((summaries[right.id].average ?? 0) - (summaries[left.id].average ?? 0)) ||
      (summaries[right.id].count - summaries[left.id].count))
    .slice(0, 3);
  const recommended = rankRecommendedEstablishments(establishments, summaries).slice(0, 3);
  const establishmentsById = new Map(establishments.map((establishment) => [establishment.id, establishment]));
  const recentlyReviewed = recentlyReviewedIds
    .map((id) => establishmentsById.get(id))
    .filter((establishment): establishment is Establishment => Boolean(establishment));

  return (
    <>
      <section className="hero">
        <div className="hero-content">
          <div className="eyebrow eyebrow-light"><span className="eyebrow-dot" /> LE CARNET DE CONAKRY</div>
          <h1>La ville a tant<br />à <em>vous raconter.</em></h1>
          <p>Des tables de Kaloum aux ruelles de Ratoma, trouvez l’adresse de votre prochaine belle histoire.</p>
          <form action="/establishments" className="hero-search">
            <label htmlFor="home-search">Une envie, un quartier, un nom…</label>
            <div className="hero-search-row">
              <input id="home-search" name="q" placeholder="Ex. brunch, Dixinn, hôtel…" type="search" />
              <button aria-label="Rechercher" type="submit">
                <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></svg>
                <span>Explorer</span>
              </button>
            </div>
          </form>
          <p className="hero-count"><strong>{establishments.length}</strong> adresses à découvrir <span>·</span> Une ville, mille façons de l’aimer</p>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="hero-sun" />
          <div className="hero-orbit hero-orbit-one" />
          <div className="hero-orbit hero-orbit-two" />
          <div className="hero-art-label">VOTRE VILLE,<br />VUE AUTREMENT</div>
          <span className="hero-star hero-star-one">✳</span>
          <span className="hero-star hero-star-two">✳</span>
        </div>
        <div className="hero-bottom-line"><span>9° 30′ N</span><span>CONAKRY · GUINÉE</span><span>13° 42′ O</span></div>
      </section>

      <main className="home-content">
        <section className="category-section" aria-labelledby="categories-title">
          <div className="section-heading-row">
            <div><div className="eyebrow">À CHACUN SON CONAKRY</div><h2 id="categories-title">Je cherche une <em>ambiance.</em></h2></div>
            <Link className="section-link" href="/establishments">Toutes les adresses <span aria-hidden="true">↗</span></Link>
          </div>
          {categories.length ? (
            <div className="category-list">
              {categories.map((category, index) => (
                <Link
                  className={`category-tile category-tile-${index % 6}`}
                  href={`/establishments?category=${encodeURIComponent(category)}`}
                  key={category}
                >
                  <span className="category-tile-symbol" aria-hidden="true">{["✳", "◌", "⌂", "✦", "◒", "⌁"][index % 6]}</span>
                  <span>{category}</span>
                  <span className="category-tile-arrow" aria-hidden="true">↗</span>
                </Link>
              ))}
            </div>
          ) : <p className="muted-copy">Les catégories seront affichées dès que les adresses seront disponibles.</p>}
        </section>

        <EstablishmentSection
          id="popular-title"
          eyebrow="LES PLUS COMMENTÉES"
          title="On en parle"
          accent="en ville."
          establishments={popular}
          summaries={summaries}
          href="/establishments?sort=popular"
          linkLabel="Voir les adresses populaires"
          description="Classées selon le nombre d’avis publiés."
          emptyMessage="Les adresses populaires apparaîtront dès les premiers avis de la communauté."
        />

        <EstablishmentSection
          id="top-rated-title"
          eyebrow="LES MIEUX NOTÉES"
          title="Les coups de cœur"
          accent="de Conakry."
          establishments={topRated}
          summaries={summaries}
          href="/establishments?sort=rating"
          linkLabel="Toutes les mieux notées"
          emptyMessage="Les meilleures notes apparaîtront après les premiers avis publiés."
        />

        <EstablishmentSection
          id="recommended-title"
          eyebrow="SÉLECTION DE LA COMMUNAUTÉ"
          title="Nos adresses"
          accent="recommandées."
          establishments={recommended}
          summaries={summaries}
          href="/establishments?sort=recommended"
          linkLabel="Explorer les recommandations"
          description="La sélection tient compte de la note moyenne et du nombre d’avis."
          emptyMessage="Les recommandations apparaîtront dès que la communauté aura partagé ses avis."
        />

        <EstablishmentSection
          id="recent-title"
          eyebrow="L’ACTUALITÉ DES ADRESSES"
          title="Récemment"
          accent="commentées."
          establishments={recentlyReviewed}
          summaries={summaries}
          href="/establishments?sort=recent"
          linkLabel="Voir les avis récents"
          emptyMessage="Les adresses commentées récemment apparaîtront ici."
        />

        <section className="community-band">
          <span className="community-spark" aria-hidden="true">✳</span>
          <div><div className="eyebrow eyebrow-light">VOTRE REGARD COMPTE</div><h2>Un lieu que vous aimez ?<br /><em>Faites-le savoir.</em></h2></div>
          <p>Un avis sincère aide quelqu’un à trouver sa prochaine adresse préférée.</p>
          <Link className="button button-cream" href="/register">Rejoindre la communauté <span aria-hidden="true">→</span></Link>
        </section>

        <div className="home-note">
          <span className="note-icon" aria-hidden="true">✳</span>
          <div><strong>Les bonnes adresses, par les gens d’ici.</strong><p>Chaque lieu raconte un bout de Conakry. À vous de trouver le vôtre.</p></div>
        </div>
      </main>
    </>
  );
}
