/**
 * Country name + map coordinates from a bundled static dataset
 * (ISO 3166-1 alpha-2 -> centroid lat/lng, source: Google canonical countries.csv, CC-BY 4.0).
 * No external calls: country centroids are static data, and the previous
 * runtime dependency (restcountries.com v3.1) got deprecated and broke.
 */
import countries from "../data/countries.json";
import { type Country } from "../models/movies";

const dataset = countries as Record<string, { name: string; lat: number; lng: number }>;

export const countryQueries = {
  get: (code: string | undefined): Country | null => {
    if (!code) return null;
    const entry = dataset[code.toUpperCase()];
    if (!entry) return null;

    return {
      name: entry.name,
      code: code.toUpperCase(),
      coords: { lat: entry.lat, lng: entry.lng },
    };
  },
};
