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

const roleSchema =
  z.object({
    role:
      z.enum([
        "admin",
        "editor",
        "viewer",
        "pending"
      ])
  });

export async function registerUserRoutes(
  app: FastifyInstance
) {
  app.get(
    "/api/users",
    {
      preHandler:
        requireRole("admin")
    },
    async () => {
      const result =
        await db.query(`
          SELECT
            id,
            name,
            username,
            email,
            role,
            created_at,
            updated_at
          FROM users
          ORDER BY created_at DESC
        `);

      return result.rows;
    }
  );

  app.patch(
    "/api/users/:id/role",
    {
      preHandler:
        requireRole("admin")
    },
    async (
      request,
      reply
    ) => {
      const params =
        z.object({
          id:
            z.string().uuid()
        }).parse(
          request.params
        );

      const input =
        roleSchema.parse(
          request.body
        );

      const result =
        await db.query(
          `
          UPDATE users
          SET role = $1
          WHERE id = $2
          RETURNING
            id,
            name,
            username,
            email,
            role,
            created_at,
            updated_at
          `,
          [
            input.role,
            params.id
          ]
        );

      if (
        !result.rows[0]
      ) {
        return reply
          .code(404)
          .send({
            message:
              "User not found."
          });
      }

      return result.rows[0];
    }
  );
}
