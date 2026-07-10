/**
 * In-memory album store (movieId -> Album | null once resolved).
 *
 * No local JSON file: Hans Zimmer's catalog is fetched live from iTunes and
 * matched in memory. On a cold start this simply re-resolves — the catalog is
 * two cached iTunes calls and the matching itself is local and instant.
 */
import { type Album } from "../models/soundtracks";

type AlbumMap = Record<string, Album | null>;

const albums: AlbumMap = {};

export const albumStore = {
  has: (movieId: number): boolean => String(movieId) in albums,

  get: (movieId: number): Album | null => albums[String(movieId)] ?? null,

  set: (movieId: number, album: Album | null): void => {
    albums[String(movieId)] = album;
  },

  /** Bulk write. */
  setAll: (entries: Map<number, Album | null>): void => {
    for (const [movieId, album] of entries) {
      albums[String(movieId)] = album;
    }
  },

  /** Number of movies with a matched (non-null) album. */
  countResolved: (): number => Object.values(albums).filter(Boolean).length,
};
