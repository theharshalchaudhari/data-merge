#!/usr/bin/env bash

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> Working in $ROOT"

mkdir -p \
  "$ROOT/apps/backend/src/config" \
  "$ROOT/apps/backend/src/db/migrations" \
  "$ROOT/apps/backend/src/modules/auth" \
  "$ROOT/apps/backend/src/modules/clients" \
  "$ROOT/apps/backend/src/modules/dashboard" \
  "$ROOT/apps/backend/src/modules/download" \
  "$ROOT/apps/backend/src/modules/metadata" \
  "$ROOT/apps/backend/src/modules/upload" \
  "$ROOT/apps/backend/src/modules/users" \
  "$ROOT/apps/backend/src/modules/views" \
  "$ROOT/apps/backend/src/storage" \
  "$ROOT/apps/backend/src/validation" \
  "$ROOT/apps/backend/src/websocket" \
  "$ROOT/packages/types/src"

echo "==> Updating backend dependencies"

pnpm --filter backend add \
  @fastify/multipart@catalog: \
  archiver@catalog:

pnpm --filter backend add -D \
  @types/archiver@catalog:

echo "==> Writing backend environment configuration"

cat > "$ROOT/apps/backend/src/config/env.ts" <<'EOF'
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
    .default("http://localhost:3000")
});

export const env = envSchema.parse(process.env);
EOF

echo "==> Writing database client"

cat > "$ROOT/apps/backend/src/db/client.ts" <<'EOF'
import pg from "pg";

import { env } from "../config/env.js";

const { Pool } = pg;

export const db = new Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000
});

export async function checkDatabaseConnection(): Promise<void> {
  const client = await db.connect();

  try {
    await client.query("SELECT 1");
  } finally {
    client.release();
  }
}

export async function closeDatabase(): Promise<void> {
  await db.end();
}
EOF

echo "==> Writing database migration"

cat > "$ROOT/apps/backend/src/db/migrations/001_initial.sql" <<'EOF'
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'pending'
        CHECK (role IN ('admin', 'editor', 'viewer', 'pending')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
    view_id UUID NOT NULL REFERENCES views(id) ON DELETE RESTRICT,

    name TEXT NOT NULL,

    annotation_type TEXT NOT NULL
        CHECK (annotation_type IN ('bbox', 'polygon', 'segmentation')),

    annotations JSONB NOT NULL DEFAULT '[]'::jsonb,

    image_hash CHAR(64) NOT NULL,

    root_folders TEXT[] NOT NULL DEFAULT '{}',
    original_root_folders TEXT[] NOT NULL DEFAULT '{}',
    source_locations TEXT[] NOT NULL DEFAULT '{}',

    description TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT metadata_client_view_name_unique
        UNIQUE (client_id, view_id, name)
);

CREATE INDEX IF NOT EXISTS idx_metadata_client_id
    ON metadata(client_id);

CREATE INDEX IF NOT EXISTS idx_metadata_view_id
    ON metadata(view_id);

CREATE INDEX IF NOT EXISTS idx_metadata_hash
    ON metadata(image_hash);

CREATE INDEX IF NOT EXISTS idx_metadata_name
    ON metadata(name);

CREATE INDEX IF NOT EXISTS idx_metadata_annotation_type
    ON metadata(annotation_type);

CREATE INDEX IF NOT EXISTS idx_metadata_annotations
    ON metadata USING GIN(annotations);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id
    ON sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_sessions_expires_at
    ON sessions(expires_at);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_updated_at ON users;

CREATE TRIGGER users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS clients_updated_at ON clients;

CREATE TRIGGER clients_updated_at
BEFORE UPDATE ON clients
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS views_updated_at ON views;

CREATE TRIGGER views_updated_at
BEFORE UPDATE ON views
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS metadata_updated_at ON metadata;

CREATE TRIGGER metadata_updated_at
BEFORE UPDATE ON metadata
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();
EOF

echo "==> Writing shared annotation types"

cat > "$ROOT/packages/types/src/annotation.ts" <<'EOF'
export type AnnotationType = "bbox" | "polygon" | "segmentation";

export interface BoundingBoxGeometry {
  format: "yolo_bbox";
  values: [
    number,
    number,
    number,
    number,
    number
  ];
}

export interface PolygonGeometry {
  format: "polygon";
  points: Array<[number, number]>;
}

export interface SegmentationGeometry {
  format: "segmentation";
  points: Array<[number, number]>;
}

export type AnnotationGeometry =
  | BoundingBoxGeometry
  | PolygonGeometry
  | SegmentationGeometry;

export interface Annotation {
  classId: number;
  className: string;
  geometry: AnnotationGeometry;
}
EOF

