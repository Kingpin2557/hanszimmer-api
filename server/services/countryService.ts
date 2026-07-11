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
