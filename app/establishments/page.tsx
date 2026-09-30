import Link from "next/link";
import { connection } from "next/server";

import { EstablishmentBrowser } from "@/components/establishment-browser";
import { ServiceMessage } from "@/components/service-message";
import { listEstablishments } from "@/lib/external-api/service";
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
  let establishments;

  try {
    establishments = await listEstablishments();
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

  let summaries = {};
  let recentlyReviewedIds: string[] = [];
  if (process.env.DATABASE_URL && establishments.length) {
    try {
      const ids = establishments.map(({ id }) => id);
      [summaries, recentlyReviewedIds] = await Promise.all([
        getReviewSummaries(ids),
        getRecentlyReviewedEstablishmentIds(ids, establishments.length),
      ]);
    } catch {
      summaries = {};
      recentlyReviewedIds = [];
    }
  }

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
        establishments={establishments}
        summaries={summaries}
        recentEstablishmentIds={recentlyReviewedIds}
        initialQuery={params.q ?? ""}
        initialCategory={params.category ?? ""}
        initialLocation={params.location ?? ""}
        initialSort={params.sort ?? "relevance"}
        initialMinRating={params.minRating ?? ""}
      />
    </main>
  );
}
