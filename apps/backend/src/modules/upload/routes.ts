import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import type { FastifyInstance } from "fastify";
import {
  requireRole,
} from "../auth/guard.js";
import {
  uploadDataset,
} from "./service.js";

function normalizeUploadPath(
  filename: string,
): string {
  return filename.replaceAll("\\", "/");
}

function validateRelativePath(
  filename: string,
): string {
  const normalized = normalizeUploadPath(
    filename,
  );

  if (!normalized) {
    throw new Error(
      "Uploaded file has no filename.",
    );
  }

  if (normalized.includes("\0")) {
    throw new Error("Invalid filename.");
  }

  if (
    normalized.startsWith("/") ||
    /^[A-Za-z]:\//.test(normalized)
  ) {
    throw new Error(
      "Absolute file paths are not allowed.",
    );
  }

  const parts = normalized.split("/");

  if (
    parts.some(
      (part) =>
        part === ".." ||
        part === ".",
    )
  ) {
    throw new Error(
      "Invalid relative file path.",
    );
  }

  if (
    parts.some(
      (part) => part.length === 0,
    )
  ) {
    throw new Error(
      "Invalid relative file path.",
    );
  }

  return normalized;
}

function parseRelativePaths(
  value: unknown,
): string[] {
  if (typeof value !== "string" || !value) {
    throw new Error(
      "Upload relative path manifest is required.",
    );
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error(
      "Invalid upload relative path manifest.",
    );
  }

  if (!Array.isArray(parsed)) {
    throw new Error(
      "Upload relative path manifest must be an array.",
    );
  }

  const paths = parsed.map((item) => {
    if (typeof item !== "string") {
      throw new Error(
        "Invalid relative path in upload manifest.",
      );
    }

    return validateRelativePath(item);
  });

  const uniquePaths = new Set(paths);

  if (uniquePaths.size !== paths.length) {
    throw new Error(
      "Duplicate relative paths were found in the upload manifest.",
    );
  }

  return paths;
}

export async function registerUploadRoutes(
  app: FastifyInstance,
) {
  app.post(
    "/api/upload",
    {
      preHandler: requireRole(
        "admin",
        "editor",
      ),
    },
    async (request, reply) => {
      const stagingPath =
        await fsp.mkdtemp(
          path.join(
            os.tmpdir(),
            "data-manage-upload-",
          ),
        );

      let clientId = "";
      let viewId = "";
      let rootFolder = "";
      let relativePaths: string[] | null =
        null;
      let fileCount = 0;

      try {
        const parts = request.parts({
          limits: {
            files: 10000,
            parts: 20000,
          },
        });

        for await (const part of parts) {
          if (part.type === "field") {
            const value = String(
              part.value ?? "",
            );

            if (
              part.fieldname ===
              "clientId"
            ) {
              clientId = value;
            } else if (
              part.fieldname ===
              "viewId"
            ) {
              viewId = value;
            } else if (
              part.fieldname ===
              "rootFolder"
            ) {
              rootFolder = value;
            } else if (
              part.fieldname ===
              "relativePaths"
            ) {
              relativePaths =
                parseRelativePaths(value);
            }

            continue;
          }

          if (!relativePaths) {
            throw new Error(
              "Upload relative path manifest must be provided before files.",
            );
          }

          if (
            fileCount >=
            relativePaths.length
          ) {
            throw new Error(
              "More uploaded files were provided than paths in the upload manifest.",
            );
          }

          const relativePath =
            relativePaths[fileCount];

          const stagingRoot =
            path.resolve(stagingPath);

          const destination =
            path.resolve(
              stagingRoot,
              relativePath,
            );

          const relativeDestination =
            path.relative(
              stagingRoot,
              destination,
            );

          if (
            relativeDestination === "" ||
            relativeDestination.startsWith(
              `..${path.sep}`,
            ) ||
            path.isAbsolute(
              relativeDestination,
            )
          ) {
            throw new Error(
              "Uploaded file path escapes the staging directory.",
            );
          }

          await fsp.mkdir(
            path.dirname(destination),
            {
              recursive: true,
            },
          );

          await pipeline(
            part.file,
            fs.createWriteStream(
              destination,
              {
                flags: "wx",
              },
            ),
          );

          if (part.file.truncated) {
            throw new Error(
              `File "${relativePath}" exceeded the upload size limit.`,
            );
          }

          fileCount++;
        }

        if (!clientId) {
          return reply.code(400).send({
            message:
              "Client is required.",
          });
        }

        if (!viewId) {
          return reply.code(400).send({
            message:
              "View is required.",
          });
        }

        if (!rootFolder) {
          return reply.code(400).send({
            message:
              "Dataset root folder is required.",
          });
        }

        if (!relativePaths) {
          return reply.code(400).send({
            message:
              "Upload relative path manifest is required.",
          });
        }

        if (fileCount === 0) {
          return reply.code(400).send({
            message:
              "No files were uploaded.",
          });
        }

        if (
          fileCount !==
          relativePaths.length
        ) {
          return reply.code(400).send({
            message:
              `Upload file count (${fileCount}) does not match the relative path manifest count (${relativePaths.length}).`,
          });
        }

        const result =
          await uploadDataset({
            stagingPath,
            clientId,
            viewId,
            rootFolder,
          });

        return reply.send(result);
      } catch (error) {
        request.log.error(error);

        const validationErrors =
          error &&
          typeof error === "object" &&
          "validationErrors" in error
            ? (
                error as {
                  validationErrors: unknown;
                }
              ).validationErrors
            : undefined;

        return reply
          .code(
            validationErrors
              ? 422
              : 400,
          )
          .send({
            message:
              error instanceof Error
                ? error.message
                : "Dataset upload failed.",
            ...(validationErrors
              ? { validationErrors }
              : {}),
          });
      } finally {
        await fsp.rm(
          stagingPath,
          {
            recursive: true,
            force: true,
          },
        );
      }
    },
  );
}