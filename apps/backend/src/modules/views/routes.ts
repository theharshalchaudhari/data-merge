import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../../db/client.js";
import { requireRole } from "../auth/guard.js";

const viewSchema = z.object({
  clientId: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional()
});

const clientIdSchema = z.object({
  clientId: z.string().uuid()
});

const viewIdSchema = z.object({
  id: z.string().uuid()
});

const renameViewSchema = z.object({
  name: z.string().min(1).max(200)
});

export async function registerViewRoutes(app: FastifyInstance) {
  app.get(
    "/api/views",
    {
      preHandler: requireRole("admin", "editor", "viewer")
    },
    async (request, reply) => {
      const query = clientIdSchema.safeParse(request.query);

      if (!query.success) {
        return reply.code(400).send({
          message: "A valid clientId is required."
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
        [query.data.clientId]
      );

      return result.rows;
    }
  );

  app.post(
    "/api/views",
    {
      preHandler: requireRole("admin", "editor")
    },
    async (request, reply) => {
      const parsed = viewSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.code(400).send({
          message: "Invalid view data.",
          errors: parsed.error.flatten()
        });
      }

      const input = parsed.data;

      const clientResult = await db.query(
        `
        SELECT id
        FROM clients
        WHERE id = $1
        LIMIT 1
        `,
        [input.clientId]
      );

      if (clientResult.rows.length === 0) {
        return reply.code(404).send({
          message: "Selected client was not found."
        });
      }

      try {
        const result = await db.query(
          `
          INSERT INTO views (
            client_id,
            name,
            description
          )
          VALUES ($1, $2, $3)
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
            input.description?.trim() || null
          ]
        );

        return reply.code(201).send(result.rows[0]);
      } catch (error: any) {
        if (error?.code === "23505") {
          return reply.code(409).send({
            message:
              "A view with this name already exists for this client."
          });
        }

        throw error;
      }
    }
  );

  app.patch(
    "/api/views/:id",
    {
      preHandler: requireRole("admin", "editor")
    },
    async (request, reply) => {
      const params = viewIdSchema.safeParse(request.params);
      const body = renameViewSchema.safeParse(request.body);

      if (!params.success) {
        return reply.code(400).send({
          message: "Invalid view ID."
        });
      }

      if (!body.success) {
        return reply.code(400).send({
          message: "Invalid view name.",
          errors: body.error.flatten()
        });
      }

      try {
        const result = await db.query(
          `
          UPDATE views
          SET name = $1
          WHERE id = $2
          RETURNING
            id,
            client_id,
            name,
            description,
            created_at,
            updated_at
          `,
          [
            body.data.name.trim(),
            params.data.id
          ]
        );

        if (result.rows.length === 0) {
          return reply.code(404).send({
            message: "View not found."
          });
        }

        return reply.send(result.rows[0]);
      } catch (error: any) {
        if (error?.code === "23505") {
          return reply.code(409).send({
            message:
              "A view with this name already exists for this client."
          });
        }

        throw error;
      }
    }
  );

  app.delete(
    "/api/views/:id",
    {
      preHandler: requireRole("admin", "editor")
    },
    async (request, reply) => {
      const parsed = viewIdSchema.safeParse(request.params);

      if (!parsed.success) {
        return reply.code(400).send({
          message: "Invalid view ID."
        });
      }

      const metadataResult = await db.query(
        `
        SELECT COUNT(*)::int AS count
        FROM metadata
        WHERE view_id = $1
        `,
        [parsed.data.id]
      );

      if (metadataResult.rows[0].count > 0) {
        return reply.code(409).send({
          message:
            "This view cannot be deleted because it contains metadata."
        });
      }

      const result = await db.query(
        `
        DELETE FROM views
        WHERE id = $1
        RETURNING id
        `,
        [parsed.data.id]
      );

      if (result.rows.length === 0) {
        return reply.code(404).send({
          message: "View not found."
        });
      }

      return reply.send({
        success: true
      });
    }
  );
}