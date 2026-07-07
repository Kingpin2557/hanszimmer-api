# hanszimmer-api

Hans Zimmer filmography (TMDB) + soundtrack previews (iTunes Search API — keyless, no auth).

All data is fetched **live**: TMDB for the filmography (ratings, runtime, genres, country),
restcountries.com for map coordinates, iTunes for soundtrack albums + previews. No build step.
The movie list is cached in memory (6h TTL) and behind CDN `s-maxage` headers, so only the
first cold request pays the TMDB fan-out (~3-5s); everything after is instant. iTunes albums
are resolved lazily per movie to respect Apple's ~20 req/min rate limit.

## Structure

```
server/
├── app.ts                 # Express app + Swagger UI (/api-docs)
├── routes.ts              # Root router (mounts /api, JSON 404)
├── routes/
│   └── api.ts             # API route declarations (OpenAPI-documented)
├── controllers/
│   └── api/
│       ├── ctrlMoviesApi.ts
│       ├── ctrlSoundtracksApi.ts
│       └── ctrlMetaApi.ts
├── middleware/
│   ├── handleError.ts
│   └── idValidation.ts
├── models/
│   ├── movies.ts
│   └── soundtracks.ts
└── services/
    ├── movieService.ts    # movieQueries (orchestration + TTL cache)
    ├── tmdbService.ts     # tmdbQueries
    ├── itunesService.ts   # itunesQueries
    ├── countryService.ts  # countryQueries
    └── http.ts            # fetchJson (retry) + mapWithConcurrency
```

## Endpoints

| Endpoint | Description |
| --- | --- |
| `GET /` | API info |
| `GET /api-docs` | Swagger UI |
| `GET /api/movie` | All movies (rating, runtime, genres, country coords, album). Optional `?page=&limit=` |
| `GET /api/movie/:id` | Single movie, incl. matched iTunes `album` |
| `GET /api/movie/:id/tracks` | Soundtrack tracks incl. 30s `previewUrl` (m4a) |
| `GET /api/preview/:id` | CORS-friendly audio proxy — safe for Web Audio `AnalyserNode` |

## Run locally

```bash
npm install
npm run dev   # http://localhost:3000
```

## Deploy (Vercel)

```bash
vercel env add TMDB_API_KEY   # one time
vercel --prod
```

`vercel.json` builds `server/app.ts` with `@vercel/node` and routes everything to it.
Only `TMDB_API_KEY` is needed in production (iTunes + restcountries are keyless).
