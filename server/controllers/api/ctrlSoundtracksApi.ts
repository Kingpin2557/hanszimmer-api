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

    console.log(`[streamPreview] Fetching upstream data...`);

    // Read the entire upstream into a buffer first
    const reader = upstream.body.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    const upstreamBuffer = Buffer.concat(chunks);
    console.log(`[streamPreview] Upstream size: ${upstreamBuffer.length} bytes`);

    const allowOrigin = getAllowedOrigin(req);

    // Convert to WAV using a buffer approach
    console.log(`[streamPreview] Starting FFmpeg conversion...`);

    // FIX: Use a variable with explicit type
    let wavBuffer: Buffer = Buffer.from(''); // Initialize with empty buffer instead of null

    await new Promise<void>((resolve, reject) => {
      const buffers: Buffer[] = [];

      const inputStream = Readable.from(upstreamBuffer);

      ffmpeg.getAvailableCodecs((err) => {
        if (err) {
          console.error("FFmpeg unavailable:", err);
        } else {
          console.log("FFmpeg detected");
        }
      });

      const command = ffmpeg(inputStream)
        .inputFormat("mp4")
        .audioCodec("pcm_s16le")
        .audioFrequency(44100)
        .audioChannels(2)
        .format("wav")
        .on("start", (cmd) => {
          console.log("[FFmpeg]", cmd);
        })
        .on("stderr", (line) => {
          console.log("[FFmpeg]", line);
        })
        .on("error", (err) => {
          console.error("[FFmpeg error]", err);
          reject(err);
        })
        .on("end", () => {
          wavBuffer = Buffer.concat(buffers);

          console.log(
            "[streamPreview] WAV header:",
            wavBuffer.slice(0, 12).toString("ascii")
          );

          console.log(
            "[streamPreview] WAV size:",
            wavBuffer.length
          );

          resolve();
        });

      command
        .pipe()
        .on("data", (chunk: Buffer) => {
          buffers.push(chunk);
        })
        .on("error", reject);
    });




    // Validate the generated WAV
    if (wavBuffer.length === 0) {
      throw new Error("FFmpeg produced empty output");
    }

    if (wavBuffer.length < 44) {
      throw new Error(`WAV file too small: ${wavBuffer.length} bytes`);
    }

    const signature = wavBuffer.slice(0, 4).toString("ascii");
    const waveHeader = wavBuffer.slice(8, 12).toString("ascii");

    if (signature !== "RIFF") {
      throw new Error(`Invalid WAV signature: ${signature}`);
    }

    if (waveHeader !== "WAVE") {
      throw new Error(`Invalid WAV header: ${waveHeader}`);
    }


    console.log(`[streamPreview] WAV validation passed`);
    console.log(`[streamPreview] Saved debug.wav (${wavBuffer.length} bytes)`);

    // Set headers
    const headers: Record<string, string> = {
      "Content-Type": "audio/wav",
      "Cache-Control": `public, max-age=${DAY}`,
      "Access-Control-Allow-Origin": allowOrigin,
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "Range, Content-Range, Accept-Encoding, Content-Type",
      "Access-Control-Expose-Headers": "Content-Range, Content-Length, Accept-Ranges",
      "Accept-Ranges": "bytes",
      "Content-Length": String(wavBuffer.length),
    };

    res.set(headers);
    res.send(wavBuffer);

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
