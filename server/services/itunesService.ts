/**
 * iTunes Search API — no auth, no API key.
 * Docs: https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/
 *
 * Apple rate-limits to roughly 20 requests/minute per IP.
 * fetchJson retries 403/429 with backoff; the build script throttles on top of that.
 */
import { fetchJson, sleep } from "./http";
import { type Album, type AlbumMatchType, type AlbumTracks, type Track, type TrackPreview } from "../models/soundtracks";

const ITUNES_BASE: string = process.env.ITUNES_BASE_URL || "https://itunes.apple.com";
const COUNTRY: string = process.env.ITUNES_COUNTRY || "US";

/** Raw iTunes result item (only the fields we read). */
export interface ItunesResult {
  wrapperType: string;
  kind?: string;
  collectionId?: number;
  collectionName?: string;
  artistName?: string;
  artworkUrl100?: string;
  trackCount?: number;
  releaseDate?: string;
  primaryGenreName?: string;
  collectionViewUrl?: string;
  trackId?: number;
  trackName?: string;
  trackNumber?: number;
  discNumber?: number;
  trackTimeMillis?: number;
  previewUrl?: string;
}

interface ItunesResponse {
  resultCount: number;
  results: ItunesResult[];
}

const STOP_WORDS = new Set([
  "a", "an", "the", "and", "but", "or", "of", "in", "on", "at", "for", "with", "from", "to", "is", "it",
]);

const BAD_ALBUM_WORDS = ["tribute", "karaoke", "inspired by", "lullaby", "ringtone", "cover version", "- single", " ep)"];

const significantWords = (title: string): string[] =>
  title
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter((word) => word.length > 0 && !STOP_WORDS.has(word));

/** Upscale Apple artwork from the default 100x100 thumbnail. */
const artwork = (url: string | undefined, size = 600): string | null =>
  url ? url.replace(/100x100bb/, `${size}x${size}bb`) : null;

/**
 * Score how well an iTunes album matches a movie title.
 * All significant movie-title words must appear in the album title.
 */
const isJunk = (album: ItunesResult): boolean =>
  BAD_ALBUM_WORDS.some((bad) => (album.collectionName || "").toLowerCase().includes(bad));

const scoreAlbum = (album: ItunesResult, movieTitle: string, requireZimmer: boolean): number => {
  const albumTitle = (album.collectionName || "").toLowerCase();
  const albumWords = new Set(significantWords(albumTitle));
  const movieWords = significantWords(movieTitle);

  if (movieWords.length === 0) return 0;
  if (!movieWords.every((word) => albumWords.has(word))) return 0;
  if (isJunk(album)) return 0;
  // Fallback searches are broad — only accept albums actually credited to Zimmer,
  // otherwise random same-titled releases slip through.
  if (requireZimmer && !/zimmer/i.test(album.artistName || "")) return 0;

  let score = 1;
  if (/soundtrack|original motion picture|original score|music from/i.test(albumTitle)) score += 0.5;
  if (/zimmer/i.test(album.artistName || "")) score += 0.3;
  // Prefer tighter titles (less unrelated noise around the movie name)
  score -= Math.max(0, albumWords.size - movieWords.length) * 0.01;

  return score;
};

const normalizeAlbum = (album: ItunesResult): Album => ({
  id: album.collectionId as number,
  title: album.collectionName ?? "",
  artist: album.artistName ?? "",
  artwork: artwork(album.artworkUrl100),
  trackCount: album.trackCount ?? null,
  releaseDate: album.releaseDate ? album.releaseDate.slice(0, 10) : null,
  genre: album.primaryGenreName ?? null,
  itunesUrl: album.collectionViewUrl ?? null,
});

const searchAlbums = async (term: string): Promise<ItunesResult[]> => {
  const url = `${ITUNES_BASE}/search?term=${encodeURIComponent(term)}&entity=album&media=music&limit=10&country=${COUNTRY}`;
  const data = await fetchJson<ItunesResponse>(url, { label: "iTunes search" });
  return (data.results || []).filter((result) => result.wrapperType === "collection");
};

// Track lookups (request time) — cached in memory per instance.
const trackCache = new Map<string, AlbumTracks>();

interface ItunesArtist {
  wrapperType: string;
  artistType?: string;
  artistName?: string;
  artistId?: number;
}

