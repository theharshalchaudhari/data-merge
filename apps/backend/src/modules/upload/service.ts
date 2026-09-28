import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

import {
  db,
} from "../../db/client.js";

import {
  getRawClientPath,
  getMetadataImagePath,
  getMetadataLabelPath,
} from "../../storage/paths.js";

import {
  scanDatasetFolder,
} from "./scanner.js";

import {
  validateYoloAnnotations,
} from "./validator.js";

type YoloAnnotation = {
  class_id: number;
  center_x: number;
  center_y: number;
  width: number;
  height: number;
};

type MetadataAnnotation = {
  class_name: string;
  center_x: number;
  center_y: number;
  width: number;
  height: number;
};

type DatasetClassMapping = {
  class_id: number;
  class_name: string;
};

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
    normalizePath(
      relativePath,
    );

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

async function sha256File(
  filePath: string,
): Promise<string> {
  const buffer =
    await fs.readFile(
      filePath,
    );

  return crypto
    .createHash("sha256")
    .update(buffer)
    .digest("hex");
}

async function fileExists(
  filePath: string,
): Promise<boolean> {
  try {
    await fs.access(
      filePath,
    );

    return true;
  } catch {
    return false;
  }
}

function parseYoloAnnotations(
  content: string,
): YoloAnnotation[] {
  const annotations:
    YoloAnnotation[] = [];

  const lines = content
    .split(/\r?\n/)
    .map(
      (line) => line.trim(),
    )
    .filter(Boolean);

  for (const line of lines) {
    const parts =
      line.split(/\s+/);

    if (parts.length !== 5) {
      throw new Error(
        `Invalid YOLO annotation: expected 5 values, received ${parts.length}.`,
      );
    }

    const classId =
      Number(parts[0]);

    const centerX =
      Number(parts[1]);

    const centerY =
      Number(parts[2]);

    const width =
      Number(parts[3]);

    const height =
      Number(parts[4]);

    if (
      !Number.isInteger(
        classId,
      ) ||
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
          Number.isFinite(
            value,
          ) &&
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
    typeof annotation !==
      "object"
  ) {
    return false;
  }

  const value =
    annotation as Record<
      string,
      unknown
    >;

  return (
    typeof value.class_id ===
      "number" &&
    Number.isInteger(
      value.class_id,
    ) &&
    value.class_id >= 0 &&
    typeof value.center_x ===
      "number" &&
    Number.isFinite(
      value.center_x,
    ) &&
    typeof value.center_y ===
      "number" &&
    Number.isFinite(
      value.center_y,
    ) &&
    typeof value.width ===
      "number" &&
    Number.isFinite(
      value.width,
    ) &&
    typeof value.height ===
      "number" &&
    Number.isFinite(
      value.height,
    )
  );
}

function isMetadataAnnotation(
  annotation: unknown,
): annotation is MetadataAnnotation {
  if (
    !annotation ||
    typeof annotation !==
      "object"
  ) {
    return false;
  }

  const value =
    annotation as Record<
      string,
      unknown
    >;

  return (
    typeof value.class_name ===
      "string" &&
    value.class_name.length >
      0 &&
    typeof value.center_x ===
      "number" &&
    Number.isFinite(
      value.center_x,
    ) &&
    typeof value.center_y ===
      "number" &&
    Number.isFinite(
      value.center_y,
    ) &&
    typeof value.width ===
      "number" &&
    Number.isFinite(
      value.width,
    ) &&
    typeof value.height ===
      "number" &&
    Number.isFinite(
      value.height,
    )
  );
}

function dedupeAnnotations(
  annotations:
    MetadataAnnotation[],
): MetadataAnnotation[] {
  const seen =
    new Set<string>();

  const result:
    MetadataAnnotation[] = [];

  for (const annotation of annotations) {
    const key =
      JSON.stringify(
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

function metadataAnnotationsToYolo(
  annotations:
    MetadataAnnotation[],
  classMappings:
    Map<number, DatasetClassMapping>,
): string {
  if (annotations.length === 0) {
    return "";
  }

  const nameToId =
    new Map<string, number>();

  for (const mapping of classMappings.values()) {
    nameToId.set(
      mapping.class_name
        .trim()
        .toLowerCase(),
      mapping.class_id,
    );
  }

  return (
    annotations
      .map(
        (annotation) => {
          const classId =
            Array.from(
              classMappings.values(),
            ).find(
              (mapping) =>
                mapping.class_name
                  .trim()
                  .toLowerCase() ===
                annotation.class_name
                  .trim()
                  .toLowerCase(),
            )?.class_id;

          if (
            classId ===
            undefined
          ) {
            throw new Error(
              `Class "${annotation.class_name}" is not registered for the selected dataset type.`,
            );
          }

          return [
            classId,
            annotation.center_x,
            annotation.center_y,
            annotation.width,
            annotation.height,
          ].join(" ");
        },
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
        (
          value,
        ): value is string =>
          typeof value ===
            "string" &&
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
        file:
          item.relativePath,
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
        file:
          item.relativePath,
        message:
          validation.errors.join(
            "; ",
          ),
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

async function getDatasetClassMappings(
  datasetTypeId: string,
): Promise<
  Map<number, DatasetClassMapping>
> {
  const result =
    await db.query<{
      class_id: number;
      class_name: string;
    }>(
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

  const mappings =
    new Map<
      number,
      DatasetClassMapping
    >();

  for (const row of result.rows) {
    mappings.set(
      Number(row.class_id),
      {
        class_id:
          Number(row.class_id),
        class_name:
          row.class_name,
      },
    );
  }

  return mappings;
}

function convertToMetadataAnnotations(
  annotations: YoloAnnotation[],
  classMappings:
    Map<number, DatasetClassMapping>,
): MetadataAnnotation[] {
  return annotations.map(
    (annotation) => {
      const mapping =
        classMappings.get(
          annotation.class_id,
        );

      if (!mapping) {
        throw new Error(
          `Dataset class ID ${annotation.class_id} is not registered for the selected dataset type.`,
        );
      }

      return {
        class_name:
          mapping.class_name,
        center_x:
          annotation.center_x,
        center_y:
          annotation.center_y,
        width:
          annotation.width,
        height:
          annotation.height,
      };
    },
  );
}

export async function uploadDataset(
  input: {
    stagingPath: string;
    clientId: string;
    viewId: string;
    datasetTypeId: string;
    rootFolder: string;
    uploadedBy: string;
  },
) {
  const {
    stagingPath,
    clientId,
    viewId,
    datasetTypeId,
    rootFolder,
    uploadedBy,
  } = input;

  const clientResult =
    await db.query<{
      id: string;
      name: string;
    }>(
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
    await db.query<{
      id: string;
      name: string;
    }>(
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

  const datasetTypeResult =
    await db.query<{
      id: string;
      name: string;
    }>(
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

  const datasetType =
    datasetTypeResult.rows[0];

  if (!datasetType) {
    throw new Error(
      "Selected dataset type was not found.",
    );
  }

  const classMappings =
    await getDatasetClassMappings(
      datasetTypeId,
    );

  if (
    classMappings.size === 0
  ) {
    throw new Error(
      "Selected dataset type has no class mappings.",
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
    const error =
      new Error(
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

  for (const item of validation.scan.images) {
    const normalized =
      normalizePath(
        item.relativePath,
      );

    const root =
      getRootFolder(
        normalized,
      );

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

  for (const item of validation.scan.images) {
    if (!item.labelPath) {
      skipped++;
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

    const uploadedAnnotations =
      parseYoloAnnotations(
        labelContent,
      );

    const metadataAnnotations =
      convertToMetadataAnnotations(
        uploadedAnnotations,
        classMappings,
      );

    const annotationType =
      metadataAnnotations.length >
      0
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
      await db.query<{
        id: string;
        image_hash: string;
        annotations: unknown;
        annotation_type: string;
        root_folders: unknown;
        original_root_folders: unknown;
        source_locations: unknown;
      }>(
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
        labelContent,
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
            metadataAnnotations,
          ),
          imageHash,
          [expectedRoot],
          [expectedRoot],
          [relativePath],
        ],
      );

      uploaded++;

      annotationCount +=
        metadataAnnotations.length;

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
        ): annotation is MetadataAnnotation =>
          isMetadataAnnotation(
            annotation,
          ),
      );

    const mergedAnnotations =
      dedupeAnnotations([
        ...normalizedExisting,
        ...metadataAnnotations,
      ]);

    const rootFolders =
      uniqueStrings([
        ...(Array.isArray(
          existing.root_folders,
        )
          ? existing.root_folders
          : []),
        expectedRoot,
      ]);

    const originalRootFolders =
      uniqueStrings([
        ...(Array.isArray(
          existing.original_root_folders,
        )
          ? existing.original_root_folders
          : []),
        expectedRoot,
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
      labelContent,
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
        mergedAnnotations.length >
        0
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

      await fs.copyFile(
        item.labelPath,
        rawLabelPath,
      );
    }

    merged++;

    annotationCount +=
      metadataAnnotations.length;
  }

  const fileCount =
    validation.scan.images
      .length +
    validation.scan.orphanLabels
      .length;

  const annotationFileCount =
    validation.scan.images.filter(
      (item) =>
        item.labelPath !== null,
    ).length;

  await db.query(
    `
      INSERT INTO dataset_uploads (
        client_id,
        view_id,
        uploaded_by,
        dataset_type_id,
        folder_name,
        raw_folder_path,
        file_count,
        image_count,
        annotation_file_count,
        annotation_count,
        status
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        'completed'
      )
    `,
    [
      clientId,
      viewId,
      uploadedBy,
      datasetTypeId,
      expectedRoot,
      path.join(
        rawClientPath,
        expectedRoot,
      ),
      fileCount,
      validation.scan.images
        .length,
      annotationFileCount,
      annotationCount,
    ],
  );

  return {
    uploaded,
    merged,
    skipped,
    conflicts,
    annotationCount,
    images:
      validation.scan.images
        .length,
    annotationFiles:
      annotationFileCount,
    fileCount,
    datasetType:
      datasetType.name,
    client: client.name,
    view: view.name,
    rootFolder:
      expectedRoot,
  };
}