import { db } from "../../db/client.js";

import type {
  CreateDatasetTypeInput,
  DatasetClass,
  DatasetType,
  DatasetUpload,
  UpdateDatasetTypeInput,
} from "./types.js";

export async function getDatasetTypes(): Promise<DatasetType[]> {
  const types =
    await db.query<{
      id: string;
      name: string;
      description: string | null;
      created_at: string;
    }>(
      `
        SELECT
          id,
          name,
          description,
          created_at
        FROM dataset_types
        ORDER BY name
      `,
    );

  if (types.rows.length === 0) {
    return [];
  }

  const classes =
    await db.query<DatasetClass>(
      `
        SELECT
          id,
          dataset_type_id,
          class_id,
          class_name
        FROM dataset_type_classes
        ORDER BY
          dataset_type_id,
          class_id
      `,
    );

  const classesByType =
    new Map<string, DatasetClass[]>();

  for (const item of classes.rows) {
    const current =
      classesByType.get(
        item.dataset_type_id,
      ) ?? [];

    current.push(item);

    classesByType.set(
      item.dataset_type_id,
      current,
    );
  }

  return types.rows.map(
    (type) => ({
      ...type,
      classes:
        classesByType.get(type.id) ??
        [],
    }),
  );
}

export async function getDatasetType(
  id: string,
): Promise<DatasetType | null> {
  const type =
    await db.query<{
      id: string;
      name: string;
      description: string | null;
      created_at: string;
    }>(
      `
        SELECT
          id,
          name,
          description,
          created_at
        FROM dataset_types
        WHERE id = $1
        LIMIT 1
      `,
      [id],
    );

  if (type.rows.length === 0) {
    return null;
  }

  const classes =
    await db.query<DatasetClass>(
      `
        SELECT
          id,
          dataset_type_id,
          class_id,
          class_name
        FROM dataset_type_classes
        WHERE dataset_type_id = $1
        ORDER BY class_id
      `,
      [id],
    );

  return {
    ...type.rows[0],
    classes: classes.rows,
  };
}

export async function createDatasetType(
  input: CreateDatasetTypeInput,
): Promise<DatasetType> {
  const client =
    await db.connect();

  try {
    await client.query(
      "BEGIN",
    );

    const datasetTypeResult =
      await client.query<{
        id: string;
        name: string;
        description: string | null;
        created_at: string;
      }>(
        `
          INSERT INTO dataset_types (
            name,
            description
          )
          VALUES ($1, $2)
          RETURNING
            id,
            name,
            description,
            created_at
        `,
        [
          input.name.trim(),
          input.description?.trim() ||
            null,
        ],
      );

    const datasetType =
      datasetTypeResult.rows[0];

    if (!datasetType) {
      throw new Error(
        "Failed to create dataset type.",
      );
    }

    const classes: DatasetClass[] = [];

    for (const item of input.classes) {
      const classResult =
        await client.query<DatasetClass>(
          `
            INSERT INTO dataset_type_classes (
              dataset_type_id,
              class_id,
              class_name
            )
            VALUES ($1, $2, $3)
            RETURNING
              id,
              dataset_type_id,
              class_id,
              class_name
          `,
          [
            datasetType.id,
            item.class_id,
            item.class_name.trim(),
          ],
        );

      const createdClass =
        classResult.rows[0];

      if (!createdClass) {
        throw new Error(
          "Failed to create dataset class.",
        );
      }

      classes.push(
        createdClass,
      );
    }

    await client.query(
      "COMMIT",
    );

    return {
      ...datasetType,
      classes,
    };
  } catch (error) {
    await client.query(
      "ROLLBACK",
    );

    throw error;
  } finally {
    client.release();
  }
}

export async function updateDatasetType(
  id: string,
  input: UpdateDatasetTypeInput,
): Promise<DatasetType | null> {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (input.name !== undefined) {
    values.push(
      input.name.trim(),
    );

    fields.push(
      `name = $${values.length}`,
    );
  }

  if (
    input.description !==
    undefined
  ) {
    values.push(
      input.description?.trim() ||
        null,
    );

    fields.push(
      `description = $${values.length}`,
    );
  }

  if (fields.length === 0) {
    return getDatasetType(id);
  }

  values.push(id);

  const result =
    await db.query(
      `
        UPDATE dataset_types
        SET ${fields.join(", ")}
        WHERE id = $${values.length}
      `,
      values,
    );

  if (
    (result.rowCount ?? 0) === 0
  ) {
    return null;
  }

  return getDatasetType(id);
}

export async function deleteDatasetType(
  id: string,
): Promise<boolean> {
  const result =
    await db.query(
      `
        DELETE FROM dataset_types
        WHERE id = $1
      `,
      [id],
    );

  return (
    (result.rowCount ?? 0) > 0
  );
}

export async function getDatasetClassMap(
  datasetTypeId: string,
): Promise<Map<number, string>> {
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

  return new Map(
    result.rows.map(
      (item) => [
        item.class_id,
        item.class_name,
      ],
    ),
  );
}

export async function getDatasetClassId(
  datasetTypeId: string,
  className: string,
): Promise<number | null> {
  const result =
    await db.query<{
      class_id: number;
    }>(
      `
        SELECT
          class_id
        FROM dataset_type_classes
        WHERE dataset_type_id = $1
          AND class_name = $2
        LIMIT 1
      `,
      [
        datasetTypeId,
        className,
      ],
    );

  return result.rows.length > 0
    ? result.rows[0].class_id
    : null;
}

export async function getDatasetUploads(
  options: {
    clientId?: string;
    viewId?: string;
    datasetTypeId?: string;
    limit: number;
    offset: number;
  },
): Promise<{
  items: DatasetUpload[];
  total: number;
}> {
  const conditions: string[] = [];
  const values: unknown[] = [];

  function add(
    condition: string,
    value: unknown,
  ) {
    values.push(value);

    conditions.push(
      condition.replace(
        "?",
        `$${values.length}`,
      ),
    );
  }

  if (options.clientId) {
    add(
      "du.client_id = ?",
      options.clientId,
    );
  }

  if (options.viewId) {
    add(
      "du.view_id = ?",
      options.viewId,
    );
  }

  if (options.datasetTypeId) {
    add(
      "du.dataset_type_id = ?",
      options.datasetTypeId,
    );
  }

  const where =
    conditions.length > 0
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

  const count =
    await db.query<{
      total: number;
    }>(
      `
        SELECT
          COUNT(*)::int AS total
        FROM dataset_uploads du
        ${where}
      `,
      values,
    );

  const result =
    await db.query<DatasetUpload>(
      `
        SELECT
          du.id,
          du.client_id,
          c.name AS client_name,
          du.view_id,
          v.name AS view_name,
          du.uploaded_by,
          u.name AS uploader_name,
          u.username,
          du.dataset_type_id,
          dt.name AS dataset_type,
          du.folder_name,
          du.raw_folder_path,
          du.file_count,
          du.image_count,
          du.annotation_file_count,
          du.annotation_count,
          du.status,
          du.created_at
        FROM dataset_uploads du
        INNER JOIN clients c
          ON c.id = du.client_id
        INNER JOIN views v
          ON v.id = du.view_id
        INNER JOIN users u
          ON u.id = du.uploaded_by
        INNER JOIN dataset_types dt
          ON dt.id = du.dataset_type_id
        ${where}
        ORDER BY du.created_at DESC
        LIMIT $${values.length + 1}
        OFFSET $${values.length + 2}
      `,
      [
        ...values,
        options.limit,
        options.offset,
      ],
    );

  return {
    items: result.rows,
    total:
      count.rows[0]?.total ?? 0,
  };
}