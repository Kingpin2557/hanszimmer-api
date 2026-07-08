import express, { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import path from "path";

import routes from "./routes";
import { movieQueries } from "./services/movieService";
import swaggerJsDocs from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";

const app: Application = express();
const PORT: number = parseInt(<string>process.env.PORT, 10) || 3000;

// 1. Get the string from env and convert it to an array
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") || [];

// 2. Configure CORS options
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (like mobile apps, curl, etc)
    if (!origin) {
      callback(null, true);
      return;
    }

    // In production, check against allowed origins
    if (process.env.NODE_ENV === 'production') {
      // Check if the request origin is in our allowed list
      if (allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
        callback(null, true);
      } else {
        console.log(`CORS blocked: ${origin} not in ${allowedOrigins}`);
        callback(new Error("Not allowed by CORS"));
      }
    } else {
      // In development, allow all origins
      callback(null, true);
    }
  },
  methods: ["GET", "HEAD", "OPTIONS", "POST", "PUT", "DELETE", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization", "Range", "Content-Range", "Accept-Encoding"],
  exposedHeaders: ["Content-Range", "Content-Length", "Accept-Ranges"],
  credentials: true,
  maxAge: 86400, // 24 hours for preflight cache
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Handle preflight requests globally
app.options("*", cors(corsOptions));

// Swagger setup
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

// Global error handler - must be after all routes
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error("Unhandled error:", err.message);
  console.error(err.stack);
  res.status(500).json({
    error: "Internal server error",
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: `Not found: ${req.method} ${req.path}` });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Swagger UI: http://localhost:${PORT}/api-docs`);
});

// Local dev: warm the movie cache on boot
if (!process.env.VERCEL) {
  void movieQueries
    .getAll()
    .then((movies) =>
      console.log(`Warmed ${movies.length} movies; albums resolved so far: ${movieQueries.getAlbumsResolved()}`),
    )
    .catch((error: Error) => console.warn(`warmup failed: ${error.message}`));
}

export default app;
