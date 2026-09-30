import { ExternalApiError } from "./errors";
import type {
  Establishment,
  EstablishmentCoordinates,
  ExternalEstablishment,
} from "./types";

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ExternalApiError(
      "La réponse du service des établissements est invalide.",
      502,
    );
  }

  return value as Record<string, unknown>;
}

function requiredText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const result = value.trim();
  return result.length > 0 ? result : null;
}

function optionalText(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    throw new ExternalApiError(
      "La réponse du service des établissements est invalide.",
      502,
    );
  }

  return value.trim() || null;
}

function externalId(value: unknown): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);

  throw new ExternalApiError(
    "La réponse du service des établissements est invalide.",
    502,
  );
}

function mediaUrl(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") {
    throw new ExternalApiError(
      "La réponse du service des établissements est invalide.",
      502,
    );
  }

  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error();
    return url.toString();
  } catch {
    throw new ExternalApiError(
      "La réponse du service des établissements contient une image invalide.",
      502,
    );
  }
}

function mediaUrls(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw new ExternalApiError(
      "La réponse du service des établissements est invalide.",
      502,
    );
  }

  return value.map((entry) => {
    const url = mediaUrl(entry);
    if (url === null) {
      throw new ExternalApiError(
        "La réponse du service des établissements contient une image invalide.",
        502,
      );
    }
    return url;
  });
}

function coordinates(value: unknown): EstablishmentCoordinates | null {
  if (value === undefined || value === null) return null;
  const record = asRecord(value);
  const { lat, lng } = record;

  if (
    typeof lat !== "number" ||
    typeof lng !== "number" ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    throw new ExternalApiError(
      "La réponse du service des établissements contient des coordonnées invalides.",
      502,
    );
  }

  return { lat, lng };
}

export function mapExternalEstablishment(value: unknown): Establishment {
  const record = asRecord(value);
  const id = externalId(record.id);
  const name = requiredText(record.nom);
  const category = requiredText(record.categorie);

  if (!name || !category) {
    throw new ExternalApiError(
      "La réponse du service des établissements ne contient pas les informations requises.",
      502,
    );
  }

  const source = record as unknown as ExternalEstablishment;
  return {
    id,
    name,
    category,
    mainImage: mediaUrl(source.image_principale),
    secondaryImages: mediaUrls(source.images_secondaires),
    description: optionalText(source.description),
    menuImages: mediaUrls(source.images_menu),
    address: optionalText(source.adresse),
    coordinates: coordinates(source.coordonnees),
  };
}

export function mapExternalEstablishmentList(value: unknown): Establishment[] {
  if (!Array.isArray(value)) {
    throw new ExternalApiError(
      "La réponse du service des établissements n’a pas le format de liste documenté.",
      502,
    );
  }

  return value.map(mapExternalEstablishment);
}
