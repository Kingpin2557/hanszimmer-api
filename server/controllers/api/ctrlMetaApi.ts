import { Request, Response } from "express";
import { movieQueries } from "../../services/movieService";

export const getApiInfo = (_req: Request, res: Response): void => {
  res.json({
    name: "hanszimmer-api",
    description: "Hans Zimmer filmography (TMDB, live) + soundtrack previews (iTunes Search API).",
    mode: "live",
    cachedAt: movieQueries.getCachedAt(),
    endpoints: {
      docs: "/api-docs",
      movies: "/api/movie?page=1&limit=20",
      movie: "/api/movie/:id",
      tracks: "/api/movie/:id/tracks",
      preview: "/api/preview/:id (CORS-friendly audio proxy)",
    },
  });
};
