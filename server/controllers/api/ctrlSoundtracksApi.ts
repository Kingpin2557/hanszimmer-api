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

    // UE5 WebBrowser widget compatible headers
    // Chromium-based browser widget supports standard audio/wav
    const headers: Record<string, string> = {
      "Content-Type": "audio/wav",
      "Cache-Control": `public, max-age=${DAY}, immutable`,
      "Access-Control-Allow-Origin": allowOrigin,
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "Range, Content-Range, Accept-Encoding, Content-Type, Accept",
      "Access-Control-Expose-Headers": "Content-Range, Content-Length, Accept-Ranges",
      "Accept-Ranges": "bytes",
      // Ensure the browser knows this is a downloadable/playable file
      "Content-Disposition": "inline; filename=\"preview.wav\"",
      // Prevent any compression that might interfere with audio playback
      "Content-Encoding": "identity",
    };

    // Handle range requests for better streaming
    const rangeHeader = req.headers.range;
    let contentLength = 0;

    if (rangeHeader) {
      const upstreamContentLength = parseInt(upstream.headers.get('content-length') || '0', 10);
      const parts = rangeHeader.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : upstreamContentLength - 1;
      const chunkSize = (end - start) + 1;

      headers["Content-Range"] = `bytes ${start}-${end}/${upstreamContentLength}`;
      headers["Content-Length"] = String(chunkSize);
      contentLength = chunkSize;

      res.status(206); // Partial Content
    } else {
      // No range request, send full content
      const upstreamContentLength = upstream.headers.get('content-length');
      if (upstreamContentLength) {
        headers["Content-Length"] = upstreamContentLength;
        contentLength = parseInt(upstreamContentLength, 10);
      }
    }

    // Set headers before streaming
    res.set(headers);

    // Convert upstream response to readable stream
    const input = Readable.fromWeb(upstream.body as any);

    console.log(`[streamPreview] Starting FFmpeg conversion to WAV (${contentLength} bytes)`);

    // Create ffmpeg command optimized for UE5 WebBrowser widget
    // UE5 expects standard PCM WAV format
    const command = ffmpeg(input)
      .format("wav")
      .audioCodec("pcm_s16le")  // UE5 native format
      .audioFrequency(44100)     // Standard sample rate
      .audioChannels(2)          // Stereo
      .audioBitrate(1411.2)      // CD quality bitrate for WAV
      .outputOptions([
        "-acodec", "pcm_s16le",  // Explicit codec
        "-ar", "44100",          // Sample rate
        "-ac", "2",              // Channels
        "-f", "wav",             // Force WAV format
        "-bitexact",             // Ensure exact bit-for-bit output
      ]);

    // Handle range requests with ffmpeg
    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : undefined;

      // Approximate seek in seconds (for WAV, we can be more precise)
      // WAV at 44.1kHz stereo 16-bit = 176.4 KB/s
      const bytesPerSecond = 44100 * 2 * 2; // 44.1kHz * 2 channels * 2 bytes
      const seekSeconds = start / bytesPerSecond;

      command.seekInput(seekSeconds);

      if (end) {
        const duration = (end - start) / bytesPerSecond;
        command.duration(duration);
      }
    }

    // Pipe ffmpeg output to response
    const stream = command.pipe(res, { end: true });

    // Handle stream errors
    stream.on("error", (err) => {
      console.error("[streamPreview] Stream error:", err);
      if (!res.headersSent) {
        res.status(500).json({
          error: "Stream processing failed",
          details: err.message
        });
      }
    });

    stream.on("end", () => {
      console.log("[streamPreview] Stream ended successfully");
    });

    // Handle client disconnect
    req.on("close", () => {
      console.log("[streamPreview] Client disconnected");
      stream.destroy();
    });

    // Handle stream finish
    stream.on("finish", () => {
      console.log("[streamPreview] Stream finished");
    });

  } catch (error) {
    console.error("[streamPreview] Fatal error:", error);
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
    "Access-Control-Allow-Headers": "Range, Content-Range, Accept-Encoding, Content-Type, Accept",
    "Access-Control-Expose-Headers": "Content-Range, Content-Length, Accept-Ranges",
    "Access-Control-Max-Age": "86400",
  });
  res.status(204).end();
};
