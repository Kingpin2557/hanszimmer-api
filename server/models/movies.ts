import { type Album } from "./soundtracks";

export interface Country {
  name: string;
  code: string;
  coords: { lat: number; lng: number };
}

export interface Movie {
  id: number;
  title: string;
  originalTitle: string;
  overview: string;
  tagline: string | null;
  releaseDate: string | null;
  year: number | null;
  runtime: number | null;
  genres: string[];
  rating: { score: number; votes: number } | null;
  popularity: number | null;
  imdbId: string | null;
  poster: string | null;
  backdrop: string | null;
  originCountry: Country | null;
  zimmerJob: string | null;
  album: Album | null;
}
