import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { env } from "../../config/env.js";
import { db } from "../../db/client.js";
import {
  getMetadataImagePath,
  getMetadataLabelPath,
} from "../../storage/paths.js";
import { requireRole } from "../auth/guard.js";

const require = createRequire(import.meta.url);
const archiver = require("archiver");

const treeQuerySchema = z.object({
  scope: z.enum(["metadata", "raw"]),
  path: z.string().default(""),
});

const fileQuerySchema = z.object({
  scope: z.enum(["metadata", "raw"]),
  path: z.string().min(1),
  download: z
    .string()
    .optional()
    .transform(
      (value) =>
        value === "1" || value === "true",
    ),
});

const annotationQuerySchema = z.object({
  name: z.string().min(1),
});

const downloadSchema = z.object({
  clientId: z.string().uuid(),
  type: z.enum([
    "images",
    "labels",
    "both",
  ]),
});

type TreeItem = {
  name: string;
  path: string;
  type: "file" | "directory";
  size?: number;
  extension?: string;
};

type RequestWithUser =
  FastifyRequest & {
    user?: {
      role?: string;
    };
  };

function getRequestRole(
  request: FastifyRequest,
) {
  return (
    request as RequestWithUser
  ).user?.role;
}

function normalizeRelativePath(
  value: string,
) {
  const normalized =
    value.replaceAll("\\", "/");

  if (!normalized) {
    return "";
  }

  if (
    normalized.startsWith("/") ||
    /^[A-Za-z]:\//.test(normalized)
  ) {
    throw new Error(
      "Invalid path.",
    );
  }

  const parts =
    normalized.split("/");

  if (
    parts.some(
      (part) =>
        !part ||
        part === "." ||
        part === "..",
    )
  ) {
    throw new Error(
      "Invalid path.",
    );
  }

  return parts.join("/");
}

function ensureInsideRoot(
  root: string,
  relativePath: string,
) {
  const resolvedRoot =
    path.resolve(root);

  const resolvedPath =
    path.resolve(
      resolvedRoot,
      relativePath,
    );

  const relative =
    path.relative(
      resolvedRoot,
      resolvedPath,
    );

  if (
    relative === ".." ||
    relative.startsWith(
      `..${path.sep}`,
    ) ||
    path.isAbsolute(relative)
  ) {
    throw new Error(
      "Invalid path.",
    );
  }

  return resolvedPath;
}

async function getClient(
  clientId: string,
) {
  const result =
    await db.query(
      `
        SELECT id, name
        FROM clients
        WHERE id = $1
        LIMIT 1
      `,
      [clientId],
    );

  return result.rows[0] as
    | {
        id: string;
        name: string;
      }
    | undefined;
}

function getScopeRoot(
  clientName: string,
  scope: "metadata" | "raw",
) {
  return path.join(
    env.DATA_ROOT,
    scope,
    clientName,
  );
}

async function scopeExists(
  clientName: string,
  scope: "metadata" | "raw",
) {
  try {
    const stat =
      await fsp.stat(
        getScopeRoot(
          clientName,
          scope,
        ),
      );

    return stat.isDirectory();
  } catch {
    return false;
  }
}

async function hasFiles(
  root: string,
): Promise<boolean> {
  try {
    const entries =
      await fsp.readdir(root, {
        withFileTypes: true,
      });

    for (const entry of entries) {
      const fullPath =
        path.join(
          root,
          entry.name,
        );

      if (entry.isFile()) {
        return true;
      }

      if (entry.isDirectory()) {
        if (
          await hasFiles(fullPath)
        ) {
          return true;
        }
      }
    }

    return false;
  } catch {
    return false;
  }
}

async function getContentType(
  filePath: string,
) {
  const extension =
    path
      .extname(filePath)
      .toLowerCase();

  const types: Record<
    string,
    string
  > = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".bmp": "image/bmp",
    ".tif": "image/tiff",
    ".tiff": "image/tiff",
    ".svg": "image/svg+xml",
    ".txt":
      "text/plain; charset=utf-8",
    ".json":
      "application/json; charset=utf-8",
    ".csv":
      "text/csv; charset=utf-8",
    ".xml":
      "application/xml; charset=utf-8",
    ".pdf": "application/pdf",
  };

  return (
    types[extension] ??
    "application/octet-stream"
  );
}