export const itunesQueries = {
  /**
   * Find the best-matching soundtrack album for a movie title.
   */
  /**
   * Hans Zimmer's full album catalog in two calls:
   * artist search -> artist album lookup (up to 200 albums).
   */
  getArtistCatalog: async (artistName: string): Promise<ItunesResult[]> => {
    const searchUrl = `${ITUNES_BASE}/search?term=${encodeURIComponent(artistName)}&entity=musicArtist&limit=5&country=${COUNTRY}`;
    const artists = await fetchJson<{ results: ItunesArtist[] }>(searchUrl, { label: "iTunes artist search" });
    const artist = (artists.results || []).find(
      (result) => result.artistName?.toLowerCase() === artistName.toLowerCase(),
    );
    if (!artist?.artistId) return [];

    const lookupUrl = `${ITUNES_BASE}/lookup?id=${artist.artistId}&entity=album&limit=200&country=${COUNTRY}`;
    const data = await fetchJson<ItunesResponse>(lookupUrl, { label: "iTunes artist albums" });
    return (data.results || []).filter((result) => result.wrapperType === "collection");
  },

  /**
   * Match a movie against a prefetched catalog (no network), tiered:
   * 1. exact  — every significant title word appears in the album title
   * 2. fuzzy  — at least half the title words appear
   * 3. fallback — any proper Zimmer album (picked by movie id, so it varies)
   * Every movie gets music; matchType tells the frontend how official it is.
   */
  matchFromCatalog: (movieTitle: string, movieId: number, catalog: ItunesResult[]): Album | null => {
    const withType = (result: ItunesResult, matchType: AlbumMatchType): Album => ({
      ...normalizeAlbum(result),
      matchType,
    });

    // 1. exact
    let best: ItunesResult | null = null;
    let bestScore = 0;
    for (const candidate of catalog) {
      const score = scoreAlbum(candidate, movieTitle, false);
      if (score > bestScore) {
        best = candidate;
        bestScore = score;
      }
    }
    if (best) return withType(best, "exact");

    // 2. fuzzy: at least half the significant title words in the album title
    const movieWords = significantWords(movieTitle);
    if (movieWords.length > 0) {
      let fuzzyBest: ItunesResult | null = null;
      let fuzzyScore = 0;
      for (const candidate of catalog) {
        if (isJunk(candidate)) continue;
        const albumWords = new Set(significantWords((candidate.collectionName || "").toLowerCase()));
        const coverage = movieWords.filter((word) => albumWords.has(word)).length / movieWords.length;
        if (coverage >= 0.5 && coverage > fuzzyScore) {
          fuzzyBest = candidate;
          fuzzyScore = coverage;
        }
      }
      if (fuzzyBest) return withType(fuzzyBest, "fuzzy");
    }

    // 3. fallback: deterministic pick from the clean catalog, varied per movie
    const clean = catalog.filter((candidate) => !isJunk(candidate));
    if (clean.length === 0) return null;
    return withType(clean[movieId % clean.length] as ItunesResult, "fallback");
  },

  findAlbum: async (movieTitle: string): Promise<Album | null> => {
    const pick = (candidates: ItunesResult[], requireZimmer: boolean): ItunesResult | null => {
      let best: ItunesResult | null = null;
      let bestScore = 0;
      for (const candidate of candidates) {
        const score = scoreAlbum(candidate, movieTitle, requireZimmer);
        if (score > bestScore) {
          best = candidate;
          bestScore = score;
        }
      }
      return best;
    };

    let best = pick(await searchAlbums(`${movieTitle} Hans Zimmer`), false);

    // Fallback: broader search, but strictly Zimmer-credited results only
    if (!best) {
      await sleep(1000);
      best = pick(await searchAlbums(`${movieTitle} soundtrack`), true);
    }

    return best ? normalizeAlbum(best) : null;
  },

  /**
   * Fetch all tracks (with 30s previewUrl) for an iTunes album id.
   */
  getAlbumTracks: async (albumId: number | string): Promise<AlbumTracks> => {
    const key = String(albumId);
    const cached = trackCache.get(key);
    if (cached) return cached;

    const url = `${ITUNES_BASE}/lookup?id=${encodeURIComponent(key)}&entity=song&limit=200&country=${COUNTRY}`;
    const data = await fetchJson<ItunesResponse>(url, { label: "iTunes lookup" });
    const results = data.results || [];

    const collection = results.find((result) => result.wrapperType === "collection");
    const tracks: Track[] = results
      .filter((result) => result.wrapperType === "track" && result.kind === "song" && result.previewUrl)
      .map((track) => ({
        id: track.trackId as number,
        title: track.trackName ?? "",
        trackNumber: track.trackNumber ?? null,
        discNumber: track.discNumber ?? null,
        durationMs: track.trackTimeMillis ?? null,
        previewUrl: track.previewUrl as string,
        artwork: artwork(track.artworkUrl100),
      }));

    const payload: AlbumTracks = {
      album: collection ? normalizeAlbum(collection) : null,
      tracks,
    };

    trackCache.set(key, payload);
    return payload;
  },

  /**
   * Resolve the preview audio URL for a single track id.
   */
  getTrackPreview: async (trackId: number | string): Promise<TrackPreview | null> => {
    const url = `${ITUNES_BASE}/lookup?id=${encodeURIComponent(String(trackId))}&country=${COUNTRY}`;
    const data = await fetchJson<ItunesResponse>(url, { label: "iTunes track lookup" });
    const track = (data.results || []).find(
      (result) => result.wrapperType === "track" && result.previewUrl,
    );

    return track
      ? { id: track.trackId as number, title: track.trackName ?? "", previewUrl: track.previewUrl as string }
      : null;
  },
};
