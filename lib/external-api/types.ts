export type ExternalEstablishmentId = string;

export interface EstablishmentCoordinates {
  lat: number;
  lng: number;
}

/** Internal model; external API field names stay inside the mapper. */
export interface Establishment {
  id: ExternalEstablishmentId;
  name: string;
  category: string;
  mainImage: string | null;
  secondaryImages: string[];
  description: string | null;
  menuImages: string[];
  address: string | null;
  coordinates: EstablishmentCoordinates | null;
}

export interface ExternalEstablishment {
  id: number | string;
  nom: string;
  categorie: string;
  image_principale?: string | null;
  images_secondaires?: string[] | null;
  description?: string | null;
  images_menu?: string[] | null;
  adresse?: string | null;
  coordonnees?: { lat: number; lng: number } | null;
}