async function buildTree(
  root: string,
  relativePath: string,
): Promise<TreeItem[]> {
  const directory =
    ensureInsideRoot(
      root,
      relativePath,
    );

  let entries: fs.Dirent[];

  try {
    entries =
      await fsp.readdir(
        directory,
        {
          withFileTypes: true,
        },
      );
  } catch {
    return [];
  }

  const result: TreeItem[] =
    [];

  for (const entry of entries) {
    const itemPath =
      joinRelativePath(
        relativePath,
        entry.name,
      );

    const fullPath =
      path.join(
        directory,
        entry.name,
      );

    if (entry.isDirectory()) {
      result.push({
        name: entry.name,
        path: itemPath,
        type: "directory",
      });

      continue;
    }

    if (entry.isFile()) {
      const stat =
        await fsp.stat(
          fullPath,
        );

      result.push({
        name: entry.name,
        path: itemPath,
        type: "file",
        size: stat.size,
        extension:
          path
            .extname(entry.name)
            .slice(1)
            .toLowerCase(),
      });
    }
  }

  return result.sort(
    (a, b) => {
      if (a.type !== b.type) {
        return a.type ===
          "directory"
          ? -1
          : 1;
      }

      return a.name.localeCompare(
        b.name,
        undefined,
        {
          numeric: true,
        },
      );
    },
  );
}

function joinRelativePath(
  parent: string,
  child: string,
) {
  return parent
    ? `${parent}/${child}`
    : child;
}

