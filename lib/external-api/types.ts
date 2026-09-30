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
  phone: string | null;
  email: string | null;
  website: string | null;
}

export interface ExternalEstablishment {
  id: number | string;
  name?: string;
  nom?: string;
  category_name?: string;
  category?: string;
  type?: string;
  categorie?: string;
  cover_image?: string | null;
  cover_image_url?: string | null;
  image_principale?: string | null;
  images_secondaires?: string[] | null;
  /** Photos returned by Djengoo can be URL strings or objects containing a URL. */
  photos?: unknown[] | null;
  description?: string | null;
  images_menu?: string[] | null;
  address?: string | null;
  quartier?: string | null;
  adresse?: string | null;
  lat?: number | null;
  lon?: number | null;
  coordonnees?: { lat: number; lng: number } | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
}

export interface ExternalEstablishmentPage {
  data: Establishment[];
  count: number;
  limit: number;
  offset: number;
}

export interface EstablishmentCategory {
  id: string;
  name: string;
  slug: string;
}
