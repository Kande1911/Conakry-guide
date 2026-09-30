"use client";

import { useEffect, useState } from "react";

export type GalleryImage = { src: string; label: string; alt: string };

export function EstablishmentGallery({ images, name }: { images: GalleryImage[]; name: string }) {
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    if (active === null) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setActive(null);
      if (event.key === "ArrowRight") setActive((value) => value === null ? null : (value + 1) % images.length);
      if (event.key === "ArrowLeft") setActive((value) => value === null ? null : (value + images.length - 1) % images.length);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [active, images.length]);

  if (images.length === 0) {
    return <div className="detail-gallery detail-gallery-empty"><span aria-hidden="true">✳</span><p>Les photos seront ajoutées dès qu’elles seront disponibles.</p></div>;
  }

  return (
    <>
      <div className="detail-gallery">
        {images.slice(0, 5).map((image, index) => (
          <button
            aria-label={`Agrandir ${image.label.toLocaleLowerCase("fr")}`}
            className={`gallery-tile gallery-tile-${index + 1}`}
            key={`${image.src}-${index}`}
            onClick={() => setActive(index)}
            type="button"
          >
            {/* Upstream image hosts are dynamic and cannot be declared as a fixed Next Image allowlist. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.src} alt={image.alt} loading={index === 0 ? "eager" : "lazy"} decoding="async" />
            <span className="gallery-label">{image.label}</span>
            {index === 4 && images.length > 5 ? <span className="gallery-more">+{images.length - 5} photos</span> : null}
          </button>
        ))}
      </div>
      {active !== null ? (
        <div
          aria-label={`Galerie photos de ${name}`}
          aria-modal="true"
          className="gallery-modal"
          onClick={(event) => { if (event.target === event.currentTarget) setActive(null); }}
          role="dialog"
        >
          <button aria-label="Fermer la galerie" className="gallery-close" onClick={() => setActive(null)} type="button">×</button>
          <button
            aria-label="Photo précédente"
            className="gallery-step gallery-step-left"
            onClick={() => setActive((active + images.length - 1) % images.length)}
            type="button"
          >‹</button>
          <figure>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={images[active].src} alt={images[active].alt} />
            <figcaption>{images[active].label} · {active + 1} / {images.length}</figcaption>
          </figure>
          <button
            aria-label="Photo suivante"
            className="gallery-step gallery-step-right"
            onClick={() => setActive((active + 1) % images.length)}
            type="button"
          >›</button>
        </div>
      ) : null}
    </>
  );
}
