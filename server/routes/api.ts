import express from "express";
import { getMovies, getMovieById, getTracksForMovie } from "../controllers/api/ctrlMoviesApi";
import { streamPreview } from "../controllers/api/ctrlSoundtracksApi";
import { idValidation } from "../middleware/idValidation";

const router = express.Router();

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

/**
 * @openapi
 * /api/preview/{id}:
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
 *         description: Audio stream (audio/mp4)
 *       404:
 *         description: No preview available for this track
 *       502:
 *         description: Upstream preview fetch failed
 */
router.get("/preview/:id", idValidation, streamPreview);

export default router;
