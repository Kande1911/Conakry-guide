import type { MetadataRoute } from "next";
import { connection } from "next/server";

export default async function robots(): Promise<MetadataRoute.Robots> {
  await connection();
  const siteUrl = process.env.SITE_URL ?? process.env.BETTER_AUTH_URL;
  let sitemap: string | undefined;
  if (siteUrl) {
    try {
      const base = new URL(siteUrl);
      if ((base.protocol === "https:" || base.protocol === "http:") && !base.username && !base.password) {
        sitemap = new URL("/sitemap.xml", base).toString();
      }
    } catch {
      sitemap = undefined;
    }
  }

  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/establishments"],
      disallow: ["/api/", "/profile", "/login", "/register"],
    },
    ...(sitemap ? { sitemap } : {}),
  };
}
