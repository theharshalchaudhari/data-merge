import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { db } from "../../db/client.js";
import {
  getRawClientPath,
  getMetadataImagePath,
  getMetadataLabelPath,
} from "../../storage/paths.js";
import { scanDatasetFolder } from "./scanner.js";
import { validateYoloAnnotations } from "./validator.js";

async function sha256File(
  filePath: string,
): Promise<string> {
  const buffer = await fs.readFile(filePath);

  return crypto
    .createHash("sha256")
    .update(buffer)
    .digest("hex");
}

function normalizePath(
  value: string,
): string {
  return value
    .replaceAll("\\", "/")
    .replace(/^\/+/, "");
}

function getRootFolder(
  relativePath: string,
): string {
  const normalized =
    normalizePath(relativePath);

  const firstSlash =
    normalized.indexOf("/");

  if (firstSlash === -1) {
    return normalized;
  }

  return normalized.slice(
    0,
    firstSlash,
  );
}

function dedupeAnnotations(
  annotations: unknown[],
): unknown[] {
  const seen = new Set<string>();
  const result: unknown[] = [];

  for (const annotation of annotations) {
    const key = JSON.stringify(
      annotation,
    );

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(annotation);
  }

  return result;
}

function annotationsToYolo(
  annotations: unknown[],
): string {
  const lines: string[] = [];

  for (const annotation of annotations) {
    const item = annotation as {
      geometry?: {
        format?: string;
        values?: unknown;
      };
    };

    const values =
      item.geometry?.values;

    if (
      !Array.isArray(values) ||
      values.length !== 5
    ) {
      continue;
    }

    if (
      !values.every(
        (value) =>
          typeof value === "number" &&
          Number.isFinite(value),
      )
    ) {
      continue;
    }

    lines.push(values.join(" "));
  }

  return lines.length > 0
    ? `${lines.join("\n")}\n`
    : "";
}

function uniqueStrings(
  values: unknown[],
): string[] {
  return Array.from(
    new Set(
      values.filter(
        (
          value,
        ): value is string =>
          typeof value === "string" &&
          value.length > 0,
      ),
    ),
  );
}

async function fileExists(
  filePath: string,
): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function validateDataset(
  stagingPath: string,
) {
  const scan =
    await scanDatasetFolder(
      stagingPath,
    );

  const errors: Array<{
    file: string;
    message: string;
  }> = [];

  let annotationRows = 0;

  for (const item of scan.images) {
    if (!item.labelPath) {
      errors.push({
        file: item.relativePath,
        message:
          "Missing YOLO annotation.",
      });

      continue;
    }

    const labelContent =
      await fs.readFile(
        item.labelPath,
        "utf8",
      );

    const validation =
      validateYoloAnnotations(
        labelContent,
      );

    if (!validation.valid) {
      errors.push({
        file: item.relativePath,
        message:
          validation.errors.join("; "),
      });

      continue;
    }

    annotationRows +=
      validation.annotationCount;
  }

  for (const orphan of scan.orphanLabels) {
    errors.push({
      file: orphan,
      message:
        "Annotation has no matching image.",
    });
  }

  return {
    scan,
    errors,
    annotationRows,
  };
}

