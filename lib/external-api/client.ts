import "server-only";

import { getExternalApiConfig } from "./config";
import { ExternalApiError } from "./errors";

function endpointUrl(id?: string): URL {
  const { collectionUrl } = getExternalApiConfig();
  if (id === undefined) return collectionUrl;

  const collectionPath = collectionUrl.toString().replace(/\/$/, "");
  return new URL(`${collectionPath}/${encodeURIComponent(id)}`);
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
      cache: "no-store",
      // Do not forward a configured credential if the upstream redirects.
      redirect: "manual",
      signal: AbortSignal.timeout(config.timeoutMs),
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

export async function fetchExternalEstablishmentList(): Promise<unknown> {
  return requestJson(endpointUrl(), false);
}

export async function fetchExternalEstablishment(id: string): Promise<unknown> {
  return requestJson(endpointUrl(id), true);
}
