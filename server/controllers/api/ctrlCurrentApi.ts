import { Request, Response } from "express";

let currentGradient: string[] = [];

export const setCurrent = (req: Request, res: Response): void => {
  const incoming = (req.body?.gradient ?? []) as unknown;
  if (Array.isArray(incoming)) {
    currentGradient = incoming.filter((c): c is string => typeof c === "string").slice(0, 8);
  }
  res.status(200).json({ ok: true, gradient: currentGradient });
};

export const getCurrentGradient = (_req: Request, res: Response): void => {
  res.set("Cache-Control", "no-store");
  res.status(200).json({ gradient: currentGradient });
};
