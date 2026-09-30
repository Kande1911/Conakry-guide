import Link from "next/link";
import { connection } from "next/server";

import { EstablishmentBrowser } from "@/components/establishment-browser";
import { ServiceMessage } from "@/components/service-message";
import {
  ESTABLISHMENT_PAGE_SIZE,
  getEstablishmentPage,
  listEstablishmentCategories,
} from "@/lib/external-api/service";
import { getPublicError } from "@/lib/external-api/errors";
import { getRecentlyReviewedEstablishmentIds, getReviewSummaries } from "@/lib/reviews/service";

type PageProps = {
  searchParams: Promise<{ q?: string; category?: string; location?: string; sort?: string; minRating?: string }>;
};

export const metadata = {
  title: "Explorer les adresses de Conakry — Conakry Guide",
  description: "Recherchez restaurants, hôtels, cafés et autres adresses à Conakry.",
};

export default async function EstablishmentsPage({ searchParams }: PageProps) {
  await connection();
  const params = await searchParams;
  let page;

  try {
    const minRating = params.minRating === "3" || params.minRating === "4"
      ? Number(params.minRating)
      : undefined;
    page = await getEstablishmentPage({
      query: params.q,
      category: params.category,
      location: params.location,
      minRating,
      limit: ESTABLISHMENT_PAGE_SIZE,
      offset: 0,
    });
  } catch (error) {
    const publicError = getPublicError(error);
    return (
      <main className="page-container directory-page">
        <div className="eyebrow">LE CARNET DE LA VILLE</div>
        <h1 className="page-heading">Explorer <em>Conakry</em></h1>
        <ServiceMessage message={publicError.message} />
      </main>
    );
  }

  let categories;
  try {
    categories = await listEstablishmentCategories();
  } catch {
    categories = [...new Set(page.data.map(({ category }) => category))]
      .map((name) => ({ id: name, name, slug: name }));
  }

  let summaries = {};
  let recentlyReviewedIds: string[] = [];
  if (process.env.DATABASE_URL && page.data.length) {
    try {
      const ids = page.data.map(({ id }) => id);
      [summaries, recentlyReviewedIds] = await Promise.all([
        getReviewSummaries(ids),
        getRecentlyReviewedEstablishmentIds(ids, ids.length),
      ]);
    } catch {
      summaries = {};
      recentlyReviewedIds = [];
    }
  }

  const requestedCategory = params.category ?? "";
  const initialCategory = categories.find(
    ({ name, slug }) => name === requestedCategory || slug === requestedCategory,
  )?.slug ?? requestedCategory;

  return (
    <main className="page-container directory-page">
      <div className="directory-intro">
        <div>
          <div className="eyebrow">LE CARNET DE LA VILLE</div>
          <h1 className="page-heading">Explorer <em>Conakry</em></h1>
          <p>Les adresses qui font battre le cœur de la capitale.</p>
        </div>
        <Link className="directory-back" href="/">← Retour à l’accueil</Link>
      </div>

      <EstablishmentBrowser
        establishments={page.data}
        summaries={summaries}
        recentEstablishmentIds={recentlyReviewedIds}
        categories={categories}
        pagination={{
          count: page.count,
          limit: page.limit,
          offset: page.offset,
          hasMore: page.offset + page.limit < page.count,
        }}
        initialQuery={params.q ?? ""}
        initialCategory={initialCategory}
        initialLocation={params.location ?? ""}
        initialSort={params.sort ?? "relevance"}
        initialMinRating={params.minRating ?? ""}
      />
    </main>
  );
}
