"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { Establishment, EstablishmentCategory } from "@/lib/external-api/types";
import type { ReviewSummary } from "@/lib/reviews/service";
import { rankRecommendedEstablishments } from "@/lib/reviews/rankings";
import { EstablishmentCard } from "./establishment-card";

type Pagination = {
  count: number;
  limit: number;
  offset: number;
  hasMore: boolean;
};

type PageResponse = {
  success: boolean;
  data: Establishment[];
  summaries?: Record<string, ReviewSummary>;
  recentEstablishmentIds?: string[];
  pagination: Pagination;
  message?: string;
};

type Props = {
  establishments: Establishment[];
  summaries: Record<string, ReviewSummary>;
  recentEstablishmentIds?: string[];
  categories: EstablishmentCategory[];
  pagination: Pagination;
  initialQuery?: string;
  initialCategory?: string;
  initialLocation?: string;
  initialSort?: string;
  initialMinRating?: string;
};

function buildPageUrl({
  query,
  category,
  location,
  minRating,
  offset,
}: {
  query: string;
  category: string;
  location: string;
  minRating: string;
  offset: number;
}) {
  const params = new URLSearchParams({ limit: "50", offset: String(offset) });
  if (query.trim()) params.set("q", query.trim());
  if (category) params.set("category", category);
  if (location.trim()) params.set("location", location.trim());
  if (minRating) params.set("minRating", minRating);
  return `/api/establishments?${params.toString()}`;
}

