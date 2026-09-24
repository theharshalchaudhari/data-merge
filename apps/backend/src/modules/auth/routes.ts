import type {
  FastifyInstance
} from "fastify";

import { z } from "zod";

import {
  env
} from "../../config/env.js";

import {
  authenticate,
  createSession,
  createUser,
  deleteSession,
  getSessionUser,
  sessionCookieOptions
} from "./service.js";

const registerSchema =
  z.object({
    name:
      z.string()
        .min(2)
        .max(100),

    username:
      z.string()
        .min(3)
        .max(50),

    email:
      z.string()
        .email(),

    password:
      z.string()
        .min(8)
        .max(200)
  });

const loginSchema =
  z.object({
    username:
      z.string()
        .min(1),

    password:
      z.string()
        .min(1)
  });

export async function registerAuthRoutes(
  app: FastifyInstance
) {
  app.post(
    "/api/auth/register",
    async (
      request,
      reply
    ) => {
      const input =
        registerSchema.parse(
          request.body
        );

      try {
        const user =
          await createUser(
            input
          );

        return reply
          .code(201)
          .send({
            user,
            message:
              "Registration successful. Waiting for administrator approval."
          });
      } catch (error: any) {
        if (
          error?.code ===
          "23505"
        ) {
          return reply
            .code(409)
            .send({
              message:
                "Username or email already exists."
            });
        }

        throw error;
      }
    }
  );

  app.post(
    "/api/auth/login",
    async (
      request,
      reply
    ) => {
      const input =
        loginSchema.parse(
          request.body
        );

      const user =
        await authenticate(
          input.username,
          input.password
        );

      if (!user) {
        return reply
          .code(401)
          .send({
            message:
              "Invalid username or password."
          });
      }

      if (
        user.role ===
        "pending"
      ) {
        return reply
          .code(403)
          .send({
            message:
              "Your account is waiting for administrator approval."
          });
      }

      const token =
        await createSession(
          user.id
        );

      reply.setCookie(
        env.SESSION_COOKIE_NAME,
        token,
        sessionCookieOptions
      );

      return {
        user
      };
    }
  );

  app.post(
    "/api/auth/logout",
    async (
      request,
      reply
    ) => {
      const token =
        request.cookies[
          env.SESSION_COOKIE_NAME
        ];

      if (token) {
        await deleteSession(
          token
        );
      }

      reply.clearCookie(
        env.SESSION_COOKIE_NAME,
        {
          path: "/"
        }
      );

      return {
        success: true
      };
    }
  );

  app.get(
    "/api/auth/me",
    async (
      request,
      reply
    ) => {
      const token =
        request.cookies[
          env.SESSION_COOKIE_NAME
        ];

      if (!token) {
        return reply
          .code(401)
          .send({
            message:
              "Not authenticated."
          });
      }

      const user =
        await getSessionUser(
          token
        );

      if (!user) {
        return reply
          .code(401)
          .send({
            message:
              "Session expired."
          });
      }

      return {
        user
      };
    }
  );
}
