import { Request, Response } from "express";
import { Readable } from "stream";
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

    const contentType = upstream.headers.get('content-type') || 'audio/mpeg';
    console.log(`[streamPreview] Upstream content-type: ${contentType}`);

    const allowOrigin = getAllowedOrigin(req);

    // Set headers - forward the original content type
    const headers: Record<string, string> = {
      "Content-Type": contentType,
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

    // Stream directly without conversion - THIS IS THE KEY CHANGE
    console.log(`[streamPreview] Streaming raw audio directly...`);
    const stream = Readable.fromWeb(upstream.body as any);
    stream.pipe(res);

    stream.on("error", (err) => {
      console.error("[streamPreview] Stream error:", err);
      if (!res.headersSent) {
        res.status(500).end();
      }
    });

    stream.on("end", () => {
      console.log("[streamPreview] Stream ended successfully");
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
