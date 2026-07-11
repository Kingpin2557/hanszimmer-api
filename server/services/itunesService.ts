import { fetchJson } from "./http";
import { type Album, type AlbumTracks, type Track, type TrackPreview } from "../models/soundtracks";

const ITUNES_BASE: string = process.env.ITUNES_BASE_URL || "https://itunes.apple.com";
const COUNTRY: string = process.env.ITUNES_COUNTRY || "US";

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

const BAD_ALBUM_WORDS = ["tribute", "karaoke", "inspired by", "lullaby", "ringtone", "cover version", "- single", " ep)"];

const SOUNDTRACK_SUFFIX =
  /\b(original motion picture soundtrack|music from the motion picture|original television soundtrack|original series soundtrack|motion picture soundtrack|original soundtrack|original score|soundtrack|score)\b/g;

const canonicalTitle = (title: string): string =>
  title
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(SOUNDTRACK_SUFFIX, " ")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const artwork = (url: string | undefined, size = 600): string | null =>
  url ? url.replace(/100x100bb/, `${size}x${size}bb`) : null;

const isJunk = (album: ItunesResult): boolean =>
  BAD_ALBUM_WORDS.some((bad) => (album.collectionName || "").toLowerCase().includes(bad));

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

// Hans Zimmer album catalog, cached in memory (no local JSON file).
const CATALOG_TTL_MS = 6 * 60 * 60 * 1000; // 6h
let catalogCache: { albums: ItunesResult[]; expiresAt: number } | null = null;

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

    getCatalog: async (artistName: string = "Hans Zimmer"): Promise<ItunesResult[]> => {
    if (catalogCache && Date.now() < catalogCache.expiresAt) return catalogCache.albums;
    const albums = await itunesQueries.getArtistCatalog(artistName);
    catalogCache = { albums, expiresAt: Date.now() + CATALOG_TTL_MS };
    return albums;
  },

    matchFromCatalog: (movieTitle: string, _movieId: number, catalog: ItunesResult[]): Album | null => {
    const target = canonicalTitle(movieTitle);
    if (!target) return null;

    let best: ItunesResult | null = null;
    for (const candidate of catalog) {
      if (isJunk(candidate)) continue;
      if (!/zimmer/i.test(candidate.artistName || "")) continue;
      if (canonicalTitle(candidate.collectionName || "") !== target) continue;
      // Deluxe/expanded editions can also match — keep the fullest one.
      if (!best || (candidate.trackCount ?? 0) > (best.trackCount ?? 0)) best = candidate;
    }

    return best ? { ...normalizeAlbum(best), matchType: "exact" } : null;
  },

  findAlbum: async (movieTitle: string): Promise<Album | null> => {

    const catalog = await itunesQueries.getCatalog("Hans Zimmer");
    return itunesQueries.matchFromCatalog(movieTitle, 0, catalog);
  },

    findLiveAlbum: async (): Promise<Album | null> => {
    const catalog = await itunesQueries.getCatalog("Hans Zimmer");
    let best: ItunesResult | null = null;
    for (const album of catalog) {
      if (isJunk(album)) continue;
      if (!/zimmer/i.test(album.artistName || "")) continue;
      if (!/\blive\b/i.test(album.collectionName || "")) continue;
      if (!best || (album.trackCount ?? 0) > (best.trackCount ?? 0)) best = album;
    }
    return best ? { ...normalizeAlbum(best), matchType: "exact" } : null;
  },

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
