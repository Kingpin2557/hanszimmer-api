import { Response } from "express";

export function handleError(res: Response, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error("[API Error]", message);

  const isDev = process.env.NODE_ENV !== "production";
  res.status(500).json({
    error: "Internal server error",
    ...(isDev && { detail: message }),
  });
}
