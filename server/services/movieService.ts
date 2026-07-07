/**
 * Movie dataset — prebuilt by `npm run build:data` (TMDB + iTunes album match).
 * Imported statically so bundlers (Vercel) always include it.
 */
import dataset from "../data/movies.json";
import { type Movie } from "../models/movies";

const movies: Movie[] = dataset.movies as Movie[];
const byId = new Map<string, Movie>(movies.map((movie) => [String(movie.id), movie]));

export const generatedAt: string | null = (dataset as { generatedAt: string | null }).generatedAt;

export const movieQueries = {
  getAll: (): Movie[] => movies,

  get: (id: number | string): Movie | null => byId.get(String(id)) ?? null,

  getPaginated: (limit: number, offset: number): Movie[] => movies.slice(offset, offset + limit),

  getCount: (): number => movies.length,
};
