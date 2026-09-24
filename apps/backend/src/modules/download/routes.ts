import path from "node:path";
import { createRequire } from "node:module";
import type { FastifyInstance } from "fastify";

import { db } from "../../db/client.js";
import { requireRole } from "../auth/guard.js";
import {
  getMetadataImagePath,
  getMetadataLabelPath,
} from "../../storage/paths.js";

const require = createRequire(import.meta.url);

type ArchiverInstance = {
  file(
    filepath: string,
    data?: {
      name?: string;
    },
  ): ArchiverInstance;

  pipe(destination: NodeJS.WritableStream): NodeJS.WritableStream;

  on(
    event: "error",
    listener: (error: Error) => void,
  ): ArchiverInstance;

  finalize(): Promise<void>;
};

type ArchiverFactory = (
  format: "zip",
  options?: {
    zlib?: {
      level?: number;
    };
  },
) => ArchiverInstance;

const archiver =
  require("archiver") as ArchiverFactory;

export async function registerDownloadRoutes(
  app: FastifyInstance,
) {
  app.get(
    "/api/download/:id",
    {
      preHandler: requireRole(
        "admin",
        "editor",
        "viewer",
      ),
    },
    async (request, reply) => {
      const params = request.params as {
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
        [params.id],
      );

      const record = result.rows[0];

      if (!record) {
        return reply
          .code(404)
          .send({
            message: "Metadata not found.",
          });
      }

      const imagePath = getMetadataImagePath(
        record.client_name,
        record.name,
      );

      const labelPath = getMetadataLabelPath(
        record.client_name,
        record.name,
      );

      const archive = archiver("zip", {
        zlib: {
          level: 6,
        },
      });

      archive.on(
        "error",
        (error: Error) => {
          request.log.error(error);
        },
      );

      archive.file(imagePath, {
        name: record.name,
      });

      archive.file(labelPath, {
        name: `${path.parse(record.name).name}.txt`,
      });

      reply.header(
        "Content-Type",
        "application/zip",
      );

      reply.header(
        "Content-Disposition",
        `attachment; filename="${path.parse(record.name).name}.zip"`,
      );

      archive.pipe(reply.raw);

      await archive.finalize();
    },
  );
}