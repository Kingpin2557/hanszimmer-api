import { Request, Response } from "express";
import { movieQueries, generatedAt } from "../../services/movieService";

export const getApiInfo = (_req: Request, res: Response): void => {
  res.json({
    name: "hanszimmer-api",
    description: "Hans Zimmer filmography (TMDB) + soundtrack previews (iTunes Search API).",
    generatedAt,
    movieCount: movieQueries.getCount(),
    endpoints: {
      docs: "/api-docs",
      movies: "/api/movie?page=1&limit=20",
      movie: "/api/movie/:id",
      tracks: "/api/movie/:id/tracks",
      preview: "/api/preview/:id (CORS-friendly audio proxy)",
    },
  });
};
