import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  BACKEND_PORT: z.coerce.number().int().positive().default(4000),

  DATABASE_URL: z.string().min(1),

  DATA_ROOT: z
    .string()
    .min(1)
    .default("/server/harshal/root-folder/data"),

  SESSION_SECRET: z.string().min(32),

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
    .default("http://localhost:3000"),
});

export const env = envSchema.parse(process.env);