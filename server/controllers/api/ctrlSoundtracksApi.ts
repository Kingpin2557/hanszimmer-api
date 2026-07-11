import { Request, Response } from "express";

import { itunesQueries } from "../../services/itunesService";
import { handleError } from "../../middleware/handleError";

const DAY = 86400;

export const streamPreview = async (_req: Request, res: Response): Promise<void> => {
  try {
    const track = await itunesQueries.getTrackPreview(res.locals.numericId);
    if (!track) {
      res.status(404).json({ error: "No preview for this track" });
      return;
    }

    res.setHeader("Cache-Control", `public, max-age=${DAY}`);
    res.redirect(302, track.previewUrl);
  } catch (error) {
    handleError(res, error);
  }
};

export const optionsPreview = (_req: Request, res: Response): void => {
  res.status(204).end();
};
