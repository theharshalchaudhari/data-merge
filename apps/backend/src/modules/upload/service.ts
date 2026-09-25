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

type YoloAnnotation = {
  class_id: number;
  center_x: number;
  center_y: number;
  width: number;
  height: number;
};

function normalizePath(value: string): string {
  return value
    .replaceAll("\\", "/")
    .replace(/^\/+/, "");
}

function getRootFolder(relativePath: string): string {
  const normalized = normalizePath(relativePath);
  const firstSlash = normalized.indexOf("/");

  if (firstSlash === -1) {
    return normalized;
  }

  return normalized.slice(0, firstSlash);
}

async function sha256File(
  filePath: string,
): Promise<string> {
  const buffer = await fs.readFile(filePath);

  return crypto
    .createHash("sha256")
    .update(buffer)
    .digest("hex");
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

function parseYoloAnnotations(
  content: string,
): YoloAnnotation[] {
  const annotations: YoloAnnotation[] = [];

  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const parts = line.split(/\s+/);

    if (parts.length !== 5) {
      throw new Error(
        `Invalid YOLO annotation: expected 5 values, received ${parts.length}.`,
      );
    }

    const classId = Number(parts[0]);
    const centerX = Number(parts[1]);
    const centerY = Number(parts[2]);
    const width = Number(parts[3]);
    const height = Number(parts[4]);

    if (
      !Number.isInteger(classId) ||
      classId < 0
    ) {
      throw new Error(
        `Invalid YOLO class ID: ${parts[0]}.`,
      );
    }

    const coordinates = [
      centerX,
      centerY,
      width,
      height,
    ];

    if (
      !coordinates.every(
        (value) =>
          Number.isFinite(value) &&
          value >= 0 &&
          value <= 1,
      )
    ) {
      throw new Error(
        `Invalid YOLO coordinates: ${line}`,
      );
    }

    annotations.push({
      class_id: classId,
      center_x: centerX,
      center_y: centerY,
      width,
      height,
    });
  }

  return annotations;
}

function isYoloAnnotation(
  annotation: unknown,
): annotation is YoloAnnotation {
  if (
    !annotation ||
    typeof annotation !== "object"
  ) {
    return false;
  }

  const value =
    annotation as Record<
      string,
      unknown
    >;

  return (
    typeof value.class_id === "number" &&
    Number.isInteger(value.class_id) &&
    value.class_id >= 0 &&
    typeof value.center_x === "number" &&
    Number.isFinite(value.center_x) &&
    typeof value.center_y === "number" &&
    Number.isFinite(value.center_y) &&
    typeof value.width === "number" &&
    Number.isFinite(value.width) &&
    typeof value.height === "number" &&
    Number.isFinite(value.height)
  );
}

function dedupeAnnotations(
  annotations: YoloAnnotation[],
): YoloAnnotation[] {
  const seen = new Set<string>();
  const result: YoloAnnotation[] = [];

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

function annotationsToYolo(
  annotations: YoloAnnotation[],
): string {
  if (annotations.length === 0) {
    return "";
  }

  return (
    annotations
      .map((annotation) =>
        [
          annotation.class_id,
          annotation.center_x,
          annotation.center_y,
          annotation.width,
          annotation.height,
        ].join(" "),
      )
      .join("\n") + "\n"
  );
}

function uniqueStrings(
  values: unknown[],
): string[] {
  return Array.from(
    new Set(
      values.filter(
        (value): value is string =>
          typeof value === "string" &&
          value.length > 0,
      ),
    ),
  );
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

  for (
    const orphan of scan.orphanLabels
  ) {
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

async function validateClassIds(
  annotations: YoloAnnotation[],
): Promise<void> {
  if (annotations.length === 0) {
    return;
  }

  const classIds = Array.from(
    new Set(
      annotations.map(
        (annotation: YoloAnnotation) =>
          annotation.class_id,
      ),
    ),
  );

  const result =
    await db.query(
      `
      SELECT class_id
      FROM classes
      WHERE class_id = ANY($1::int[])
      `,
      [classIds],
    );

  const registeredIds =
    new Set<number>(
      result.rows.map(
        (row: { class_id: number }) =>
          Number(row.class_id),
      ),
    );

  const missingIds =
    classIds.filter(
      (classId) =>
        !registeredIds.has(
          classId,
        ),
    );

  if (missingIds.length > 0) {
    throw new Error(
      `Class IDs ${missingIds.join(", ")} are not registered.`,
    );
  }
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
        AND client_id = $2
      LIMIT 1
      `,
      [
        viewId,
        clientId,
      ],
    );

  const view =
    viewResult.rows[0];

  if (!view) {
    throw new Error(
      "Selected view was not found for this client.",
    );
  }

  const validation =
    await validateDataset(
      stagingPath,
    );

  if (
    validation.scan.images.length ===
    0
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

  for (
    const item of validation.scan
      .images
  ) {
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

  for (
    const item of validation.scan
      .images
  ) {
    if (!item.labelPath) {
      continue;
    }

    const relativePath =
      normalizePath(
        item.relativePath,
      );

    const imageName =
      path.basename(
        relativePath,
      );

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
        `Validation failed for ${relativePath}: ${annotationValidation.errors.join("; ")}`,
      );
    }

    const annotations =
      parseYoloAnnotations(
        labelContent,
      );

    await validateClassIds(
      annotations,
    );

    const annotationType =
      annotations.length > 0
        ? "bbox"
        : "background_images";

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
          image_hash,
          annotations,
          annotation_type,
          root_folders,
          original_root_folders,
          source_locations
        FROM metadata
        WHERE client_id = $1
          AND view_id = $2
          AND name = $3
        LIMIT 1
        `,
        [
          clientId,
          viewId,
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
        if (rawImageExists) {
          const existingRawHash =
            await sha256File(
              rawImagePath,
            );

          if (
            existingRawHash !==
            imageHash
          ) {
            conflicts++;
            continue;
          }
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

      if (
        !(await fileExists(
          metadataImagePath,
        ))
      ) {
        await fs.copyFile(
          item.imagePath,
          metadataImagePath,
        );
      }

      await fs.writeFile(
        metadataLabelPath,
        annotationsToYolo(
          annotations,
        ),
        "utf8",
      );

      await db.query(
        `
        INSERT INTO metadata (
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
          annotationType,
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
        annotations.length;

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

    const normalizedExisting =
      existingAnnotations.filter(
        (
          annotation: unknown,
        ): annotation is YoloAnnotation =>
          isYoloAnnotation(
            annotation,
          ),
      );

    const mergedAnnotations =
      dedupeAnnotations([
        ...normalizedExisting,
        ...annotations,
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

    if (
      !(await fileExists(
        metadataImagePath,
      ))
    ) {
      await fs.copyFile(
        item.imagePath,
        metadataImagePath,
      );
    }

    await fs.writeFile(
      metadataLabelPath,
      annotationsToYolo(
        mergedAnnotations,
      ),
      "utf8",
    );

    await db.query(
      `
      UPDATE metadata
      SET
        annotations = $1::jsonb,
        annotation_type = $2,
        root_folders = $3::text[],
        original_root_folders = $4::text[],
        source_locations = $5::text[]
      WHERE id = $6
      `,
      [
        JSON.stringify(
          mergedAnnotations,
        ),
        mergedAnnotations.length > 0
          ? "bbox"
          : "background_images",
        rootFolders,
        originalRootFolders,
        sourceLocations,
        existing.id,
      ],
    );

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

    merged++;
    annotationCount +=
      annotations.length;
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