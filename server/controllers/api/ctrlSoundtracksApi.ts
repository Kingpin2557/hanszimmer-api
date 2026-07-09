import { Request, Response } from "express";
import { Readable } from "stream";
import ffmpeg from "fluent-ffmpeg";
import { itunesQueries } from "../../services/itunesService";
import { handleError } from "../../middleware/handleError";

const DAY = 86400;

const getAllowedOrigin = (req: Request): string => {
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") || [];
  const origin = req.headers.origin;

  if (!origin) {
    return allowedOrigins[0] || "*";
  }

  if (allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
    return origin;
  }

  if (process.env.NODE_ENV !== 'production') {
    return origin;
  }

  return allowedOrigins[0] || "*";
};

export const streamPreview = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    console.log(`[streamPreview] Processing track: ${res.locals.numericId}`);

    const track = await itunesQueries.getTrackPreview(res.locals.numericId);

    if (!track) {
      res.status(404).json({ error: "No preview for this track" });
      return;
    }

    console.log(`[streamPreview] Preview URL: ${track.previewUrl}`);

    const upstream = await fetch(track.previewUrl);

    if (!upstream.ok || !upstream.body) {
      console.error(`[streamPreview] Upstream failed: ${upstream.status}`);
      res.status(502).json({
        error: `Upstream preview fetch failed (${upstream.status})`,
      });
      return;
    }

    const allowOrigin = getAllowedOrigin(req);

    // Set headers for MP3 stream
    const headers: Record<string, string> = {
      "Content-Type": "audio/mpeg", // MP3 MIME type
      "Cache-Control": `public, max-age=${DAY}`,
      "Access-Control-Allow-Origin": allowOrigin,
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "Range, Content-Range, Accept-Encoding, Content-Type",
      "Access-Control-Expose-Headers": "Content-Range, Content-Length, Accept-Ranges",
      "Accept-Ranges": "bytes",
    };

    // Handle range requests (important for streaming)
    const rangeHeader = req.headers.range;
    if (rangeHeader) {
      // ... (range handling code remains the same as your previous version)
      const contentLength = parseInt(upstream.headers.get('content-length') || '0', 10);
      const parts = rangeHeader.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : contentLength - 1;
      const chunkSize = (end - start) + 1;

      headers["Content-Range"] = `bytes ${start}-${end}/${contentLength}`;
      headers["Content-Length"] = String(chunkSize);
      res.status(206);
    } else {
      const contentLength = upstream.headers.get('content-length');
      if (contentLength) {
        headers["Content-Length"] = contentLength;
      }
    }

    res.set(headers);

    const input = Readable.fromWeb(upstream.body as any);

    // Build FFmpeg command to convert to MP3
    const command = ffmpeg(input)
      .inputFormat('mp4') // Specify that the input is MP4 container
      .format('mp3')      // Output format is MP3
      .audioCodec('libmp3lame') // MP3 codec
      .audioBitrate('128k') // Standard bitrate
      .audioFrequency(44100) // CD-quality sample rate
      .audioChannels(2) // Stereo
      .outputOptions([
        '-acodec', 'libmp3lame',
        '-b:a', '128k',
        '-ar', '44100',
        '-ac', '2',
        '-f', 'mp3'
      ])
      .on('start', (cmd) => {
        console.log(`[streamPreview] FFmpeg started: ${cmd}`);
      })
      .on('error', (err) => {
        console.error('[streamPreview] FFmpeg error:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Audio conversion failed", details: err.message });
        }
      })
      .on('end', () => {
        console.log('[streamPreview] FFmpeg conversion completed');
      });

    // Pipe the converted MP3 stream to the response
    const stream = command.pipe(res, { end: true });

    stream.on("error", (err) => {
      console.error("[streamPreview] Stream error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: "Stream processing failed", details: err.message });
      }
    });

    req.on("close", () => {
      console.log("[streamPreview] Client disconnected");
      stream.destroy();
    });

  } catch (error) {
    console.error("[streamPreview] Fatal error:", error);
    handleError(res, error);
  }
};

export const optionsPreview = (
  req: Request,
  res: Response,
): void => {
  const allowOrigin = getAllowedOrigin(req);

  res.set({
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "Range, Content-Range, Accept-Encoding, Content-Type",
    "Access-Control-Expose-Headers": "Content-Range, Content-Length, Accept-Ranges",
    "Access-Control-Max-Age": "86400",
  });
  res.status(204).end();
};
