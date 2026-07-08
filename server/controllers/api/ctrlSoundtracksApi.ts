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

      // Create a readable stream from the buffer
      const inputStream = new Readable();
      inputStream.push(upstreamBuffer);
      inputStream.push(null); // Signal end of stream

      const command = ffmpeg(inputStream)
        .inputFormat('m4a')
        .audioCodec('pcm_s16le')
        .audioFrequency(44100)
        .audioChannels(2)
        .format('wav')
        .duration(5) // Keep 5 second test
        .outputOptions([
          '-acodec', 'pcm_s16le',
          '-ar', '44100',
          '-ac', '2',
          '-f', 'wav'
        ])
        .on('start', (cmd) => {
          console.log(`[streamPreview] FFmpeg started: ${cmd}`);
        })
        .on('error', (err) => {
          console.error('[streamPreview] FFmpeg error:', err);
          reject(err);
        })
        .on('end', () => {
          console.log('[streamPreview] FFmpeg completed');
          wavBuffer = Buffer.concat(buffers);
          console.log(`[streamPreview] WAV size: ${wavBuffer.length} bytes`);
          resolve();
        });

      // Collect output
      const stream = command.pipe();
      stream.on('data', (chunk: Buffer) => {
        buffers.push(chunk);
      });
      stream.on('error', (err) => {
        console.error('[streamPreview] Stream error:', err);
        reject(err);
      });
    });

    // Now wavBuffer is guaranteed to be a Buffer, not null
    if (wavBuffer.length === 0) {
      throw new Error('FFmpeg produced empty output');
    }

    // Check WAV signature
    if (wavBuffer.length < 44) {
      throw new Error(`WAV file too small: ${wavBuffer.length} bytes`);
    }

    const signature = wavBuffer.slice(0, 4).toString('ascii');
    if (signature !== 'RIFF') {
      throw new Error(`Invalid WAV signature: ${signature}`);
    }

    console.log(`[streamPreview] WAV validation passed, sending response...`);

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