export async function registerDownloadRoutes(
  app: FastifyInstance,
) {
  app.get(
    "/api/download/clients",
    {
      preHandler: requireRole(
        "admin",
        "editor",
        "viewer",
      ),
    },
    async (request) => {
      const role =
        getRequestRole(request);

      const clientsResult =
        await db.query(`
          SELECT id, name
          FROM clients
          ORDER BY name
        `);

      const clients = [];

      for (const client of clientsResult.rows as {
        id: string;
        name: string;
      }[]) {
        const metadataRoot =
          getScopeRoot(
            client.name,
            "metadata",
          );

        const rawRoot =
          getScopeRoot(
            client.name,
            "raw",
          );

        const metadataHasFiles =
          await hasFiles(
            metadataRoot,
          );

        const rawHasFiles =
          await hasFiles(
            rawRoot,
          );

        if (
          role === "viewer" &&
          !metadataHasFiles
        ) {
          continue;
        }

        if (
          role !== "viewer" &&
          !metadataHasFiles &&
          !rawHasFiles
        ) {
          continue;
        }

        const countResult =
          await db.query(
            `
              SELECT COUNT(*)::int AS count
              FROM metadata
              WHERE client_id = $1
            `,
            [client.id],
          );

        clients.push({
          id: client.id,
          name: client.name,
          metadata_count:
            countResult.rows[0]
              ?.count ?? 0,
          has_metadata:
            metadataHasFiles,
          has_raw: rawHasFiles,
        });
      }

      return clients;
    },
  );

  app.get(
    "/api/download/:clientId/tree",
    {
      preHandler: requireRole(
        "admin",
        "editor",
        "viewer",
      ),
    },
    async (
      request,
      reply,
    ) => {
      const params =
        z.object({
          clientId:
            z.string().uuid(),
        }).parse(
          request.params,
        );

      const query =
        treeQuerySchema.parse(
          request.query,
        );

      const client =
        await getClient(
          params.clientId,
        );

      if (!client) {
        return reply
          .code(404)
          .send({
            message:
              "Client not found.",
          });
      }

      const role =
        getRequestRole(request);

      if (
        query.scope === "raw" &&
        role === "viewer"
      ) {
        return reply
          .code(403)
          .send({
            message:
              "Viewers cannot access raw data.",
          });
      }

      const root =
        getScopeRoot(
          client.name,
          query.scope,
        );

      const exists =
        await scopeExists(
          client.name,
          query.scope,
        );

      if (!exists) {
        return [];
      }

      return buildTree(
        root,
        normalizeRelativePath(
          query.path,
        ),
      );
    },
  );

  app.get(
    "/api/download/:clientId/file",
    {
      preHandler: requireRole(
        "admin",
        "editor",
        "viewer",
      ),
    },
    async (
      request,
      reply,
    ) => {
      const params =
        z.object({
          clientId:
            z.string().uuid(),
        }).parse(
          request.params,
        );

      const query =
        fileQuerySchema.parse(
          request.query,
        );

      const client =
        await getClient(
          params.clientId,
        );

      if (!client) {
        return reply
          .code(404)
          .send({
            message:
              "Client not found.",
          });
      }

      const role =
        getRequestRole(request);

      if (
        query.scope === "raw" &&
        role === "viewer"
      ) {
        return reply
          .code(403)
          .send({
            message:
              "Viewers cannot access raw data.",
          });
      }

      const relativePath =
        normalizeRelativePath(
          query.path,
        );

      const root =
        getScopeRoot(
          client.name,
          query.scope,
        );

      const filePath =
        ensureInsideRoot(
          root,
          relativePath,
        );

      let stat: fs.Stats;

      try {
        stat =
          await fsp.stat(
            filePath,
          );
      } catch {
        return reply
          .code(404)
          .send({
            message:
              "File not found.",
          });
      }

      if (!stat.isFile()) {
        return reply
          .code(400)
          .send({
            message:
              "Requested path is not a file.",
          });
      }

      const filename =
        path.basename(
          filePath,
        );

      reply.header(
        "Content-Type",
        await getContentType(
          filePath,
        ),
      );

      reply.header(
        "Content-Length",
        String(stat.size),
      );

      reply.header(
        "Content-Disposition",
        query.download
          ? `attachment; filename="${filename.replaceAll('"', "")}"`
          : `inline; filename="${filename.replaceAll('"', "")}"`,
      );

      reply.header(
        "Cache-Control",
        "private, no-store",
      );

      return reply.send(
        fs.createReadStream(
          filePath,
        ),
      );
    },
  );

  app.get(
    "/api/download/:clientId/annotation",
    {
      preHandler: requireRole(
        "admin",
        "editor",
        "viewer",
      ),
    },
    async (
      request,
      reply,
    ) => {
      const params =
        z.object({
          clientId:
            z.string().uuid(),
        }).parse(
          request.params,
        );

      const query =
        annotationQuerySchema.parse(
          request.query,
        );

      const result =
        await db.query(
          `
            SELECT
              m.id,
              m.name,
              m.annotation_type,
              m.annotations,
              m.image_hash,
              m.root_folders,
              m.original_root_folders,
              m.source_locations,
              v.id AS view_id,
              v.name AS view_name
            FROM metadata m
            INNER JOIN views v
              ON v.id = m.view_id
            WHERE
              m.client_id = $1
              AND m.name = $2
            ORDER BY v.name
          `,
          [
            params.clientId,
            path.basename(
              query.name,
            ),
          ],
        );

      if (
        result.rows.length ===
        0
      ) {
        return reply
          .code(404)
          .send({
            message:
              "No annotation was found for this file.",
          });
      }

      return result.rows.map(
        (row) => ({
          id: row.id,
          name: row.name,
          annotationType:
            row.annotation_type,
          annotations:
            row.annotations ?? [],
          imageHash:
            row.image_hash,
          rootFolders:
            row.root_folders ?? [],
          originalRootFolders:
            row.original_root_folders ??
            [],
          sourceLocations:
            row.source_locations ??
            [],
          view: {
            id: row.view_id,
            name: row.view_name,
          },
        }),
      );
    },
  );

  app.get(
    "/api/download/:clientId/:type",
    {
      preHandler: requireRole(
        "admin",
        "editor",
        "viewer",
      ),
    },
    async (
      request,
      reply,
    ) => {
      const params =
        downloadSchema.parse({
          clientId:
            (
              request.params as {
                clientId: string;
              }
            ).clientId,
          type:
            (
              request.params as {
                type: string;
              }
            ).type,
        });

      const client =
        await getClient(
          params.clientId,
        );

      if (!client) {
        return reply
          .code(404)
          .send({
            message:
              "Client not found.",
          });
      }

      const metadataRoot =
        getScopeRoot(
          client.name,
          "metadata",
        );

      const metadataExists =
        await scopeExists(
          client.name,
          "metadata",
        );

      if (!metadataExists) {
        return reply
          .code(404)
          .send({
            message:
              "No metadata is available for this client.",
          });
      }

      const metadataResult =
        await db.query(
          `
            SELECT
              name,
              image_hash
            FROM metadata
            WHERE client_id = $1
            ORDER BY name
          `,
          [params.clientId],
        );

      const archive =
        archiver("zip", {
          zlib: {
            level: 6,
          },
        });

      const filename =
        `${client.name}-${params.type}.zip`;

      reply.header(
        "Content-Type",
        "application/zip",
      );

      reply.header(
        "Content-Disposition",
        `attachment; filename="${filename.replaceAll('"', "")}"`,
      );

      reply.header(
        "Cache-Control",
        "private, no-store",
      );

      archive.on(
        "error",
        (error: Error) => {
          request.log.error(
            error,
          );
          archive.destroy(
            error,
          );
        },
      );

      archive.pipe(
        reply.raw,
      );

      for (const row of metadataResult.rows as {
        name: string;
        image_hash:
          | string
          | null;
      }[]) {
        if (
          params.type ===
            "images" ||
          params.type === "both"
        ) {
          const imagePath =
            getMetadataImagePath(
              client.name,
              row.name,
            );

          try {
            await fsp.access(
              imagePath,
              fs.constants.F_OK,
            );

            archive.file(
              imagePath,
              {
                name: `images/${row.name}`,
              },
            );
          } catch {}
        }

        if (
          params.type ===
            "labels" ||
          params.type === "both"
        ) {
          const labelPath =
            getMetadataLabelPath(
              client.name,
              row.name,
            );

          try {
            await fsp.access(
              labelPath,
              fs.constants.F_OK,
            );

            archive.file(
              labelPath,
              {
                name: `labels/${path.basename(
                  row.name,
                  path.extname(
                    row.name,
                  ),
                )}.txt`,
              },
            );
          } catch {}
        }
      }

      await archive.finalize();
    },
  );
}