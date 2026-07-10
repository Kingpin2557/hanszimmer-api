import { Request, Response } from "express";
import { Readable } from "stream";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import { itunesQueries } from "../../services/itunesService";
import { handleError } from "../../middleware/handleError";

const DAY = 86400;

// Point fluent-ffmpeg at a usable binary.
if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
  console.log(`[FFmpeg] Path set to: ${ffmpegPath}`);
} else {
  try {
    ffmpeg.setFfmpegPath("ffmpeg");
    console.log("[FFmpeg] Using system ffmpeg as fallback");
  } catch {
    console.error("[FFmpeg] No ffmpeg binary found");
  }
}

// Small in-memory cache of fully-transcoded Ogg previews (~0.5 MB each) so a
// replayed track is instant and doesn't re-run ffmpeg.
const oggCache = new Map<string, Buffer>();

const getAllowedOrigin = (req: Request): string => {
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") || [];
  const origin = req.headers.origin;

  if (!origin) return allowedOrigins[0] || "*";
  if (allowedOrigins.includes(origin) || allowedOrigins.includes("*")) return origin;
  if (process.env.NODE_ENV !== "production") return origin;
  return allowedOrigins[0] || "*";
};

// Transcode an iTunes m4a preview into a COMPLETE Ogg Vorbis buffer. Buffering
// (rather than piping) lets us send an accurate Content-Length, which is what
// makes the browser report the real duration and fire "ended" at the end.
function transcodeToOgg(previewUrl: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    fetch(previewUrl)
      .then((upstream) => {
        if (!upstream.ok || !upstream.body) {
          reject(new Error(`Upstream preview fetch failed (${upstream.status})`));
          return;
        }

        const input = Readable.fromWeb(upstream.body as any);
        const chunks: Buffer[] = [];

        const output = ffmpeg(input)
          .inputFormat("mp4") // iTunes previews are an MP4/AAC container
          .audioCodec("libvorbis")
          .audioBitrate("128k")
          .audioFrequency(44100)
          .audioChannels(2)
          .format("ogg")
          .on("error", reject)
          .pipe();

        output.on("data", (chunk: Buffer) => chunks.push(chunk));
        output.on("end", () => resolve(Buffer.concat(chunks)));
        output.on("error", reject);
      })
      .catch(reject);
  });
}

export const streamPreview = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(res.locals.numericId);

    let ogg = oggCache.get(id);
    if (!ogg) {
      const track = await itunesQueries.getTrackPreview(res.locals.numericId);
      if (!track) {
        res.status(404).json({ error: "No preview for this track" });
        return;
      }
      ogg = await transcodeToOgg(track.previewUrl);
      oggCache.set(id, ogg);
    }

    res.set({
      "Content-Type": "audio/ogg",
      "Content-Length": String(ogg.length), // accurate length -> real duration + "ended"
      "Cache-Control": `public, max-age=${DAY}`,
      "Access-Control-Allow-Origin": getAllowedOrigin(req),
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Expose-Headers": "Content-Length, Content-Type",
    });
    res.status(200).end(ogg);
  } catch (error) {
    handleError(res, error);
  }
};

export const optionsPreview = (req: Request, res: Response): void => {
  res.set({
    "Access-Control-Allow-Origin": getAllowedOrigin(req),
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "Range, Content-Range, Accept-Encoding, Content-Type",
    "Access-Control-Max-Age": "86400",
  });
  res.status(204).end();
};
