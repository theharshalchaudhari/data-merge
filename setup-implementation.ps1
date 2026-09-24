$ErrorActionPreference = "Stop"

$Root = (Get-Location).Path

Write-Host ""
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host " Data Manage - Implementation Generator" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Project root:" $Root
Write-Host ""

function Write-ProjectFile {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,

        [Parameter(Mandatory = $true)]
        [string]$Content
    )

    $FullPath = Join-Path $Root $Path
    $Directory = Split-Path $FullPath -Parent

    if (!(Test-Path $Directory)) {
        New-Item -ItemType Directory -Path $Directory -Force | Out-Null
    }

    Set-Content `
        -Path $FullPath `
        -Value $Content `
        -Encoding UTF8

    Write-Host "  [write] $Path" -ForegroundColor DarkGray
}

function Write-ProjectDirectory {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    $FullPath = Join-Path $Root $Path

    if (!(Test-Path $FullPath)) {
        New-Item -ItemType Directory -Path $FullPath -Force | Out-Null
    }
}

Write-Host "Creating directories..." -ForegroundColor Yellow

$Directories = @(
    "apps/backend/src/config",
    "apps/backend/src/db/migrations",
    "apps/backend/src/modules/auth",
    "apps/backend/src/modules/clients",
    "apps/backend/src/modules/dashboard",
    "apps/backend/src/modules/download",
    "apps/backend/src/modules/metadata",
    "apps/backend/src/modules/upload",
    "apps/backend/src/modules/users",
    "apps/backend/src/modules/views",
    "apps/backend/src/storage",
    "apps/backend/src/validation",
    "apps/backend/src/websocket",

    "apps/frontend/app/(auth)/login",
    "apps/frontend/app/(auth)/register",
    "apps/frontend/app/(dashboard)/dashboard",
    "apps/frontend/app/(dashboard)/clients",
    "apps/frontend/app/(dashboard)/views",
    "apps/frontend/app/(dashboard)/metadata",
    "apps/frontend/app/(dashboard)/upload",
    "apps/frontend/app/(dashboard)/users",

    "apps/frontend/components/layout",
    "apps/frontend/components/shared",
    "apps/frontend/lib",
    "apps/frontend/hooks",

    "packages/types/src"
)

foreach ($Directory in $Directories) {
    Write-ProjectDirectory $Directory
}

# ============================================================
# BACKEND PACKAGE
# ============================================================

Write-Host ""
Write-Host "Writing backend package..." -ForegroundColor Yellow

Write-ProjectFile "apps/backend/package.json" @'
{
  "name": "backend",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "lint": "eslint src --ext .ts",
    "check-types": "tsc --noEmit"
  },
  "dependencies": {
    "@data-manage/types": "workspace:*",
    "@fastify/cookie": "catalog:",
    "@fastify/cors": "catalog:",
    "@fastify/multipart": "catalog:",
    "archiver": "catalog:",
    "bcrypt": "catalog:",
    "dotenv": "catalog:",
    "fastify": "catalog:",
    "pg": "catalog:",
    "zod": "catalog:"
  },
  "devDependencies": {
    "@repo/eslint-config": "workspace:*",
    "@repo/typescript-config": "workspace:*",
    "@types/archiver": "catalog:",
    "@types/bcrypt": "catalog:",
    "@types/node": "catalog:",
    "@types/pg": "catalog:",
    "eslint": "catalog:",
    "tsx": "catalog:",
    "typescript": "catalog:"
  }
}
'@

# ============================================================
# BACKEND ENV
# ============================================================

Write-ProjectFile "apps/backend/src/config/env.ts" @'
import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  BACKEND_PORT: z.coerce
    .number()
    .int()
    .positive()
    .default(4000),

  DATABASE_URL: z.string().min(1),

  DATA_ROOT: z.string().min(1),

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
    .default("http://localhost:3000")
});

export const env = envSchema.parse(
  process.env
);
'@

Write-ProjectFile "apps/backend/.env.example" @'
NODE_ENV=development
BACKEND_PORT=4000

DATABASE_URL=postgresql://postgres:postgres@localhost:5432/data_manage

DATA_ROOT=C:/Data_Manage/data

SESSION_SECRET=replace-this-with-a-random-secret-at-least-32-characters

SESSION_COOKIE_NAME=data_manage_session

MAX_UPLOAD_SIZE_MB=2048

NEXT_PUBLIC_API_URL=http://localhost:3000
'@

# ============================================================
# DATABASE
# ============================================================

Write-ProjectFile "apps/backend/src/db/client.ts" @'
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
'@

Write-ProjectFile "apps/backend/src/db/migrations/001_initial.sql" @'
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name TEXT NOT NULL,

    username TEXT NOT NULL UNIQUE,

    email TEXT NOT NULL UNIQUE,

    password_hash TEXT NOT NULL,

    role TEXT NOT NULL DEFAULT 'pending'
        CHECK (
            role IN (
                'admin',
                'editor',
                'viewer',
                'pending'
            )
        ),

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

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    token_hash TEXT NOT NULL UNIQUE,

    expires_at TIMESTAMPTZ NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    client_id UUID NOT NULL
        REFERENCES clients(id)
        ON DELETE RESTRICT,

    view_id UUID NOT NULL
        REFERENCES views(id)
        ON DELETE RESTRICT,

    name TEXT NOT NULL,

    annotation_type TEXT NOT NULL
        CHECK (
            annotation_type IN (
                'bbox',
                'polygon',
                'segmentation'
            )
        ),

    annotations JSONB NOT NULL DEFAULT '[]'::jsonb,

    image_hash CHAR(64) NOT NULL,

    root_folders TEXT[] NOT NULL DEFAULT '{}',

    original_root_folders TEXT[] NOT NULL DEFAULT '{}',

    source_locations TEXT[] NOT NULL DEFAULT '{}',

    description TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT metadata_client_view_name_unique
        UNIQUE (
            client_id,
            view_id,
            name
        )
);

CREATE INDEX IF NOT EXISTS idx_metadata_client_id
    ON metadata(client_id);

CREATE INDEX IF NOT EXISTS idx_metadata_view_id
    ON metadata(view_id);

CREATE INDEX IF NOT EXISTS idx_metadata_image_hash
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

DROP TRIGGER IF EXISTS users_updated_at
ON users;

CREATE TRIGGER users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS clients_updated_at
ON clients;

CREATE TRIGGER clients_updated_at
BEFORE UPDATE ON clients;

CREATE TRIGGER clients_updated_at
BEFORE UPDATE ON clients
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS views_updated_at
ON views;

CREATE TRIGGER views_updated_at
BEFORE UPDATE ON views
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS metadata_updated_at
ON metadata;

CREATE TRIGGER metadata_updated_at
BEFORE UPDATE ON metadata
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();
'@

# ============================================================
# STORAGE
# ============================================================

Write-ProjectFile "apps/backend/src/storage/paths.ts" @'
import path from "node:path";

import { env } from "../config/env.js";

function safeSegment(
  value: string
): string {
  const normalized = value.trim();

  if (
    !normalized ||
    normalized === "." ||
    normalized === ".." ||
    normalized.includes("/") ||
    normalized.includes("\\")
  ) {
    throw new Error(
      "Invalid path segment."
    );
  }

  return normalized;
}

function insideRoot(
  root: string,
  target: string
): string {
  const resolvedRoot =
    path.resolve(root);

  const resolvedTarget =
    path.resolve(target);

  const relative =
    path.relative(
      resolvedRoot,
      resolvedTarget
    );

  if (
    relative === ".." ||
    relative.startsWith(
      `..${path.sep}`
    ) ||
    path.isAbsolute(relative)
  ) {
    throw new Error(
      "Path escapes DATA_ROOT."
    );
  }

  return resolvedTarget;
}

export function getDataRoot(): string {
  return path.resolve(
    env.DATA_ROOT
  );
}

export function getRawRoot(): string {
  return path.join(
    getDataRoot(),
    "raw"
  );
}

export function getMetadataRoot(): string {
  return path.join(
    getDataRoot(),
    "metadata"
  );
}

export function getRawClientRoot(
  clientName: string
): string {
  return insideRoot(
    getRawRoot(),
    path.join(
      getRawRoot(),
      safeSegment(clientName)
    )
  );
}

export function getRawSourcePath(
  clientName: string,
  relativePath: string
): string {
  return insideRoot(
    getRawClientRoot(clientName),
    path.join(
      getRawClientRoot(clientName),
      relativePath
    )
  );
}

export function getMetadataClientRoot(
  clientName: string
): string {
  return insideRoot(
    getMetadataRoot(),
    path.join(
      getMetadataRoot(),
      safeSegment(clientName)
    )
  );
}

export function getMetadataImagesRoot(
  clientName: string
): string {
  return path.join(
    getMetadataClientRoot(clientName),
    "images"
  );
}

export function getMetadataLabelsRoot(
  clientName: string
): string {
  return path.join(
    getMetadataClientRoot(clientName),
    "labels"
  );
}

export function getMetadataImagePath(
  clientName: string,
  imageName: string
): string {
  const root =
    getMetadataImagesRoot(
      clientName
    );

  return insideRoot(
    root,
    path.join(
      root,
      safeSegment(imageName)
    )
  );
}

export function getMetadataLabelPath(
  clientName: string,
  imageName: string
): string {
  const root =
    getMetadataLabelsRoot(
      clientName
    );

  const stem =
    path.parse(
      safeSegment(imageName)
    ).name;

  return insideRoot(
    root,
    path.join(
      root,
      `${stem}.txt`
    )
  );
}
'@

Write-ProjectFile "apps/backend/src/storage/hash.ts" @'
import {
  createHash
} from "node:crypto";

import {
  createReadStream
} from "node:fs";

export async function sha256File(
  filePath: string
): Promise<string> {
  return new Promise(
    (resolve, reject) => {
      const hash =
        createHash("sha256");

      const stream =
        createReadStream(
          filePath
        );

      stream.on(
        "data",
        (chunk) => {
          hash.update(chunk);
        }
      );

      stream.on(
        "error",
        reject
      );

      stream.on(
        "end",
        () => {
          resolve(
            hash.digest("hex")
          );
        }
      );
    }
  );
}
'@

Write-ProjectFile "apps/backend/src/storage/init.ts" @'
import {
  mkdir
} from "node:fs/promises";

import {
  getRawRoot,
  getMetadataRoot
} from "./paths.js";

export async function initializeStorage(): Promise<void> {
  await mkdir(
    getRawRoot(),
    { recursive: true }
  );

  await mkdir(
    getMetadataRoot(),
    { recursive: true }
  );
}
'@

Write-ProjectFile "apps/backend/src/storage/storage.ts" @'
import {
  access,
  copyFile,
  mkdir,
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
  await mkdir(
    path.dirname(filePath),
    { recursive: true }
  );
}

export async function copyFileSafe(
  source: string,
  destination: string
): Promise<void> {
  await ensureParentDirectory(
    destination
  );

  await copyFile(
    source,
    destination
  );
}

export async function writeTextFile(
  filePath: string,
  content: string
): Promise<void> {
  await ensureParentDirectory(
    filePath
  );

  await writeFile(
    filePath,
    content,
    "utf8"
  );
}
'@

Write-ProjectFile "apps/backend/src/storage/merge.ts" @'
import type {
  Annotation,
  AnnotationType
} from "@data-manage/types";

export function dedupeAnnotations(
  annotations: Annotation[]
): Annotation[] {
  const seen =
    new Set<string>();

  const result: Annotation[] = [];

  for (const annotation of annotations) {
    const key =
      JSON.stringify(annotation);

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
  if (!annotations.length) {
    return "bbox";
  }

  const formats =
    new Set(
      annotations.map(
        (annotation) =>
          annotation.geometry.format
      )
    );

  if (
    formats.has("segmentation")
  ) {
    return "segmentation";
  }

  if (
    formats.has("polygon")
  ) {
    return "polygon";
  }

  return "bbox";
}
'@

# ============================================================
# AUTH
# ============================================================

Write-ProjectFile "apps/backend/src/modules/auth/service.ts" @'
import crypto from "node:crypto";

import bcrypt from "bcrypt";

import {
  db
} from "../../db/client.js";

import {
  env
} from "../../config/env.js";

export type AuthRole =
  | "admin"
  | "editor"
  | "viewer"
  | "pending";

export interface AuthUser {
  id: string;
  name: string;
  username: string;
  email: string;
  role: AuthRole;
}

function hashToken(
  token: string
): string {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
}

export async function createUser(
  input: {
    name: string;
    username: string;
    email: string;
    password: string;
  }
) {
  const passwordHash =
    await bcrypt.hash(
      input.password,
      12
    );

  const result =
    await db.query(
      `
      INSERT INTO users
      (
        name,
        username,
        email,
        password_hash
      )
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
  const result =
    await db.query(
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

  const user =
    result.rows[0];

  if (!user) {
    return null;
  }

  const valid =
    await bcrypt.compare(
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
  const token =
    crypto.randomBytes(48)
      .toString("hex");

  await db.query(
    `
    INSERT INTO sessions
    (
      user_id,
      token_hash,
      expires_at
    )
    VALUES
    (
      $1,
      $2,
      NOW() + INTERVAL '8 hours'
    )
    `,
    [
      userId,
      hashToken(token)
    ]
  );

  return token;
}

export async function getSessionUser(
  token: string
): Promise<AuthUser | null> {
  const result =
    await db.query(
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
      [hashToken(token)]
    );

  return (
    result.rows[0] ??
    null
  );
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
  secure:
    env.NODE_ENV ===
    "production",
  path: "/",
  maxAge: 60 * 60 * 8
};
'@

Write-ProjectFile "apps/backend/src/modules/auth/guard.ts" @'
import type {
  FastifyReply,
  FastifyRequest
} from "fastify";

import {
  env
} from "../../config/env.js";

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
    request.cookies[
      env.SESSION_COOKIE_NAME
    ];

  if (!token) {
    await reply.code(401)
      .send({
        message:
          "Authentication required."
      });

    return null;
  }

  const user =
    await getSessionUser(
      token
    );

  if (!user) {
    await reply.code(401)
      .send({
        message:
          "Session expired."
      });

    return null;
  }

  request.authUser =
    user;

  return user;
}

