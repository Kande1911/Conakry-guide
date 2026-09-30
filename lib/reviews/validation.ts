import "server-only";

const MAX_REQUEST_BYTES = 24 * 1024;
const MAX_COMMENT_LENGTH = 5_000;

export class ReviewInputError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 413 | 415 = 400,
  ) {
    super(message);
  }
}

export type ReviewInput = {
  rating: number;
  comment: string;
};

export async function parseReviewInput(request: Request): Promise<ReviewInput> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) {
    throw new ReviewInputError("Le corps doit être envoyé au format JSON.", 415);
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    throw new ReviewInputError("Le contenu envoyé est trop volumineux.", 413);
  }

  if (!request.body) {
    throw new ReviewInputError("Le contenu JSON est manquant.");
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_REQUEST_BYTES) {
        await reader.cancel();
        throw new ReviewInputError("Le contenu envoyé est trop volumineux.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new ReviewInputError("Le contenu JSON est invalide.");
  }

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ReviewInputError("Le contenu JSON doit être un objet.");
  }

  const input = value as Record<string, unknown>;
  if (!Number.isInteger(input.rating) || Number(input.rating) < 1 || Number(input.rating) > 5) {
    throw new ReviewInputError("La note doit être un nombre entier entre 1 et 5.");
  }

  if (typeof input.comment !== "string") {
    throw new ReviewInputError("Le commentaire doit être du texte.");
  }
  const comment = input.comment.trim();
  if (!comment) throw new ReviewInputError("Le commentaire ne peut pas être vide.");
  if (comment.length > MAX_COMMENT_LENGTH) {
    throw new ReviewInputError("Le commentaire ne peut pas dépasser 5000 caractères.");
  }

  return { rating: Number(input.rating), comment };
}

export function isValidEstablishmentId(id: string): boolean {
  return id.length > 0 && !/[\u0000-\u001f\u007f]/u.test(id);
}
