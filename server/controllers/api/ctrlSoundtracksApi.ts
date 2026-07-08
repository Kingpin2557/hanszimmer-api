import { Request, Response } from "express";
import { Readable } from "stream";
import ffmpeg from "fluent-ffmpeg";
import { itunesQueries } from "../../services/itunesService";
import { handleError } from "../../middleware/handleError";

const DAY = 86400;

export const streamPreview = async (
  _req: Request,
  res: Response,
): Promise<void> => {
  try {
    const track = await itunesQueries.getTrackPreview(res.locals.numericId);

    if (!track) {
      res.status(404).json({ error: "No preview for this track" });
      return;
    }

    const upstream = await fetch(track.previewUrl);

    if (!upstream.ok || !upstream.body) {
      res.status(502).json({
        error: `Upstream preview fetch failed (${upstream.status})`,
      });
      return;
    }

    res.set({
      "Content-Type": "audio/mpeg",
      "Cache-Control": `public, max-age=${DAY}`,
      "Access-Control-Allow-Origin": "*",
    });

    const input = Readable.fromWeb(upstream.body as any);

    ffmpeg(input)
      .format("mp3")
      .audioCodec("libmp3lame")
      .audioBitrate("128k")
      .on("error", (err) => {
        console.error("FFmpeg error:", err);
        if (!res.headersSent) {
          res.status(500).end();
        }
      })
      .pipe(res, { end: true });

  } catch (error) {
    handleError(res, error);
  }
};
