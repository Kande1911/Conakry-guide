import Link from "next/link";

import type { Establishment } from "@/lib/external-api/types";
import type { ReviewSummary } from "@/lib/reviews/service";

type Props = {
  establishment: Establishment;
  summary?: ReviewSummary;
  compact?: boolean;
};

export function EstablishmentCard({ establishment, summary, compact = false }: Props) {
  const image = establishment.mainImage ?? establishment.secondaryImages[0] ?? null;

  return (
    <article className={`establishment-card${compact ? " establishment-card-compact" : ""}`}>
      <Link
        className="card-image-link"
        href={`/establishments/${encodeURIComponent(establishment.id)}`}
        aria-label={`Découvrir ${establishment.name}`}
      >
        {image ? (
          // The upstream API supplies image hosts dynamically, so next/image cannot use a fixed allowlist.
          // eslint-disable-next-line @next/next/no-img-element
          <img className="card-image" src={image} alt={establishment.name} loading="lazy" decoding="async" />
        ) : (
          <span className="image-placeholder" aria-label="Photo indisponible">
            <span className="placeholder-initial">{establishment.name.slice(0, 1)}</span>
          </span>
        )}
        <span className="category-pill">{establishment.category}</span>
      </Link>
      <div className="card-content">
        <div className="card-title-row">
          <h3>
            <Link href={`/establishments/${encodeURIComponent(establishment.id)}`}>
              {establishment.name}
            </Link>
          </h3>
          <span className="rating-inline" aria-label={summary?.average ? `Note ${summary.average} sur 5` : "Pas encore noté"}>
            <span aria-hidden="true">★</span> {summary?.average?.toFixed(1) ?? "Nouveau"}
          </span>
        </div>
        <p className="card-location">
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M10 18s6-5.5 6-10a6 6 0 1 0-12 0c0 4.5 6 10 6 10Z" />
            <circle cx="10" cy="8" r="2" />
          </svg>
          {establishment.address ?? "Conakry"}
        </p>
        {!compact && establishment.description ? (
          <p className="card-description">{establishment.description}</p>
        ) : null}
        <div className="card-bottom-row">
          <span>{summary?.count ?? 0} avis</span>
          <Link className="card-link" href={`/establishments/${encodeURIComponent(establishment.id)}`}>
            Voir la fiche <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </article>
  );
}
