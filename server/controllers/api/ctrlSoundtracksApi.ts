import { Request, Response } from "express";
import { Readable } from "stream";
import { itunesQueries } from "../../services/itunesService";
import { handleError } from "../../middleware/handleError";

const DAY = 86400;

/**
 * Streams the iTunes 30s preview (m4a) through this API so the frontend
 * can pipe it into a Web Audio AnalyserNode (same-origin + CORS headers,
 * which Apple's CDN does not guarantee).
 */
export const streamPreview = async (_req: Request, res: Response): Promise<void> => {
  try {
    const track = await itunesQueries.getTrackPreview(res.locals.numericId);
    if (!track) {
      res.status(404).json({ error: "No preview for this track" });
      return;
    }

    const upstream = await fetch(track.previewUrl);
    if (!upstream.ok || !upstream.body) {
      res.status(502).json({ error: `Upstream preview fetch failed (${upstream.status})` });
      return;
    }

    res.set({
      "Content-Type": "audio/mp4",
      "Cache-Control": `public, max-age=${DAY}`,
      "Accept-Ranges": "bytes",
    });
    const length = upstream.headers.get("content-length");
    if (length) res.set("Content-Length", length);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Readable.fromWeb(upstream.body as any).pipe(res);
  } catch (error) {
    handleError(res, error);
  }
};
