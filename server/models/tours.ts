export interface TourStop {
  city: string;
  country: string;
  code: string;
  coords: { lat: number; lng: number };
  date: string;
  venue: string;
}

export interface Tour {
  id: string;
  name: string;
  years: string;
  stopCount: number;
  start: TourStop;
  stops: TourStop[];
  album: { id: number; title: string; artist: string; artwork: string | null } | null;
}
