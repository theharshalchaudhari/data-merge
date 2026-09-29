import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV:
    z.enum([
      "development",
      "test",
      "production",
    ]).default("development"),

  BACKEND_PORT:
    z.coerce
      .number()
      .int()
      .min(1)
      .max(65535)
      .default(4000),

  DATABASE_URL:
    z.string().min(1),

  DATA_ROOT:
    z.string().default(""),

  SESSION_SECRET:
    z.string().min(32),

  SESSION_COOKIE_NAME:
    z.string()
      .min(1)
      .default("data_manage_session"),

  SESSION_COOKIE_SECURE:
    z
      .string()
      .default("false")
      .transform(
        (value) =>
          value.trim().toLowerCase() === "true",
      ),

  MAX_UPLOAD_SIZE_MB:
    z.coerce
      .number()
      .positive()
      .default(2048),

  FRONTEND_URL:
    z.string()
      .url()
      .default("http://localhost:3000"),

  CORS_ALLOWED_ORIGINS:
    z.string().default(""),

  CLOUDFLARE_FRONTEND_URL:
    z.string()
      .url()
      .optional()
      .or(z.literal("")),

  CLOUDFLARE_API_URL:
    z.string()
      .url()
      .optional()
      .or(z.literal("")),

  NEXT_PUBLIC_API_URL:
    z.string()
      .url()
      .optional()
      .or(z.literal("")),
});

const result =
  envSchema.safeParse(
    process.env,
  );

if (!result.success) {
  console.error(
    "Invalid environment configuration:",
  );

  console.error(
    result.error.flatten()
      .fieldErrors,
  );

  process.exit(1);
}

const configuredDataRoot =
  result.data.DATA_ROOT.trim();

const backendDirectory =
  path.dirname(
    fileURLToPath(
      import.meta.url,
    ),
  );

const projectRoot =
  path.resolve(
    backendDirectory,
    "../../../../",
  );

const dataRoot =
  configuredDataRoot ||
  path.join(
    projectRoot,
    "data",
  );

export const env = {
  ...result.data,
  DATA_ROOT: dataRoot,
};