cat > "$ROOT/packages/types/src/client.ts" <<'EOF'
export interface Client {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface View {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}
EOF

cat > "$ROOT/packages/types/src/user.ts" <<'EOF'
export type UserRole =
  | "admin"
  | "editor"
  | "viewer"
  | "pending";

export interface User {
  id: string;
  name: string;
  username: string;
  email: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface AuthUser extends User {}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  username: string;
  email: string;
  password: string;
}

export interface SessionUser {
  id: string;
  name: string;
  username: string;
  email: string;
  role: UserRole;
}
EOF

cat > "$ROOT/packages/types/src/metadata.ts" <<'EOF'
import type {
  Annotation,
  AnnotationType
} from "./annotation.js";

export interface MetadataRecord {
  id: string;
  clientId: string;
  clientName: string;
  viewId: string;
  viewName: string;
  name: string;
  annotationType: AnnotationType;
  annotations: Annotation[];
  imageHash: string;
  rootFolders: string[];
  originalRootFolders: string[];
  sourceLocations: string[];
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MetadataListQuery {
  clientId?: string;
  viewId?: string;
  annotationType?: AnnotationType;
  search?: string;
  page?: number;
  limit?: number;
}

export interface MetadataListResponse {
  items: MetadataRecord[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
EOF

cat > "$ROOT/packages/types/src/dashboard.ts" <<'EOF'
export interface DashboardStats {
  clients: number;
  views: number;
  images: number;
  annotations: number;
  users: number;
}

export interface ClientStatistics {
  clientId: string;
  clientName: string;
  images: number;
  annotations: number;
}

export interface ViewStatistics {
  viewId: string;
  viewName: string;
  images: number;
  annotations: number;
}

export interface ClassStatistics {
  classId: number;
  className: string;
  count: number;
}

export interface DashboardResponse {
  stats: DashboardStats;
  clients: ClientStatistics[];
  views: ViewStatistics[];
  classes: ClassStatistics[];
}
EOF

cat > "$ROOT/packages/types/src/index.ts" <<'EOF'
export * from "./annotation.js";
export * from "./client.js";
export * from "./dashboard.js";
export * from "./metadata.js";
export * from "./user.js";
EOF

echo "==> Writing storage paths"

cat > "$ROOT/apps/backend/src/storage/paths.ts" <<'EOF'
import path from "node:path";

import { env } from "../config/env.js";

function safeSegment(value: string): string {
  const normalized = value.trim();

  if (
    !normalized ||
    normalized === "." ||
    normalized === ".." ||
    normalized.includes("/") ||
    normalized.includes("\\")
  ) {
    throw new Error("Invalid path segment");
  }

  return normalized;
}

function insideRoot(root: string, target: string): string {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(target);
  const relative = path.relative(resolvedRoot, resolvedTarget);

  if (
    relative.startsWith(`..${path.sep}`) ||
    relative === ".." ||
    path.isAbsolute(relative)
  ) {
    throw new Error("Path escapes DATA_ROOT");
  }

  return resolvedTarget;
}

export function getDataRoot(): string {
  return path.resolve(env.DATA_ROOT);
}

export function getRawRoot(): string {
  return insideRoot(
    getDataRoot(),
    path.join(getDataRoot(), "raw")
  );
}

export function getMetadataRoot(): string {
  return insideRoot(
    getDataRoot(),
    path.join(getDataRoot(), "metadata")
  );
}

export function getRawClientRoot(clientName: string): string {
  return insideRoot(
    getRawRoot(),
    path.join(getRawRoot(), safeSegment(clientName))
  );
}

export function getRawSourcePath(
  clientName: string,
  relativePath: string
): string {
  const root = getRawClientRoot(clientName);

  return insideRoot(
    root,
    path.join(root, relativePath)
  );
}

export function getMetadataClientRoot(clientName: string): string {
  return insideRoot(
    getMetadataRoot(),
    path.join(getMetadataRoot(), safeSegment(clientName))
  );
}

export function getMetadataImagesRoot(clientName: string): string {
  const root = getMetadataClientRoot(clientName);

  return insideRoot(
    root,
    path.join(root, "images")
  );
}

export function getMetadataLabelsRoot(clientName: string): string {
  const root = getMetadataClientRoot(clientName);

  return insideRoot(
    root,
    path.join(root, "labels")
  );
}

export function getMetadataImagePath(
  clientName: string,
  name: string
): string {
  return insideRoot(
    getMetadataImagesRoot(clientName),
    path.join(getMetadataImagesRoot(clientName), safeSegment(name))
  );
}

export function getMetadataLabelPath(
  clientName: string,
  name: string
): string {
  const stem = path.parse(safeSegment(name)).name;

  return insideRoot(
    getMetadataLabelsRoot(clientName),
    path.join(getMetadataLabelsRoot(clientName), `${stem}.txt`)
  );
}
EOF

echo "==> Writing storage hashing"

cat > "$ROOT/apps/backend/src/storage/hash.ts" <<'EOF'
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";

export async function sha256File(
  filePath: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);

    stream.on("data", (chunk) => {
      hash.update(chunk);
    });

    stream.on("error", reject);

    stream.on("end", () => {
      resolve(hash.digest("hex"));
    });
  });
}

export function sha256Text(value: string): string {
  return createHash("sha256")
    .update(value)
    .digest("hex");
}
EOF

echo "==> Writing storage initialization"

cat > "$ROOT/apps/backend/src/storage/init.ts" <<'EOF'
import { mkdir } from "node:fs/promises";

import {
  getMetadataRoot,
  getRawRoot
} from "./paths.js";

export async function initializeStorage(): Promise<void> {
  await mkdir(getRawRoot(), {
    recursive: true
  });

  await mkdir(getMetadataRoot(), {
    recursive: true
  });
}
EOF

echo "==> Writing storage helpers"

cat > "$ROOT/apps/backend/src/storage/storage.ts" <<'EOF'
import {
  access,
  copyFile,
  mkdir,
  readFile,
  writeFile
} from "node:fs/promises";
import path from "node:path";

export async function fileExists(
  filePath: string
): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function ensureParentDirectory(
  filePath: string
): Promise<void> {
  await mkdir(path.dirname(filePath), {
    recursive: true
  });
}

export async function copyFileSafe(
  source: string,
  destination: string
): Promise<void> {
  await ensureParentDirectory(destination);
  await copyFile(source, destination);
}

export async function readTextFile(
  filePath: string
): Promise<string> {
  return readFile(filePath, "utf8");
}

export async function writeTextFile(
  filePath: string,
  content: string
): Promise<void> {
  await ensureParentDirectory(filePath);

  await writeFile(
    filePath,
    content,
    "utf8"
  );
}
EOF

echo "==> Writing annotation merge logic"

cat > "$ROOT/apps/backend/src/storage/merge.ts" <<'EOF'
import type {
  Annotation,
  AnnotationType
} from "@data-manage/types";

export function dedupeAnnotations(
  annotations: Annotation[]
): Annotation[] {
  const seen = new Set<string>();
  const result: Annotation[] = [];

  for (const annotation of annotations) {
    const key = JSON.stringify(annotation);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(annotation);
  }

  return result;
}

export function inferAnnotationType(
  annotations: Annotation[]
): AnnotationType {
  if (annotations.length === 0) {
    return "bbox";
  }

  const formats = new Set(
    annotations.map(
      (annotation) => annotation.geometry.format
    )
  );

  if (formats.has("segmentation")) {
    return "segmentation";
  }

  if (formats.has("polygon")) {
    return "polygon";
  }

  return "bbox";
}
EOF

echo "==> Writing application"

cat > "$ROOT/apps/backend/src/app.ts" <<'EOF'
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
    bodyLimit:
      env.MAX_UPLOAD_SIZE_MB *
      1024 *
      1024
  });

  await app.register(cors, {
    origin: env.NEXT_PUBLIC_API_URL,
    credentials: true
  });

  await app.register(cookie, {
    secret: env.SESSION_SECRET
  });

  await app.register(multipart, {
    limits: {
      fileSize:
        env.MAX_UPLOAD_SIZE_MB *
        1024 *
        1024
    }
  });

  app.get("/health", async () => ({
    status: "ok",
    service: "data-manage-backend",
    timestamp: new Date().toISOString()
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
EOF

cat > "$ROOT/apps/backend/src/server.ts" <<'EOF'
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import {
  checkDatabaseConnection,
  closeDatabase
} from "./db/client.js";
import { initializeStorage } from "./storage/init.js";

async function start() {
  await initializeStorage();
  await checkDatabaseConnection();

  const app = await createApp();

  await app.listen({
    host: "0.0.0.0",
    port: env.BACKEND_PORT
  });

  const shutdown = async () => {
    await app.close();
    await closeDatabase();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
EOF

echo "==> Writing authentication service"

cat > "$ROOT/apps/backend/src/modules/auth/service.ts" <<'EOF'
import crypto from "node:crypto";
import bcrypt from "bcrypt";

import { db } from "../../db/client.js";
import { env } from "../../config/env.js";

export interface AuthUser {
  id: string;
  name: string;
  username: string;
  email: string;
  role: "admin" | "editor" | "viewer" | "pending";
}

function hashToken(token: string): string {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
}

export async function createUser(input: {
  name: string;
  username: string;
  email: string;
  password: string;
}) {
  const passwordHash = await bcrypt.hash(
    input.password,
    12
  );

  const result = await db.query(
    `
      INSERT INTO users
        (name, username, email, password_hash)
      VALUES
        ($1, $2, $3, $4)
      RETURNING
        id,
        name,
        username,
        email,
        role,
        created_at,
        updated_at
    `,
    [
      input.name,
      input.username,
      input.email,
      passwordHash
    ]
  );

  return result.rows[0];
}

export async function authenticate(
  username: string,
  password: string
): Promise<AuthUser | null> {
  const result = await db.query(
    `
      SELECT
        id,
        name,
        username,
        email,
        password_hash,
        role
      FROM users
      WHERE username = $1
    `,
    [username]
  );

  const user = result.rows[0];

  if (!user) {
    return null;
  }

  const valid = await bcrypt.compare(
    password,
    user.password_hash
  );

  if (!valid) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    username: user.username,
    email: user.email,
    role: user.role
  };
}

export async function createSession(
  userId: string
): Promise<string> {
  const token = crypto.randomBytes(48).toString("hex");

  const tokenHash = hashToken(token);

  await db.query(
    `
      INSERT INTO sessions
        (user_id, token_hash, expires_at)
      VALUES
        ($1, $2, NOW() + INTERVAL '8 hours')
    `,
    [userId, tokenHash]
  );

  return token;
}

export async function getSessionUser(
  token: string
): Promise<AuthUser | null> {
  const tokenHash = hashToken(token);

  const result = await db.query(
    `
      SELECT
        u.id,
        u.name,
        u.username,
        u.email,
        u.role
      FROM sessions s
      INNER JOIN users u
        ON u.id = s.user_id
      WHERE
        s.token_hash = $1
        AND s.expires_at > NOW()
    `,
    [tokenHash]
  );

  return result.rows[0] ?? null;
}

export async function deleteSession(
  token: string
): Promise<void> {
  await db.query(
    `
      DELETE FROM sessions
      WHERE token_hash = $1
    `,
    [hashToken(token)]
  );
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 8
};
EOF

cat > "$ROOT/apps/backend/src/modules/auth/routes.ts" <<'EOF'
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { env } from "../../config/env.js";
import {
  authenticate,
  createSession,
  createUser,
  deleteSession,
  getSessionUser,
  sessionCookieOptions
} from "./service.js";

const registerSchema = z.object({
  name: z.string().min(2).max(100),
  username: z.string().min(3).max(50),
  email: z.string().email(),
  password: z.string().min(8).max(200)
});

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
});

export async function registerAuthRoutes(
  app: FastifyInstance
) {
  app.post("/api/auth/register", async (request, reply) => {
    const input = registerSchema.parse(request.body);

    try {
      const user = await createUser(input);

      return reply.code(201).send({
        user,
        message:
          "Registration successful. Waiting for administrator approval."
      });
    } catch (error: any) {
      if (error?.code === "23505") {
        return reply
          .code(409)
          .send({
            message:
              "Username or email already exists."
          });
      }

      throw error;
    }
  });

  app.post("/api/auth/login", async (request, reply) => {
    const input = loginSchema.parse(request.body);

    const user = await authenticate(
      input.username,
      input.password
    );

    if (!user) {
      return reply
        .code(401)
        .send({
          message: "Invalid username or password."
        });
    }

    const token = await createSession(user.id);

    reply.setCookie(
      env.SESSION_COOKIE_NAME,
      token,
      sessionCookieOptions
    );

    return {
      user
    };
  });

  app.post("/api/auth/logout", async (request, reply) => {
    const token =
      request.cookies[env.SESSION_COOKIE_NAME];

    if (token) {
      await deleteSession(token);
    }

    reply.clearCookie(
      env.SESSION_COOKIE_NAME,
      {
        path: "/"
      }
    );

    return {
      success: true
    };
  });

  app.get("/api/auth/me", async (request, reply) => {
    const token =
      request.cookies[env.SESSION_COOKIE_NAME];

    if (!token) {
      return reply
        .code(401)
        .send({
          message: "Not authenticated."
        });
    }

    const user = await getSessionUser(token);

    if (!user) {
      return reply
        .code(401)
        .send({
          message: "Session expired."
        });
    }

    return {
      user
    };
  });
}
EOF

echo "==> Writing auth guard"

cat > "$ROOT/apps/backend/src/modules/auth/guard.ts" <<'EOF'
import type {
  FastifyReply,
  FastifyRequest
} from "fastify";

import { env } from "../../config/env.js";
import {
  getSessionUser,
  type AuthUser
} from "./service.js";

declare module "fastify" {
  interface FastifyRequest {
    authUser?: AuthUser;
  }
}

export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<AuthUser | null> {
  const token =
    request.cookies[env.SESSION_COOKIE_NAME];

  if (!token) {
    await reply.code(401).send({
      message: "Authentication required."
    });

    return null;
  }

  const user = await getSessionUser(token);

  if (!user) {
    await reply.code(401).send({
      message: "Session expired."
    });

    return null;
  }

  request.authUser = user;

  return user;
}

export function requireRole(
  ...roles: AuthUser["role"][]
) {
  return async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const user = await requireAuth(
      request,
      reply
    );

    if (!user) {
      return;
    }

    if (!roles.includes(user.role)) {
      await reply.code(403).send({
        message: "Insufficient permissions."
      });
    }
  };
}
EOF

echo "==> Writing client routes"

cat > "$ROOT/apps/backend/src/modules/clients/routes.ts" <<'EOF'
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { db } from "../../db/client.js";
import { requireRole } from "../auth/guard.js";

const clientSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional()
});

