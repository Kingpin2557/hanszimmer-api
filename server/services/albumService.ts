/**
 * Persistent album store — server/data/albums.json (movieId -> Album | null once checked).
 * Works like the countries dataset, but is written back as new albums get resolved,
 * so restarts don't lose progress. Fill it once with `npm run build:albums` and commit it.
 * Writes fail silently on read-only filesystems (Vercel) — the committed file is used there.
 */
import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { type Album } from "../models/soundtracks";

const FILE = path.join(__dirname, "..", "data", "albums.json");

type AlbumMap = Record<string, Album | null>;

const load = (): AlbumMap => {
  try {
    return JSON.parse(readFileSync(FILE, "utf8")) as AlbumMap;
  } catch {
    return {};
  }
};

const albums: AlbumMap = load();

const persist = (): void => {
  try {
    writeFileSync(FILE, JSON.stringify(albums, null, 2));
  } catch {
    // read-only filesystem (e.g. Vercel) — in-memory copy still works
  }
};

export const albumStore = {
  has: (movieId: number): boolean => String(movieId) in albums,

  get: (movieId: number): Album | null => albums[String(movieId)] ?? null,

  set: (movieId: number, album: Album | null): void => {
    albums[String(movieId)] = album;
    persist();
  },

  /** Bulk write (single file save). */
  setAll: (entries: Map<number, Album | null>): void => {
    for (const [movieId, album] of entries) {
      albums[String(movieId)] = album;
    }
    persist();
  },

  /** Number of movies with a matched (non-null) album. */
  countResolved: (): number => Object.values(albums).filter(Boolean).length,
};
