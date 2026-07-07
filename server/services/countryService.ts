/**
 * Country coordinates via restcountries.com (keyless).
 * Cached per country code, with in-flight deduplication.
 */
import { fetchJson } from "./http";
import { type Country } from "../models/movies";

const COUNTRIES_BASE: string =
  process.env.COUNTRIES_BASE_URL || "https://restcountries.com";

interface RestCountry {
  name: { common: string; official: string };
  cca2: string;
  latlng: [number, number];
}

const cache = new Map<string, Promise<Country | null>>();

const lookup = async (code: string): Promise<Country | null> => {
  try {
    const data = await fetchJson<RestCountry[]>(
      `${COUNTRIES_BASE}/v3.1/alpha/${code}`,
      { label: "restcountries" },
    );
    const entry = Array.isArray(data) ? data[0] : null;
    if (!entry) return null;

    return {
      name: entry.name.common,
      officialName: entry.name.official,
      code: entry.cca2,
      coords: { lat: entry.latlng[0], lng: entry.latlng[1] },
    };
  } catch (error) {
    console.warn(`country lookup failed for "${code}": ${(error as Error).message}`);
    return null;
  }
};

export const countryQueries = {
  get: (code: string | undefined): Promise<Country | null> => {
    if (!code) return Promise.resolve(null);

    let pending = cache.get(code);
    if (!pending) {
      pending = lookup(code);
      cache.set(code, pending);
    }
    return pending;
  },
};
