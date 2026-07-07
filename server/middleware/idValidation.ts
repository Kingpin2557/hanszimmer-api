import { Request, Response, NextFunction } from "express";

export const idValidation = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const { id } = req.params;
  const parsedId = Number(id);

  if (!Number.isInteger(parsedId) || parsedId <= 0) {
    res.status(400).json({ error: "Invalid ID format. ID must be a positive integer." });
    return;
  }

  res.locals.numericId = parsedId;
  next();
};
