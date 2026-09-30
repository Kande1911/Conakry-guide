import "server-only";

import { fetchExternalEstablishment, fetchExternalEstablishmentList } from "./client";
import { mapExternalEstablishment, mapExternalEstablishmentList } from "./mapper";
import type { Establishment } from "./types";

export async function listEstablishments(): Promise<Establishment[]> {
  const payload = await fetchExternalEstablishmentList();
  return mapExternalEstablishmentList(payload);
}

export async function getEstablishment(id: string): Promise<Establishment> {
  const payload = await fetchExternalEstablishment(id);
  return mapExternalEstablishment(payload);
}
