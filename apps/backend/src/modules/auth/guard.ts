import type {
  FastifyReply,
  FastifyRequest
} from "fastify";

import {
  env
} from "../../config/env.js";

import {
  getSessionUser,
  type AuthUser
} from "./service.js";

declare module "fastify" {
  interface FastifyRequest {
    authUser?: AuthUser;
  }
}

export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<AuthUser | null> {
  const token =
    request.cookies[
      env.SESSION_COOKIE_NAME
    ];

  if (!token) {
    await reply.code(401)
      .send({
        message:
          "Authentication required."
      });

    return null;
  }

  const user =
    await getSessionUser(
      token
    );

  if (!user) {
    await reply.code(401)
      .send({
        message:
          "Session expired."
      });

    return null;
  }

  request.authUser =
    user;

  return user;
}

export function requireRole(
  ...roles: AuthUser["role"][]
) {
  return async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const user =
      await requireAuth(
        request,
        reply
      );

    if (!user) {
      return;
    }

    if (
      !roles.includes(
        user.role
      )
    ) {
      await reply.code(403)
        .send({
          message:
            "Insufficient permissions."
        });
    }
  };
}
