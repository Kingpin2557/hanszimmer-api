/** A single dated stop on a tour (one concert's city + coordinates). */
export interface TourStop {
  city: string;
  country: string; // country name
  code: string; // ISO country code
  coords: { lat: number; lng: number };
  date: string; // ISO yyyy-mm-dd
  venue: string;
}

/** A Hans Zimmer tour: an ordered trail of located concert stops. */
export interface Tour {
  id: string; // slug of the tour name
  name: string;
  years: string; // "2017" or "2016–2019"
  stopCount: number;
  start: TourStop; // used as the map candle when no tour is selected
  stops: TourStop[]; // full chronological trail (drawn when selected)
  album: { id: number; title: string; artist: string; artwork: string | null } | null;
}