export async function registerClientRoutes(
  app: FastifyInstance
) {
  app.get(
    "/api/clients",
    {
      preHandler: requireRole(
        "admin",
        "editor",
        "viewer"
      )
    },
    async () => {
      const result = await db.query(`
        SELECT
          id,
          name,
          description,
          created_at,
          updated_at
        FROM clients
        ORDER BY name ASC
      `);

      return result.rows.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    }
  );

  app.post(
    "/api/clients",
    {
      preHandler: requireRole("admin")
    },
    async (request, reply) => {
      const input = clientSchema.parse(
        request.body
      );

      try {
        const result = await db.query(
          `
            INSERT INTO clients
              (name, description)
            VALUES
              ($1, $2)
            RETURNING *
          `,
          [
            input.name,
            input.description ?? null
          ]
        );

        return reply.code(201).send(
          result.rows[0]
        );
      } catch (error: any) {
        if (error?.code === "23505") {
          return reply
            .code(409)
            .send({
              message:
                "Client already exists."
            });
        }

        throw error;
      }
    }
  );
}
EOF

echo "==> Writing view routes"

cat > "$ROOT/apps/backend/src/modules/views/routes.ts" <<'EOF'
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { db } from "../../db/client.js";
import { requireRole } from "../auth/guard.js";

const viewSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional()
});

export async function registerViewRoutes(
  app: FastifyInstance
) {
  app.get(
    "/api/views",
    {
      preHandler: requireRole(
        "admin",
        "editor",
        "viewer"
      )
    },
    async () => {
      const result = await db.query(`
        SELECT
          id,
          name,
          description,
          created_at,
          updated_at
        FROM views
        ORDER BY name ASC
      `);

      return result.rows.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    }
  );

  app.post(
    "/api/views",
    {
      preHandler: requireRole("admin")
    },
    async (request, reply) => {
      const input = viewSchema.parse(
        request.body
      );

      try {
        const result = await db.query(
          `
            INSERT INTO views
              (name, description)
            VALUES
              ($1, $2)
            RETURNING *
          `,
          [
            input.name,
            input.description ?? null
          ]
        );

        return reply.code(201).send(
          result.rows[0]
        );
      } catch (error: any) {
        if (error?.code === "23505") {
          return reply
            .code(409)
            .send({
              message:
                "View already exists."
            });
        }

        throw error;
      }
    }
  );
}
EOF

echo "==> Writing user routes"

cat > "$ROOT/apps/backend/src/modules/users/routes.ts" <<'EOF'
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { db } from "../../db/client.js";
import { requireRole } from "../auth/guard.js";

const roleSchema = z.object({
  role: z.enum([
    "admin",
    "editor",
    "viewer",
    "pending"
  ])
});

