import Link from "next/link";
import { connection } from "next/server";
import { notFound } from "next/navigation";

import { EstablishmentGallery, type GalleryImage } from "@/components/establishment-gallery";
import { ReviewPanel } from "@/components/review-panel";
import { ServiceMessage } from "@/components/service-message";
import { getPublicError } from "@/lib/external-api/errors";
import { getEstablishment } from "@/lib/external-api/service";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps) {
  await connection();
  try {
    const establishment = await getEstablishment((await params).id);
    return {
      title: `${establishment.name} — Conakry Guide`,
      description: establishment.description ?? `${establishment.category} à découvrir à Conakry. Consultez les photos, informations et avis sur Conakry Guide.`,
    };
  } catch {
    return { title: "Établissement — Conakry Guide" };
  }
}

export default async function EstablishmentDetailPage({ params }: PageProps) {
  await connection();
  const { id } = await params;

  let establishment;
  try {
    establishment = await getEstablishment(id);
  } catch (error) {
    const publicError = getPublicError(error);
    if (publicError.status === 404) notFound();
    return (
      <main className="page-container">
        <div className="breadcrumbs"><Link href="/">Accueil</Link><span>/</span><Link href="/establishments">Explorer</Link></div>
        <ServiceMessage message={publicError.message} title="Cette fiche est indisponible" />
      </main>
    );
  }

  const galleryImages: GalleryImage[] = [
    ...(establishment.mainImage ? [{ src: establishment.mainImage, label: "Photo principale", alt: establishment.name }] : []),
    ...establishment.secondaryImages.map((src, index) => ({ src, label: `Photo ${index + 1}`, alt: `${establishment.name}, photo ${index + 1}` })),
    ...establishment.menuImages.map((src, index) => ({ src, label: `Menu ${index + 1}`, alt: `Menu de ${establishment.name}, photo ${index + 1}` })),
  ];
  const images = galleryImages.filter((image, index) => galleryImages.findIndex(({ src }) => src === image.src) === index);
  const mapsUrl = establishment.coordinates
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${establishment.coordinates.lat},${establishment.coordinates.lng}`)}`
      : establishment.address
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${establishment.name} ${establishment.address} Conakry`)}`
        : null;
  const phoneHref = establishment.phone?.replace(/[^\d+]/g, "") || null;

  return (
    <main className="detail-container">
      <div className="breadcrumbs"><Link href="/">Accueil</Link><span>/</span><Link href="/establishments">Explorer</Link><span>/</span><span>{establishment.name}</span></div>
      <section className="detail-heading">
        <div>
          <Link className="detail-category" href={`/establishments?category=${encodeURIComponent(establishment.category)}`}>{establishment.category}</Link>
          <h1>{establishment.name}</h1>
          {establishment.address ? <p className="detail-address"><span aria-hidden="true">⌖</span>{establishment.address}</p> : null}
        </div>
        <a className="detail-review-jump" href="#avis">Lire les avis <span aria-hidden="true">↓</span></a>
      </section>

      <EstablishmentGallery images={images} name={establishment.name} />

      <div className="detail-main-grid">
        <section className="detail-about">
          <div className="eyebrow">À PROPOS DE L’ADRESSE</div>
          <h2>Un lieu à <em>découvrir.</em></h2>
          {establishment.description ? <p className="detail-description">{establishment.description}</p> : <p className="detail-description detail-description-muted">Aucune description n’a été renseignée pour le moment.</p>}
          {establishment.menuImages.length ? <p className="menu-available"><span aria-hidden="true">↗</span> {establishment.menuImages.length} photo{establishment.menuImages.length === 1 ? "" : "s"} du menu dans la galerie</p> : null}
        </section>

        <aside className="detail-info-card">
          <div className="eyebrow">INFOS PRATIQUES</div>
          {establishment.address ? <div className="detail-info-item"><span className="detail-info-icon" aria-hidden="true">⌖</span><div><strong>Adresse</strong><p>{establishment.address}</p></div></div> : null}
          {establishment.coordinates ? <div className="detail-info-item"><span className="detail-info-icon" aria-hidden="true">◎</span><div><strong>Coordonnées</strong><p>{establishment.coordinates.lat.toFixed(5)}, {establishment.coordinates.lng.toFixed(5)}</p></div></div> : null}
          {phoneHref ? <div className="detail-info-item"><span className="detail-info-icon" aria-hidden="true">☎</span><div><strong>Téléphone</strong><p><a href={`tel:${phoneHref}`}>{establishment.phone}</a></p></div></div> : null}
          {establishment.email ? <div className="detail-info-item"><span className="detail-info-icon" aria-hidden="true">@</span><div><strong>E-mail</strong><p><a href={`mailto:${encodeURIComponent(establishment.email)}`}>{establishment.email}</a></p></div></div> : null}
          {establishment.website ? <div className="detail-info-item"><span className="detail-info-icon" aria-hidden="true">↗</span><div><strong>Site web</strong><p><a href={establishment.website} rel="noreferrer" target="_blank">Visiter le site</a></p></div></div> : null}
          {mapsUrl ? <a className="map-link" href={mapsUrl} rel="noreferrer" target="_blank">Voir sur la carte <span aria-hidden="true">↗</span></a> : <p className="detail-description-muted">Emplacement non renseigné.</p>}
        </aside>
      </div>

      <ReviewPanel establishmentId={establishment.id} />
    </main>
  );
}
