export class ExternalApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ExternalApiError";
  }
}

export function getPublicError(error: unknown): {
  status: number;
  message: string;
} {
  if (error instanceof ExternalApiError) {
    return { status: error.status, message: error.message };
  }

  return {
    status: 500,
    message: "Une erreur interne est survenue.",
  };
}
