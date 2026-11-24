// Place search from Open-Meteo's geocoding API (https://open-meteo.com/en/docs/geocoding-api): free for
// non-commercial use, no key, built on GeoNames data, which its docs ask us to credit.
//
// API:
//   searchArizona(query): Promise<Place[]>   Arizona places for a typed city or ZIP; cached per query in memory;
//                                            rejects when Open-Meteo can't be reached

import type { Place } from "./types";

export const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
export const GEOCODING_CREDIT = "Place search by Open-Meteo.com";
export const GEONAMES_URL = "https://www.geonames.org";
export const GEONAMES_CREDIT = "GeoNames";

const TIMEOUT_MS = 8000;

/** The parts of a geocoding result this file reads. */
interface GeocodingResult {
  name: string;
  latitude: number;
  longitude: number;
  admin1?: string;
  admin2?: string;
  feature_code?: string;
  postcodes?: string[];
}

const cache = new Map<string, Place[]>();

function toPlace(r: GeocodingResult): Place {
  return { label: r.name, zip: r.postcodes?.[0] ?? null, county: r.admin2 || null, lat: r.latitude, lng: r.longitude };
}

/**
 * Arizona towns matching a typed city or ZIP, best match first (the API ranks by population). The name is
 * qualified with ", Arizona" so the API filters to the state before it limits to 10: a plain "Payson" or
 * "Mesa" is crowded out by other states' towns. Throws on a network or API failure (8 s limit).
 */
export async function searchArizona(query: string): Promise<Place[]> {
  const typed = query.trim();
  const key = typed.toLowerCase();
  const cached = cache.get(key);
  if (cached) return cached;
  const url = `${GEOCODING_URL}?name=${encodeURIComponent(`${typed}, Arizona`)}&count=10&language=en&format=json&countryCode=US`;
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`Open-Meteo geocoding answered ${res.status}`);
  const body = (await res.json()) as { results?: GeocodingResult[] };
  // Towns and cities (GeoNames PPL*; PPLX is a city section), not a park, peak or airport that shares the name.
  const places = (body.results ?? [])
    .filter((r) => r.admin1 === "Arizona" && r.feature_code?.startsWith("PPL") && r.feature_code !== "PPLX")
    .map(toPlace);
  // A typed full name wins over longer prefix matches: "Mesa" is Mesa, not also Mesa Patios.
  const exact = places.filter((p) => p.label.toLowerCase() === key);
  const matches = exact.length > 0 ? exact : places;
  cache.set(key, matches);
  return matches;
}
