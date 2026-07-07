/**
 * TMDB client — needs TMDB_API_KEY (set it in .env locally and as a Vercel env var).
 */
import dotenv from "dotenv";
import { fetchJson } from "./http";

dotenv.config();

const TMDB_BASE: string = process.env.TMDB_BASE_URL || "https://api.themoviedb.org/3";
const TMDB_KEY: string | undefined = process.env.TMDB_API_KEY;

export interface TmdbCredit {
  id: number;
  title?: string;
  original_title?: string;
  job: string;
}

export interface TmdbMovieDetail {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  tagline: string | null;
  release_date: string;
  runtime: number | null;
  genres: { id: number; name: string }[];
  vote_average: number;
  vote_count: number;
  popularity: number | null;
  imdb_id: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  origin_country?: string[];
}

const tmdb = <T>(endpoint: string): Promise<T> => {
  if (!TMDB_KEY) {
    throw new Error("TMDB_API_KEY is not set (add it to .env / Vercel environment variables)");
  }
  return fetchJson<T>(
    `${TMDB_BASE}${endpoint}${endpoint.includes("?") ? "&" : "?"}api_key=${TMDB_KEY}`,
    { label: `TMDB ${endpoint}` },
  );
};

export const tmdbQueries = {
  getPersonMovieCredits: (personId: number): Promise<{ crew: TmdbCredit[] }> =>
    tmdb<{ crew: TmdbCredit[] }>(`/person/${personId}/movie_credits`),

  getMovie: (movieId: number | string): Promise<TmdbMovieDetail> =>
    tmdb<TmdbMovieDetail>(`/movie/${movieId}`),
};
