import type {
  FastifyInstance,
} from "fastify";

import { z } from "zod";

import {
  db,
} from "../../db/client.js";

import {
  requireRole,
} from "../auth/guard.js";

const classIdParamsSchema =
  z.object({
    classId: z.coerce
      .number()
      .int()
      .nonnegative(),
  });

const createClassSchema =
  z.object({
    classId: z.number()
      .int()
      .nonnegative(),

    className: z.string()
      .trim()
      .min(1)
      .max(200),
  });

const updateClassSchema =
  z.object({
    classId: z.number()
      .int()
      .nonnegative(),

    className: z.string()
      .trim()
      .min(1)
      .max(200),
  });

export async function registerClassRoutes(
  app: FastifyInstance,
) {
  app.get(
    "/api/classes",
    {
      preHandler: requireRole(
        "admin",
        "editor",
        "viewer",
      ),
    },
    async () => {
      const result =
        await db.query(`
          SELECT
            class_id,
            class_name
          FROM classes
          ORDER BY class_id ASC
        `);

      return result.rows;
    },
  );

  app.post(
    "/api/classes",
    {
      preHandler: requireRole(
        "admin",
        "editor",
      ),
    },
    async (
      request,
      reply,
    ) => {
      const input =
        createClassSchema.parse(
          request.body,
        );

      try {
        const result =
          await db.query(
            `
            INSERT INTO classes (
              class_id,
              class_name
            )
            VALUES (
              $1,
              $2
            )
            RETURNING
              class_id,
              class_name
            `,
            [
              input.classId,
              input.className,
            ],
          );

        return reply
          .code(201)
          .send(
            result.rows[0],
          );
      } catch (error: unknown) {
        const code =
          error &&
          typeof error ===
            "object" &&
          "code" in error
            ? String(
                (
                  error as {
                    code: unknown;
                  }
                ).code,
              )
            : "";

        if (code === "23505") {
          return reply
            .code(409)
            .send({
              message:
                "Class ID or class name already exists.",
            });
        }

        throw error;
      }
    },
  );

  app.patch(
    "/api/classes/:classId",
    {
      preHandler: requireRole(
        "admin",
        "editor",
      ),
    },
    async (
      request,
      reply,
    ) => {
      const params =
        classIdParamsSchema.parse(
          request.params,
        );

      const input =
        updateClassSchema.parse(
          request.body,
        );

      const existing =
        await db.query(
          `
          SELECT
            class_id,
            class_name
          FROM classes
          WHERE class_id = $1
          `,
          [params.classId],
        );

      if (
        existing.rows.length === 0
      ) {
        return reply
          .code(404)
          .send({
            message:
              "Class not found.",
          });
      }

      const oldClass =
        existing.rows[0];

      if (
        input.classId !==
        oldClass.class_id
      ) {
        const references =
          await db.query(
            `
            SELECT COUNT(*)::int AS count
            FROM dataset_type_classes
            WHERE global_class_id = $1
            `,
            [oldClass.class_id],
          );

        if (
          references.rows[0].count >
          0
        ) {
          return reply
            .code(409)
            .send({
              message:
                "Class ID cannot be changed because the class is already used by dataset type mappings.",
            });
        }

        const metadataReferences =
          await db.query(
            `
            SELECT COUNT(*)::int AS count
            FROM metadata
            WHERE annotations @>
              jsonb_build_array(
                jsonb_build_object(
                  'class_name',
                  $1
                )
              )
            `,
            [oldClass.class_name],
          );

        if (
          metadataReferences.rows[0].count >
          0
        ) {
          return reply
            .code(409)
            .send({
              message:
                "Class ID cannot be changed because the class is already used by metadata.",
            });
        }
      }

      try {
        await db.query(
          "BEGIN",
        );

        const result =
          await db.query(
            `
            UPDATE classes
            SET
              class_id = $1,
              class_name = $2
            WHERE class_id = $3
            RETURNING
              class_id,
              class_name
            `,
            [
              input.classId,
              input.className,
              params.classId,
            ],
          );

        if (
          oldClass.class_name !==
          input.className
        ) {
          await db.query(
            `
            UPDATE metadata
            SET annotations = (
              SELECT COALESCE(
                jsonb_agg(
                  CASE
                    WHEN item->>'class_name' = $1
                    THEN item ||
                      jsonb_build_object(
                        'class_name',
                        $2
                      )
                    ELSE item
                  END
                ),
                '[]'::jsonb
              )
              FROM jsonb_array_elements(
                metadata.annotations
              ) AS item
            )
            WHERE annotations @>
              jsonb_build_array(
                jsonb_build_object(
                  'class_name',
                  $1
                )
              )
            `,
            [
              oldClass.class_name,
              input.className,
            ],
          );
        }

        await db.query(
          "COMMIT",
        );

        return result.rows[0];
      } catch (error: unknown) {
        await db.query(
          "ROLLBACK",
        );

        const code =
          error &&
          typeof error ===
            "object" &&
          "code" in error
            ? String(
                (
                  error as {
                    code: unknown;
                  }
                ).code,
              )
            : "";

        if (code === "23505") {
          return reply
            .code(409)
            .send({
              message:
                "Class ID or class name already exists.",
            });
        }

        throw error;
      }
    },
  );

  app.delete(
    "/api/classes/:classId",
    {
      preHandler: requireRole(
        "admin",
        "editor",
      ),
    },
    async (
      request,
      reply,
    ) => {
      const params =
        classIdParamsSchema.parse(
          request.params,
        );

      const existing =
        await db.query(
          `
          SELECT
            class_id,
            class_name
          FROM classes
          WHERE class_id = $1
          `,
          [params.classId],
        );

      if (
        existing.rows.length === 0
      ) {
        return reply
          .code(404)
          .send({
            message:
              "Class not found.",
          });
      }

      const item =
        existing.rows[0];

      const mappingReferences =
        await db.query(
          `
          SELECT COUNT(*)::int AS count
          FROM dataset_type_classes
          WHERE global_class_id = $1
          `,
          [item.class_id],
        );

      if (
        mappingReferences.rows[0]
          .count > 0
      ) {
        return reply
          .code(409)
          .send({
            message:
              "Class cannot be deleted because it is used by dataset type mappings.",
          });
      }

      const metadataReferences =
        await db.query(
          `
          SELECT COUNT(*)::int AS count
          FROM metadata
          WHERE annotations @>
            jsonb_build_array(
              jsonb_build_object(
                'class_name',
                $1
              )
            )
          `,
          [item.class_name],
        );

      if (
        metadataReferences.rows[0]
          .count > 0
      ) {
        return reply
          .code(409)
          .send({
            message:
              "Class cannot be deleted because it is used by metadata.",
          });
      }

      await db.query(
        `
        DELETE FROM classes
        WHERE class_id = $1
        `,
        [item.class_id],
      );

      return reply.send({
        message:
          "Class deleted successfully.",
      });
    },
  );
}