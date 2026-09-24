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

const viewSchema =
  z.object({
    name:
      z.string()
        .min(1)
        .max(200),

    description:
      z.string()
        .max(1000)
        .optional()
  });

export async function registerViewRoutes(
  app: FastifyInstance
) {
  app.get(
    "/api/views",
    {
      preHandler:
        requireRole(
          "admin",
          "editor",
          "viewer"
        )
    },
    async () => {
      const result =
        await db.query(`
          SELECT
            id,
            name,
            description,
            created_at,
            updated_at
          FROM views
          ORDER BY name
        `);

      return result.rows;
    }
  );

  app.post(
    "/api/views",
    {
      preHandler:
        requireRole("admin")
    },
    async (
      request,
      reply
    ) => {
      const input =
        viewSchema.parse(
          request.body
        );

      try {
        const result =
          await db.query(
            `
            INSERT INTO views
            (
              name,
              description
            )
            VALUES
            ($1, $2)
            RETURNING *
            `,
            [
              input.name,
              input.description ??
                null
            ]
          );

        return reply
          .code(201)
          .send(
            result.rows[0]
          );
      } catch (error: any) {
        if (
          error?.code ===
          "23505"
        ) {
          return reply
            .code(409)
            .send({
              message:
                "View already exists."
            });
        }

        throw error;
      }
    }
  );
}
