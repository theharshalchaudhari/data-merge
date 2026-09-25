import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { env } from "./config/env.js";
import { registerAuthRoutes } from "./modules/auth/routes.js";
import { registerClientRoutes } from "./modules/clients/routes.js";
import { registerDashboardRoutes } from "./modules/dashboard/routes.js";
import { registerDownloadRoutes } from "./modules/download/routes.js";
import { registerMetadataRoutes } from "./modules/metadata/routes.js";
import { registerUploadRoutes } from "./modules/upload/routes.js";
import { registerUserRoutes } from "./modules/users/routes.js";
import { registerViewRoutes } from "./modules/views/routes.js";

export async function createApp() {
  const app = Fastify({
    logger: true,
    bodyLimit: env.MAX_UPLOAD_SIZE_MB * 1024 * 1024,
  });

  await app.register(cors, {
    origin: [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
    ],
    credentials: true,
    methods: [
      "GET",
      "HEAD",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
    ],
  });

  await app.register(cookie, {
    secret: env.SESSION_SECRET,
  });

  await app.register(multipart, {
    limits: {
      fileSize: env.MAX_UPLOAD_SIZE_MB * 1024 * 1024,
      files: 10000,
      parts: 20000,
      fields: 10,
      fieldSize: 1024 * 1024,
    },
  });

  app.get("/health", async () => ({
    status: "ok",
    service: "data-manage-backend",
    timestamp: new Date().toISOString(),
  }));

  await registerAuthRoutes(app);
  await registerClientRoutes(app);
  await registerViewRoutes(app);
  await registerUserRoutes(app);
  await registerMetadataRoutes(app);
  await registerDashboardRoutes(app);
  await registerUploadRoutes(app);
  await registerDownloadRoutes(app);

  return app;
}