export async function registerUserRoutes(
  app: FastifyInstance
) {
  app.get(
    "/api/users",
    {
      preHandler: requireRole("admin")
    },
    async () => {
      const result = await db.query(`
        SELECT
          id,
          name,
          username,
          email,
          role,
          created_at,
          updated_at
        FROM users
        ORDER BY created_at DESC
      `);

      return result.rows.map((row) => ({
        id: row.id,
        name: row.name,
        username: row.username,
        email: row.email,
        role: row.role,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    }
  );

  app.patch(
    "/api/users/:id/role",
    {
      preHandler: requireRole("admin")
    },
    async (request, reply) => {
      const params = z
        .object({
          id: z.string().uuid()
        })
        .parse(request.params);

      const input = roleSchema.parse(
        request.body
      );

      const result = await db.query(
        `
          UPDATE users
          SET role = $1
          WHERE id = $2
          RETURNING
            id,
            name,
            username,
            email,
            role,
            created_at,
            updated_at
        `,
        [
          input.role,
          params.id
        ]
      );

      if (!result.rows[0]) {
        return reply.code(404).send({
          message: "User not found."
        });
      }

      return result.rows[0];
    }
  );
}
EOF

echo "==> Writing metadata routes"

cat > "$ROOT/apps/backend/src/modules/metadata/routes.ts" <<'EOF'
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { db } from "../../db/client.js";
import { requireRole } from "../auth/guard.js";

const querySchema = z.object({
  clientId: z.string().uuid().optional(),
  viewId: z.string().uuid().optional(),
  annotationType: z
    .enum([
      "bbox",
      "polygon",
      "segmentation"
    ])
    .optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce
    .number()
    .int()
    .positive()
    .max(100)
    .default(50)
});

export async function registerMetadataRoutes(
  app: FastifyInstance
) {
  app.get(
    "/api/metadata",
    {
      preHandler: requireRole(
        "admin",
        "editor",
        "viewer"
      )
    },
    async (request) => {
      const query = querySchema.parse(
        request.query
      );

      const conditions: string[] = [];
      const values: unknown[] = [];

      const add = (
        condition: string,
        value: unknown
      ) => {
        values.push(value);
        conditions.push(
          condition.replace(
            "?",
            `$${values.length}`
          )
        );
      };

      if (query.clientId) {
        add(
          "m.client_id = ?",
          query.clientId
        );
      }

      if (query.viewId) {
        add(
          "m.view_id = ?",
          query.viewId
        );
      }

      if (query.annotationType) {
        add(
          "m.annotation_type = ?",
          query.annotationType
        );
      }

      if (query.search) {
        add(
          "m.name ILIKE ?",
          `%${query.search}%`
        );
      }

      const where = conditions.length
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

      const countResult = await db.query(
        `
          SELECT COUNT(*)::int AS total
          FROM metadata m
          ${where}
        `,
        values
      );

      const total =
        countResult.rows[0]?.total ?? 0;

      const offset =
        (query.page - 1) * query.limit;

      const result = await db.query(
        `
          SELECT
            m.id,
            m.client_id,
            c.name AS client_name,
            m.view_id,
            v.name AS view_name,
            m.name,
            m.annotation_type,
            m.annotations,
            m.image_hash,
            m.root_folders,
            m.original_root_folders,
            m.source_locations,
            m.description,
            m.created_at,
            m.updated_at
          FROM metadata m
          INNER JOIN clients c
            ON c.id = m.client_id
          INNER JOIN views v
            ON v.id = m.view_id
          ${where}
          ORDER BY m.updated_at DESC
          LIMIT $${values.length + 1}
          OFFSET $${values.length + 2}
        `,
        [
          ...values,
          query.limit,
          offset
        ]
      );

      return {
        items: result.rows.map((row) => ({
          id: row.id,
          clientId: row.client_id,
          clientName: row.client_name,
          viewId: row.view_id,
          viewName: row.view_name,
          name: row.name,
          annotationType:
            row.annotation_type,
          annotations: row.annotations,
          imageHash: row.image_hash,
          rootFolders: row.root_folders,
          originalRootFolders:
            row.original_root_folders,
          sourceLocations:
            row.source_locations,
          description: row.description,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        })),
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(
          total / query.limit
        )
      };
    }
  );
}
EOF

echo "==> Writing dashboard routes"

cat > "$ROOT/apps/backend/src/modules/dashboard/routes.ts" <<'EOF'
import type { FastifyInstance } from "fastify";

import { db } from "../../db/client.js";
import { requireRole } from "../auth/guard.js";

export async function registerDashboardRoutes(
  app: FastifyInstance
) {
  app.get(
    "/api/dashboard",
    {
      preHandler: requireRole(
        "admin",
        "editor",
        "viewer"
      )
    },
    async () => {
      const statsResult =
        await db.query(`
          SELECT
            (SELECT COUNT(*)::int FROM clients) AS clients,
            (SELECT COUNT(*)::int FROM views) AS views,
            (SELECT COUNT(*)::int FROM metadata) AS images,
            (
              SELECT COALESCE(
                SUM(jsonb_array_length(annotations)),
                0
              )::int
              FROM metadata
            ) AS annotations,
            (SELECT COUNT(*)::int FROM users) AS users
        `);

      const clientsResult =
        await db.query(`
          SELECT
            c.id AS client_id,
            c.name AS client_name,
            COUNT(m.id)::int AS images,
            COALESCE(
              SUM(
                jsonb_array_length(m.annotations)
              ),
              0
            )::int AS annotations
          FROM clients c
          LEFT JOIN metadata m
            ON m.client_id = c.id
          GROUP BY c.id, c.name
          ORDER BY c.name
        `);

      const viewsResult =
        await db.query(`
          SELECT
            v.id AS view_id,
            v.name AS view_name,
            COUNT(m.id)::int AS images,
            COALESCE(
              SUM(
                jsonb_array_length(m.annotations)
              ),
              0
            )::int AS annotations
          FROM views v
          LEFT JOIN metadata m
            ON m.view_id = v.id
          GROUP BY v.id, v.name
          ORDER BY v.name
        `);

      const classesResult =
        await db.query(`
          SELECT
            (annotation->>'classId')::int AS class_id,
            annotation->>'className' AS class_name,
            COUNT(*)::int AS count
          FROM metadata m,
               jsonb_array_elements(m.annotations) annotation
          GROUP BY
            annotation->>'classId',
            annotation->>'className'
          ORDER BY count DESC
        `);

      const stats = statsResult.rows[0];

      return {
        stats: {
          clients: stats.clients,
          views: stats.views,
          images: stats.images,
          annotations: stats.annotations,
          users: stats.users
        },
        clients: clientsResult.rows.map(
          (row) => ({
            clientId: row.client_id,
            clientName: row.client_name,
            images: row.images,
            annotations: row.annotations
          })
        ),
        views: viewsResult.rows.map(
          (row) => ({
            viewId: row.view_id,
            viewName: row.view_name,
            images: row.images,
            annotations: row.annotations
          })
        ),
        classes: classesResult.rows.map(
          (row) => ({
            classId: row.class_id,
            className: row.class_name,
            count: row.count
          })
        )
      };
    }
  );
}
EOF

echo "==> Writing upload route"

cat > "$ROOT/apps/backend/src/modules/upload/routes.ts" <<'EOF'
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";

import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { db } from "../../db/client.js";
import { requireRole } from "../auth/guard.js";
import {
  getRawClientRoot,
  getRawSourcePath,
  getMetadataImagePath,
  getMetadataLabelPath
} from "../../storage/paths.js";
import {
  fileExists,
  copyFileSafe,
  readTextFile,
  writeTextFile
} from "../../storage/storage.js";
import { sha256File } from "../../storage/hash.js";
import {
  dedupeAnnotations,
  inferAnnotationType
} from "../../storage/merge.js";

function parseAnnotationLines(
  content: string
) {
  const annotations = [];

  for (const line of content
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean)) {
    const values = line
      .split(/\s+/)
      .map(Number);

    if (
      values.length !== 5 ||
      values.some(Number.isNaN)
    ) {
      throw new Error(
        "Invalid YOLO annotation line."
      );
    }

    annotations.push({
      classId: values[0],
      className: `class_${values[0]}`,
      geometry: {
        format: "yolo_bbox",
        values: [
          values[0],
          values[1],
          values[2],
          values[3],
          values[4]
        ]
      }
    });
  }

  return annotations;
}

export async function registerUploadRoutes(
  app: FastifyInstance
) {
  app.post(
    "/api/upload",
    {
      preHandler: requireRole(
        "admin",
        "editor"
      )
    },
    async (request, reply) => {
      const parts = request.parts();

      let clientId = "";
      let viewId = "";
      let rootFolder = "";
      let relativePath = "";
      let imageBuffer: Buffer | null = null;
      let imageName = "";
      let labelContent = "";

      for await (const part of parts) {
        if (part.type === "field") {
          if (part.fieldname === "clientId") {
            clientId = String(part.value);
          }

          if (part.fieldname === "viewId") {
            viewId = String(part.value);
          }

          if (part.fieldname === "rootFolder") {
            rootFolder = String(part.value);
          }

          if (part.fieldname === "relativePath") {
            relativePath = String(part.value);
          }

          if (part.fieldname === "labelContent") {
            labelContent = String(part.value);
          }

          continue;
        }

        if (part.fieldname === "image") {
          imageName = path.basename(
            part.filename
          );

          imageBuffer =
            await part.toBuffer();
        }
      }

      const input = z.object({
        clientId: z.string().uuid(),
        viewId: z.string().uuid(),
        rootFolder: z.string().min(1),
        relativePath: z.string().min(1)
      }).parse({
        clientId,
        viewId,
        rootFolder,
        relativePath
      });

      if (!imageBuffer || !imageName) {
        return reply.code(400).send({
          message: "Image file is required."
        });
      }

      const clientResult = await db.query(
        `
          SELECT id, name
          FROM clients
          WHERE id = $1
        `,
        [input.clientId]
      );

      const viewResult = await db.query(
        `
          SELECT id, name
          FROM views
          WHERE id = $1
        `,
        [input.viewId]
      );

      const client = clientResult.rows[0];
      const view = viewResult.rows[0];

      if (!client || !view) {
        return reply.code(400).send({
          message:
            "Selected client or view does not exist."
        });
      }

      const rawDestination =
        getRawSourcePath(
          client.name,
          path.join(
            input.rootFolder,
            input.relativePath
          )
        );

      await mkdir(
        path.dirname(rawDestination),
        { recursive: true }
      );

      await writeFile(
        rawDestination,
        imageBuffer
      );

      const imageHash = await sha256File(
        rawDestination
      );

      const labelName =
        path.parse(imageName).name;

      const metadataImage =
        getMetadataImagePath(
          client.name,
          imageName
        );

      const metadataLabel =
        getMetadataLabelPath(
          client.name,
          imageName
        );

      const existing =
        await db.query(
          `
            SELECT
              id,
              image_hash,
              annotations,
              root_folders,
              original_root_folders,
              source_locations
            FROM metadata
            WHERE
              client_id = $1
              AND view_id = $2
              AND name = $3
          `,
          [
            client.id,
            view.id,
            imageName
          ]
        );

      const annotations =
        parseAnnotationLines(
          labelContent
        );

      if (existing.rows[0]) {
        const record = existing.rows[0];

        if (record.image_hash !== imageHash) {
          return reply.code(409).send({
            message:
              "Filename exists with different image content.",
            conflict: true
          });
        }

        const merged = dedupeAnnotations([
          ...(record.annotations ?? []),
          ...annotations
        ]);

        await db.query(
          `
            UPDATE metadata
            SET
              annotations = $1,
              root_folders = ARRAY(
                SELECT DISTINCT unnest(
                  root_folders || $2::text[]
                )
              ),
              original_root_folders = ARRAY(
                SELECT DISTINCT unnest(
                  original_root_folders || $3::text[]
                )
              ),
              source_locations = ARRAY(
                SELECT DISTINCT unnest(
                  source_locations || $4::text[]
                )
              )
            WHERE id = $5
          `,
          [
            JSON.stringify(merged),
            [input.rootFolder],
            [input.rootFolder],
            [
              path.join(
                input.rootFolder,
                input.relativePath
              )
            ],
            record.id
          ]
        );

        await writeTextFile(
          metadataLabel,
          merged
            .map(
              (annotation: any) =>
                annotation.geometry.values.join(" ")
            )
            .join("\n")
        );

        return {
          merged: true,
          metadataId: record.id,
          imageName,
          annotationCount:
            merged.length
        };
      }

      if (
        !(await fileExists(metadataImage))
      ) {
        await copyFileSafe(
          rawDestination,
          metadataImage
        );
      }

      await writeTextFile(
        metadataLabel,
        annotations
          .map(
            (annotation: any) =>
              annotation.geometry.values.join(" ")
          )
          .join("\n")
      );

      const inserted = await db.query(
        `
          INSERT INTO metadata
          (
            client_id,
            view_id,
            name,
            annotation_type,
            annotations,
            image_hash,
            root_folders,
            original_root_folders,
            source_locations
          )
          VALUES
          (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9
          )
          RETURNING id
        `,
        [
          client.id,
          view.id,
          imageName,
          inferAnnotationType(
            annotations
          ),
          JSON.stringify(annotations),
          imageHash,
          [input.rootFolder],
          [input.rootFolder],
          [
            path.join(
              input.rootFolder,
              input.relativePath
            )
          ]
        ]
      );

      return reply.code(201).send({
        merged: false,
        metadataId:
          inserted.rows[0].id,
        imageName,
        annotationCount:
          annotations.length,
        labelName
      });
    }
  );
}
EOF

echo "==> Writing download route"

cat > "$ROOT/apps/backend/src/modules/download/routes.ts" <<'EOF'
import path from "node:path";

import type { FastifyInstance } from "fastify";
import archiver from "archiver";

import { db } from "../../db/client.js";
import { requireRole } from "../auth/guard.js";
import {
  getMetadataImagePath,
  getMetadataLabelPath
} from "../../storage/paths.js";

export async function registerDownloadRoutes(
  app: FastifyInstance
) {
  app.get(
    "/api/download/:id",
    {
      preHandler: requireRole(
        "admin",
        "editor",
        "viewer"
      )
    },
    async (request, reply) => {
      const { id } = request.params as {
        id: string;
      };

      const result = await db.query(
        `
          SELECT
            m.id,
            m.name,
            c.name AS client_name
          FROM metadata m
          INNER JOIN clients c
            ON c.id = m.client_id
          WHERE m.id = $1
        `,
        [id]
      );

      const row = result.rows[0];

      if (!row) {
        return reply.code(404).send({
          message: "Metadata not found."
        });
      }

      const imagePath =
        getMetadataImagePath(
          row.client_name,
          row.name
        );

      const labelPath =
        getMetadataLabelPath(
          row.client_name,
          row.name
        );

      reply.header(
        "Content-Type",
        "application/zip"
      );

      reply.header(
        "Content-Disposition",
        `attachment; filename="${path.parse(row.name).name}.zip"`
      );

      const archive = archiver("zip", {
        zlib: { level: 6 }
      });

      archive.on("error", (error) => {
        throw error;
      });

      archive.file(imagePath, {
        name: row.name
      });

      archive.file(labelPath, {
        name: `${path.parse(row.name).name}.txt`
      });

      await reply.send(archive);
    }
  );
}
EOF

echo "==> Writing backend placeholder modules"

for file in \
  apps/backend/src/modules/auth/index.ts \
  apps/backend/src/modules/clients/index.ts \
  apps/backend/src/modules/dashboard/index.ts \
  apps/backend/src/modules/download/index.ts \
  apps/backend/src/modules/metadata/index.ts \
  apps/backend/src/modules/upload/index.ts \
  apps/backend/src/modules/users/index.ts \
  apps/backend/src/modules/views/index.ts \
  apps/backend/src/validation/index.ts \
  apps/backend/src/websocket/index.ts
do
  if [ ! -f "$ROOT/$file" ]; then
    mkdir -p "$(dirname "$ROOT/$file")"
    printf 'export {};\n' > "$ROOT/$file"
  fi
done

echo "==> Writing frontend API client"

cat > "$ROOT/apps/frontend/lib/api.ts" <<'EOF'
const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:4000";

export async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(
    `${API_URL}${path}`,
    {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type":
          "application/json",
        ...(options.headers ?? {})
      },
      cache: "no-store"
    }
  );

  const contentType =
    response.headers.get(
      "content-type"
    );

  const body = contentType?.includes(
    "application/json"
  )
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message =
      typeof body === "object" &&
      body !== null &&
      "message" in body
        ? String(body.message)
        : "Request failed.";

    throw new Error(message);
  }

  return body as T;
}

