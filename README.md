# hanszimmer-api

Hans Zimmer filmography (TMDB) + soundtrack previews (iTunes Search API — keyless, no auth).

The movie dataset is **prebuilt** into `server/data/movies.json`, so the deployed API answers
instantly and needs **zero environment variables**. Only track lists and audio previews hit
iTunes live (cached in memory + CDN cache headers).

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
├── data/movies.json       # Prebuilt dataset
└── services/
    ├── movieService.ts    # movieQueries
    ├── itunesService.ts   # itunesQueries
    └── http.ts
scripts/
└── build-data.ts          # Dataset builder (TMDB + iTunes)
```

## Endpoints

| Endpoint | Description |
| --- | --- |
| `GET /` | API info |
| `GET /api-docs` | Swagger UI |
| `GET /api/movie` | All movies (rating, runtime, genres, country coords, album). Optional `?page=&limit=` |
| `GET /api/movie/:id` | Single movie |
| `GET /api/movie/:id/tracks` | Soundtrack tracks incl. 30s `previewUrl` (m4a) |
| `GET /api/preview/:id` | CORS-friendly audio proxy — safe for Web Audio `AnalyserNode` |

## Rebuild the dataset

Needs `TMDB_API_KEY` in `.env` (see `.env.example`). iTunes is rate-limited (~20 req/min),
so a full build takes ~10–15 minutes.

```bash
npm run build:data                 # full build
npm run build:data -- --limit 5    # quick test
npm run build:data -- --skip-itunes
```

Commit the regenerated `server/data/movies.json`.

## Run locally

```bash
npm install
npm run dev   # http://localhost:3000
```

## Deploy (Vercel)

```bash
vercel --prod
```

`vercel.json` builds `server/app.ts` with `@vercel/node` and routes everything to it.
No env vars needed in production.
