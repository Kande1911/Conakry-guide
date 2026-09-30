"use client";

import { useMemo, useState } from "react";

import type { Establishment } from "@/lib/external-api/types";
import type { ReviewSummary } from "@/lib/reviews/service";
import { rankRecommendedEstablishments } from "@/lib/reviews/rankings";
import { EstablishmentCard } from "./establishment-card";

type Props = {
  establishments: Establishment[];
  summaries: Record<string, ReviewSummary>;
  recentEstablishmentIds?: string[];
  initialQuery?: string;
  initialCategory?: string;
  initialLocation?: string;
  initialSort?: string;
  initialMinRating?: string;
};

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr");
}

export function EstablishmentBrowser({
  establishments,
  summaries,
  recentEstablishmentIds = [],
  initialQuery = "",
  initialCategory = "",
  initialLocation = "",
  initialSort = "relevance",
  initialMinRating = "",
}: Props) {
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState(initialCategory);
  const [location, setLocation] = useState(initialLocation);
  const [sort, setSort] = useState(initialSort);
  const [minRating, setMinRating] = useState(initialMinRating);
  const [visibleCount, setVisibleCount] = useState(12);
  const categories = useMemo(
    () => [...new Set(establishments.map(({ category: name }) => name))].sort((a, b) => a.localeCompare(b, "fr")),
    [establishments],
  );
  const recentRank = useMemo(
    () => new Map(recentEstablishmentIds.map((id, index) => [id, index])),
    [recentEstablishmentIds],
  );
  const recommendedRank = useMemo(
    () => new Map(rankRecommendedEstablishments(establishments, summaries).map(({ id }, index) => [id, index])),
    [establishments, summaries],
  );

  const visible = useMemo(() => {
    const terms = normalize(query).split(/\s+/).filter(Boolean);
    const filtered = establishments.filter((establishment) => {
      if (category && establishment.category !== category) return false;
      if (location && !normalize(establishment.address ?? "").includes(normalize(location))) return false;
      if (minRating && (summaries[establishment.id]?.average ?? 0) < Number(minRating)) return false;
      const searchable = normalize([
        establishment.name,
        establishment.category,
        establishment.address ?? "",
        establishment.description ?? "",
      ].join(" "));
      return terms.every((term) => searchable.includes(term));
    });

    return filtered.sort((left, right) => {
      const leftSummary = summaries[left.id];
      const rightSummary = summaries[right.id];
      if (sort === "rating") {
        return (rightSummary?.average ?? 0) - (leftSummary?.average ?? 0) ||
          (rightSummary?.count ?? 0) - (leftSummary?.count ?? 0);
      }
      if (sort === "popular") {
        return (rightSummary?.count ?? 0) - (leftSummary?.count ?? 0) ||
          (rightSummary?.average ?? 0) - (leftSummary?.average ?? 0);
      }
      if (sort === "recommended") {
        const leftRank = recommendedRank.get(left.id);
        const rightRank = recommendedRank.get(right.id);
        if (leftRank === undefined && rightRank === undefined) return 0;
        if (leftRank === undefined) return 1;
        if (rightRank === undefined) return -1;
        return leftRank - rightRank;
      }
      if (sort === "recent") {
        const leftRank = recentRank.get(left.id);
        const rightRank = recentRank.get(right.id);
        if (leftRank === undefined && rightRank === undefined) return 0;
        if (leftRank === undefined) return 1;
        if (rightRank === undefined) return -1;
        return leftRank - rightRank;
      }
      if (sort === "name") return left.name.localeCompare(right.name, "fr");
      if (sort === "category") {
        return left.category.localeCompare(right.category, "fr") || left.name.localeCompare(right.name, "fr");
      }
      return 0;
    });
  }, [establishments, query, category, location, sort, minRating, summaries, recentRank, recommendedRank]);

  function clearFilters() {
    setQuery("");
    setCategory("");
    setLocation("");
    setSort("relevance");
    setMinRating("");
    setVisibleCount(12);
  }

  return (
    <>
      <div className="directory-toolbar">
        <label className="field-control search-control">
          <span className="sr-only">Rechercher un établissement</span>
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></svg>
          <input
            value={query}
            onChange={(event) => { setQuery(event.target.value); setVisibleCount(12); }}
            placeholder="Nom, catégorie ou quartier…"
            type="search"
          />
        </label>
        <label className="field-control location-control">
          <span className="sr-only">Filtrer par quartier ou localisation</span>
          <input
            value={location}
            onChange={(event) => { setLocation(event.target.value); setVisibleCount(12); }}
            placeholder="Quartier / localisation…"
            type="search"
          />
        </label>
        <label className="field-control select-control">
          <span className="sr-only">Filtrer par catégorie</span>
          <select value={category} onChange={(event) => { setCategory(event.target.value); setVisibleCount(12); }}>
            <option value="">Toutes les catégories</option>
            {categories.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <label className="field-control select-control rating-filter-control">
          <span className="sr-only">Filtrer par note minimum</span>
          <select value={minRating} onChange={(event) => { setMinRating(event.target.value); setVisibleCount(12); }}>
            <option value="">Toutes les notes</option>
            <option value="4">4 étoiles et plus</option>
            <option value="3">3 étoiles et plus</option>
          </select>
        </label>
        <label className="field-control select-control sort-control">
          <span className="sr-only">Trier les établissements</span>
          <select value={sort} onChange={(event) => { setSort(event.target.value); setVisibleCount(12); }}>
            <option value="relevance">Ordre de la source</option>
            <option value="recent">Récemment commentés</option>
            <option value="recommended">Recommandés par la communauté</option>
            <option value="rating">Mieux notés</option>
            <option value="popular">Plus d’avis</option>
            <option value="name">Nom A–Z</option>
            <option value="category">Catégorie A–Z</option>
          </select>
        </label>
      </div>

      <div className="results-meta" aria-live="polite">
        <p><strong>{visible.length}</strong> adresse{visible.length === 1 ? "" : "s"} trouvée{visible.length === 1 ? "" : "s"}</p>
        {(query || category || location || minRating || sort !== "relevance") ? (
          <button className="text-button" onClick={clearFilters} type="button">Effacer les filtres</button>
        ) : null}
      </div>

      {visible.length ? (
        <div className="establishment-grid">
          {visible.slice(0, visibleCount).map((establishment) => (
            <EstablishmentCard
              key={establishment.id}
              establishment={establishment}
              summary={summaries[establishment.id]}
            />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <span aria-hidden="true">⌕</span>
          <h2>Aucune adresse trouvée</h2>
          <p>Essayez un autre nom, quartier ou catégorie.</p>
          <button className="button button-dark" onClick={clearFilters} type="button">Réinitialiser</button>
        </div>
      )}
      {visible.length > visibleCount ? (
        <button className="button button-outline directory-load-more" onClick={() => setVisibleCount((count) => count + 12)} type="button">
          Afficher 12 adresses de plus <span aria-hidden="true">↓</span>
        </button>
      ) : null}
    </>
  );
}
