import { Request, Response } from "express";
import { Readable } from "stream";
import ffmpeg from "fluent-ffmpeg";
import { itunesQueries } from "../../services/itunesService";
import { handleError } from "../../middleware/handleError";

const DAY = 86400;

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

    // Enhanced headers for better compatibility with UE5 web browser
    const headers: Record<string, string> = {
      "Content-Type": "audio/mpeg",
      "Cache-Control": `public, max-age=${DAY}`,
      "Access-Control-Allow-Origin": "*",
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

    // Create ffmpeg command with better options for compatibility
    const command = ffmpeg(input)
      .format("wav")
      .audioCodec("libmp3lame")
      .audioBitrate("128k")
      .audioFrequency(44100) // Standard sample rate for better compatibility
      .audioChannels(2) // Stereo
      .outputOptions([
        "-write_xing", "0", // Disable Xing header for better compatibility
        "-id3v2_version", "3", // Use ID3v2.3 for better compatibility
      ]);

    // Handle range requests with ffmpeg
    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : undefined;

      // Seek to the correct position in the stream
      command.seekInput(start / 1000); // Convert bytes to seconds (approximate)

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

    // Handle stream end
    stream.on("end", () => {
      console.log("Stream ended successfully");
    });

    // Handle client disconnect
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
  res.set({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "Range, Content-Range, Accept-Encoding, Content-Type",
    "Access-Control-Expose-Headers": "Content-Range, Content-Length, Accept-Ranges",
    "Access-Control-Max-Age": "86400", // 24 hours
  });
  res.status(204).end();
};
