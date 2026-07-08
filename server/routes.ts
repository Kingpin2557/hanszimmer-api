import express, { Request, Response } from "express";
import apiRouter from "./routes/api";
import { getApiInfo } from "./controllers/api/ctrlMetaApi";

const router = express.Router();

/**
 * @openapi
 * /:
 *   get:
 *     tags:
 *       - Meta
 *     summary: API info and endpoint overview
 *     responses:
 *       200:
 *         description: API metadata
 */
router.get("/", getApiInfo);

router.use("/api", apiRouter);

router.use((req: Request, res: Response): void => {
  res.status(404).json({ error: `Not found: ${req.method} ${req.path}` });
});


export default router;
