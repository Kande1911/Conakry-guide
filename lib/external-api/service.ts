import {
  fetchExternalEstablishment,
  fetchExternalEstablishmentCategories,
  fetchExternalEstablishmentList,
  fetchExternalEstablishmentSearch,
} from "./client";
import { ExternalApiError } from "./errors";
import {
  mapExternalEstablishment,
  mapExternalEstablishmentCategories,
  mapExternalEstablishmentPage,
  mapExternalEstablishmentSearchPage,
} from "./mapper";
import type { Establishment, EstablishmentCategory, ExternalEstablishmentPage } from "./types";

export const ESTABLISHMENT_PAGE_SIZE = 50;
const PAGE_CONCURRENCY = 6;

export interface EstablishmentPageOptions {
  query?: string;
  category?: string;
  location?: string;
  minRating?: number;
  limit?: number;
  offset?: number;
}

function safeLimit(limit: number | undefined) {
  return Math.max(1, Math.min(ESTABLISHMENT_PAGE_SIZE, Math.trunc(limit ?? ESTABLISHMENT_PAGE_SIZE)));
}

function safeOffset(offset: number | undefined) {
  return Math.max(0, Math.min(1_000_000, Math.trunc(offset ?? 0)));
}

export async function getEstablishmentPage({
  query,
  category,
  location,
  minRating,
  limit: rawLimit,
  offset: rawOffset,
}: EstablishmentPageOptions = {}): Promise<ExternalEstablishmentPage> {
  const limit = safeLimit(rawLimit);
  const offset = safeOffset(rawOffset);
  const normalizedQuery = [query?.trim(), location?.trim()].filter(Boolean).join(" ");
  const hasSearchFilter = Boolean(normalizedQuery || category || minRating !== undefined);

  if (!hasSearchFilter) {
    const payload = await fetchExternalEstablishmentList(limit, offset);
    return mapExternalEstablishmentPage(payload, limit, offset);
  }

  const payload = await fetchExternalEstablishmentSearch({
    ...(normalizedQuery ? { query: normalizedQuery } : {}),
    ...(category ? { category } : {}),
    ...(minRating !== undefined ? { minRating } : {}),
    limit,
    offset,
  });
  return mapExternalEstablishmentSearchPage(payload, limit, offset);
}

export async function listEstablishmentCategories(): Promise<EstablishmentCategory[]> {
  return mapExternalEstablishmentCategories(await fetchExternalEstablishmentCategories());
}

export async function listEstablishments(): Promise<Establishment[]> {
  const firstPage = await getEstablishmentPage({ limit: ESTABLISHMENT_PAGE_SIZE, offset: 0 });
  const establishments = [...firstPage.data];
  const offsets: number[] = [];

  for (let offset = firstPage.limit; offset < firstPage.count; offset += firstPage.limit) {
    offsets.push(offset);
  }

  for (let index = 0; index < offsets.length; index += PAGE_CONCURRENCY) {
    const batch = offsets.slice(index, index + PAGE_CONCURRENCY);
    const pages = await Promise.all(
      batch.map((offset) =>
        getEstablishmentPage({ limit: firstPage.limit, offset }),
      ),
    );
    for (const page of pages) establishments.push(...page.data);
  }

  if (establishments.length < firstPage.count) {
    throw new ExternalApiError(
      "La liste des établissements récupérée est incomplète.",
      502,
    );
  }

  return establishments.slice(0, firstPage.count);
}

export async function getEstablishment(id: string): Promise<Establishment> {
  const payload = await fetchExternalEstablishment(id);
  return mapExternalEstablishment(payload);
}
