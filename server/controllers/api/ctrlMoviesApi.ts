import { Request, Response } from "express";
import { movieQueries, generatedAt } from "../../services/movieService";
import { itunesQueries } from "../../services/itunesService";
import { handleError } from "../../middleware/handleError";

const DAY = 86400;
const cache = (res: Response, seconds: number = DAY): void => {
  res.set(
    "Cache-Control",
    `public, max-age=300, s-maxage=${seconds}, stale-while-revalidate=${DAY}`,
  );
};

export const getMovies = async (req: Request, res: Response): Promise<void> => {
  try {
    cache(res);

    if (req.query.page || req.query.limit) {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(50, parseInt(req.query.limit as string) || 5);
      const offset = (page - 1) * limit;
      const movies = movieQueries.getPaginated(limit, offset);
      const total = movieQueries.getCount();
      res.status(200).json({ movies, total, page, totalPages: Math.ceil(total / limit), generatedAt });
    } else {
      const movies = movieQueries.getAll();
      res.status(200).json({ count: movies.length, generatedAt, movies });
    }
  } catch (error) {
    handleError(res, error);
  }
};

export const getMovieById = async (_req: Request, res: Response): Promise<void> => {
  try {
    const movie = movieQueries.get(res.locals.numericId);
    if (!movie) {
      res.status(404).json({ error: "Movie not found" });
      return;
    }

    cache(res);
    res.status(200).json(movie);
  } catch (error) {
    handleError(res, error);
  }
};

export const getTracksForMovie = async (_req: Request, res: Response): Promise<void> => {
  try {
    const movie = movieQueries.get(res.locals.numericId);
    if (!movie) {
      res.status(404).json({ error: "Movie not found" });
      return;
    }
    if (!movie.album) {
      res.status(404).json({ error: `No soundtrack album found for "${movie.title}"` });
      return;
    }

    const { album, tracks } = await itunesQueries.getAlbumTracks(movie.album.id);

    cache(res);
    res.status(200).json({
      movieId: movie.id,
      movieTitle: movie.title,
      album: album ?? movie.album,
      trackCount: tracks.length,
      tracks,
    });
  } catch (error) {
    handleError(res, error);
  }
};
