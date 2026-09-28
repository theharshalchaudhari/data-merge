import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

import type {
  FastifyInstance,
  FastifyRequest,
} from "fastify";

import { z } from "zod";

import { env } from "../../config/env.js";
import { db } from "../../db/client.js";

import {
  getMetadataImagePath,
  getMetadataLabelPath,
} from "../../storage/paths.js";

import { requireRole } from "../auth/guard.js";

const require = createRequire(
  import.meta.url,
);

const archiver = require("archiver");

const treeQuerySchema = z.object({
  scope: z.enum([
    "metadata",
    "raw",
  ]),
  path: z.string().default(""),
});

const fileQuerySchema = z.object({
  scope: z.enum([
    "metadata",
    "raw",
  ]),
  path: z.string().min(1),
  download: z
    .string()
    .optional()
    .transform(
      (value) =>
        value === "1" ||
        value === "true",
    ),
});

const annotationQuerySchema =
  z.object({
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

const metadataDownloadSchema =
  z.object({
    client: z
      .string()
      .trim()
      .optional()
      .default(""),

    view: z
      .string()
      .trim()
      .optional()
      .default(""),

    name: z
      .string()
      .trim()
      .optional()
      .default(""),

    classes: z
      .string()
      .trim()
      .optional()
      .default(""),

    datasetTypeId: z
      .string()
      .uuid()
      .optional(),
  });

type TreeItem = {
  name: string;
  path: string;
  type:
    | "file"
    | "directory";
  size?: number;
  extension?: string;
};

type RequestWithUser =
  FastifyRequest & {
    user?: {
      role?: string;
    };
  };

type MetadataAnnotation = {
  class_name: string;
  center_x: number;
  center_y: number;
  width: number;
  height: number;
};

type MetadataDownloadRow = {
  id: string;
  client_name: string;
  view_name: string;
  name: string;
  annotations:
    | MetadataAnnotation[]
    | null;
};

type DatasetClassRow = {
  class_id: number;
  class_name: string;
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
  scope:
    | "metadata"
    | "raw",
) {
  return path.join(
    env.DATA_ROOT,
    scope,
    clientName,
  );
}

async function scopeExists(
  clientName: string,
  scope:
    | "metadata"
    | "raw",
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
    ".pdf":
      "application/pdf",
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

function parseClassFilter(
  value: string,
) {
  return Array.from(
    new Set(
      value
        .split(",")
        .map(
          (item) =>
            item.trim(),
        )
        .filter(Boolean),
    ),
  );
}

function isMetadataAnnotation(
  value: unknown,
): value is MetadataAnnotation {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return false;
  }

  const annotation =
    value as Partial<MetadataAnnotation>;

  return (
    typeof annotation.class_name ===
      "string" &&
    typeof annotation.center_x ===
      "number" &&
    typeof annotation.center_y ===
      "number" &&
    typeof annotation.width ===
      "number" &&
    typeof annotation.height ===
      "number"
  );
}

function normalizeMetadataAnnotations(
  value: unknown,
) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    isMetadataAnnotation,
  );
}

