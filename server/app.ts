import express, { Application } from "express";
import cors from "cors";
import path from "path";

import routes from "./routes";
import swaggerJsDocs from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";

const app: Application = express();
const PORT: number = parseInt(<string>process.env.PORT, 10) || 3000;

// Public read-only data API: allow all origins
// (consumed by the hanszimmer frontend and the UE5 browser widget).
app.use(cors());

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
        url: process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : `http://localhost:${PORT}`,
      },
    ],
  },
  apis: [path.join(__dirname, "routes.*"), path.join(__dirname, "routes/*.*")],
};

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

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/", routes);

app.listen(PORT, () => {
  console.log(`Server draait op http://localhost:${PORT}`);
  console.log(`Swagger UI: http://localhost:${PORT}/api-docs`);
});

export default app;
