import type {
  FastifyInstance
} from "fastify";

import { z } from "zod";

import {
  db
} from "../../db/client.js";

import {
  requireRole
} from "../auth/guard.js";

const querySchema =
  z.object({
    clientId:
      z.string()
        .uuid()
        .optional(),

    viewId:
      z.string()
        .uuid()
        .optional(),

    annotationType:
      z.enum([
        "bbox",
        "polygon",
        "segmentation"
      ]).optional(),

    search:
      z.string()
        .optional(),

    page:
      z.coerce
        .number()
        .int()
        .positive()
        .default(1),

    limit:
      z.coerce
        .number()
        .int()
        .positive()
        .max(100)
        .default(50)
  });

export async function registerMetadataRoutes(
  app: FastifyInstance
) {
  app.get(
    "/api/metadata",
    {
      preHandler:
        requireRole(
          "admin",
          "editor",
          "viewer"
        )
    },
    async (
      request
    ) => {
      const query =
        querySchema.parse(
          request.query
        );

      const conditions: string[] =
        [];

      const values: unknown[] =
        [];

      function add(
        condition: string,
        value: unknown
      ) {
        values.push(value);

        conditions.push(
          condition.replace(
            "?",
            `$${values.length}`
          )
        );
      }

      if (query.clientId) {
        add(
          "m.client_id = ?",
          query.clientId
        );
      }

      if (query.viewId) {
        add(
          "m.view_id = ?",
          query.viewId
        );
      }

      if (
        query.annotationType
      ) {
        add(
          "m.annotation_type = ?",
          query.annotationType
        );
      }

      if (query.search) {
        add(
          "m.name ILIKE ?",
          `%${query.search}%`
        );
      }

      const where =
        conditions.length
          ? `WHERE ${conditions.join(
              " AND "
            )}`
          : "";

      const count =
        await db.query(
          `
          SELECT COUNT(*)::int AS total
          FROM metadata m
          ${where}
          `,
          values
        );

      const total =
        count.rows[0].total;

      const offset =
        (query.page - 1) *
        query.limit;

      const result =
        await db.query(
          `
          SELECT
            m.id,
            m.client_id,
            c.name AS client_name,
            m.view_id,
            v.name AS view_name,
            m.name,
            m.annotation_type,
            m.annotations,
            m.image_hash,
            m.root_folders,
            m.original_root_folders,
            m.source_locations,
            m.description,
            m.created_at,
            m.updated_at
          FROM metadata m
          INNER JOIN clients c
            ON c.id = m.client_id
          INNER JOIN views v
            ON v.id = m.view_id
          ${where}
          ORDER BY
            m.updated_at DESC
          LIMIT
            $${values.length + 1}
          OFFSET
            $${values.length + 2}
          `,
          [
            ...values,
            query.limit,
            offset
          ]
        );

      return {
        items:
          result.rows,
        page:
          query.page,
        limit:
          query.limit,
        total,
        totalPages:
          Math.ceil(
            total /
              query.limit
          )
      };
    }
  );
}
