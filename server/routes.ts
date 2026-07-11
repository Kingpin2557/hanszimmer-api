import express, { Request, Response } from "express";
import { itunesQueries } from "./services/itunesService";
import ffmpeg from "fluent-ffmpeg";
import { Readable } from "stream";
import apiRouter from "./routes/api";
import { getApiInfo } from "./controllers/api/ctrlMetaApi";

const router = express.Router();

router.get("/", getApiInfo);

router.use("/api", apiRouter);

router.get("/audio/:id", async (req: Request, res: Response) => {
  try {
    const trackId = parseInt(String(req.params.id));
    console.log(`[audio] Fetching track: ${trackId}`);

    const track = await itunesQueries.getTrackPreview(trackId);

    if (!track) {
      res.status(404).json({ error: "Track not found" });
      return;
    }

    console.log(`[audio] Track found: ${track.id}`);
    console.log(`[audio] Preview URL: ${track.previewUrl}`);

    const upstream = await fetch(track.previewUrl);

    if (!upstream.ok || !upstream.body) {
      console.error(`[audio] Upstream failed: ${upstream.status}`);
      res.status(502).json({ error: "Failed to fetch audio from iTunes" });
      return;
    }

    console.log(`[audio] Upstream fetch successful`);

    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") || [];
    const origin = req.headers.origin;
    const allowOrigin = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0] || "*";

    res.set({
      "Content-Type": "audio/wav",
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": allowOrigin,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Content-Disposition": `inline; filename="track-${trackId}.wav"`,
    });

    const input = Readable.fromWeb(upstream.body as any);

    const command = ffmpeg(input)
      .format("wav")
      .audioCodec("pcm_s16le")
      .audioFrequency(44100)
      .audioChannels(2)
      .on('start', () => {
        console.log(`[audio] FFmpeg conversion started for track ${trackId}`);
      })
      .on('error', (err) => {
        console.error(`[audio] FFmpeg error:`, err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Audio conversion failed" });
        }
      })
      .on('end', () => {
        console.log(`[audio] FFmpeg conversion completed for track ${trackId}`);
      });

    command.pipe(res, { end: true });

  } catch (error) {
    console.error("[audio] Error:", error);
    res.status(500).json({
      error: "Failed to process audio",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

router.use((req: Request, res: Response): void => {
  res.status(404).json({ error: `Not found: ${req.method} ${req.path}` });
});

export default router;
