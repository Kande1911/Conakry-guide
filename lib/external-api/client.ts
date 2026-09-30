import "server-only";

import { getExternalApiConfig } from "./config";
import { ExternalApiError } from "./errors";

function endpointUrl(id?: string, limit?: number, offset?: number): URL {
  const { collectionUrl } = getExternalApiConfig();
  if (id !== undefined) return new URL(`${encodeURIComponent(id)}/`, collectionUrl);

  const url = new URL(collectionUrl);
  if (limit !== undefined) url.searchParams.set("limit", String(limit));
  if (offset !== undefined) url.searchParams.set("offset", String(offset));
  return url;
}

function relatedEndpoint(name: "search" | "categories"): URL {
  return new URL(`../${name}/`, getExternalApiConfig().collectionUrl);
}

async function requestJson(url: URL, missingIsNotFound: boolean): Promise<unknown> {
  const config = getExternalApiConfig();
  const headers = new Headers({ Accept: "application/json" });
  if (config.authHeader && config.authValue) {
    headers.set(config.authHeader, config.authValue);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      headers,
      // Do not forward a configured credential if the upstream redirects.
      redirect: "manual",
      signal: AbortSignal.timeout(config.timeoutMs),
      ...(config.revalidateSeconds > 0
        ? { next: { revalidate: config.revalidateSeconds } }
        : { cache: "no-store" as const }),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new ExternalApiError(
        "Le service des établissements ne répond pas à temps.",
        504,
      );
    }

    throw new ExternalApiError(
      "Impossible de joindre le service des établissements.",
      503,
    );
  }

  if (response.status === 404 && missingIsNotFound) {
    throw new ExternalApiError("Établissement introuvable.", 404);
  }

  if (!response.ok) {
    throw new ExternalApiError(
      "Impossible de récupérer les établissements.",
      502,
    );
  }

  try {
    return await response.json();
  } catch {
    throw new ExternalApiError(
      "La réponse du service des établissements n’est pas un JSON valide.",
      502,
    );
  }
}

export async function fetchExternalEstablishmentList(limit: number, offset: number): Promise<unknown> {
  return requestJson(endpointUrl(undefined, limit, offset), false);
}

export async function fetchExternalEstablishmentSearch({
  query,
  category,
  minRating,
  limit,
  offset,
}: {
  query?: string;
  category?: string;
  minRating?: number;
  limit: number;
  offset: number;
}): Promise<unknown> {
  const url = relatedEndpoint("search");
  if (query) url.searchParams.set("q", query);
  if (category) url.searchParams.set("category", category);
  if (minRating !== undefined) url.searchParams.set("min_rating", String(minRating));
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));
  return requestJson(url, false);
}

export async function fetchExternalEstablishmentCategories(): Promise<unknown> {
  return requestJson(relatedEndpoint("categories"), false);
}

export async function fetchExternalEstablishment(id: string): Promise<unknown> {
  return requestJson(endpointUrl(id), true);
}