export function requireRole(
  ...roles: AuthUser["role"][]
) {
  return async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const user =
      await requireAuth(
        request,
        reply
      );

    if (!user) {
      return;
    }

    if (
      !roles.includes(
        user.role
      )
    ) {
      await reply.code(403)
        .send({
          message:
            "Insufficient permissions."
        });
    }
  };
}
'@

Write-ProjectFile "apps/backend/src/modules/auth/routes.ts" @'
import type {
  FastifyInstance
} from "fastify";

import { z } from "zod";

import {
  env
} from "../../config/env.js";

import {
  authenticate,
  createSession,
  createUser,
  deleteSession,
  getSessionUser,
  sessionCookieOptions
} from "./service.js";

const registerSchema =
  z.object({
    name:
      z.string()
        .min(2)
        .max(100),

    username:
      z.string()
        .min(3)
        .max(50),

    email:
      z.string()
        .email(),

    password:
      z.string()
        .min(8)
        .max(200)
  });

const loginSchema =
  z.object({
    username:
      z.string()
        .min(1),

    password:
      z.string()
        .min(1)
  });

export async function registerAuthRoutes(
  app: FastifyInstance
) {
  app.post(
    "/api/auth/register",
    async (
      request,
      reply
    ) => {
      const input =
        registerSchema.parse(
          request.body
        );

      try {
        const user =
          await createUser(
            input
          );

        return reply
          .code(201)
          .send({
            user,
            message:
              "Registration successful. Waiting for administrator approval."
          });
      } catch (error: any) {
        if (
          error?.code ===
          "23505"
        ) {
          return reply
            .code(409)
            .send({
              message:
                "Username or email already exists."
            });
        }

        throw error;
      }
    }
  );

  app.post(
    "/api/auth/login",
    async (
      request,
      reply
    ) => {
      const input =
        loginSchema.parse(
          request.body
        );

      const user =
        await authenticate(
          input.username,
          input.password
        );

      if (!user) {
        return reply
          .code(401)
          .send({
            message:
              "Invalid username or password."
          });
      }

      if (
        user.role ===
        "pending"
      ) {
        return reply
          .code(403)
          .send({
            message:
              "Your account is waiting for administrator approval."
          });
      }

      const token =
        await createSession(
          user.id
        );

      reply.setCookie(
        env.SESSION_COOKIE_NAME,
        token,
        sessionCookieOptions
      );

      return {
        user
      };
    }
  );

  app.post(
    "/api/auth/logout",
    async (
      request,
      reply
    ) => {
      const token =
        request.cookies[
          env.SESSION_COOKIE_NAME
        ];

      if (token) {
        await deleteSession(
          token
        );
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
    }
  );

  app.get(
    "/api/auth/me",
    async (
      request,
      reply
    ) => {
      const token =
        request.cookies[
          env.SESSION_COOKIE_NAME
        ];

      if (!token) {
        return reply
          .code(401)
          .send({
            message:
              "Not authenticated."
          });
      }

      const user =
        await getSessionUser(
          token
        );

      if (!user) {
        return reply
          .code(401)
          .send({
            message:
              "Session expired."
          });
      }

      return {
        user
      };
    }
  );
}
'@

# ============================================================
# CLIENTS
# ============================================================

Write-ProjectFile "apps/backend/src/modules/clients/routes.ts" @'
import type {
  FastifyInstance
} from "fastify";

import { z } from "zod";

import {
  db
} from "../../db/client.js";

import {
  requireRole
} from "../auth/guard.js";

const clientSchema =
  z.object({
    name:
      z.string()
        .min(1)
        .max(200),

    description:
      z.string()
        .max(1000)
        .optional()
  });

export async function registerClientRoutes(
  app: FastifyInstance
) {
  app.get(
    "/api/clients",
    {
      preHandler:
        requireRole(
          "admin",
          "editor",
          "viewer"
        )
    },
    async () => {
      const result =
        await db.query(`
          SELECT
            id,
            name,
            description,
            created_at,
            updated_at
          FROM clients
          ORDER BY name
        `);

      return result.rows;
    }
  );

  app.post(
    "/api/clients",
    {
      preHandler:
        requireRole("admin")
    },
    async (
      request,
      reply
    ) => {
      const input =
        clientSchema.parse(
          request.body
        );

      try {
        const result =
          await db.query(
            `
            INSERT INTO clients
            (
              name,
              description
            )
            VALUES
            ($1, $2)
            RETURNING *
            `,
            [
              input.name,
              input.description ??
                null
            ]
          );

        return reply
          .code(201)
          .send(
            result.rows[0]
          );
      } catch (error: any) {
        if (
          error?.code ===
          "23505"
        ) {
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
'@

# ============================================================
# VIEWS
# ============================================================

Write-ProjectFile "apps/backend/src/modules/views/routes.ts" @'
import type {
  FastifyInstance
} from "fastify";

import { z } from "zod";

import {
  db
} from "../../db/client.js";

import {
  requireRole
} from "../auth/guard.js";

const viewSchema =
  z.object({
    name:
      z.string()
        .min(1)
        .max(200),

    description:
      z.string()
        .max(1000)
        .optional()
  });

export async function registerViewRoutes(
  app: FastifyInstance
) {
  app.get(
    "/api/views",
    {
      preHandler:
        requireRole(
          "admin",
          "editor",
          "viewer"
        )
    },
    async () => {
      const result =
        await db.query(`
          SELECT
            id,
            name,
            description,
            created_at,
            updated_at
          FROM views
          ORDER BY name
        `);

      return result.rows;
    }
  );

  app.post(
    "/api/views",
    {
      preHandler:
        requireRole("admin")
    },
    async (
      request,
      reply
    ) => {
      const input =
        viewSchema.parse(
          request.body
        );

      try {
        const result =
          await db.query(
            `
            INSERT INTO views
            (
              name,
              description
            )
            VALUES
            ($1, $2)
            RETURNING *
            `,
            [
              input.name,
              input.description ??
                null
            ]
          );

        return reply
          .code(201)
          .send(
            result.rows[0]
          );
      } catch (error: any) {
        if (
          error?.code ===
          "23505"
        ) {
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
'@

# ============================================================
# USERS
# ============================================================

Write-ProjectFile "apps/backend/src/modules/users/routes.ts" @'
import type {
  FastifyInstance
} from "fastify";

import { z } from "zod";

import {
  db
} from "../../db/client.js";

import {
  requireRole
} from "../auth/guard.js";

const roleSchema =
  z.object({
    role:
      z.enum([
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
      preHandler:
        requireRole("admin")
    },
    async () => {
      const result =
        await db.query(`
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

      return result.rows;
    }
  );

  app.patch(
    "/api/users/:id/role",
    {
      preHandler:
        requireRole("admin")
    },
    async (
      request,
      reply
    ) => {
      const params =
        z.object({
          id:
            z.string().uuid()
        }).parse(
          request.params
        );

      const input =
        roleSchema.parse(
          request.body
        );

      const result =
        await db.query(
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

      if (
        !result.rows[0]
      ) {
        return reply
          .code(404)
          .send({
            message:
              "User not found."
          });
      }

      return result.rows[0];
    }
  );
}
'@

# ============================================================
# DASHBOARD
# ============================================================

Write-ProjectFile "apps/backend/src/modules/dashboard/routes.ts" @'
import type {
  FastifyInstance
} from "fastify";

import {
  db
} from "../../db/client.js";

import {
  requireRole
} from "../auth/guard.js";

export async function registerDashboardRoutes(
  app: FastifyInstance
) {
  app.get(
    "/api/dashboard",
    {
      preHandler:
        requireRole(
          "admin",
          "editor",
          "viewer"
        )
    },
    async () => {
      const statsResult =
        await db.query(`
          SELECT
            (
              SELECT COUNT(*)::int
              FROM clients
            ) AS clients,

            (
              SELECT COUNT(*)::int
              FROM views
            ) AS views,

            (
              SELECT COUNT(*)::int
              FROM metadata
            ) AS images,

            (
              SELECT COALESCE(
                SUM(
                  jsonb_array_length(
                    annotations
                  )
                ),
                0
              )::int
              FROM metadata
            ) AS annotations,

            (
              SELECT COUNT(*)::int
              FROM users
            ) AS users
        `);

      const clientsResult =
        await db.query(`
          SELECT
            c.id AS client_id,
            c.name AS client_name,
            COUNT(m.id)::int AS images,
            COALESCE(
              SUM(
                jsonb_array_length(
                  m.annotations
                )
              ),
              0
            )::int AS annotations
          FROM clients c
          LEFT JOIN metadata m
            ON m.client_id = c.id
          GROUP BY
            c.id,
            c.name
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
                jsonb_array_length(
                  m.annotations
                )
              ),
              0
            )::int AS annotations
          FROM views v
          LEFT JOIN metadata m
            ON m.view_id = v.id
          GROUP BY
            v.id,
            v.name
          ORDER BY v.name
        `);

      const stats =
        statsResult.rows[0];

      return {
        stats: {
          clients:
            stats.clients,
          views:
            stats.views,
          images:
            stats.images,
          annotations:
            stats.annotations,
          users:
            stats.users
        },

        clients:
          clientsResult.rows,

        views:
          viewsResult.rows
      };
    }
  );
}
'@

# ============================================================
# METADATA
# ============================================================

Write-ProjectFile "apps/backend/src/modules/metadata/routes.ts" @'
import type {
  FastifyInstance
} from "fastify";

import { z } from "zod";

import {
  db
} from "../../db/client.js";

import {
  requireRole
} from "../auth/guard.js";

const querySchema =
  z.object({
    clientId:
      z.string()
        .uuid()
        .optional(),

    viewId:
      z.string()
        .uuid()
        .optional(),

    annotationType:
      z.enum([
        "bbox",
        "polygon",
        "segmentation"
      ]).optional(),

    search:
      z.string()
        .optional(),

    page:
      z.coerce
        .number()
        .int()
        .positive()
        .default(1),

    limit:
      z.coerce
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
      preHandler:
        requireRole(
          "admin",
          "editor",
          "viewer"
        )
    },
    async (
      request
    ) => {
      const query =
        querySchema.parse(
          request.query
        );

      const conditions: string[] =
        [];

      const values: unknown[] =
        [];

      function add(
        condition: string,
        value: unknown
      ) {
        values.push(value);

        conditions.push(
          condition.replace(
            "?",
            `$${values.length}`
          )
        );
      }

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

      if (
        query.annotationType
      ) {
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

      const where =
        conditions.length
          ? `WHERE ${conditions.join(
              " AND "
            )}`
          : "";

      const count =
        await db.query(
          `
          SELECT COUNT(*)::int AS total
          FROM metadata m
          ${where}
          `,
          values
        );

      const total =
        count.rows[0].total;

      const offset =
        (query.page - 1) *
        query.limit;

      const result =
        await db.query(
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
          ORDER BY
            m.updated_at DESC
          LIMIT
            $${values.length + 1}
          OFFSET
            $${values.length + 2}
          `,
          [
            ...values,
            query.limit,
            offset
          ]
        );

      return {
        items:
          result.rows,
        page:
          query.page,
        limit:
          query.limit,
        total,
        totalPages:
          Math.ceil(
            total /
              query.limit
          )
      };
    }
  );
}
'@

# ============================================================
# UPLOAD
# ============================================================

Write-ProjectFile "apps/backend/src/modules/upload/routes.ts" @'
import path from "node:path";

import {
  mkdir,
  writeFile
} from "node:fs/promises";

import type {
  FastifyInstance
} from "fastify";

import {
  z
} from "zod";

import {
  db
} from "../../db/client.js";

import {
  requireRole
} from "../auth/guard.js";

import {
  getRawSourcePath,
  getMetadataImagePath,
  getMetadataLabelPath
} from "../../storage/paths.js";

import {
  fileExists,
  copyFileSafe,
  writeTextFile
} from "../../storage/storage.js";

import {
  sha256File
} from "../../storage/hash.js";

import {
  dedupeAnnotations,
  inferAnnotationType
} from "../../storage/merge.js";

function parseYolo(
  content: string
) {
  return content
    .split(/\r?\n/)
    .map(
      (line) =>
        line.trim()
    )
    .filter(Boolean)
    .map((line) => {
      const values =
        line
          .split(/\s+/)
          .map(Number);

      if (
        values.length !== 5 ||
        values.some(
          Number.isNaN
        )
      ) {
        throw new Error(
          "Invalid YOLO annotation."
        );
      }

      return {
        classId:
          values[0],

        className:
          `class_${values[0]}`,

        geometry: {
          format:
            "yolo_bbox" as const,

          values: [
            values[0],
            values[1],
            values[2],
            values[3],
            values[4]
          ] as [
            number,
            number,
            number,
            number,
            number
          ]
        }
      };
    });
}

export async function registerUploadRoutes(
  app: FastifyInstance
) {
  app.post(
    "/api/upload",
    {
      preHandler:
        requireRole(
          "admin",
          "editor"
        )
    },
    async (
      request,
      reply
    ) => {
      const parts =
        request.parts();

      let clientId = "";
      let viewId = "";
      let rootFolder = "";
      let relativePath = "";
      let labelContent = "";

      let imageBuffer:
        Buffer | null = null;

      let imageName = "";

      for await (
        const part of parts
      ) {
        if (
          part.type ===
          "field"
        ) {
          if (
            part.fieldname ===
            "clientId"
          ) {
            clientId =
              String(
                part.value
              );
          }

          if (
            part.fieldname ===
            "viewId"
          ) {
            viewId =
              String(
                part.value
              );
          }

          if (
            part.fieldname ===
            "rootFolder"
          ) {
            rootFolder =
              String(
                part.value
              );
          }

          if (
            part.fieldname ===
            "relativePath"
          ) {
            relativePath =
              String(
                part.value
              );
          }

          if (
            part.fieldname ===
            "labelContent"
          ) {
            labelContent =
              String(
                part.value
              );
          }

          continue;
        }

        if (
          part.fieldname ===
          "image"
        ) {
          imageName =
            path.basename(
              part.filename
            );

          imageBuffer =
            await part.toBuffer();
        }
      }

      const input =
        z.object({
          clientId:
            z.string().uuid(),

          viewId:
            z.string().uuid(),

          rootFolder:
            z.string()
              .min(1),

          relativePath:
            z.string()
              .min(1)
        }).parse({
          clientId,
          viewId,
          rootFolder,
          relativePath
        });

      if (
        !imageBuffer ||
        !imageName
      ) {
        return reply
          .code(400)
          .send({
            message:
              "Image is required."
          });
      }

      const clientResult =
        await db.query(
          `
          SELECT id, name
          FROM clients
          WHERE id = $1
          `,
          [input.clientId]
        );

      const viewResult =
        await db.query(
          `
          SELECT id, name
          FROM views
          WHERE id = $1
          `,
          [input.viewId]
        );

      const client =
        clientResult.rows[0];

      const view =
        viewResult.rows[0];

      if (
        !client ||
        !view
      ) {
        return reply
          .code(400)
          .send({
            message:
              "Invalid client or view."
          });
      }

      const rawPath =
        getRawSourcePath(
          client.name,
          path.join(
            input.rootFolder,
            input.relativePath
          )
        );

      await mkdir(
        path.dirname(
          rawPath
        ),
        {
          recursive: true
        }
      );

      await writeFile(
        rawPath,
        imageBuffer
      );

      const imageHash =
        await sha256File(
          rawPath
        );

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
        parseYolo(
          labelContent
        );

      if (
        existing.rows[0]
      ) {
        const record =
          existing.rows[0];

        if (
          record.image_hash !==
          imageHash
        ) {
          return reply
            .code(409)
            .send({
              message:
                "Filename exists but image content is different.",
              conflict: true
            });
        }

        const merged =
          dedupeAnnotations([
            ...(record.annotations ??
              []),
            ...annotations
          ]);

        await db.query(
          `
          UPDATE metadata
          SET
            annotations = $1,
            root_folders =
              ARRAY(
                SELECT DISTINCT
                  unnest(
                    root_folders ||
                    $2::text[]
                  )
              ),
            original_root_folders =
              ARRAY(
                SELECT DISTINCT
                  unnest(
                    original_root_folders ||
                    $3::text[]
                  )
              ),
            source_locations =
              ARRAY(
                SELECT DISTINCT
                  unnest(
                    source_locations ||
                    $4::text[]
                  )
              )
          WHERE id = $5
          `,
          [
            JSON.stringify(
              merged
            ),

            [
              input.rootFolder
            ],

            [
              input.rootFolder
            ],

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
              (
                annotation: any
              ) =>
                annotation
                  .geometry
                  .values
                  .join(" ")
            )
            .join("\n")
        );

        return {
          merged: true,
          metadataId:
            record.id,
          imageName,
          annotationCount:
            merged.length
        };
      }

      if (
        !(await fileExists(
          metadataImage
        ))
      ) {
        await copyFileSafe(
          rawPath,
          metadataImage
        );
      }

      await writeTextFile(
        metadataLabel,
        annotations
          .map(
            (
              annotation: any
            ) =>
              annotation
                .geometry
                .values
                .join(" ")
          )
          .join("\n")
      );

      const inserted =
        await db.query(
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
            JSON.stringify(
              annotations
            ),
            imageHash,
            [
              input.rootFolder
            ],
            [
              input.rootFolder
            ],
            [
              path.join(
                input.rootFolder,
                input.relativePath
              )
            ]
          ]
        );

      return reply
        .code(201)
        .send({
          merged: false,
          metadataId:
            inserted.rows[0].id,
          imageName,
          annotationCount:
            annotations.length
        });
    }
  );
}
'@

# ============================================================
# DOWNLOAD
# ============================================================

Write-ProjectFile "apps/backend/src/modules/download/routes.ts" @'
import path from "node:path";

import type {
  FastifyInstance
} from "fastify";

import archiver from "archiver";

import {
  db
} from "../../db/client.js";

import {
  requireRole
} from "../auth/guard.js";

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
      preHandler:
        requireRole(
          "admin",
          "editor",
          "viewer"
        )
    },
    async (
      request,
      reply
    ) => {
      const params =
        request.params as {
          id: string;
        };

      const result =
        await db.query(
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
          [params.id]
        );

      const record =
        result.rows[0];

      if (!record) {
        return reply
          .code(404)
          .send({
            message:
              "Metadata not found."
          });
      }

      const imagePath =
        getMetadataImagePath(
          record.client_name,
          record.name
        );

      const labelPath =
        getMetadataLabelPath(
          record.client_name,
          record.name
        );

      const archive =
        archiver(
          "zip",
          {
            zlib: {
              level: 6
            }
          }
        );

      archive.on(
        "error",
        (error) => {
          request.log.error(
            error
          );
        }
      );

      archive.file(
        imagePath,
        {
          name:
            record.name
        }
      );

      archive.file(
        labelPath,
        {
          name:
            `${path.parse(
              record.name
            ).name}.txt`
        }
      );

      reply.header(
        "Content-Type",
        "application/zip"
      );

      reply.header(
        "Content-Disposition",
        `attachment; filename="${path.parse(record.name).name}.zip"`
      );

      return reply.send(
        archive
      );
    }
  );
}
'@

# ============================================================
# APP / SERVER
# ============================================================

Write-ProjectFile "apps/backend/src/app.ts" @'
import Fastify from "fastify";

import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";

import {
  env
} from "./config/env.js";

import {
  registerAuthRoutes
} from "./modules/auth/routes.js";

import {
  registerClientRoutes
} from "./modules/clients/routes.js";

import {
  registerDashboardRoutes
} from "./modules/dashboard/routes.js";

import {
  registerDownloadRoutes
} from "./modules/download/routes.js";

import {
  registerMetadataRoutes
} from "./modules/metadata/routes.js";

import {
  registerUploadRoutes
} from "./modules/upload/routes.js";

import {
  registerUserRoutes
} from "./modules/users/routes.js";

import {
  registerViewRoutes
} from "./modules/views/routes.js";

export async function createApp() {
  const app =
    Fastify({
      logger: true,
      bodyLimit:
        env.MAX_UPLOAD_SIZE_MB *
        1024 *
        1024
    });

  await app.register(
    cors,
    {
      origin:
        env.NEXT_PUBLIC_API_URL,
      credentials: true
    }
  );

  await app.register(
    cookie,
    {
      secret:
        env.SESSION_SECRET
    }
  );

  await app.register(
    multipart,
    {
      limits: {
        fileSize:
          env.MAX_UPLOAD_SIZE_MB *
          1024 *
          1024
      }
    }
  );

  app.get(
    "/health",
    async () => ({
      status: "ok",
      service:
        "data-manage-backend",
      timestamp:
        new Date().toISOString()
    })
  );

  await registerAuthRoutes(
    app
  );

  await registerClientRoutes(
    app
  );

  await registerViewRoutes(
    app
  );

  await registerUserRoutes(
    app
  );

  await registerMetadataRoutes(
    app
  );

  await registerDashboardRoutes(
    app
  );

  await registerUploadRoutes(
    app
  );

  await registerDownloadRoutes(
    app
  );

  return app;
}
'@

Write-ProjectFile "apps/backend/src/server.ts" @'
import {
  createApp
} from "./app.js";

import {
  env
} from "./config/env.js";

import {
  checkDatabaseConnection,
  closeDatabase
} from "./db/client.js";

import {
  initializeStorage
} from "./storage/init.js";

async function start() {
  await initializeStorage();

  await checkDatabaseConnection();

  const app =
    await createApp();

  await app.listen({
    host: "0.0.0.0",
    port:
      env.BACKEND_PORT
  });

  async function shutdown() {
    await app.close();
    await closeDatabase();
    process.exit(0);
  }

  process.on(
    "SIGINT",
    shutdown
  );

  process.on(
    "SIGTERM",
    shutdown
  );
}

start().catch(
  (error) => {
    console.error(
      error
    );

    process.exit(1);
  }
);
'@

# ============================================================
# SHARED TYPES
# ============================================================

Write-ProjectFile "packages/types/src/annotation.ts" @'
export type AnnotationType =
  | "bbox"
  | "polygon"
  | "segmentation";

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

  points:
    Array<
      [number, number]
    >;
}

export interface SegmentationGeometry {
  format: "segmentation";

  points:
    Array<
      [number, number]
    >;
}

export type AnnotationGeometry =
  | BoundingBoxGeometry
  | PolygonGeometry
  | SegmentationGeometry;

export interface Annotation {
  classId: number;

  className: string;

  geometry:
    AnnotationGeometry;
}
'@

Write-ProjectFile "packages/types/src/client.ts" @'
export interface Client {
  id: string;
  name: string;
  description: string | null;
  created_at?: string;
  updated_at?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface View {
  id: string;
  name: string;
  description: string | null;
  created_at?: string;
  updated_at?: string;
  createdAt?: string;
  updatedAt?: string;
}
'@

Write-ProjectFile "packages/types/src/user.ts" @'
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
  created_at?: string;
  updated_at?: string;
}

export interface AuthUser
  extends User {}

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
'@

Write-ProjectFile "packages/types/src/dashboard.ts" @'
export interface DashboardStats {
  clients: number;
  views: number;
  images: number;
  annotations: number;
  users: number;
}

export interface ClientStatistics {
  client_id: string;
  client_name: string;
  images: number;
  annotations: number;
}

export interface ViewStatistics {
  view_id: string;
  view_name: string;
  images: number;
  annotations: number;
}

export interface DashboardResponse {
  stats: DashboardStats;
  clients: ClientStatistics[];
  views: ViewStatistics[];
}
'@

Write-ProjectFile "packages/types/src/metadata.ts" @'
import type {
  Annotation,
  AnnotationType
} from "./annotation.js";

export interface MetadataRecord {
  id: string;

  client_id: string;

  client_name: string;

  view_id: string;

  view_name: string;

  name: string;

  annotation_type:
    AnnotationType;

  annotations:
    Annotation[];

  image_hash: string;

  root_folders:
    string[];

  original_root_folders:
    string[];

  source_locations:
    string[];

  description:
    string | null;

  created_at: string;

  updated_at: string;
}

export interface MetadataListResponse {
  items:
    MetadataRecord[];

  page: number;

  limit: number;

  total: number;

  totalPages: number;
}
'@

Write-ProjectFile "packages/types/src/index.ts" @'
export * from "./annotation.js";
export * from "./client.js";
export * from "./dashboard.js";
export * from "./metadata.js";
export * from "./user.js";
'@

# ============================================================
# FRONTEND API
# ============================================================

Write-ProjectFile "apps/frontend/lib/api.ts" @'
const API_URL =
  process.env
    .NEXT_PUBLIC_API_URL ??
  "http://localhost:4000";

export async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response =
    await fetch(
      `${API_URL}${path}`,
      {
        ...options,

        credentials:
          "include",

        headers: {
          ...(options.body instanceof FormData
            ? {}
            : {
                "Content-Type":
                  "application/json"
              }),

          ...(options.headers ?? {})
        },

        cache:
          "no-store"
      }
    );

  const contentType =
    response.headers.get(
      "content-type"
    );

  const body =
    contentType?.includes(
      "application/json"
    )
      ? await response.json()
      : await response.text();

  if (
    !response.ok
  ) {
    const message =
      typeof body ===
        "object" &&
      body !== null &&
      "message" in body
        ? String(
            body.message
          )
        : "Request failed.";

    throw new Error(
      message
    );
  }

  return body as T;
}

export {
  API_URL
};
'@

# ============================================================
# AUTH HOOK
# ============================================================

Write-ProjectFile "apps/frontend/hooks/use-auth.ts" @'
"use client";

import {
  useCallback,
  useEffect,
  useState
} from "react";

import type {
  AuthUser
} from "@data-manage/types";

import {
  api
} from "../lib/api";

export function useAuth() {
  const [
    user,
    setUser
  ] =
    useState<AuthUser | null>(
      null
    );

  const [
    loading,
    setLoading
  ] =
    useState(true);

  const refresh =
    useCallback(
      async () => {
        try {
          const result =
            await api<{
              user: AuthUser;
            }>(
              "/api/auth/me"
            );

          setUser(
            result.user
          );
        } catch {
          setUser(null);
        } finally {
          setLoading(
            false
          );
        }
      },
      []
    );

  useEffect(
    () => {
      void refresh();
    },
    [refresh]
  );

  const logout =
    useCallback(
      async () => {
        await api(
          "/api/auth/logout",
          {
            method:
              "POST"
          }
        );

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
'@

# ============================================================
# AUTH PAGES
# ============================================================

Write-ProjectFile "apps/frontend/app/(auth)/login/page.tsx" @'
"use client";

import {
  FormEvent,
  useState
} from "react";

import {
  useRouter
} from "next/navigation";

import Link from "next/link";

import {
  api
} from "../../../lib/api";

export default function LoginPage() {
  const router =
    useRouter();

  const [
    username,
    setUsername
  ] =
    useState("");

  const [
    password,
    setPassword
  ] =
    useState("");

  const [
    error,
    setError
  ] =
    useState("");

  const [
    loading,
    setLoading
  ] =
    useState(false);

  async function submit(
    event: FormEvent
  ) {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      await api(
        "/api/auth/login",
        {
          method:
            "POST",

          body:
            JSON.stringify({
              username,
              password
            })
        }
      );

      router.push(
        "/dashboard"
      );

      router.refresh();
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : "Login failed."
      );
    } finally {
      setLoading(
        false
      );
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <form
        onSubmit={submit}
        className="w-full max-w-md space-y-6 rounded-2xl border bg-card p-8 shadow-sm"
      >
        <div>
          <h1 className="text-2xl font-semibold">
            Sign in
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            Sign in to Data Manage.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">
            Username
          </label>

          <input
            className="w-full rounded-lg border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring"
            value={username}
            onChange={(event) =>
              setUsername(
                event.target.value
              )
            }
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">
            Password
          </label>

          <input
            type="password"
            className="w-full rounded-lg border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring"
            value={password}
            onChange={(event) =>
              setPassword(
                event.target.value
              )
            }
            required
          />
        </div>

        {error && (
          <p className="text-sm text-destructive">
            {error}
          </p>
        )}

        <button
          disabled={loading}
          className="w-full rounded-lg bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
        >
          {loading
            ? "Signing in..."
            : "Sign in"}
        </button>

        <p className="text-center text-sm text-muted-foreground">
          No account?{" "}
          <Link
            href="/register"
            className="text-foreground underline"
          >
            Register
          </Link>
        </p>
      </form>
    </main>
  );
}
'@

Write-ProjectFile "apps/frontend/app/(auth)/register/page.tsx" @'
"use client";

import {
  FormEvent,
  useState
} from "react";

import {
  useRouter
} from "next/navigation";

import Link from "next/link";

import {
  api
} from "../../../lib/api";

export default function RegisterPage() {
  const router =
    useRouter();

  const [
    name,
    setName
  ] =
    useState("");

  const [
    username,
    setUsername
  ] =
    useState("");

  const [
    email,
    setEmail
  ] =
    useState("");

  const [
    password,
    setPassword
  ] =
    useState("");

  const [
    error,
    setError
  ] =
    useState("");

  const [
    success,
    setSuccess
  ] =
    useState("");

  async function submit(
    event: FormEvent
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    try {
      await api(
        "/api/auth/register",
        {
          method:
            "POST",

          body:
            JSON.stringify({
              name,
              username,
              email,
              password
            })
        }
      );

      setSuccess(
        "Registration submitted. Wait for administrator approval."
      );

      setTimeout(
        () =>
          router.push(
            "/login"
          ),
        1200
      );
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : "Registration failed."
      );
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <form
        onSubmit={submit}
        className="w-full max-w-md space-y-5 rounded-2xl border bg-card p-8 shadow-sm"
      >
        <div>
          <h1 className="text-2xl font-semibold">
            Create account
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            New accounts require administrator approval.
          </p>
        </div>

        <input
          className="w-full rounded-lg border bg-background px-3 py-2"
          placeholder="Full name"
          value={name}
          onChange={(event) =>
            setName(
              event.target.value
            )
          }
          required
        />

        <input
          className="w-full rounded-lg border bg-background px-3 py-2"
          placeholder="Username"
          value={username}
          onChange={(event) =>
            setUsername(
              event.target.value
            )
          }
          required
        />

        <input
          type="email"
          className="w-full rounded-lg border bg-background px-3 py-2"
          placeholder="Email"
          value={email}
          onChange={(event) =>
            setEmail(
              event.target.value
            )
          }
          required
        />

        <input
          type="password"
          className="w-full rounded-lg border bg-background px-3 py-2"
          placeholder="Password"
          value={password}
          onChange={(event) =>
            setPassword(
              event.target.value
            )
          }
          required
        />

        {error && (
          <p className="text-sm text-destructive">
            {error}
          </p>
        )}

        {success && (
          <p className="text-sm text-green-600">
            {success}
          </p>
        )}

        <button className="w-full rounded-lg bg-primary px-4 py-2 text-primary-foreground">
          Create account
        </button>

        <p className="text-center text-sm text-muted-foreground">
          Already registered?{" "}
          <Link
            href="/login"
            className="underline"
          >
            Sign in
          </Link>
        </p>
      </form>
    </main>
  );
}
'@

# ============================================================
# DASHBOARD
# ============================================================

Write-ProjectFile "apps/frontend/app/(dashboard)/dashboard/page.tsx" @'
"use client";

import {
  useEffect,
  useState
} from "react";

import type {
  DashboardResponse
} from "@data-manage/types";

import {
  api
} from "../../../lib/api";

export default function DashboardPage() {
  const [
    data,
    setData
  ] =
    useState<DashboardResponse | null>(
      null
    );

  const [
    error,
    setError
  ] =
    useState("");

  useEffect(
    () => {
      api<DashboardResponse>(
        "/api/dashboard"
      )
        .then(setData)
        .catch(
          (value) =>
            setError(
              value instanceof Error
                ? value.message
                : "Failed to load dashboard."
            )
        );
    },
    []
  );

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

  const cards = [
    [
      "Clients",
      data.stats.clients
    ],
    [
      "Views",
      data.stats.views
    ],
    [
      "Images",
      data.stats.images
    ],
    [
      "Annotations",
      data.stats.annotations
    ],
    [
      "Users",
      data.stats.users
    ]
  ];

  return (
    <main className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">
          Dashboard
        </h1>

        <p className="mt-1 text-sm text-muted-foreground">
          Dataset and metadata overview.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map(
          ([
            label,
            value
          ]) => (
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
          )
        )}
      </div>

      <section className="rounded-xl border bg-card">
        <div className="border-b p-5">
          <h2 className="font-semibold">
            Clients
          </h2>
        </div>

        {data.clients.map(
          (client) => (
            <div
              key={
                client.client_id
              }
              className="flex items-center justify-between border-b p-4 last:border-b-0"
            >
              <span>
                {
                  client.client_name
                }
              </span>

              <span className="text-sm text-muted-foreground">
                {
                  client.images
                }{" "}
                images ·{" "}
                {
                  client.annotations
                }{" "}
                annotations
              </span>
            </div>
          )
        )}
      </section>
    </main>
  );
}
'@

# ============================================================
# CLIENTS
# ============================================================

Write-ProjectFile "apps/frontend/app/(dashboard)/clients/page.tsx" @'
"use client";

import {
  useEffect,
  useState
} from "react";

import type {
  Client
} from "@data-manage/types";

import {
  api
} from "../../../lib/api";

export default function ClientsPage() {
  const [
    clients,
    setClients
  ] =
    useState<Client[]>(
      []
    );

  const [
    name,
    setName
  ] =
    useState("");

  const [
    description,
    setDescription
  ] =
    useState("");

  const [
    error,
    setError
  ] =
    useState("");

  async function load() {
    try {
      setClients(
        await api<Client[]>(
          "/api/clients"
        )
      );
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : "Failed to load clients."
      );
    }
  }

  useEffect(
    () => {
      void load();
    },
    []
  );

  async function create() {
    if (!name.trim()) {
      return;
    }

    try {
      await api(
        "/api/clients",
        {
          method:
            "POST",

          body:
            JSON.stringify({
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
  }

  return (
    <main className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">
          Clients
        </h1>

        <p className="text-sm text-muted-foreground">
          Manage dataset clients.
        </p>
      </div>

      <section className="grid gap-3 rounded-xl border bg-card p-5 md:grid-cols-[1fr_1fr_auto]">
        <input
          className="rounded-lg border bg-background px-3 py-2"
          placeholder="Client name"
          value={name}
          onChange={(event) =>
            setName(
              event.target.value
            )
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
          onClick={create}
          className="rounded-lg bg-primary px-4 py-2 text-primary-foreground"
        >
          Create
        </button>
      </section>

      {error && (
        <p className="text-sm text-destructive">
          {error}
        </p>
      )}

      <section className="divide-y rounded-xl border bg-card">
        {clients.map(
          (client) => (
            <div
              key={client.id}
              className="p-5"
            >
              <p className="font-medium">
                {client.name}
              </p>

              {client.description && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {
                    client.description
                  }
                </p>
              )}
            </div>
          )
        )}

        {!clients.length && (
          <div className="p-6 text-sm text-muted-foreground">
            No clients yet.
          </div>
        )}
      </section>
    </main>
  );
}
'@

# ============================================================
# VIEWS
# ============================================================

Write-ProjectFile "apps/frontend/app/(dashboard)/views/page.tsx" @'
"use client";

import {
  useEffect,
  useState
} from "react";

import type {
  View
} from "@data-manage/types";

import {
  api
} from "../../../lib/api";

export default function ViewsPage() {
  const [
    views,
    setViews
  ] =
    useState<View[]>(
      []
    );

  const [
    name,
    setName
  ] =
    useState("");

  const [
    description,
    setDescription
  ] =
    useState("");

  const [
    error,
    setError
  ] =
    useState("");

  async function load() {
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
  }

  useEffect(
    () => {
      void load();
    },
    []
  );

  async function create() {
    if (!name.trim()) {
      return;
    }

    try {
      await api(
        "/api/views",
        {
          method:
            "POST",

          body:
            JSON.stringify({
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
          : "Failed to create view."
      );
    }
  }

  return (
    <main className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">
          Views
        </h1>

        <p className="text-sm text-muted-foreground">
          Manage camera and dataset view types.
        </p>
      </div>

      <section className="grid gap-3 rounded-xl border bg-card p-5 md:grid-cols-[1fr_1fr_auto]">
        <input
          className="rounded-lg border bg-background px-3 py-2"
          placeholder="View name"
          value={name}
          onChange={(event) =>
            setName(
              event.target.value
            )
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
          onClick={create}
          className="rounded-lg bg-primary px-4 py-2 text-primary-foreground"
        >
          Create
        </button>
      </section>

      {error && (
        <p className="text-sm text-destructive">
          {error}
        </p>
      )}

      <section className="divide-y rounded-xl border bg-card">
        {views.map(
          (view) => (
            <div
              key={view.id}
              className="p-5"
            >
              <p className="font-medium">
                {view.name}
              </p>

              {view.description && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {
                    view.description
                  }
                </p>
              )}
            </div>
          )
        )}

        {!views.length && (
          <div className="p-6 text-sm text-muted-foreground">
            No views yet.
          </div>
        )}
      </section>
    </main>
  );
}
'@

# ============================================================
# METADATA
# ============================================================

Write-ProjectFile "apps/frontend/app/(dashboard)/metadata/page.tsx" @'
"use client";

import {
  useEffect,
  useState
} from "react";

import type {
  MetadataListResponse
} from "@data-manage/types";

import {
  api
} from "../../../lib/api";

export default function MetadataPage() {
  const [
    data,
    setData
  ] =
    useState<MetadataListResponse | null>(
      null
    );

  const [
    error,
    setError
  ] =
    useState("");

  useEffect(
    () => {
      api<MetadataListResponse>(
        "/api/metadata"
      )
        .then(setData)
        .catch(
          (value) =>
            setError(
              value instanceof Error
                ? value.message
                : "Failed to load metadata."
            )
        );
    },
    []
  );

  return (
    <main className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">
          Metadata
        </h1>

        <p className="text-sm text-muted-foreground">
          Canonical image and annotation records.
        </p>
      </div>

      {error && (
        <p className="text-sm text-destructive">
          {error}
        </p>
      )}

      <section className="overflow-hidden rounded-xl border bg-card">
        <div className="grid grid-cols-5 border-b p-4 text-sm font-medium">
          <span>Name</span>
          <span>Client</span>
          <span>View</span>
          <span>Type</span>
          <span>Annotations</span>
        </div>

        {!data && (
          <div className="p-6 text-sm text-muted-foreground">
            Loading...
          </div>
        )}

        {data?.items.map(
          (item) => (
            <div
              key={item.id}
              className="grid grid-cols-5 border-b p-4 text-sm last:border-b-0"
            >
              <span className="truncate">
                {item.name}
              </span>

              <span>
                {
                  item.client_name
                }
              </span>

              <span>
                {
                  item.view_name
                }
              </span>

              <span>
                {
                  item.annotation_type
                }
              </span>

              <span>
                {
                  item.annotations
                    .length
                }
              </span>
            </div>
          )
        )}
      </section>
    </main>
  );
}
'@

# ============================================================
# UPLOAD
# ============================================================

Write-ProjectFile "apps/frontend/app/(dashboard)/upload/page.tsx" @'
"use client";

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useState
} from "react";

import type {
  Client,
  View
} from "@data-manage/types";

import {
  api
} from "../../../lib/api";

export default function UploadPage() {
  const [
    clients,
    setClients
  ] =
    useState<Client[]>(
      []
    );

  const [
    views,
    setViews
  ] =
    useState<View[]>(
      []
    );

  const [
    clientId,
    setClientId
  ] =
    useState("");

  const [
    viewId,
    setViewId
  ] =
    useState("");

  const [
    rootFolder,
    setRootFolder
  ] =
    useState("");

  const [
    relativePath,
    setRelativePath
  ] =
    useState("");

  const [
    image,
    setImage
  ] =
    useState<File | null>(
      null
    );

  const [
    label,
    setLabel
  ] =
    useState("");

  const [
    message,
    setMessage
  ] =
    useState("");

  const [
    error,
    setError
  ] =
    useState("");

  useEffect(
    () => {
      Promise.all([
        api<Client[]>(
          "/api/clients"
        ),
        api<View[]>(
          "/api/views"
        )
      ]).then(
        ([
          clientsData,
          viewsData
        ]) => {
          setClients(
            clientsData
          );

          setViews(
            viewsData
          );
        }
      );
    },
    []
  );

  function selectImage(
    event: ChangeEvent<HTMLInputElement>
  ) {
    setImage(
      event.target.files?.[0] ??
        null
    );
  }

  async function submit(
    event: FormEvent
  ) {
    event.preventDefault();

    setMessage("");
    setError("");

    if (!image) {
      setError(
        "Select an image."
      );

      return;
    }

    const form =
      new FormData();

    form.append(
      "clientId",
      clientId
    );

    form.append(
      "viewId",
      viewId
    );

    form.append(
      "rootFolder",
      rootFolder
    );

    form.append(
      "relativePath",
      relativePath
    );

    form.append(
      "labelContent",
      label
    );

    form.append(
      "image",
      image
    );

    try {
      const result =
        await api<{
          merged: boolean;
          imageName: string;
          annotationCount:
            number;
        }>(
          "/api/upload",
          {
            method:
              "POST",

            body:
              form
          }
        );

      setMessage(
        result.merged
          ? `Merged ${result.annotationCount} annotations into ${result.imageName}.`
          : `Uploaded ${result.imageName} with ${result.annotationCount} annotations.`
      );
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : "Upload failed."
      );
    }
  }

  return (
    <main className="max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">
          Upload Dataset
        </h1>

        <p className="mt-1 text-sm text-muted-foreground">
          Upload an image and its YOLO annotation.
        </p>
      </div>

      <form
        onSubmit={submit}
        className="space-y-5 rounded-xl border bg-card p-6"
      >
        <select
          className="w-full rounded-lg border bg-background px-3 py-2"
          value={clientId}
          onChange={(event) =>
            setClientId(
              event.target.value
            )
          }
          required
        >
          <option value="">
            Select client
          </option>

          {clients.map(
            (client) => (
              <option
                key={client.id}
                value={client.id}
              >
                {client.name}
              </option>
            )
          )}
        </select>

        <select
          className="w-full rounded-lg border bg-background px-3 py-2"
          value={viewId}
          onChange={(event) =>
            setViewId(
              event.target.value
            )
          }
          required
        >
          <option value="">
            Select view
          </option>

          {views.map(
            (view) => (
              <option
                key={view.id}
                value={view.id}
              >
                {view.name}
              </option>
            )
          )}
        </select>

        <input
          className="w-full rounded-lg border bg-background px-3 py-2"
          placeholder="Root folder"
          value={rootFolder}
          onChange={(event) =>
            setRootFolder(
              event.target.value
            )
          }
          required
        />

        <input
          className="w-full rounded-lg border bg-background px-3 py-2"
          placeholder="Relative path"
          value={relativePath}
          onChange={(event) =>
            setRelativePath(
              event.target.value
            )
          }
          required
        />

        <input
          type="file"
          accept="image/*"
          onChange={
            selectImage
          }
          required
        />

        <textarea
          className="min-h-32 w-full rounded-lg border bg-background px-3 py-2 font-mono text-sm"
          placeholder="YOLO annotation lines"
          value={label}
          onChange={(event) =>
            setLabel(
              event.target.value
            )
          }
        />

        {error && (
          <p className="text-sm text-destructive">
            {error}
          </p>
        )}

        {message && (
          <p className="text-sm text-green-600">
            {message}
          </p>
        )}

        <button className="rounded-lg bg-primary px-5 py-2 text-primary-foreground">
          Upload
        </button>
      </form>
    </main>
  );
}
'@

# ============================================================
# USERS
# ============================================================

Write-ProjectFile "apps/frontend/app/(dashboard)/users/page.tsx" @'
"use client";

import {
  useEffect,
  useState
} from "react";

import type {
  User,
  UserRole
} from "@data-manage/types";

import {
  api
} from "../../../lib/api";

export default function UsersPage() {
  const [
    users,
    setUsers
  ] =
    useState<User[]>(
      []
    );

  const [
    error,
    setError
  ] =
    useState("");

  async function load() {
    try {
      setUsers(
        await api<User[]>(
          "/api/users"
        )
      );
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : "Failed to load users."
      );
    }
  }

  useEffect(
    () => {
      void load();
    },
    []
  );

  async function updateRole(
    id: string,
    role: UserRole
  ) {
    try {
      await api(
        `/api/users/${id}/role`,
        {
          method:
            "PATCH",

          body:
            JSON.stringify({
              role
            })
        }
      );

      await load();
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : "Failed to update role."
      );
    }
  }

  return (
    <main className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">
          Users
        </h1>

        <p className="text-sm text-muted-foreground">
          Manage access permissions.
        </p>
      </div>

      {error && (
        <p className="text-sm text-destructive">
          {error}
        </p>
      )}

      <section className="overflow-hidden rounded-xl border bg-card">
        <div className="grid grid-cols-4 border-b p-4 text-sm font-medium">
          <span>Name</span>
          <span>Username</span>
          <span>Email</span>
          <span>Role</span>
        </div>

        {users.map(
          (user) => (
            <div
              key={user.id}
              className="grid grid-cols-4 items-center border-b p-4 text-sm last:border-b-0"
            >
              <span>
                {user.name}
              </span>

              <span>
                {user.username}
              </span>

              <span>
                {user.email}
              </span>

              <select
                className="rounded-lg border bg-background px-2 py-1"
                value={user.role}
                onChange={(
                  event
                ) =>
                  updateRole(
                    user.id,
                    event.target
                      .value as UserRole
                  )
                }
              >
                <option value="pending">
                  Pending
                </option>

                <option value="viewer">
                  Viewer
                </option>

                <option value="editor">
                  Editor
                </option>

                <option value="admin">
                  Admin
                </option>
              </select>
            </div>
          )
        )}
      </section>
    </main>
  );
}
'@

# ============================================================
# FRONTEND ROOT
# ============================================================

Write-ProjectFile "apps/frontend/app/page.tsx" @'
import { redirect } from "next/navigation";

export default function HomePage() {
  redirect(
    "/dashboard"
  );
}
'@

# ============================================================
# BASIC DASHBOARD LAYOUT
# ============================================================

Write-ProjectFile "apps/frontend/app/(dashboard)/layout.tsx" @'
"use client";

import Link from "next/link";

import {
  usePathname,
  useRouter
} from "next/navigation";

import {
  useAuth
} from "../../hooks/use-auth";

const links = [
  {
    href: "/dashboard",
    label: "Dashboard"
  },
  {
    href: "/clients",
    label: "Clients"
  },
  {
    href: "/views",
    label: "Views"
  },
  {
    href: "/metadata",
    label: "Metadata"
  },
  {
    href: "/upload",
    label: "Upload"
  },
  {
    href: "/users",
    label: "Users"
  }
];

export default function DashboardLayout({
  children
}: {
  children:
    React.ReactNode;
}) {
  const pathname =
    usePathname();

  const router =
    useRouter();

  const {
    user,
    loading,
    logout
  } =
    useAuth();

  if (
    loading
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        Loading...
      </div>
    );
  }

  if (!user) {
    router.replace(
      "/login"
    );

    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r bg-card md:block">
        <div className="p-6">
          <h1 className="font-semibold">
            Data Manage
          </h1>

          <p className="mt-1 text-xs text-muted-foreground">
            Dataset management
          </p>
        </div>

        <nav className="space-y-1 px-3">
          {links
            .filter(
              (link) =>
                link.label !==
                  "Users" ||
                user.role ===
                  "admin"
            )
            .map(
              (link) => {
                const active =
                  pathname ===
                  link.href;

                return (
                  <Link
                    key={
                      link.href
                    }
                    href={
                      link.href
                    }
                    className={`block rounded-lg px-3 py-2 text-sm ${
                      active
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    }`}
                  >
                    {
                      link.label
                    }
                  </Link>
                );
              }
            )}
        </nav>

        <div className="absolute inset-x-0 bottom-0 border-t p-4">
          <p className="truncate text-sm font-medium">
            {user.name}
          </p>

          <p className="text-xs text-muted-foreground">
            {user.role}
          </p>

          <button
            onClick={async () => {
              await logout();

              router.push(
                "/login"
              );
            }}
            className="mt-3 w-full rounded-lg border px-3 py-2 text-sm hover:bg-accent"
          >
            Sign out
          </button>
        </div>
      </aside>

      <div className="md:pl-64">
        {children}
      </div>
    </div>
  );
}
'@

# ============================================================
# BACKEND PLACEHOLDERS FOR FUTURE MODULES
# ============================================================

Write-ProjectFile "apps/backend/src/modules/auth/index.ts" @'
export {};
'@

Write-ProjectFile "apps/backend/src/modules/clients/index.ts" @'
export {};
'@

Write-ProjectFile "apps/backend/src/modules/dashboard/index.ts" @'
export {};
'@

Write-ProjectFile "apps/backend/src/modules/download/index.ts" @'
export {};
'@

Write-ProjectFile "apps/backend/src/modules/metadata/index.ts" @'
export {};
'@

Write-ProjectFile "apps/backend/src/modules/upload/index.ts" @'
export {};
'@

Write-ProjectFile "apps/backend/src/modules/users/index.ts" @'
export {};
'@

Write-ProjectFile "apps/backend/src/modules/views/index.ts" @'
export {};
'@

Write-ProjectFile "apps/backend/src/validation/index.ts" @'
export {};
'@

Write-ProjectFile "apps/backend/src/websocket/index.ts" @'
export {};
'@

Write-Host ""
Write-Host "==============================================" -ForegroundColor Green
Write-Host " Source generation complete." -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Green
Write-Host ""

Write-Host "Next commands:" -ForegroundColor Cyan
Write-Host ""
Write-Host "  pnpm install"
Write-Host "  pnpm --filter @data-manage/types exec tsc --noEmit"
Write-Host "  pnpm --filter backend exec tsc --noEmit"
Write-Host "  pnpm --filter frontend exec tsc --noEmit"
Write-Host "  pnpm check-types"
Write-Host "  pnpm build"
Write-Host ""