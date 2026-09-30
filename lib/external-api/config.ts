import "server-only";

import { ExternalApiError } from "./errors";

interface ExternalApiConfig {
  collectionUrl: URL;
  timeoutMs: number;
  revalidateSeconds: number;
  authHeader?: string;
  authValue?: string;
}

export function getExternalApiConfig(): ExternalApiConfig {
  const configuredUrl = process.env.EXTERNAL_API_URL?.trim();
  if (!configuredUrl) {
    throw new ExternalApiError(
      "Le service des établissements n’est pas configuré.",
      503,
    );
  }

  let collectionUrl: URL;
  try {
    collectionUrl = new URL(configuredUrl);
  } catch {
    throw new ExternalApiError(
      "La configuration du service des établissements est invalide.",
      503,
    );
  }

  if (
    !["http:", "https:"].includes(collectionUrl.protocol) ||
    collectionUrl.username ||
    collectionUrl.password ||
    collectionUrl.search ||
    collectionUrl.hash ||
    (process.env.NODE_ENV === "production" && collectionUrl.protocol !== "https:")
  ) {
    throw new ExternalApiError(
      "La configuration du service des établissements est invalide.",
      503,
    );
  }

  const authHeader = process.env.EXTERNAL_API_AUTH_HEADER?.trim();
  const authValue = process.env.EXTERNAL_API_AUTH_VALUE;
  if (Boolean(authHeader) !== Boolean(authValue)) {
    throw new ExternalApiError(
      "La configuration d’authentification du service est incomplète.",
      503,
    );
  }

  const timeoutMs = Number(process.env.EXTERNAL_API_TIMEOUT_MS ?? "8000");
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30_000) {
    throw new ExternalApiError(
      "La configuration du délai du service est invalide.",
      503,
    );
  }

  if (!collectionUrl.pathname.endsWith("/")) collectionUrl.pathname += "/";

  const revalidateSeconds = Number(process.env.EXTERNAL_API_REVALIDATE_SECONDS ?? "300");
  if (!Number.isInteger(revalidateSeconds) || revalidateSeconds < 0 || revalidateSeconds > 86_400) {
    throw new ExternalApiError(
      "La configuration de mise en cache du service est invalide.",
      503,
    );
  }

  return { collectionUrl, timeoutMs, revalidateSeconds, authHeader, authValue };
}
