/**
 * Live movie data: TMDB filmography fetched on demand and cached in memory (TTL),
 * with CDN cache headers doing the heavy lifting on Vercel.
 * iTunes soundtrack albums are resolved lazily per movie (Apple rate limit ~20 req/min).
 */
import { tmdbQueries, type TmdbMovieDetail } from "./tmdbService";
import { countryQueries } from "./countryService";
import { itunesQueries } from "./itunesService";
import { albumStore } from "./albumService";
import { mapWithConcurrency } from "./http";
import { type Movie } from "../models/movies";
import { type Album } from "../models/soundtracks";

const HANS_ZIMMER_PERSON_ID = 947;
const COMPOSER_JOBS = new Set(["Original Music Composer", "Music", "Composer"]);
const TMDB_IMG: string = process.env.TMDB_IMAGE_BASE_URL || "https://image.tmdb.org/t/p";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h
const DETAIL_CONCURRENCY = 12;

interface MoviesCache {
  movies: Movie[];
  byId: Map<number, Movie>;
  cachedAt: string;
  expiresAt: number;
}

let moviesCache: MoviesCache | null = null;
let inFlight: Promise<MoviesCache> | null = null;

// Composer credits (movie id -> job), cached alongside the movie list TTL
let creditsCache: { jobs: Map<number, string>; expiresAt: number } | null = null;

const withAlbum = (movie: Movie): Movie => ({
  ...movie,
  album: albumStore.get(movie.id),
});

/**
 * Resolve ALL missing albums in one pass: fetch Hans Zimmer's full iTunes
 * album catalog (2 requests) and match every movie against it locally.
 * Unmatched movies are stored as null; albums.json is written once.
 */
const resolveAllAlbums = async (cache: MoviesCache): Promise<void> => {
  // also re-match movies stored as null: fallback matching guarantees them music now
  const missing = cache.movies.filter((movie) => !albumStore.has(movie.id) || !albumStore.get(movie.id));
  if (missing.length === 0) return;

  const catalog = await itunesQueries.getArtistCatalog("Hans Zimmer");
  if (catalog.length === 0) {
    console.warn("album catalog fetch returned nothing — skipping album matching");
    return;
  }

  const entries = new Map(
    missing.map((movie) => [movie.id, itunesQueries.matchFromCatalog(movie.title, movie.id, catalog)] as const),
  );
  albumStore.setAll(new Map(entries));
  console.log(`Matched ${[...entries.values()].filter(Boolean).length}/${missing.length} new albums from a ${catalog.length}-album catalog.`);
};

const toMovie = (detail: TmdbMovieDetail, job: string | null): Movie => ({
  id: detail.id,
  title: detail.title,
  originalTitle: detail.original_title,
  overview: detail.overview,
  tagline: detail.tagline || null,
  releaseDate: detail.release_date || null,
  year: detail.release_date ? Number(detail.release_date.slice(0, 4)) : null,
  runtime: detail.runtime || null,
  genres: (detail.genres || []).map((genre) => genre.name),
  rating: {
    score: Math.round(detail.vote_average * 10) / 10,
    votes: detail.vote_count,
  },
  popularity: detail.popularity ?? null,
  imdbId: detail.imdb_id || null,
  poster: detail.poster_path ? `${TMDB_IMG}/w500${detail.poster_path}` : null,
  backdrop: detail.backdrop_path ? `${TMDB_IMG}/w1280${detail.backdrop_path}` : null,
  originCountry: countryQueries.get(detail.origin_country?.[0]),
  zimmerJob: job,
  album: null,
});

const getComposerJobs = async (): Promise<Map<number, string>> => {
  if (creditsCache && Date.now() < creditsCache.expiresAt) return creditsCache.jobs;

  const credits = await tmdbQueries.getPersonMovieCredits(HANS_ZIMMER_PERSON_ID);
  const jobs = new Map<number, string>();
  for (const credit of credits.crew || []) {
    if (COMPOSER_JOBS.has(credit.job) && !jobs.has(credit.id)) {
      jobs.set(credit.id, credit.job);
    }
  }

  creditsCache = { jobs, expiresAt: Date.now() + CACHE_TTL_MS };
  return jobs;
};