export function EstablishmentBrowser({
  establishments: initialEstablishments,
  summaries: initialSummaries,
  recentEstablishmentIds: initialRecentIds = [],
  categories,
  pagination: initialPagination,
  initialQuery = "",
  initialCategory = "",
  initialLocation = "",
  initialSort = "relevance",
  initialMinRating = "",
}: Props) {
  const [establishments, setEstablishments] = useState(initialEstablishments);
  const [summaries, setSummaries] = useState(initialSummaries);
  const [recentEstablishmentIds, setRecentEstablishmentIds] = useState(initialRecentIds);
  const [totalCount, setTotalCount] = useState(initialPagination.count);
  const [nextOffset, setNextOffset] = useState(initialPagination.offset + initialPagination.limit);
  const [hasMore, setHasMore] = useState(initialPagination.hasMore);
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState(initialCategory);
  const [location, setLocation] = useState(initialLocation);
  const [sort, setSort] = useState(initialSort);
  const [minRating, setMinRating] = useState(initialMinRating);
  const [visibleCount, setVisibleCount] = useState(12);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const firstFilterEffect = useRef(true);
  const requestGeneration = useRef(0);

  useEffect(() => {
    if (firstFilterEffect.current) {
      firstFilterEffect.current = false;
      return;
    }

    const generation = ++requestGeneration.current;
    const controller = new AbortController();
    setIsLoadingMore(false);
    const timer = window.setTimeout(async () => {
      setIsLoading(true);
      setErrorMessage("");
      setVisibleCount(12);

      try {
        const response = await fetch(buildPageUrl({ query, category, location, minRating, offset: 0 }), {
          signal: controller.signal,
        });
        const payload = await response.json() as PageResponse;
        if (!response.ok || !payload.success) {
          throw new Error(payload.message || "Impossible de rechercher les établissements.");
        }
        if (generation !== requestGeneration.current) return;

        setEstablishments(payload.data);
        setSummaries(payload.summaries ?? {});
        setRecentEstablishmentIds(payload.recentEstablishmentIds ?? []);
        setTotalCount(payload.pagination.count);
        setNextOffset(payload.pagination.offset + payload.pagination.limit);
        setHasMore(payload.pagination.hasMore);
      } catch (error) {
        if (controller.signal.aborted || generation !== requestGeneration.current) return;
        setEstablishments([]);
        setSummaries({});
        setRecentEstablishmentIds([]);
        setTotalCount(0);
        setNextOffset(0);
        setHasMore(false);
        setErrorMessage(error instanceof Error ? error.message : "Impossible de rechercher les établissements.");
      } finally {
        if (!controller.signal.aborted && generation === requestGeneration.current) setIsLoading(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, category, location, minRating]);

  const recentRank = useMemo(
    () => new Map(recentEstablishmentIds.map((id, index) => [id, index])),
    [recentEstablishmentIds],
  );
  const recommendedRank = useMemo(
    () => new Map(rankRecommendedEstablishments(establishments, summaries).map(({ id }, index) => [id, index])),
    [establishments, summaries],
  );

  const visible = useMemo(() => {
    return [...establishments].sort((left, right) => {
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
  }, [establishments, sort, summaries, recentRank, recommendedRank]);

  function clearFilters() {
    setQuery("");
    setCategory("");
    setLocation("");
    setSort("relevance");
    setMinRating("");
  }

  async function loadMore() {
    if (visible.length > visibleCount) {
      setVisibleCount((count) => count + 12);
      return;
    }
    if (!hasMore || isLoadingMore || isLoading) return;

    const generation = requestGeneration.current;
    setIsLoadingMore(true);
    setErrorMessage("");
    try {
      const response = await fetch(buildPageUrl({ query, category, location, minRating, offset: nextOffset }));
      const payload = await response.json() as PageResponse;
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || "Impossible de charger les adresses suivantes.");
      }
      if (generation !== requestGeneration.current) return;

      setEstablishments((current) => [...current, ...payload.data]);
      setSummaries((current) => ({ ...current, ...(payload.summaries ?? {}) }));
      setRecentEstablishmentIds((current) => [
        ...current,
        ...(payload.recentEstablishmentIds ?? []).filter((id) => !current.includes(id)),
      ]);
      setTotalCount(payload.pagination.count);
      setNextOffset(payload.pagination.offset + payload.pagination.limit);
      setHasMore(payload.pagination.hasMore);
      setVisibleCount((count) => count + 12);
    } catch (error) {
      if (generation === requestGeneration.current) {
        setErrorMessage(error instanceof Error ? error.message : "Impossible de charger les adresses suivantes.");
      }
    } finally {
      if (generation === requestGeneration.current) setIsLoadingMore(false);
    }
  }

  return (
    <>
      <div className="directory-toolbar">
        <label className="field-control search-control">
          <span className="sr-only">Rechercher un établissement</span>
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></svg>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nom, catégorie ou quartier…"
            type="search"
          />
        </label>
        <label className="field-control location-control">
          <span className="sr-only">Filtrer par quartier ou localisation</span>
          <input
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            placeholder="Quartier / localisation…"
            type="search"
          />
        </label>
        <label className="field-control select-control">
          <span className="sr-only">Filtrer par catégorie</span>
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">Toutes les catégories</option>
            {categories.map(({ id, name, slug }) => <option key={id} value={slug}>{name}</option>)}
          </select>
        </label>
        <label className="field-control select-control rating-filter-control">
          <span className="sr-only">Filtrer par note minimum</span>
          <select value={minRating} onChange={(event) => setMinRating(event.target.value)}>
            <option value="">Toutes les notes</option>
            <option value="4">4 étoiles et plus</option>
            <option value="3">3 étoiles et plus</option>
          </select>
        </label>
        <label className="field-control select-control sort-control">
          <span className="sr-only">Trier les établissements</span>
          <select value={sort} onChange={(event) => setSort(event.target.value)}>
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
        <p><strong>{totalCount}</strong> adresse{totalCount === 1 ? "" : "s"} trouvée{totalCount === 1 ? "" : "s"}</p>
        {(query || category || location || minRating || sort !== "relevance") ? (
          <button className="text-button" onClick={clearFilters} type="button">Effacer les filtres</button>
        ) : null}
      </div>

      {errorMessage ? <p className="service-message" role="alert">{errorMessage}</p> : null}
      {isLoading && establishments.length === 0 ? <p className="muted-copy" role="status">Recherche des adresses…</p> : null}
      {!isLoading && !errorMessage && visible.length === 0 ? (
        <div className="empty-state">
          <span aria-hidden="true">⌕</span>
          <h2>Aucune adresse trouvée</h2>
          <p>Essayez un autre nom, quartier ou catégorie.</p>
          <button className="button button-dark" onClick={clearFilters} type="button">Réinitialiser</button>
        </div>
      ) : null}
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
      ) : null}
      {visible.length > visibleCount || hasMore ? (
        <button className="button button-outline directory-load-more" onClick={loadMore} disabled={isLoading || isLoadingMore} type="button">
          {isLoadingMore ? "Chargement…" : "Afficher 12 adresses de plus"} <span aria-hidden="true">↓</span>
        </button>
      ) : null}
    </>
  );
}
