import { Request, Response } from "express";
import { movieQueries } from "../../services/movieService";
import { itunesQueries } from "../../services/itunesService";
import { handleError } from "../../middleware/handleError";

const DAY = 86400;
const cache = (res: Response, seconds: number = 6 * 3600): void => {
  res.set(
    "Cache-Control",
    `public, max-age=300, s-maxage=${seconds}, stale-while-revalidate=${DAY}`,
  );
};

export const getMovies = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log("[getMovies] Starting request");

    if (!process.env.TMDB_API_KEY) {
      console.error("[getMovies] TMDB_API_KEY is not set!");
      res.status(500).json({
        error: "Configuration error",
        message: "TMDB_API_KEY is not configured"
      });
      return;
    }

    console.log("[getMovies] TMDB_API_KEY is set");

    cache(res, 900);

    if (req.query.page || req.query.limit) {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(50, parseInt(req.query.limit as string) || 5);
      const offset = (page - 1) * limit;

      console.log(`[getMovies] Fetching page ${page}, limit ${limit}`);

      const [movies, total] = await Promise.all([
        movieQueries.getPaginated(limit, offset),
        movieQueries.getCount(),
      ]);

      console.log(`[getMovies] Found ${movies.length} movies, total ${total}`);

      res.status(200).json({
        movies,
        total,
        page,
        totalPages: Math.ceil(total / limit),
        albumsResolved: movieQueries.getAlbumsResolved(),
        cachedAt: movieQueries.getCachedAt(),
      });
    } else {
      console.log("[getMovies] Fetching all movies");
      const movies = await movieQueries.getAll();

      console.log(`[getMovies] Found ${movies.length} movies`);

      res.status(200).json({
        count: movies.length,
        albumsResolved: movieQueries.getAlbumsResolved(),
        cachedAt: movieQueries.getCachedAt(),
        movies,
      });
    }
  } catch (error) {
    console.error("[getMovies] Error:", error);
    handleError(res, error);
  }
};

export const getMovieById = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log(`[getMovieById] Fetching movie: ${req.params.id}`);

    const movie = await movieQueries.getWithAlbumByKey(String(req.params.id));
    if (!movie) {
      res.status(404).json({ error: "Movie not found" });
      return;
    }

    cache(res);
    res.status(200).json(movie);
  } catch (error) {
    console.error("[getMovieById] Error:", error);
    handleError(res, error);
  }
};

export const getTracksForMovie = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log(`[getTracksForMovie] Fetching tracks for movie: ${req.params.id}`);

    const movie = await movieQueries.getWithAlbumByKey(String(req.params.id), true);
    if (!movie) {
      res.status(404).json({ error: "Movie not found" });
      return;
    }
    if (!movie.album) {
      res.status(404).json({ error: `No soundtrack album found for "${movie.title}"` });
      return;
    }

    const { album, tracks } = await itunesQueries.getAlbumTracks(movie.album.id);

    cache(res, DAY);
    res.status(200).json({
      movieId: movie.id,
      movieTitle: movie.title,
      album: album ?? movie.album,
      trackCount: tracks.length,
      tracks,
    });
  } catch (error) {
    console.error("[getTracksForMovie] Error:", error);
    handleError(res, error);
  }
};
