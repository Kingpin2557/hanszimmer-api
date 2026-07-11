import { Request, Response } from "express";
import ffmpeg from "fluent-ffmpeg";

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

    res.setHeader("Content-Type", "audio/wav");
    res.setHeader("Cache-Control", `public, max-age=${DAY}`);

    ffmpeg(track.previewUrl)
      .format("wav")
      .audioCodec("pcm_s16le")      // uncompressed PCM
      .audioChannels(1)            // optional: mono
      .audioFrequency(44100)      // optional: standard sample rate
      .on("error", (err) => {
        // if headers already sent, just end
        try { res.end(); } catch {}
        handleError(res, err);
      })
      .pipe(res, { end: true });
  } catch (error) {
    handleError(res, error);
  }
};

export const optionsPreview = (_req: Request, res: Response): void => {
  res.status(204).end();
};
