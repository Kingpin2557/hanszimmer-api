import express from "express";
import { getMovies, getMovieById, getTracksForMovie } from "../controllers/api/ctrlMoviesApi";
import { streamPreview, optionsPreview } from "../controllers/api/ctrlSoundtracksApi";
import { getTours, getTourBySlug, getAlbumTracks } from "../controllers/api/ctrlToursApi";
import { idValidation } from "../middleware/idValidation";

const router = express.Router();

/**
 * @openapi
 * /api/health:
 *   get:
 *     tags:
 *       - Health
 *     summary: Health check endpoint for debugging
 *     responses:
 *       200:
 *         description: API health status
 */
router.get("/health", (req: express.Request, res: express.Response) => {
  res.json({
    status: "ok",
    environment: process.env.NODE_ENV || "development",
    hasApiKey: !!process.env.TMDB_API_KEY,
    apiKeyPrefix: process.env.TMDB_API_KEY ? process.env.TMDB_API_KEY.substring(0, 5) + "..." : "not set",
    allowedOrigins: process.env.ALLOWED_ORIGINS?.split(",") || [],
    timestamp: new Date().toISOString(),
  });
});

/**
 * @openapi
 * /api/movie:
 *   get:
 *     tags:
 *       - Movies - Read Operations
 *     summary: Get all Hans Zimmer movies (rating, runtime, genres, country coords, soundtrack album)
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Optional page number (enables pagination)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Optional page size (max 50, default 5)
 *     responses:
 *       200:
 *         description: List of movies from the prebuilt dataset
 */
router.get("/movie", getMovies);

/**
 * @openapi
 * /api/movie/{id}/tracks:
 *   get:
 *     tags:
 *       - Soundtracks - Read Operations
 *     summary: Get soundtrack tracks (with 30s previewUrl) for a movie's album
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: TMDB movie id or slugified title (e.g. 155 or the-dark-knight)
 *     responses:
 *       200:
 *         description: Album info and track list with iTunes 30s preview URLs
 *       404:
 *         description: Movie not found, or no soundtrack album matched
 */
router.get("/movie/:id/tracks", getTracksForMovie);

/**
 * @openapi
 * /api/movie/{id}:
 *   get:
 *     tags:
 *       - Movies - Read Operations
 *     summary: Get a single movie by TMDB id or slug
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: TMDB movie id or slugified title (e.g. 155 or the-dark-knight)
 *     responses:
 *       200:
 *         description: The movie
 *       404:
 *         description: Movie not found
 */
router.get("/movie/:id", getMovieById);

// --- Tours (Hans Zimmer live tours from setlist.fm) ---
router.get("/tours", getTours);
router.get("/tour/:slug", getTourBySlug);
router.get("/album/:id/tracks", getAlbumTracks);

/**
 * @openapi
 * /api/preview/{id}:
 *   options:
 *     tags:
 *       - Soundtracks - Read Operations
 *     summary: CORS preflight for audio preview
 *     responses:
 *       204:
 *         description: CORS headers set
 *   get:
 *     tags:
 *       - Soundtracks - Read Operations
 *     summary: Stream a track's 30s preview audio through a CORS-friendly proxy (Web Audio safe)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: iTunes track id
 *     responses:
 *       200:
 *         description: Audio stream (audio/mpeg)
 *       404:
 *         description: No preview available for this track
 *       502:
 *         description: Upstream preview fetch failed
 */
// OPTIONS must come BEFORE GET for the same route
router.options("/preview/:id", optionsPreview);
router.get("/preview/:id", idValidation, streamPreview);

export default router;
