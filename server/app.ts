import express, { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import path from "path";

import routes from "./routes";
import { movieQueries } from "./services/movieService";
import swaggerJsDocs from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";

const app: Application = express();
const PORT: number = parseInt(<string>process.env.PORT, 10) || 3000;

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") || [];

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {

    if (!origin) {
      callback(null, true);
      return;
    }

    if (process.env.NODE_ENV === 'production') {

      if (allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
        callback(null, true);
      } else {
        console.log(`CORS blocked: ${origin} not in ${allowedOrigins}`);
        callback(new Error("Not allowed by CORS"));
      }
    } else {

      callback(null, true);
    }
  },
  methods: ["GET", "HEAD", "OPTIONS", "POST", "PUT", "DELETE", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization", "Range", "Content-Range", "Accept-Encoding"],
  exposedHeaders: ["Content-Range", "Content-Length", "Accept-Ranges"],
  credentials: true,
  maxAge: 86400,
};

app.use(cors(corsOptions));

app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.method === 'OPTIONS') {

    cors(corsOptions)(req, res, next);
  } else {
    next();
  }
});

const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Hans Zimmer API",
      version: "2.0.0",
      description:
        "Hans Zimmer filmography (TMDB) + soundtrack previews (iTunes Search API, no auth)",
    },
    servers: [
      {
        url: process.env.ALLOWED_ORIGINS
          ? `https://${process.env.ALLOWED_ORIGINS}`
          : `http://localhost:${PORT}`,
      },
    ],
  },
  apis: [path.join(__dirname, "routes.*"), path.join(__dirname, "routes/*.*")],
};

try {
  const specs = swaggerJsDocs(swaggerOptions);
  app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(specs, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    }),
  );
} catch (error) {
  console.error("Swagger initialization error:", error);
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/", routes);

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error("Unhandled error:", err.message);
  console.error(err.stack);
  res.status(500).json({
    error: "Internal server error",
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

app.use((req: Request, res: Response) => {
  res.status(404).json({ error: `Not found: ${req.method} ${req.path}` });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Swagger UI: http://localhost:${PORT}/api-docs`);
});

if (!process.env.VERCEL) {
  void movieQueries
    .getAll()
    .then((movies) =>
      console.log(`Warmed ${movies.length} movies; albums resolved so far: ${movieQueries.getAlbumsResolved()}`),
    )
    .catch((error: Error) => console.warn(`warmup failed: ${error.message}`));
}

export default app;
