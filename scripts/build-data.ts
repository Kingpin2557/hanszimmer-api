/**
 * Build the movie dataset: TMDB filmography + iTunes soundtrack album matches.
 *
 * Run locally (needs TMDB_API_KEY in .env — the deployed API itself needs no keys):
 *   npm run build:data                 # full build (~10-15 min, iTunes is rate-limited)
 *   npm run build:data -- --limit 5    # quick test with 5 movies
 *   npm run build:data -- --skip-itunes
 *
 * Output: server/data/movies.json (commit it — the API serves it directly).
 */
import { writeFileSync, mkdirSync } from "fs";
import path from "path";
import dotenv from "dotenv";

import { fetchJson, sleep } from "../server/services/http";
import { itunesQueries } from "../server/services/itunesService";
import { type Movie, type Country } from "../server/models/movies";

dotenv.config();

const TMDB_BASE: string = process.env.TMDB_BASE_URL || "https://api.themoviedb.org/3";
const TMDB_IMG: string = process.env.TMDB_IMAGE_BASE_URL || "https://image.tmdb.org/t/p";
const TMDB_KEY: string | undefined = process.env.TMDB_API_KEY;

const HANS_ZIMMER_PERSON_ID = 947;
const COMPOSER_JOBS = new Set(["Original Music Composer", "Music", "Composer"]);
const ITUNES_THROTTLE_MS = 3500; // Apple allows ~20 req/min per IP
const TMDB_THROTTLE_MS = 60;

interface TmdbCredit {
  id: number;
  title?: string;
  original_title?: string;
  job: string;
}

interface TmdbMovieDetail {
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

interface RestCountry {
  name: { common: string; official: string };
  cca2: string;
  latlng: [number, number];
}

const args: string[] = process.argv.slice(2);
const limitIndex = args.indexOf("--limit");
const LIMIT: number = limitIndex !== -1 ? Number(args[limitIndex + 1]) : Infinity;
const SKIP_ITUNES: boolean = args.includes("--skip-itunes");

if (!TMDB_KEY) {
  console.error("Missing TMDB_API_KEY in .env");
  process.exit(1);
}

const tmdb = <T>(endpoint: string): Promise<T> =>
  fetchJson<T>(
    `${TMDB_BASE}${endpoint}${endpoint.includes("?") ? "&" : "?"}api_key=${TMDB_KEY}`,
    { label: `TMDB ${endpoint}` },
  );

// --- Country coords (restcountries.com), cached per run ---------------------
const countryCache = new Map<string, Country | null>();

const countryInfo = async (code: string | undefined): Promise<Country | null> => {
  if (!code) return null;
  const cached = countryCache.get(code);
  if (cached !== undefined) return cached;

  let country: Country | null = null;
  try {
    const data = await fetchJson<RestCountry[]>(
      `https://restcountries.com/v3.1/alpha/${code}`,
      { label: "restcountries" },
    );
    const entry = Array.isArray(data) ? data[0] : null;
    if (entry) {
      country = {
        name: entry.name.common,
        officialName: entry.name.official,
        code: entry.cca2,
        coords: { lat: entry.latlng[0], lng: entry.latlng[1] },
      };
    }
  } catch (error) {
    console.warn(`  ⚠ country lookup failed for "${code}": ${(error as Error).message}`);
  }

  countryCache.set(code, country);
  return country;
};

// --- Main --------------------------------------------------------------------
const run = async (): Promise<void> => {
  console.log("Fetching Hans Zimmer movie credits from TMDB...");
  const credits = await tmdb<{ crew: TmdbCredit[] }>(
    `/person/${HANS_ZIMMER_PERSON_ID}/movie_credits`,
  );

  // Composer credits only, deduplicated (a movie can appear once per job)
  const seen = new Set<number>();
  const creditList = (credits.crew || []).filter((credit) => {
    if (!COMPOSER_JOBS.has(credit.job)) return false;
    if (seen.has(credit.id)) return false;
    seen.add(credit.id);
    return true;
  });

  console.log(`${creditList.length} composer credits found.`);

  const movies: Movie[] = [];
  let index = 0;

  for (const credit of creditList) {
    if (movies.length >= LIMIT) break;
    index++;

    let detail: TmdbMovieDetail;
    try {
      detail = await tmdb<TmdbMovieDetail>(`/movie/${credit.id}`);
    } catch (error) {
      console.warn(`  ⚠ skipping ${credit.title ?? credit.id}: ${(error as Error).message}`);
      continue;
    }
    await sleep(TMDB_THROTTLE_MS);

    // Skip unreleased/obscure entries that a kiosk can't display properly
    if (!detail.poster_path || !detail.release_date) continue;

    const movie: Movie = {
      id: detail.id,
      title: detail.title,
      originalTitle: detail.original_title,
      overview: detail.overview,
      tagline: detail.tagline || null,
      releaseDate: detail.release_date,
      year: Number(detail.release_date.slice(0, 4)),
      runtime: detail.runtime || null,
      genres: (detail.genres || []).map((genre) => genre.name),
      rating: {
        score: Math.round(detail.vote_average * 10) / 10,
        votes: detail.vote_count,
      },
      popularity: detail.popularity ?? null,
      imdbId: detail.imdb_id || null,
      poster: `${TMDB_IMG}/w500${detail.poster_path}`,
      backdrop: detail.backdrop_path ? `${TMDB_IMG}/w1280${detail.backdrop_path}` : null,
      originCountry: await countryInfo(detail.origin_country?.[0]),
      zimmerJob: credit.job,
      album: null,
    };

    if (!SKIP_ITUNES) {
      try {
        movie.album = await itunesQueries.findAlbum(movie.title);
      } catch (error) {
        console.warn(`  ⚠ iTunes lookup failed for "${movie.title}": ${(error as Error).message}`);
      }
      await sleep(ITUNES_THROTTLE_MS);
    }

    movies.push(movie);
    console.log(
      `[${index}/${creditList.length}] ${movie.title} (${movie.year}) ★${movie.rating?.score}` +
        (movie.album ? ` → 🎵 ${movie.album.title}` : " → no album match"),
    );
  }

  movies.sort((a, b) => (a.releaseDate ?? "").localeCompare(b.releaseDate ?? ""));

  const outDir = path.join(__dirname, "..", "server", "data");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    path.join(outDir, "movies.json"),
    JSON.stringify(
      { generatedAt: new Date().toISOString(), count: movies.length, movies },
      null,
      2,
    ),
  );

  const withAlbum = movies.filter((movie) => movie.album).length;
  console.log(
    `\n✅ Wrote ${movies.length} movies (${withAlbum} with a soundtrack album) to server/data/movies.json`,
  );
};

run().catch((error: Error) => {
  console.error(error);
  process.exit(1);
});
