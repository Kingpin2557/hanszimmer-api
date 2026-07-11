export type AlbumMatchType = "exact" | "fuzzy" | "fallback";

export interface Album {
    matchType?: AlbumMatchType;
  id: number;
  title: string;
  artist: string;
  artwork: string | null;
  trackCount: number | null;
  releaseDate: string | null;
  genre: string | null;
  itunesUrl: string | null;
}

export interface Track {
  id: number;
  title: string;
  trackNumber: number | null;
  discNumber: number | null;
  durationMs: number | null;
  previewUrl: string;
  artwork: string | null;
}

export interface AlbumTracks {
  album: Album | null;
  tracks: Track[];
}

export interface TrackPreview {
  id: number;
  title: string;
  previewUrl: string;
}
