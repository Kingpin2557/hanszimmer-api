import { type Album } from "../models/soundtracks";

type AlbumMap = Record<string, Album | null>;

const albums: AlbumMap = {};

export const albumStore = {
  has: (movieId: number): boolean => String(movieId) in albums,

  get: (movieId: number): Album | null => albums[String(movieId)] ?? null,

  set: (movieId: number, album: Album | null): void => {
    albums[String(movieId)] = album;
  },

    setAll: (entries: Map<number, Album | null>): void => {
    for (const [movieId, album] of entries) {
      albums[String(movieId)] = album;
    }
  },

    countResolved: (): number => Object.values(albums).filter(Boolean).length,
};
