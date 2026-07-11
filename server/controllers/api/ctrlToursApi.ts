import { Request, Response } from "express";
import { tourQueries } from "../../services/setlistService";
import { itunesQueries } from "../../services/itunesService";
import { getGradient } from "../../services/gradientService";
import { handleError } from "../../middleware/handleError";

const DAY = 86400;
const cache = (res: Response, seconds: number = 6 * 3600): void => {
  res.set(
    "Cache-Control",
    `public, max-age=300, s-maxage=${seconds}, stale-while-revalidate=${DAY}`,
  );
};

export const getTours = async (_req: Request, res: Response): Promise<void> => {
  try {
    if (!process.env.SETLIST_API_KEY) {
      res.status(500).json({ error: "Configuration error", message: "SETLIST_API_KEY is not configured" });
      return;
    }
    const tours = await tourQueries.getAll();
    cache(res, DAY);
    res.status(200).json({ count: tours.length, tours });
  } catch (error) {
    console.error("[getTours] Error:", error);
    handleError(res, error);
  }
};

export const getTourBySlug = async (req: Request, res: Response): Promise<void> => {
  try {
    const tour = await tourQueries.get(String(req.params.slug));
    if (!tour) {
      res.status(404).json({ error: "Tour not found" });
      return;
    }
    cache(res, DAY);
    res.status(200).json(tour);
  } catch (error) {
    console.error("[getTourBySlug] Error:", error);
    handleError(res, error);
  }
};

export const getAlbumTracks = async (req: Request, res: Response): Promise<void> => {
  try {
    const { album, tracks } = await itunesQueries.getAlbumTracks(String(req.params.id));
    const gradient = await getGradient(album?.artwork);
    cache(res, DAY);
    res.status(200).json({ album, gradient, trackCount: tracks.length, tracks });
  } catch (error) {
    console.error("[getAlbumTracks] Error:", error);
    handleError(res, error);
  }
};
