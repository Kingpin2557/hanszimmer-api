import { Request, Response } from "express";
import { Readable } from "stream";
import ffmpeg from "fluent-ffmpeg";
import { itunesQueries } from "../../services/itunesService";
import { handleError } from "../../middleware/handleError";

const DAY = 86400;

// Helper function to get allowed origin
const getAllowedOrigin = (req: Request): string => {
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") || [];
  const origin = req.headers.origin;

  // If no origin, return first allowed or *
  if (!origin) {
    return allowedOrigins[0] || "*";
  }

  // Check if origin is allowed
  if (allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
    return origin;
  }

  // If in development, allow all
  if (process.env.NODE_ENV !== 'production') {
    return origin;
  }

  // Default to first allowed or *
  return allowedOrigins[0] || "*";
};

export const streamPreview = async (
  req: Request,
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

    const allowOrigin = getAllowedOrigin(req);

    // Enhanced headers for better compatibility with UE5 web browser
    const headers: Record<string, string> = {
      "Content-Type": "audio/wav",
      "Cache-Control": `public, max-age=${DAY}`,
      "Access-Control-Allow-Origin": allowOrigin,
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "Range, Content-Range, Accept-Encoding, Content-Type",
      "Access-Control-Expose-Headers": "Content-Range, Content-Length, Accept-Ranges",
      "Accept-Ranges": "bytes",
    };

    // Handle range requests for better streaming
    const rangeHeader = req.headers.range;
    if (rangeHeader) {
      const contentLength = parseInt(upstream.headers.get('content-length') || '0', 10);
      const parts = rangeHeader.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : contentLength - 1;
      const chunkSize = (end - start) + 1;

      headers["Content-Range"] = `bytes ${start}-${end}/${contentLength}`;
      headers["Content-Length"] = String(chunkSize);

      res.status(206); // Partial Content
    } else {
      // No range request, send full content
      const contentLength = upstream.headers.get('content-length');
      if (contentLength) {
        headers["Content-Length"] = contentLength;
      }
    }

    res.set(headers);

    // Convert upstream response to readable stream
    const input = Readable.fromWeb(upstream.body as any);

    // Create ffmpeg command for WAV conversion
    const command = ffmpeg(input)
      .format("wav")
      .audioCodec("pcm_s16le")
      .audioFrequency(44100)
      .audioChannels(2);

    // Handle range requests with ffmpeg
    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : undefined;

      command.seekInput(start / 1000);

      if (end) {
        const duration = (end - start) / 1000;
        command.duration(duration);
      }
    }

    // Pipe ffmpeg output to response
    const stream = command.pipe(res, { end: true });

    // Handle stream errors
    stream.on("error", (err) => {
      console.error("Stream error:", err);
      if (!res.headersSent) {
        res.status(500).end();
      }
    });

    stream.on("end", () => {
      console.log("Stream ended successfully");
    });

    req.on("close", () => {
      console.log("Client disconnected, ending stream");
      stream.destroy();
    });

  } catch (error) {
    console.error("Preview stream error:", error);
    handleError(res, error);
  }
};

// OPTIONS handler for CORS preflight
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
