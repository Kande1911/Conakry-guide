import "server-only";

import { isDatabaseConfigured } from "@/db";

export class AuthConfigurationError extends Error {}

export function isAuthConfigured(): boolean {
  const secret = process.env.BETTER_AUTH_SECRET;
  const baseURL = process.env.BETTER_AUTH_URL;
  if (!secret || secret.length < 32 || !baseURL) return false;

  try {
    const url = new URL(baseURL);
    const secureInProduction = process.env.NODE_ENV !== "production" || url.protocol === "https:";
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      secureInProduction
    );
  } catch {
    return false;
  }
}

export async function getRequestSession(request: Request) {
  if (!isDatabaseConfigured()) {
    throw new AuthConfigurationError("Database is not configured");
  }

  if (!isAuthConfigured()) {
    throw new AuthConfigurationError("Authentication is not configured");
  }

  const { auth } = await import("@/lib/auth");
  return auth.api.getSession({ headers: request.headers });
}
