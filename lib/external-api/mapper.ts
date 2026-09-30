import { ExternalApiError } from "./errors";
import type {
  Establishment,
  EstablishmentCategory,
  EstablishmentCoordinates,
  ExternalEstablishment,
  ExternalEstablishmentPage,
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
  if (typeof value !== "string") return null;

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
  if (typeof value === "object" && !Array.isArray(value)) {
    const media = value as Record<string, unknown>;
    for (const key of ["url", "image_url", "photo_url", "src", "image", "photo", "file"]) {
      const url = mediaUrl(media[key]);
      if (url) return url;
    }
    return null;
  }
  if (typeof value !== "string") return null;

  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error();
    return url.toString();
  } catch {
    return null;
  }
}

function mediaUrls(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  const entries = Array.isArray(value) ? value : [value];
  return [...new Set(entries.map(mediaUrl).filter((url): url is string => url !== null))];
}

function coordinates(value: unknown): EstablishmentCoordinates | null {
  if (value === undefined || value === null) return null;
  const record = asRecord(value);
  const lat = record.lat;
  const lng = record.lng;

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
    return null;
  }

  return { lat, lng };
}

function establishmentCoordinates(record: Record<string, unknown>) {
  if (record.lat === undefined && record.lon === undefined) {
    return coordinates(record.coordonnees);
  }
  if (
    record.lat === null ||
    record.lon === null ||
    record.lat === undefined ||
    record.lon === undefined
  ) return null;
  return coordinates({ lat: record.lat, lng: record.lon });
}

function safeWebsite(value: unknown): string | null {
  const text = optionalText(value);
  if (!text) return null;

  try {
    const url = new URL(text);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function mapExternalEstablishment(value: unknown): Establishment {
  const record = asRecord(value);
  const source = record as unknown as ExternalEstablishment;
  const id = externalId(record.id ?? record.place_id ?? record.osm_id);
  const name =
    requiredText(record.name) ??
    requiredText(record.nom) ??
    requiredText(record.display_name) ??
    requiredText(record.address) ??
    `Établissement ${id}`;
  const category =
    requiredText(record.category_name) ??
    requiredText(record.categorie) ??
    requiredText(record.type) ??
    requiredText(record.category) ??
    "Autre";

  const mainImage = mediaUrl(source.cover_image_url ?? source.cover_image ?? source.image_principale);
  const secondaryImages = [
    ...mediaUrls(source.photos),
    ...mediaUrls(source.images_secondaires),
  ].filter((url, index, images) => url !== mainImage && images.indexOf(url) === index);

  return {
    id,
    name,
    category,
    mainImage,
    secondaryImages,
    description: optionalText(source.description),
    menuImages: mediaUrls(source.images_menu),
    address:
      optionalText(source.address) ??
      optionalText(source.adresse) ??
      optionalText(source.quartier),
    coordinates: establishmentCoordinates(record),
    phone: optionalText(record.phone),
    email: optionalText(record.email),
    website: safeWebsite(record.website),
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

function nonNegativeInteger(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : fallback;
}

function positiveInteger(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0
    ? value
    : fallback;
}

export function mapExternalEstablishmentPage(
  value: unknown,
  requestedLimit: number,
  requestedOffset: number,
): ExternalEstablishmentPage {
  const record = asRecord(value);
  if (!Array.isArray(record.results)) {
    throw new ExternalApiError(
      "La réponse paginée du service des établissements est invalide.",
      502,
    );
  }

  const data = record.results.map(mapExternalEstablishment);
  return {
    data,
    count: nonNegativeInteger(record.count, requestedOffset + data.length),
    limit: positiveInteger(record.limit, requestedLimit),
    offset: nonNegativeInteger(record.offset, requestedOffset),
  };
}

export function mapExternalEstablishmentSearchPage(
  value: unknown,
  requestedLimit: number,
  requestedOffset: number,
): ExternalEstablishmentPage {
  const record = asRecord(value);
  if (!Array.isArray(record.results)) {
    throw new ExternalApiError(
      "La réponse paginée de recherche du service des établissements est invalide.",
      502,
    );
  }

  // Search also returns OpenStreetMap results without a Conakry Guide place ID.
  // Those entries cannot be opened through the documented place-detail endpoint.
  const placeResults = record.results.filter((value) => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
    return (value as Record<string, unknown>).place_id !== null &&
      (value as Record<string, unknown>).place_id !== undefined;
  });

  return mapExternalEstablishmentPage(
    { ...record, results: placeResults },
    requestedLimit,
    requestedOffset,
  );
}

export function mapExternalEstablishmentCategories(value: unknown): EstablishmentCategory[] {
  const record = asRecord(value);
  if (!Array.isArray(record.categories)) {
    throw new ExternalApiError(
      "La liste des catégories du service des établissements est invalide.",
      502,
    );
  }

  return record.categories.flatMap((value) => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return [];
    const category = value as Record<string, unknown>;
    const name = requiredText(category.name);
    const slug = requiredText(category.slug);
    if (!name || !slug) return [];
    return [{ id: externalId(category.id ?? slug), name, slug }];
  });
}
