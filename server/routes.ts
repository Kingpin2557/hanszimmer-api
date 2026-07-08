import express, { Request, Response } from "express";
import { itunesQueries } from "./services/itunesService";
import ffmpeg from "fluent-ffmpeg";
import { Readable } from "stream";
import apiRouter from "./routes/api";
import { getApiInfo } from "./controllers/api/ctrlMetaApi";

const router = express.Router();

/**
 * @openapi
 * /:
 *   get:
 *     tags:
 *       - Meta
 *     summary: API info and endpoint overview
 *     responses:
 *       200:
 *         description: API metadata
 */
router.get("/", getApiInfo);

router.use("/api", apiRouter);


/**
 * @openapi
 * /api/audio/{id}:
 *   get:
 *     tags:
 *       - Audio
 *     summary: Get a WAV file for a track (simple route)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: iTunes track id
 *     responses:
 *       200:
 *         description: WAV audio file
 *       404:
 *         description: Track not found
 *       500:
 *         description: Conversion failed
 */
router.get("/audio/:id", async (req: Request, res: Response) => {
  try {
    const trackId = parseInt(String(req.params.id));
    console.log(`[audio] Fetching track: ${trackId}`);

    // Get track info from iTunes
    const track = await itunesQueries.getTrackPreview(trackId);

    if (!track) {
      res.status(404).json({ error: "Track not found" });
      return;
    }

    console.log(`[audio] Track found: ${track.id}`);
    console.log(`[audio] Preview URL: ${track.previewUrl}`);

    // Fetch the audio from iTunes
    const upstream = await fetch(track.previewUrl);

    if (!upstream.ok || !upstream.body) {
      console.error(`[audio] Upstream failed: ${upstream.status}`);
      res.status(502).json({ error: "Failed to fetch audio from iTunes" });
      return;
    }

    console.log(`[audio] Upstream fetch successful`);

    // Set CORS headers
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") || [];
    const origin = req.headers.origin;
    const allowOrigin = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0] || "*";

    // Set response headers for WAV file
    res.set({
      "Content-Type": "audio/wav",
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": allowOrigin,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Content-Disposition": `inline; filename="track-${trackId}.wav"`,
    });

    // Convert to WAV and stream
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

    // Pipe the converted audio to response
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
