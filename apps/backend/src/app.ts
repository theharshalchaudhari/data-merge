import Fastify from "fastify";

import cors from "@fastify/cors";
import cookie from "@fastify/cookie";

import {
  env
} from "./config/env.js";

export function createApp() {
  const app =
    Fastify({
      logger: {
        level:
          env.NODE_ENV ===
          "production"
            ? "info"
            : "debug"
      }
    });

  app.register(
    cors,
    {
      origin:
        env.NEXT_PUBLIC_API_URL,
      credentials: true
    }
  );

  app.register(
    cookie,
    {
      hook: "onRequest"
    }
  );

  app.get(
    "/health",
    async () => {
      return {
        status: "ok",
        service:
          "data-manage-backend",
        timestamp:
          new Date().toISOString()
      };
    }
  );

  return app;
}