export async function uploadDataset(
  input: {
    stagingPath: string;
    clientId: string;
    viewId: string;
    rootFolder: string;
  },
) {
  const {
    stagingPath,
    clientId,
    viewId,
    rootFolder,
  } = input;

  const clientResult =
    await db.query(
      `
        SELECT
          id,
          name
        FROM clients
        WHERE id = $1
        LIMIT 1
      `,
      [clientId],
    );

  const client =
    clientResult.rows[0];

  if (!client) {
    throw new Error(
      "Selected client was not found.",
    );
  }

  const viewResult =
    await db.query(
      `
        SELECT
          id,
          name
        FROM views
        WHERE id = $1
        LIMIT 1
      `,
      [viewId],
    );

  const view =
    viewResult.rows[0];

  if (!view) {
    throw new Error(
      "Selected view was not found.",
    );
  }

  const validation =
    await validateDataset(
      stagingPath,
    );

  if (
    validation.scan.images
      .length === 0
  ) {
    throw new Error(
      "No supported images were uploaded.",
    );
  }

  if (
    validation.errors.length > 0
  ) {
    const error = new Error(
      "Dataset validation failed.",
    );

    Object.assign(error, {
      validationErrors:
        validation.errors,
    });

    throw error;
  }

  const expectedRoot =
    rootFolder.trim();

  if (!expectedRoot) {
    throw new Error(
      "Dataset root folder is required.",
    );
  }

  for (const item of
    validation.scan.images) {
    const normalized =
      normalizePath(
        item.relativePath,
      );

    const root =
      getRootFolder(normalized);

    if (root !== expectedRoot) {
      throw new Error(
        `Uploaded file "${normalized}" does not belong to the selected dataset folder "${expectedRoot}".`,
      );
    }
  }

  const rawClientPath =
    getRawClientPath(
      client.name,
    );

  let uploaded = 0;
  let merged = 0;
  let skipped = 0;
  let conflicts = 0;
  let annotationCount = 0;

  for (const item of
    validation.scan.images) {
    if (!item.labelPath) {
      continue;
    }

    const relativePath =
      normalizePath(
        item.relativePath,
      );

    const imageName =
      path.basename(relativePath);

    const labelRelativePath =
      relativePath.replace(
        /\.[^.]+$/,
        ".txt",
      );

    const imageHash =
      await sha256File(
        item.imagePath,
      );

    const labelContent =
      await fs.readFile(
        item.labelPath,
        "utf8",
      );

    const annotationValidation =
      validateYoloAnnotations(
        labelContent,
      );

    if (
      !annotationValidation.valid
    ) {
      throw new Error(
        `Validation failed for ${relativePath}.`,
      );
    }

    const rawImagePath =
      path.join(
        rawClientPath,
        relativePath,
      );

    const rawLabelPath =
      path.join(
        rawClientPath,
        labelRelativePath,
      );

    const metadataImagePath =
      getMetadataImagePath(
        client.name,
        imageName,
      );

    const metadataLabelPath =
      getMetadataLabelPath(
        client.name,
        imageName,
      );

    const existingResult =
      await db.query(
        `
          SELECT
            id,
            name,
            image_hash,
            annotations,
            root_folders,
            original_root_folders,
            source_locations
          FROM metadata
          WHERE client_id = $1
            AND name = $2
          LIMIT 1
        `,
        [
          clientId,
          imageName,
        ],
      );

    const existing =
      existingResult.rows[0];

    if (!existing) {
      const rawImageExists =
        await fileExists(
          rawImagePath,
        );

      const rawLabelExists =
        await fileExists(
          rawLabelPath,
        );

      if (
        rawImageExists ||
        rawLabelExists
      ) {
        const existingRawHash =
          rawImageExists
            ? await sha256File(
                rawImagePath,
              )
            : null;

        if (
          existingRawHash &&
          existingRawHash !== imageHash
        ) {
          conflicts++;
          continue;
        }

        if (
          existingRawHash === imageHash
        ) {
          const rawLabelContent =
            rawLabelExists
              ? await fs.readFile(
                  rawLabelPath,
                  "utf8",
                )
              : "";

          const rawValidation =
            validateYoloAnnotations(
              rawLabelContent,
            );

          if (!rawValidation.valid) {
            conflicts++;
            continue;
          }

          const annotations =
            dedupeAnnotations([
              ...rawValidation.annotations,
              ...annotationValidation.annotations,
            ]);

          await fs.mkdir(
            path.dirname(
              rawLabelPath,
            ),
            {
              recursive: true,
            },
          );

          await fs.writeFile(
            rawLabelPath,
            annotationsToYolo(
              annotations,
            ),
            "utf8",
          );

          await fs.mkdir(
            path.dirname(
              metadataImagePath,
            ),
            {
              recursive: true,
            },
          );

          await fs.mkdir(
            path.dirname(
              metadataLabelPath,
            ),
            {
              recursive: true,
            },
          );

          await fs.copyFile(
            rawImagePath,
            metadataImagePath,
          );

          await fs.writeFile(
            metadataLabelPath,
            annotationsToYolo(
              annotations,
            ),
            "utf8",
          );

          const metadataAnnotations =
            annotations;

          await db.query(
            `
              INSERT INTO metadata (
                id,
                client_id,
                view_id,
                name,
                annotation_type,
                annotations,
                image_hash,
                root_folders,
                original_root_folders,
                source_locations,
                description
              )
              VALUES (
                gen_random_uuid(),
                $1,
                $2,
                $3,
                $4,
                $5::jsonb,
                $6,
                $7::text[],
                $8::text[],
                $9::text[],
                NULL
              )
            `,
            [
              clientId,
              viewId,
              imageName,
              "bbox",
              JSON.stringify(
                metadataAnnotations,
              ),
              imageHash,
              [rootFolder],
              [rootFolder],
              [relativePath],
            ],
          );

          uploaded++;
          annotationCount +=
            annotationValidation.annotationCount;

          continue;
        }

        if (!rawImageExists) {
          await fs.mkdir(
            path.dirname(
              rawImagePath,
            ),
            {
              recursive: true,
            },
          );

          await fs.copyFile(
            item.imagePath,
            rawImagePath,
          );
        }

        if (!rawLabelExists) {
          await fs.mkdir(
            path.dirname(
              rawLabelPath,
            ),
            {
              recursive: true,
            },
          );

          await fs.copyFile(
            item.labelPath,
            rawLabelPath,
          );
        }
      } else {
        await fs.mkdir(
          path.dirname(
            rawImagePath,
          ),
          {
            recursive: true,
          },
        );

        await fs.mkdir(
          path.dirname(
            rawLabelPath,
          ),
          {
            recursive: true,
          },
        );

        await fs.copyFile(
          item.imagePath,
          rawImagePath,
        );

        await fs.copyFile(
          item.labelPath,
          rawLabelPath,
        );
      }

      await fs.mkdir(
        path.dirname(
          metadataImagePath,
        ),
        {
          recursive: true,
        },
      );

      await fs.mkdir(
        path.dirname(
          metadataLabelPath,
        ),
        {
          recursive: true,
        },
      );

      await fs.copyFile(
        item.imagePath,
        metadataImagePath,
      );

      await fs.writeFile(
        metadataLabelPath,
        labelContent,
        "utf8",
      );

      const annotations =
        annotationValidation.annotations;

      await db.query(
        `
          INSERT INTO metadata (
            id,
            client_id,
            view_id,
            name,
            annotation_type,
            annotations,
            image_hash,
            root_folders,
            original_root_folders,
            source_locations,
            description
          )
          VALUES (
            gen_random_uuid(),
            $1,
            $2,
            $3,
            $4,
            $5::jsonb,
            $6,
            $7::text[],
            $8::text[],
            $9::text[],
            NULL
          )
        `,
        [
          clientId,
          viewId,
          imageName,
          "bbox",
          JSON.stringify(
            annotations,
          ),
          imageHash,
          [rootFolder],
          [rootFolder],
          [relativePath],
        ],
      );

      uploaded++;
      annotationCount +=
        annotationValidation.annotationCount;

      continue;
    }

    if (
      existing.image_hash !==
      imageHash
    ) {
      conflicts++;
      continue;
    }

    const existingAnnotations =
      Array.isArray(
        existing.annotations,
      )
        ? existing.annotations
        : [];

    const mergedAnnotations =
      dedupeAnnotations([
        ...existingAnnotations,
        ...annotationValidation.annotations,
      ]);

    const rootFolders =
      uniqueStrings([
        ...(Array.isArray(
          existing.root_folders,
        )
          ? existing.root_folders
          : []),
        rootFolder,
      ]);

    const originalRootFolders =
      uniqueStrings([
        ...(Array.isArray(
          existing.original_root_folders,
        )
          ? existing.original_root_folders
          : []),
        rootFolder,
      ]);

    const sourceLocations =
      uniqueStrings([
        ...(Array.isArray(
          existing.source_locations,
        )
          ? existing.source_locations
          : []),
        relativePath,
      ]);

    await db.query(
      `
        UPDATE metadata
        SET
          annotations = $1::jsonb,
          root_folders = $2::text[],
          original_root_folders = $3::text[],
          source_locations = $4::text[],
          view_id = $5,
          updated_at = now()
        WHERE id = $6
      `,
      [
        JSON.stringify(
          mergedAnnotations,
        ),
        rootFolders,
        originalRootFolders,
        sourceLocations,
        viewId,
        existing.id,
      ],
    );

    await fs.mkdir(
      path.dirname(
        metadataLabelPath,
      ),
      {
        recursive: true,
      },
    );

    await fs.writeFile(
      metadataLabelPath,
      annotationsToYolo(
        mergedAnnotations,
      ),
      "utf8",
    );

    if (
      !(await fileExists(
        metadataImagePath,
      ))
    ) {
      const rawImageExists =
        await fileExists(
          rawImagePath,
        );

      if (rawImageExists) {
        await fs.mkdir(
          path.dirname(
            metadataImagePath,
          ),
          {
            recursive: true,
          },
        );

        await fs.copyFile(
          rawImagePath,
          metadataImagePath,
        );
      } else {
        await fs.mkdir(
          path.dirname(
            metadataImagePath,
          ),
          {
            recursive: true,
          },
        );

        await fs.copyFile(
          item.imagePath,
          metadataImagePath,
        );
      }
    }

    if (
      !(await fileExists(
        rawImagePath,
      ))
    ) {
      await fs.mkdir(
        path.dirname(
          rawImagePath,
        ),
        {
          recursive: true,
        },
      );

      await fs.copyFile(
        item.imagePath,
        rawImagePath,
      );
    }

    if (
      !(await fileExists(
        rawLabelPath,
      ))
    ) {
      await fs.mkdir(
        path.dirname(
          rawLabelPath,
        ),
        {
          recursive: true,
        },
      );

      await fs.writeFile(
        rawLabelPath,
        annotationsToYolo(
          mergedAnnotations,
        ),
        "utf8",
      );
    }

    merged++;
    annotationCount +=
      annotationValidation.annotationCount;
  }

  skipped =
    validation.scan.images.length -
    uploaded -
    merged -
    conflicts;

  return {
    uploaded,
    merged,
    skipped,
    conflicts,
    annotationCount,
    images:
      validation.scan.images.length,
    annotationFiles:
      validation.scan.images.filter(
        (item) =>
          item.labelPath !== null,
      ).length,
  };
}