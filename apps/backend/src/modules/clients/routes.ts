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

const clientSchema =
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

const clientIdSchema =
  z.object({
    id:
      z.string()
        .uuid()
  });

export async function registerClientRoutes(
  app: FastifyInstance
) {
  app.get(
    "/api/clients",
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
          FROM clients
          ORDER BY name
        `);

      return result.rows;
    }
  );

  app.post(
    "/api/clients",
    {
      preHandler:
        requireRole(
          "admin",
          "editor"
        )
    },
    async (
      request,
      reply
    ) => {
      const input =
        clientSchema.parse(
          request.body
        );

      try {
        const result =
          await db.query(
            `
            INSERT INTO clients
            (
              name,
              description
            )
            VALUES
            ($1, $2)
            RETURNING *
            `,
            [
              input.name.trim(),
              input.description?.trim() ||
                null
            ]
          );

        return reply
          .code(201)
          .send(
            result.rows[0]
          );
      } catch (
        error: any
      ) {
        if (
          error?.code ===
          "23505"
        ) {
          return reply
            .code(409)
            .send({
              message:
                "Client already exists."
            });
        }

        throw error;
      }
    }
  );

  app.delete(
    "/api/clients/:id",
    {
      preHandler:
        requireRole(
          "admin",
          "editor"
        )
    },
    async (
      request,
      reply
    ) => {
      const parsed =
        clientIdSchema.safeParse(
          request.params
        );

      if (!parsed.success) {
        return reply
          .code(400)
          .send({
            message:
              "Invalid client ID."
          });
      }

      const metadataResult =
        await db.query(
          `
          SELECT COUNT(*)::int AS count
          FROM metadata
          WHERE client_id = $1
          `,
          [
            parsed.data.id
          ]
        );

      if (
        metadataResult.rows[0].count >
        0
      ) {
        return reply
          .code(409)
          .send({
            message:
              "This client cannot be deleted because it contains metadata."
          });
      }

      const result =
        await db.query(
          `
          DELETE FROM clients
          WHERE id = $1
          RETURNING id
          `,
          [
            parsed.data.id
          ]
        );

      if (
        result.rows.length ===
        0
      ) {
        return reply
          .code(404)
          .send({
            message:
              "Client not found."
          });
      }

      return reply.send({
        success: true
      });
    }
  );
}