import { Response } from "express";

export function handleError(res: Response, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error("[API Error]", message);

  const isUpstream = /^(TMDB|iTunes)/.test(message);
  const isDev = process.env.NODE_ENV !== "production";

  res.status(isUpstream ? 502 : 500).json({
    error: isUpstream ? "Upstream API error" : "Internal server error",
    ...((isDev || isUpstream) && { detail: message }),
  });
}
