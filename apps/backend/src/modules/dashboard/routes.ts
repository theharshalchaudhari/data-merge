import type {
  FastifyInstance,
} from "fastify";

import { z } from "zod";

import { db } from "../../db/client.js";

import {
  requireRole,
} from "../auth/guard.js";

const querySchema = z.object({
  clientId: z.string().uuid().optional(),
  viewId: z.string().uuid().optional(),
  className: z.string().trim().min(1).optional(),
  annotationType: z.string().trim().min(1).optional(),
});

function toNumber(
  value: unknown,
): number {
  if (
    typeof value === "number"
  ) {
    return value;
  }

  return Number(value ?? 0);
}

export async function registerDashboardRoutes(
  app: FastifyInstance,
) {
  app.get(
    "/api/dashboard",
    {
      preHandler: requireRole(
        "admin",
        "editor",
        "viewer",
      ),
    },
    async (request) => {
      const query =
        querySchema.parse(
          request.query,
        );

      const conditions: string[] = [];
      const values: unknown[] = [];

      function addCondition(
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

      if (query.clientId) {
        addCondition(
          "m.client_id = ?",
          query.clientId,
        );
      }

      if (query.viewId) {
        addCondition(
          "m.view_id = ?",
          query.viewId,
        );
      }

      if (query.annotationType) {
        addCondition(
          "m.annotation_type = ?",
          query.annotationType,
        );
      }

      if (query.className) {
        addCondition(
          `
            EXISTS (
              SELECT 1
              FROM jsonb_array_elements(
                CASE
                  WHEN jsonb_typeof(m.annotations) = 'array'
                    THEN m.annotations
                  ELSE '[]'::jsonb
                END
              ) AS filtered_annotation
              WHERE filtered_annotation->>'class_name' = ?
            )
          `,
          query.className,
        );
      }

      const where =
        conditions.length > 0
          ? `WHERE ${conditions.join(" AND ")}`
          : "";

      const filteredMetadataCte = `
        WITH filtered_metadata AS (
          SELECT
            m.id,
            m.client_id,
            m.view_id,
            m.name,
            m.annotation_type,
            CASE
              WHEN jsonb_typeof(m.annotations) = 'array'
                THEN m.annotations
              ELSE '[]'::jsonb
            END AS annotations
          FROM metadata m
          ${where}
        )
      `;

      const statsResult =
        await db.query(
          `
          ${filteredMetadataCte}
          SELECT
            (
              SELECT COUNT(DISTINCT client_id)::int
              FROM filtered_metadata
            ) AS clients,

            (
              SELECT COUNT(DISTINCT view_id)::int
              FROM filtered_metadata
            ) AS views,

            (
              SELECT COUNT(*)::int
              FROM users
            ) AS users,

            (
              SELECT COUNT(*)::int
              FROM filtered_metadata
            ) AS images,

            (
              SELECT COUNT(*)::int
              FROM filtered_metadata
              WHERE jsonb_array_length(annotations) > 0
            ) AS annotated_images,

            (
              SELECT COUNT(*)::int
              FROM filtered_metadata
              WHERE annotation_type = 'background_images'
            ) AS background_images,

            (
              SELECT COALESCE(
                SUM(
                  jsonb_array_length(annotations)
                ),
                0
              )::int
              FROM filtered_metadata
            ) AS annotations,

            (
              SELECT COUNT(DISTINCT annotation->>'class_name')::int
              FROM filtered_metadata fm
              CROSS JOIN LATERAL jsonb_array_elements(
                fm.annotations
              ) AS annotation
              WHERE annotation->>'class_name' IS NOT NULL
                AND trim(annotation->>'class_name') <> ''
            ) AS classes,

            (
              SELECT COALESCE(
                SUM(
                  jsonb_array_length(annotations)
                )::numeric
                /
                NULLIF(COUNT(*), 0),
                0
              )::float
              FROM filtered_metadata
            ) AS average_annotations_per_image
          `,
          values,
        );

      const classResult =
        await db.query(
          `
          ${filteredMetadataCte}
          SELECT
            c.class_id,
            annotation->>'class_name' AS class_name,
            COUNT(*)::int AS count
          FROM filtered_metadata fm
          CROSS JOIN LATERAL jsonb_array_elements(
            fm.annotations
          ) AS annotation
          LEFT JOIN classes c
            ON lower(c.class_name) =
               lower(annotation->>'class_name')
          WHERE annotation->>'class_name' IS NOT NULL
            AND trim(annotation->>'class_name') <> ''
          GROUP BY
            c.class_id,
            annotation->>'class_name'
          ORDER BY
            count DESC,
            class_name ASC
          `,
          values,
        );

      const annotationTypeResult =
        await db.query(
          `
          ${filteredMetadataCte}
          SELECT
            annotation_type AS type,
            COUNT(*)::int AS count
          FROM filtered_metadata
          GROUP BY annotation_type
          ORDER BY count DESC, type ASC
          `,
          values,
        );

      const clientResult =
        await db.query(
          `
          ${filteredMetadataCte}
          SELECT
            c.id AS client_id,
            c.name AS client_name,

            COUNT(fm.id)::int AS images,

            COALESCE(
              SUM(
                jsonb_array_length(
                  fm.annotations
                )
              ),
              0
            )::int AS annotations,

            COUNT(
              CASE
                WHEN jsonb_array_length(
                  fm.annotations
                ) > 0
                THEN 1
              END
            )::int AS annotated_images,

            COUNT(
              CASE
                WHEN fm.annotation_type =
                  'background_images'
                THEN 1
              END
            )::int AS background_images

          FROM filtered_metadata fm
          INNER JOIN clients c
            ON c.id = fm.client_id

          GROUP BY
            c.id,
            c.name

          ORDER BY
            images DESC,
            c.name ASC
          `,
          values,
        );

      const viewResult =
        await db.query(
          `
          ${filteredMetadataCte}
          SELECT
            v.id AS view_id,
            v.name AS view_name,
            c.id AS client_id,
            c.name AS client_name,

            COUNT(fm.id)::int AS images,

            COALESCE(
              SUM(
                jsonb_array_length(
                  fm.annotations
                )
              ),
              0
            )::int AS annotations,

            COUNT(
              CASE
                WHEN jsonb_array_length(
                  fm.annotations
                ) > 0
                THEN 1
              END
            )::int AS annotated_images,

            COUNT(
              CASE
                WHEN fm.annotation_type =
                  'background_images'
                THEN 1
              END
            )::int AS background_images

          FROM filtered_metadata fm
          INNER JOIN views v
            ON v.id = fm.view_id
          INNER JOIN clients c
            ON c.id = fm.client_id

          GROUP BY
            v.id,
            v.name,
            c.id,
            c.name

          ORDER BY
            images DESC,
            c.name ASC,
            v.name ASC
          `,
          values,
        );

      const datasetTypeConditions: string[] = [];
      const datasetTypeValues: unknown[] = [];

      if (query.clientId) {
        datasetTypeValues.push(
          query.clientId,
        );

        datasetTypeConditions.push(
          `du.client_id = $${datasetTypeValues.length}`,
        );
      }

      if (query.viewId) {
        datasetTypeValues.push(
          query.viewId,
        );

        datasetTypeConditions.push(
          `du.view_id = $${datasetTypeValues.length}`,
        );
      }

      const datasetTypeWhere =
        datasetTypeConditions.length > 0
          ? `WHERE ${datasetTypeConditions.join(" AND ")}`
          : "";

          const datasetTypeResult =
      await db.query(
        `
        SELECT
          dt.id AS dataset_type_id,
          dt.name AS dataset_type,

          COALESCE(
            SUM(du.image_count),
            0
          )::int AS images,

          COALESCE(
            SUM(du.annotation_count),
            0
          )::int AS annotations,

          COUNT(du.id)::int AS uploads

        FROM dataset_types dt

        LEFT JOIN dataset_uploads du
          ON du.dataset_type_id = dt.id

          ${
            query.clientId
              ? `AND du.client_id = $1`
              : ""
          }

          ${
            query.viewId
              ? `AND du.view_id = $${
                  query.clientId ? 2 : 1
                }`
              : ""
          }

        GROUP BY
          dt.id,
          dt.name

        HAVING
          COUNT(du.id) > 0

        ORDER BY
          images DESC,
          dt.name ASC
        `,
        datasetTypeValues,
      );

      const statsRow =
        statsResult.rows[0] ?? {};

      return {
        stats: {
          clients: toNumber(
            statsRow.clients,
          ),
          views: toNumber(
            statsRow.views,
          ),
          users: toNumber(
            statsRow.users,
          ),
          images: toNumber(
            statsRow.images,
          ),
          annotatedImages:
            toNumber(
              statsRow.annotated_images,
            ),
          backgroundImages:
            toNumber(
              statsRow.background_images,
            ),
          annotations: toNumber(
            statsRow.annotations,
          ),
          classes: toNumber(
            statsRow.classes,
          ),
          averageAnnotationsPerImage:
            toNumber(
              statsRow.average_annotations_per_image,
            ),
        },

        annotationClasses:
          classResult.rows.map(
            (row) => ({
              classId:
                row.class_id === null
                  ? null
                  : Number(
                      row.class_id,
                    ),
              className:
                String(
                  row.class_name,
                ),
              count: toNumber(
                row.count,
              ),
            }),
          ),

        annotationTypes:
          annotationTypeResult.rows.map(
            (row) => ({
              type: String(
                row.type,
              ),
              count: toNumber(
                row.count,
              ),
            }),
          ),

        datasetTypes:
          datasetTypeResult.rows.map(
            (row) => ({
              datasetTypeId:
                String(
                  row.dataset_type_id,
                ),
              datasetType:
                String(
                  row.dataset_type,
                ),
              images: toNumber(
                row.images,
              ),
              annotations:
                toNumber(
                  row.annotations,
                ),
              uploads: toNumber(
                row.uploads,
              ),
            }),
          ),

        clients:
          clientResult.rows.map(
            (row) => ({
              clientId:
                String(
                  row.client_id,
                ),
              clientName:
                String(
                  row.client_name,
                ),
              images: toNumber(
                row.images,
              ),
              annotations:
                toNumber(
                  row.annotations,
                ),
              annotatedImages:
                toNumber(
                  row.annotated_images,
                ),
              backgroundImages:
                toNumber(
                  row.background_images,
                ),
            }),
          ),

        views:
          viewResult.rows.map(
            (row) => ({
              viewId:
                String(
                  row.view_id,
                ),
              viewName:
                String(
                  row.view_name,
                ),
              clientId:
                String(
                  row.client_id,
                ),
              clientName:
                String(
                  row.client_name,
                ),
              images: toNumber(
                row.images,
              ),
              annotations:
                toNumber(
                  row.annotations,
                ),
              annotatedImages:
                toNumber(
                  row.annotated_images,
                ),
              backgroundImages:
                toNumber(
                  row.background_images,
                ),
            }),
          ),
      };
    },
  );
}