function sanitizeArchiveSegment(
  value: string,
) {
  return (
    value
      .replaceAll("\\", "_")
      .replaceAll("/", "_")
      .replaceAll("..", "_")
      .replaceAll(
        /[<>:"|?*\x00-\x1f]/g,
        "_",
      )
      .trim() ||
    "unknown"
  );
}

function sanitizeArchiveFileName(
  value: string,
) {
  const basename =
    path.basename(value);

  return sanitizeArchiveSegment(
    basename,
  );
}

function createLabelContent(
  annotations: MetadataAnnotation[],
  classMap: Map<
    string,
    number
  >,
) {
  const lines: string[] = [];

  for (const annotation of annotations) {
    const classId =
      classMap.get(
        annotation.class_name,
      );

    if (
      classId === undefined
    ) {
      continue;
    }

    lines.push(
      [
        classId,
        annotation.center_x,
        annotation.center_y,
        annotation.width,
        annotation.height,
      ]
        .map(String)
        .join(" "),
    );
  }

  return lines.length > 0
    ? `${lines.join("\n")}\n`
    : "";
}

async function getFilteredMetadata(
  query: z.infer<
    typeof metadataDownloadSchema
  >,
) {
  const classNames =
    parseClassFilter(
      query.classes,
    );

  const values: unknown[] = [];

  const conditions: string[] = [];

  if (query.client) {
    values.push(query.client);
    conditions.push(
      `c.name = $${values.length}`,
    );
  }

  if (query.view) {
    values.push(query.view);
    conditions.push(
      `v.name = $${values.length}`,
    );
  }

  if (query.name) {
    values.push(
      `%${query.name}%`,
    );
    conditions.push(
      `m.name ILIKE $${values.length}`,
    );
  }

  if (classNames.length > 0) {
    values.push(classNames);
    conditions.push(`
      EXISTS (
        SELECT 1
        FROM jsonb_array_elements(
          CASE
            WHEN jsonb_typeof(m.annotations) = 'array'
            THEN m.annotations
            ELSE '[]'::jsonb
          END
        ) AS annotation
        WHERE annotation->>'class_name' = ANY($${values.length}::text[])
      )
    `);
  }

  const whereClause =
    conditions.length > 0
      ? `WHERE ${conditions.join(
          "\nAND ",
        )}`
      : "";

  const result =
    await db.query(
      `
        SELECT
          m.id,
          c.name AS client_name,
          v.name AS view_name,
          m.name,
          m.annotations
        FROM metadata m
        INNER JOIN clients c
          ON c.id = m.client_id
        INNER JOIN views v
          ON v.id = m.view_id
        ${whereClause}
        ORDER BY
          c.name,
          v.name,
          m.name
      `,
      values,
    );

  return {
    rows:
      result.rows as MetadataDownloadRow[],
    classNames,
  };
}

async function getDatasetType(
  datasetTypeId: string,
) {
  const result =
    await db.query(
      `
        SELECT
          id,
          name
        FROM dataset_types
        WHERE id = $1
        LIMIT 1
      `,
      [datasetTypeId],
    );

  return result.rows[0] as
    | {
        id: string;
        name: string;
      }
    | undefined;
}

async function getDatasetClassMap(
  datasetTypeId: string,
) {
  const result =
    await db.query(
      `
        SELECT
          class_id,
          class_name
        FROM dataset_type_classes
        WHERE dataset_type_id = $1
        ORDER BY class_id
      `,
      [datasetTypeId],
    );

  const map =
    new Map<
      string,
      number
    >();

  for (
    const row of result.rows as DatasetClassRow[]
  ) {
    map.set(
      row.class_name,
      Number(row.class_id),
    );
  }

  return map;
}

function getExportAnnotations(
  annotations: MetadataAnnotation[],
  classFilter: string[],
) {
  if (
    classFilter.length === 0
  ) {
    return annotations;
  }

  const selected =
    new Set(classFilter);

  return annotations.filter(
    (annotation) =>
      selected.has(
        annotation.class_name,
      ),
  );
}

async function appendImageToArchive(
  archive: any,
  clientName: string,
  viewName: string,
  imageName: string,
) {
  const imagePath =
    getMetadataImagePath(
      clientName,
      imageName,
    );

  try {
    const stat =
      await fsp.stat(
        imagePath,
      );

    if (!stat.isFile()) {
      return false;
    }
  } catch {
    return false;
  }

  const safeView =
    sanitizeArchiveSegment(
      viewName,
    );

  const safeName =
    sanitizeArchiveFileName(
      imageName,
    );

  archive.file(
    imagePath,
    {
      name: `images/${safeView}/${safeName}`,
    },
  );

  return true;
}

async function appendDatasetEntry(
  archive: any,
  clientName: string,
  viewName: string,
  imageName: string,
  annotations: MetadataAnnotation[],
  classMap: Map<
    string,
    number
  >,
  classFilter: string[],
) {
  const imagePath =
    getMetadataImagePath(
      clientName,
      imageName,
    );

  try {
    const stat =
      await fsp.stat(
        imagePath,
      );

    if (!stat.isFile()) {
      return false;
    }
  } catch {
    return false;
  }

  const filteredAnnotations =
    getExportAnnotations(
      annotations,
      classFilter,
    );

  const labelContent =
    createLabelContent(
      filteredAnnotations,
      classMap,
    );

  const safeView =
    sanitizeArchiveSegment(
      viewName,
    );

  const safeImageName =
    sanitizeArchiveFileName(
      imageName,
    );

  const stem =
    path.basename(
      safeImageName,
      path.extname(
        safeImageName,
      ),
    );

  archive.file(
    imagePath,
    {
      name: `images/${safeView}/${safeImageName}`,
    },
  );

  archive.append(
    labelContent,
    {
      name: `labels/${safeView}/${stem}.txt`,
    },
  );

  return true;
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

      for (
        const client of clientsResult.rows as {
          id: string;
          name: string;
        }[]
      ) {
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

      for (
        const row of metadataResult.rows as {
          name: string;
          image_hash:
            | string
            | null;
        }[]
      ) {
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

  app.get(
    "/api/metadata-download/images",
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
      const query =
        metadataDownloadSchema.parse(
          request.query,
        );

      const {
        rows,
      } =
        await getFilteredMetadata(
          query,
        );

      if (rows.length === 0) {
        return reply
          .code(404)
          .send({
            message:
              "No metadata matched the selected filters.",
          });
      }

      const archive =
        archiver("zip", {
          zlib: {
            level: 6,
          },
        });

      const filename =
        "metadata-images.zip";

      reply.header(
        "Content-Type",
        "application/zip",
      );

      reply.header(
        "Content-Disposition",
        `attachment; filename="${filename}"`,
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

      let addedCount = 0;

      for (const row of rows) {
        const added =
          await appendImageToArchive(
            archive,
            row.client_name,
            row.view_name,
            row.name,
          );

        if (added) {
          addedCount++;
        }
      }

      if (addedCount === 0) {
        archive.abort();

        return reply
          .code(404)
          .send({
            message:
              "No image files were found for the selected metadata.",
          });
      }

      await archive.finalize();
    },
  );

  app.get(
    "/api/metadata-download/dataset",
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
      const query =
        metadataDownloadSchema.parse(
          request.query,
        );

      if (
        !query.datasetTypeId
      ) {
        return reply
          .code(400)
          .send({
            message:
              "Dataset type is required.",
          });
      }

      const datasetType =
        await getDatasetType(
          query.datasetTypeId,
        );

      if (!datasetType) {
        return reply
          .code(404)
          .send({
            message:
              "Dataset type not found.",
          });
      }

      const classMap =
        await getDatasetClassMap(
          query.datasetTypeId,
        );

      if (
        classMap.size === 0
      ) {
        return reply
          .code(400)
          .send({
            message:
              "The selected dataset type has no class mappings.",
          });
      }

      const {
        rows,
        classNames,
      } =
        await getFilteredMetadata(
          query,
        );

      if (rows.length === 0) {
        return reply
          .code(404)
          .send({
            message:
              "No metadata matched the selected filters.",
          });
      }

      const archive =
        archiver("zip", {
          zlib: {
            level: 6,
          },
        });

      const safeDatasetType =
        sanitizeArchiveSegment(
          datasetType.name,
        );

      const filename =
        `metadata-${safeDatasetType}-dataset.zip`;

      reply.header(
        "Content-Type",
        "application/zip",
      );

      reply.header(
        "Content-Disposition",
        `attachment; filename="${filename}"`,
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

      let addedCount = 0;

      for (const row of rows) {
        const annotations =
          normalizeMetadataAnnotations(
            row.annotations,
          );

        const added =
          await appendDatasetEntry(
            archive,
            row.client_name,
            row.view_name,
            row.name,
            annotations,
            classMap,
            classNames,
          );

        if (added) {
          addedCount++;
        }
      }

      if (addedCount === 0) {
        archive.abort();

        return reply
          .code(404)
          .send({
            message:
              "No image files were found for the selected metadata.",
          });
      }

      await archive.finalize();
    },
  );
}