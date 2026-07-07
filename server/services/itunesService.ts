/**
 * iTunes Search API — no auth, no API key.
 * Docs: https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/
 *
 * Apple rate-limits to roughly 20 requests/minute per IP.
 * fetchJson retries 403/429 with backoff; the build script throttles on top of that.
 */
import { fetchJson } from "./http";
import { type Album, type AlbumTracks, type Track, type TrackPreview } from "../models/soundtracks";

const ITUNES_BASE: string = process.env.ITUNES_BASE_URL || "https://itunes.apple.com";
const COUNTRY: string = process.env.ITUNES_COUNTRY || "US";

/** Raw iTunes result item (only the fields we read). */
interface ItunesResult {
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

const BAD_ALBUM_WORDS = ["tribute", "karaoke", "inspired by", "lullaby", "ringtone", "cover version"];

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
const scoreAlbum = (album: ItunesResult, movieTitle: string): number => {
  const albumTitle = (album.collectionName || "").toLowerCase();
  const albumWords = new Set(significantWords(albumTitle));
  const movieWords = significantWords(movieTitle);

  if (movieWords.length === 0) return 0;
  if (!movieWords.every((word) => albumWords.has(word))) return 0;
  if (BAD_ALBUM_WORDS.some((bad) => albumTitle.includes(bad))) return 0;

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

export const itunesQueries = {
  /**
   * Find the best-matching soundtrack album for a movie title.
   */
  findAlbum: async (movieTitle: string): Promise<Album | null> => {
    const candidates = await searchAlbums(`${movieTitle} Hans Zimmer`);

    let best: ItunesResult | null = null;
    let bestScore = 0;

    for (const candidate of candidates) {
      const score = scoreAlbum(candidate, movieTitle);
      if (score > bestScore) {
        best = candidate;
        bestScore = score;
      }
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