const buildCache = async (): Promise<MoviesCache> => {
  const jobs = await getComposerJobs();
  const ids = [...jobs.keys()];

  const fetched = await mapWithConcurrency(ids, DETAIL_CONCURRENCY, async (id) => {
    try {
      const detail = await tmdbQueries.getMovie(id);
      // Skip unreleased/obscure entries that a kiosk can't display properly
      if (!detail.poster_path || !detail.release_date) return null;
      return toMovie(detail, jobs.get(id) ?? null);
    } catch (error) {
      console.warn(`skipping movie ${id}: ${(error as Error).message}`);
      return null;
    }
  });

  const movies = (fetched.filter(Boolean) as Movie[]).sort((a, b) =>
    (a.releaseDate ?? "").localeCompare(b.releaseDate ?? ""),
  );

  return {
    movies,
    byId: new Map(movies.map((movie) => [movie.id, movie])),
    cachedAt: new Date().toISOString(),
    expiresAt: Date.now() + CACHE_TTL_MS,
  };
};

const getCache = async (): Promise<MoviesCache> => {
  if (moviesCache && Date.now() < moviesCache.expiresAt) return moviesCache;

  // Share the in-flight build so concurrent requests don't stampede TMDB
  if (!inFlight) {
    inFlight = buildCache()
      .then((cache) => {
        moviesCache = cache;
        return cache;
      })
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
};

export const movieQueries = {
  getAll: async (): Promise<Movie[]> => {
    const cache = await getCache();
    try {
      await resolveAllAlbums(cache);
    } catch (error) {
      console.warn(`album matching failed: ${(error as Error).message}`);
    }
    return cache.movies.map(withAlbum);
  },

  getCount: async (): Promise<number> => (await getCache()).movies.length,

  getPaginated: async (limit: number, offset: number): Promise<Movie[]> => {
    const cache = await getCache();
    try {
      await resolveAllAlbums(cache);
    } catch (error) {
      console.warn(`album matching failed: ${(error as Error).message}`);
    }
    return cache.movies.slice(offset, offset + limit).map(withAlbum);
  },

  /** How many movies have a matched (non-null) album so far. */
  getAlbumsResolved: (): number => albumStore.countResolved(),

  get: async (id: number): Promise<Movie | null> => {
    // Fast path when the list cache is warm
    if (moviesCache && Date.now() < moviesCache.expiresAt) {
      return moviesCache.byId.get(id) ?? null;
    }

    // Cold path: verify it's a Zimmer movie, then fetch just this one
    const jobs = await getComposerJobs();
    const job = jobs.get(id);
    if (!job) return null;

    const detail = await tmdbQueries.getMovie(id);
    return toMovie(detail, job);
  },

  /**
   * Movie with its iTunes soundtrack album resolved (lazy, cached per movie).
   * strict=true rethrows iTunes failures (tracks endpoint) instead of
   * degrading to album:null (detail endpoint), so real errors stay visible.
   */
  getWithAlbum: async (id: number, strict = false): Promise<Movie | null> => {
    const movie = await movieQueries.get(id);
    if (!movie) return null;

    if (!albumStore.has(id)) {
      try {
        albumStore.set(id, await itunesQueries.findAlbum(movie.title));
      } catch (error) {
        console.warn(`iTunes album lookup failed for "${movie.title}": ${(error as Error).message}`);
        if (strict) throw error;
        return { ...movie, album: null };
      }
    }

    return { ...movie, album: albumStore.get(id) };
  },

  getCachedAt: (): string | null => moviesCache?.cachedAt ?? null,
};
