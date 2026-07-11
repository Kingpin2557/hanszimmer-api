import express from "express";
import { getMovies, getMovieById, getTracksForMovie, getWarm } from "../controllers/api/ctrlMoviesApi";
import { streamPreview, optionsPreview } from "../controllers/api/ctrlSoundtracksApi";
import { getTours, getTourBySlug, getAlbumTracks } from "../controllers/api/ctrlToursApi";
import { idValidation } from "../middleware/idValidation";

const router = express.Router();

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

router.get("/movie", getMovies);
router.get("/warm", getWarm);

router.get("/movie/:id/tracks", getTracksForMovie);

router.get("/movie/:id", getMovieById);

router.get("/tours", getTours);
router.get("/tour/:slug", getTourBySlug);
router.get("/album/:id/tracks", getAlbumTracks);

router.options("/preview/:id", optionsPreview);
router.get("/preview/:id", idValidation, streamPreview);

export default router;
