/**
 * Hans Zimmer live tours from setlist.fm, grouped into located trails.
 *
 * setlist.fm needs an API key (SETLIST_API_KEY) sent as the x-api-key header;
 * it is free for non-commercial use. Data is fetched live and cached in memory
 * (tours change rarely). Setlists without a tour name or venue coordinates are
 * skipped, so every stop we keep can be placed on the globe.
 */
import { slugify } from "../utils/slugify";
import { itunesQueries } from "./itunesService";
import { sleep } from "./http";
import { type Tour, type TourStop } from "../models/tours";

const SETLIST_BASE = "https://api.setlist.fm/rest/1.0";
const HZ_MBID = "e6de1f3b-6484-491c-88dd-6d619f142abc";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const MAX_PAGES = 15; // 20 setlists/page

interface SetlistCity {
  name?: string;
  coords?: { lat?: number; long?: number };
  country?: { code?: string; name?: string };
}
interface SetlistItem {
  eventDate?: string;
  tour?: { name?: string };
  venue?: { name?: string; city?: SetlistCity };
}
interface SetlistPage {
  itemsPerPage: number;
  page: number;
  total: number;
  setlist?: SetlistItem[];
}

/** "dd-MM-yyyy" -> ISO "yyyy-mm-dd" (or "" when unparseable). */
const toIso = (d?: string): string => {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(d ?? "");
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
};

async function fetchSetlistPage(page: number): Promise<SetlistPage | null> {
  const key = process.env.SETLIST_API_KEY;
  if (!key) throw new Error("SETLIST_API_KEY is not set");

  const url = `${SETLIST_BASE}/artist/${HZ_MBID}/setlists?p=${page}`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(url, {
      headers: { Accept: "application/json", "x-api-key": key },
    });
    if (res.ok) return (await res.json()) as SetlistPage;
    if (res.status === 404) return null; // no setlists / past last page
    if (res.status === 429 || res.status >= 500) {
      await sleep(1200 * attempt);
      continue;
    }
    throw new Error(`setlist.fm HTTP ${res.status} for ${url}`);
  }
  return null;
}

interface ToursCache {
  tours: Tour[];
  byId: Map<string, Tour>;
  expiresAt: number;
}
let cache: ToursCache | null = null;
let inFlight: Promise<ToursCache> | null = null;

async function build(): Promise<ToursCache> {
  const items: SetlistItem[] = [];
  for (let p = 1; p <= MAX_PAGES; p++) {
    const page = await fetchSetlistPage(p);
    if (!page?.setlist?.length) break;
    items.push(...page.setlist);
    if (page.page * page.itemsPerPage >= page.total) break;
    await sleep(600); // stay under setlist.fm's rate limit
  }

  // Group located stops by tour name.
  const groups = new Map<string, TourStop[]>();
  for (const item of items) {
    const name = item.tour?.name?.trim();
    if (!name) continue;
    const city = item.venue?.city;
    const lat = city?.coords?.lat;
    const lng = city?.coords?.long;
    if (typeof lat !== "number" || typeof lng !== "number") continue;

    const stop: TourStop = {
      city: city?.name ?? "",
      country: city?.country?.name ?? "",
      code: city?.country?.code ?? "",
      coords: { lat, lng },
      date: toIso(item.eventDate),
      venue: item.venue?.name ?? "",
    };
    const list = groups.get(name) ?? [];
    list.push(stop);
    groups.set(name, list);
  }

  // One Hans Zimmer live album powers the player for every tour.
  let liveAlbum: Tour["album"] = null;
  try {
    const album = await itunesQueries.findLiveAlbum();
    if (album) liveAlbum = { id: album.id, title: album.title, artist: album.artist, artwork: album.artwork };
  } catch {
    liveAlbum = null;
  }

  const tours: Tour[] = [];
  for (const [name, rawStops] of groups) {
    const ordered = rawStops.filter((s) => s.date).sort((a, b) => a.date.localeCompare(b.date));
    // Collapse consecutive nights in the same city into one trail point.
    const trail: TourStop[] = [];
    for (const s of ordered) {
      const prev = trail[trail.length - 1];
      if (prev && prev.coords.lat === s.coords.lat && prev.coords.lng === s.coords.lng) continue;
      trail.push(s);
    }
    if (trail.length === 0) continue;

    const first = trail[0].date.slice(0, 4);
    const last = trail[trail.length - 1].date.slice(0, 4);
    tours.push({
      id: slugify(name),
      name,
      years: first === last ? first : `${first}–${last}`,
      stopCount: trail.length,
      start: trail[0],
      stops: trail,
      album: liveAlbum,
    });
  }

  // Most recent tours first.
  tours.sort((a, b) =>
    (b.stops[b.stops.length - 1]?.date ?? "").localeCompare(a.stops[a.stops.length - 1]?.date ?? ""),
  );

  return { tours, byId: new Map(tours.map((t) => [t.id, t])), expiresAt: Date.now() + CACHE_TTL_MS };
}

async function getCache(): Promise<ToursCache> {
  if (cache && Date.now() < cache.expiresAt) return cache;
  if (!inFlight) {
    inFlight = build()
      .then((c) => {
        cache = c;
        return c;
      })
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

export const tourQueries = {
  getAll: async (): Promise<Tour[]> => (await getCache()).tours,
  get: async (slug: string): Promise<Tour | null> => (await getCache()).byId.get(slug) ?? null,
};
