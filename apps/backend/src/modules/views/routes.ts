import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../../db/client.js";
import { requireRole } from "../auth/guard.js";

const viewSchema = z.object({
  clientId: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
});

const clientIdSchema = z.object({
  clientId: z.string().uuid(),
});

export async function registerViewRoutes(
  app: FastifyInstance,
) {
  app.get(
    "/api/views",
    {
      preHandler: requireRole(
        "admin",
        "editor",
        "viewer",
      ),
    },
    async (request, reply) => {
      const query = clientIdSchema.safeParse(
        request.query,
      );

      if (!query.success) {
        return reply.code(400).send({
          message:
            "A valid clientId is required.",
        });
      }

      const result = await db.query(
        `
          SELECT
            id,
            client_id,
            name,
            description,
            created_at,
            updated_at
          FROM views
          WHERE client_id = $1
          ORDER BY name
        `,
        [query.data.clientId],
      );

      return result.rows;
    },
  );

  app.post(
    "/api/views",
    {
      preHandler: requireRole("admin"),
    },
    async (request, reply) => {
      const parsed = viewSchema.safeParse(
        request.body,
      );

      if (!parsed.success) {
        return reply.code(400).send({
          message:
            "Invalid view data.",
          errors: parsed.error.flatten(),
        });
      }

      const input = parsed.data;

      const clientResult =
        await db.query(
          `
            SELECT
              id
            FROM clients
            WHERE id = $1
            LIMIT 1
          `,
          [input.clientId],
        );

      if (
        clientResult.rows.length === 0
      ) {
        return reply.code(404).send({
          message:
            "Selected client was not found.",
        });
      }

      try {
        const result =
          await db.query(
            `
              INSERT INTO views (
                client_id,
                name,
                description
              )
              VALUES (
                $1,
                $2,
                $3
              )
              RETURNING
                id,
                client_id,
                name,
                description,
                created_at,
                updated_at
            `,
            [
              input.clientId,
              input.name.trim(),
              input.description?.trim() ||
                null,
            ],
          );

        return reply
          .code(201)
          .send(result.rows[0]);
      } catch (error: unknown) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "23505"
        ) {
          return reply
            .code(409)
            .send({
              message:
                "A view with this name already exists for this client.",
            });
        }

        throw error;
      }
    },
  );
}