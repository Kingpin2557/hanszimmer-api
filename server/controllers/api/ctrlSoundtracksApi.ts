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

    console.log(`[streamPreview] Fetching from iTunes: ${track.previewUrl}`);

    const upstream = await fetch(track.previewUrl);

    if (!upstream.ok || !upstream.body) {
      console.error(`[streamPreview] Upstream failed: ${upstream.status}`);
      res.status(502).json({
        error: `Upstream preview fetch failed (${upstream.status})`,
      });
      return;
    }

    const allowOrigin = getAllowedOrigin(req);

    // Use MP3 for better compatibility and faster streaming
    const headers: Record<string, string> = {
      "Content-Type": "audio/mpeg",
      "Cache-Control": `public, max-age=${DAY}`,
      "Access-Control-Allow-Origin": allowOrigin,
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "Range, Content-Range, Accept-Encoding, Content-Type",
      "Access-Control-Expose-Headers": "Content-Range, Content-Length, Accept-Ranges",
      "Accept-Ranges": "bytes",
    };

    // Handle range requests
    const rangeHeader = req.headers.range;
    if (rangeHeader) {
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

    // Convert upstream response to readable stream
    const input = Readable.fromWeb(upstream.body as any);

    // Convert to MP3 (faster than WAV)
    const command = ffmpeg(input)
      .format("mp3")
      .audioCodec("libmp3lame")
      .audioBitrate("128k")
      .audioFrequency(44100)
      .audioChannels(2);

    // Handle range requests with ffmpeg
    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : undefined;

      // Approximate seek in seconds
      const bytesPerSecond = 44100 * 2 * 2;
      const seekSeconds = start / bytesPerSecond;

      command.seekInput(seekSeconds);

      if (end) {
        const duration = (end - start) / bytesPerSecond;
        command.duration(duration);
      }
    }

    // Pipe ffmpeg output to response with explicit chunking
    const stream = command.pipe(res, { end: true });

    // Set up streaming with proper chunking
    let isStreamEnded = false;

    stream.on("data", (chunk) => {
      // Send chunks as they come
    });

    stream.on("error", (err) => {
      console.error("[streamPreview] Stream error:", err);
      if (!res.headersSent && !isStreamEnded) {
        res.status(500).end();
      }
    });

    stream.on("end", () => {
      console.log("[streamPreview] Stream ended successfully");
      isStreamEnded = true;
    });

    req.on("close", () => {
      console.log("[streamPreview] Client disconnected");
      if (!isStreamEnded) {
        stream.destroy();
      }
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