export { API_URL };
EOF

echo "==> Writing frontend auth hook"

cat > "$ROOT/apps/frontend/hooks/use-auth.ts" <<'EOF'
"use client";

import {
  useCallback,
  useEffect,
  useState
} from "react";

import type { AuthUser } from "@data-manage/types";

import { api } from "../lib/api";

export function useAuth() {
  const [user, setUser] =
    useState<AuthUser | null>(null);

  const [loading, setLoading] =
    useState(true);

  const refresh = useCallback(
    async () => {
      try {
        const result = await api<{
          user: AuthUser;
        }>("/api/auth/me");

        setUser(result.user);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const logout = useCallback(
    async () => {
      await api("/api/auth/logout", {
        method: "POST"
      });

      setUser(null);
    },
    []
  );

  return {
    user,
    loading,
    refresh,
    logout
  };
}
EOF

echo "==> Writing frontend permission helper"

cat > "$ROOT/apps/frontend/hooks/use-permission.ts" <<'EOF'
"use client";

import type { UserRole } from "@data-manage/types";

import { useAuth } from "./use-auth";

export function usePermission() {
  const { user } = useAuth();

  const hasRole = (
    ...roles: UserRole[]
  ) => {
    if (!user) {
      return false;
    }

    return roles.includes(user.role);
  };

  return {
    user,
    hasRole,
    isAdmin: hasRole("admin"),
    canEdit: hasRole(
      "admin",
      "editor"
    ),
    canView: hasRole(
      "admin",
      "editor",
      "viewer"
    )
  };
}
EOF

echo "==> Writing dashboard page"

cat > "$ROOT/apps/frontend/app/(dashboard)/dashboard/page.tsx" <<'EOF'
"use client";

import {
  useEffect,
  useState
} from "react";

import type {
  DashboardResponse
} from "@data-manage/types";

import { api } from "../../../lib/api";

export default function DashboardPage() {
  const [data, setData] =
    useState<DashboardResponse | null>(
      null
    );

  const [error, setError] =
    useState("");

  useEffect(() => {
    api<DashboardResponse>(
      "/api/dashboard"
    )
      .then(setData)
      .catch((value) =>
        setError(
          value instanceof Error
            ? value.message
            : "Failed to load dashboard."
        )
      );
  }, []);

  if (error) {
    return (
      <main className="p-6">
        <p className="text-destructive">
          {error}
        </p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="p-6">
        Loading dashboard...
      </main>
    );
  }

  return (
    <main className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">
          Dashboard
        </h1>
        <p className="text-muted-foreground">
          Dataset and metadata overview.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ["Clients", data.stats.clients],
          ["Views", data.stats.views],
          ["Images", data.stats.images],
          [
            "Annotations",
            data.stats.annotations
          ],
          ["Users", data.stats.users]
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-xl border bg-card p-5"
          >
            <p className="text-sm text-muted-foreground">
              {label}
            </p>

            <p className="mt-2 text-3xl font-semibold">
              {value}
            </p>
          </div>
        ))}
      </div>

      <section className="rounded-xl border bg-card">
        <div className="border-b p-5">
          <h2 className="font-semibold">
            Clients
          </h2>
        </div>

        <div className="divide-y">
          {data.clients.map((client) => (
            <div
              key={client.clientId}
              className="flex items-center justify-between p-4"
            >
              <span>
                {client.clientName}
              </span>

              <span className="text-sm text-muted-foreground">
                {client.images} images ·{" "}
                {client.annotations} annotations
              </span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
EOF

echo "==> Writing metadata page"

cat > "$ROOT/apps/frontend/app/(dashboard)/metadata/page.tsx" <<'EOF'
"use client";

import {
  useEffect,
  useState
} from "react";

import type {
  MetadataListResponse
} from "@data-manage/types";

import { api } from "../../../lib/api";

export default function MetadataPage() {
  const [data, setData] =
    useState<MetadataListResponse | null>(
      null
    );

  const [error, setError] =
    useState("");

  useEffect(() => {
    api<MetadataListResponse>(
      "/api/metadata"
    )
      .then(setData)
      .catch((value) =>
        setError(
          value instanceof Error
            ? value.message
            : "Failed to load metadata."
        )
      );
  }, []);

  return (
    <main className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">
          Metadata
        </h1>
        <p className="text-muted-foreground">
          Canonical image and annotation records.
        </p>
      </div>

      {error && (
        <p className="text-destructive">
          {error}
        </p>
      )}

      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="grid grid-cols-5 border-b p-4 text-sm font-medium">
          <span>Name</span>
          <span>Client</span>
          <span>View</span>
          <span>Type</span>
          <span>Annotations</span>
        </div>

        {!data && (
          <div className="p-6">
            Loading...
          </div>
        )}

        {data?.items.map((item) => (
          <div
            key={item.id}
            className="grid grid-cols-5 border-b p-4 text-sm last:border-b-0"
          >
            <span className="truncate">
              {item.name}
            </span>

            <span>
              {item.clientName}
            </span>

            <span>
              {item.viewName}
            </span>

            <span>
              {item.annotationType}
            </span>

            <span>
              {item.annotations.length}
            </span>
          </div>
        ))}
      </div>
    </main>
  );
}
EOF

echo "==> Writing frontend clients page"

cat > "$ROOT/apps/frontend/app/(dashboard)/clients/page.tsx" <<'EOF'
"use client";

import {
  useEffect,
  useState
} from "react";

import type {
  Client
} from "@data-manage/types";

import { api } from "../../../lib/api";

export default function ClientsPage() {
  const [clients, setClients] =
    useState<Client[]>([]);

  const [name, setName] =
    useState("");

  const [description, setDescription] =
    useState("");

  const [error, setError] =
    useState("");

  const load = async () => {
    try {
      const result = await api<Client[]>(
        "/api/clients"
      );

      setClients(result);
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : "Failed to load clients."
      );
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const create = async () => {
    if (!name.trim()) {
      return;
    }

    try {
      await api(
        "/api/clients",
        {
          method: "POST",
          body: JSON.stringify({
            name,
            description
          })
        }
      );

      setName("");
      setDescription("");

      await load();
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : "Failed to create client."
      );
    }
  };

  return (
    <main className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">
          Clients
        </h1>
        <p className="text-muted-foreground">
          Manage dataset clients.
        </p>
      </div>

      <section className="grid gap-3 rounded-xl border bg-card p-5 md:grid-cols-[1fr_1fr_auto]">
        <input
          className="rounded-lg border bg-background px-3 py-2"
          placeholder="Client name"
          value={name}
          onChange={(event) =>
            setName(event.target.value)
          }
        />

        <input
          className="rounded-lg border bg-background px-3 py-2"
          placeholder="Description"
          value={description}
          onChange={(event) =>
            setDescription(
              event.target.value
            )
          }
        />

        <button
          className="rounded-lg border bg-primary px-4 py-2 text-primary-foreground"
          onClick={create}
        >
          Create
        </button>
      </section>

      {error && (
        <p className="text-destructive">
          {error}
        </p>
      )}

      <section className="divide-y rounded-xl border bg-card">
        {clients.map((client) => (
          <div
            key={client.id}
            className="p-5"
          >
            <p className="font-medium">
              {client.name}
            </p>

            {client.description && (
              <p className="mt-1 text-sm text-muted-foreground">
                {client.description}
              </p>
            )}
          </div>
        ))}

        {clients.length === 0 && (
          <div className="p-6 text-muted-foreground">
            No clients yet.
          </div>
        )}
      </section>
    </main>
  );
}
EOF

echo "==> Writing frontend views page"

cat > "$ROOT/apps/frontend/app/(dashboard)/views/page.tsx" <<'EOF'
"use client";

import {
  useEffect,
  useState
} from "react";

import type {
  View
} from "@data-manage/types";

import { api } from "../../../lib/api";

export default function ViewsPage() {
  const [views, setViews] =
    useState<View[]>([]);

  const [name, setName] =
    useState("");

  const [description, setDescription] =
    useState("");

  const [error, setError] =
    useState("");

  const load = async () => {
    try {
      setViews(
        await api<View[]>(
          "/api/views"
        )
      );
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : "Failed to load views."
      );
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const create = async () => {
    if (!name.trim()) {
      return;
    }

    try {
      await api("/api/views", {
        method: "POST",
        body: JSON.stringify({
          name,
          description
        })
      });

      setName("");
      setDescription("");

      await load();
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : "Failed to create view."
      );
    }
  };

  return (
    <main className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">
          Views
        </h1>
        <p className="text-muted-foreground">
          Manage camera or dataset view types.
        </p>
      </div>

      <section className="grid gap-3 rounded-xl border bg-card p-5 md:grid-cols-[1fr_1fr_auto]">
        <input
          className="rounded-lg border bg-background px-3 py-2"
          placeholder="View name"
          value={name}
          onChange={(event) =>
            setName(event.target.value)
          }
        />

        <input
          className="rounded-lg border bg-background px-3 py-2"
          placeholder="Description"
          value={description}
          onChange={(event) =>
            setDescription(
              event.target.value
            )
          }
        />

        <button
          className="rounded-lg border bg-primary px-4 py-2 text-primary-foreground"
          onClick={create}
        >
          Create
        </button>
      </section>

      {error && (
        <p className="text-destructive">
          {error}
        </p>
      )}

      <section className="divide-y rounded-xl border bg-card">
        {views.map((view) => (
          <div
            key={view.id}
            className="p-5"
          >
            <p className="font-medium">
              {view.name}
            </p>

            {view.description && (
              <p className="mt-1 text-sm text-muted-foreground">
                {view.description}
              </p>
            )}
          </div>
        ))}

        {views.length === 0 && (
          <div className="p-6 text-muted-foreground">
            No views yet.
          </div>
        )}
      </section>
    </main>
  );
}
EOF

echo "==> Writing root redirect"

cat > "$ROOT/apps/frontend/app/page.tsx" <<'EOF'
import { redirect } from "next/navigation";

export default function HomePage() {
  redirect("/dashboard");
}
EOF

echo "==> Writing environment example"

cat > "$ROOT/apps/backend/.env.example" <<'EOF'
NODE_ENV=development
BACKEND_PORT=4000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/data_manage
DATA_ROOT=/server/harshal/root-folder/data
SESSION_SECRET=replace-this-with-a-long-random-secret-at-least-32-characters
SESSION_COOKIE_NAME=data_manage_session
MAX_UPLOAD_SIZE_MB=2048
NEXT_PUBLIC_API_URL=http://localhost:3000
EOF

echo "==> Type checking"

pnpm install

pnpm --filter @data-manage/types exec tsc --noEmit
pnpm --filter backend exec tsc --noEmit

echo
echo "=============================================="
echo "Implementation foundation generated."
echo "=============================================="
echo
echo "Next:"
echo "  1. Configure PostgreSQL DATABASE_URL"
echo "  2. Apply 001_initial.sql"
echo "  3. Start backend"
echo "  4. Start frontend"
echo
