import type {
  FastifyInstance
} from "fastify";

import {
  db
} from "../../db/client.js";

import {
  requireRole
} from "../auth/guard.js";

export async function registerDashboardRoutes(
  app: FastifyInstance
) {
  app.get(
    "/api/dashboard",
    {
      preHandler:
        requireRole(
          "admin",
          "editor",
          "viewer"
        )
    },
    async () => {
      const statsResult =
        await db.query(`
          SELECT
            (
              SELECT COUNT(*)::int
              FROM clients
            ) AS clients,

            (
              SELECT COUNT(*)::int
              FROM views
            ) AS views,

            (
              SELECT COUNT(*)::int
              FROM metadata
            ) AS images,

            (
              SELECT COALESCE(
                SUM(
                  jsonb_array_length(
                    annotations
                  )
                ),
                0
              )::int
              FROM metadata
            ) AS annotations,

            (
              SELECT COUNT(*)::int
              FROM users
            ) AS users
        `);

      const clientsResult =
        await db.query(`
          SELECT
            c.id AS client_id,
            c.name AS client_name,
            COUNT(m.id)::int AS images,
            COALESCE(
              SUM(
                jsonb_array_length(
                  m.annotations
                )
              ),
              0
            )::int AS annotations
          FROM clients c
          LEFT JOIN metadata m
            ON m.client_id = c.id
          GROUP BY
            c.id,
            c.name
          ORDER BY c.name
        `);

      const viewsResult =
        await db.query(`
          SELECT
            v.id AS view_id,
            v.name AS view_name,
            COUNT(m.id)::int AS images,
            COALESCE(
              SUM(
                jsonb_array_length(
                  m.annotations
                )
              ),
              0
            )::int AS annotations
          FROM views v
          LEFT JOIN metadata m
            ON m.view_id = v.id
          GROUP BY
            v.id,
            v.name
          ORDER BY v.name
        `);

      const stats =
        statsResult.rows[0];

      return {
        stats: {
          clients:
            stats.clients,
          views:
            stats.views,
          images:
            stats.images,
          annotations:
            stats.annotations,
          users:
            stats.users
        },

        clients:
          clientsResult.rows,

        views:
          viewsResult.rows
      };
    }
  );
}
