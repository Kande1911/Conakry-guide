import type { MetadataRoute } from "next";
import { connection } from "next/server";

import { listEstablishments } from "@/lib/external-api/service";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const siteUrl = process.env.SITE_URL ?? process.env.BETTER_AUTH_URL;
  if (!siteUrl) return [];

  let base: URL;
  try {
    base = new URL(siteUrl);
  } catch {
    return [];
  }
  if ((base.protocol !== "https:" && base.protocol !== "http:") || base.username || base.password) {
    return [];
  }

  const routes: MetadataRoute.Sitemap = [
    { url: new URL("/", base).toString(), changeFrequency: "weekly", priority: 1 },
    { url: new URL("/establishments", base).toString(), changeFrequency: "daily", priority: 0.9 },
  ];

  try {
    const establishments = await listEstablishments();
    routes.push(...establishments.map(({ id }) => ({
      url: new URL(`/establishments/${encodeURIComponent(id)}`, base).toString(),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })));
  } catch {
    // Keep the public directory routes in the sitemap while the upstream API is unavailable.
  }

  return routes;
}
