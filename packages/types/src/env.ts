import "dotenv/config";

import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum([
      "development",
      "test",
      "production"
    ])
    .default("development"),

  BACKEND_PORT: z.coerce
    .number()
    .int()
    .min(1)
    .max(65535)
    .default(4000),

  DATABASE_URL: z
    .string()
    .min(1),

  DATA_ROOT: z
    .string()
    .min(1),

  SESSION_SECRET: z
    .string()
    .min(32),

  SESSION_COOKIE_NAME: z
    .string()
    .min(1)
    .default("data_manage_session"),

  MAX_UPLOAD_SIZE_MB: z.coerce
    .number()
    .positive()
    .default(2048),

  NEXT_PUBLIC_API_URL: z
    .string()
    .url()
});

const result = envSchema.safeParse(
  process.env
);

if (!result.success) {
  console.error(
    "Invalid environment configuration:"
  );

  console.error(
    result.error.flatten().fieldErrors
  );

  process.exit(1);
}

export const env = result.data;