import type {
  FastifyInstance,
} from "fastify";

import { z } from "zod";

import {
  requireRole,
} from "../auth/guard.js";

import {
  createDatasetType,
  deleteDatasetType,
  getDatasetClassId,
  getDatasetClassMap,
  getDatasetType,
  getDatasetTypes,
  getDatasetUploads,
  updateDatasetType,
} from "./service.js";

const idSchema =
  z.string().uuid();

const createDatasetTypeSchema =
  z.object({
    name:
      z.string()
        .trim()
        .min(1)
        .max(100),

    description:
      z.string()
        .trim()
        .max(500)
        .nullable()
        .optional(),

    classes:
      z.array(
        z.object({
          class_id:
            z.number()
              .int()
              .nonnegative(),

          class_name:
            z.string()
              .trim()
              .min(1)
              .max(100),
        }),
      )
      .min(1),
  });

const updateDatasetTypeSchema =
  z.object({
    name:
      z.string()
        .trim()
        .min(1)
        .max(100)
        .optional(),

    description:
      z.string()
        .trim()
        .max(500)
        .nullable()
        .optional(),
  });

const uploadQuerySchema =
  z.object({
    clientId:
      z.string()
        .uuid()
        .optional(),

    viewId:
      z.string()
        .uuid()
        .optional(),

    datasetTypeId:
      z.string()
        .uuid()
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
        .default(50),
  });

function getRouteId(
  request: {
    params: unknown;
  },
) {
  return idSchema.safeParse(
    (
      request.params as {
        id?: string;
      }
    ).id,
  );
}

export async function registerDatasetRoutes(
  app: FastifyInstance,
) {
  app.get(
    "/api/dataset-types",
    {
      preHandler:
        requireRole(
          "admin",
          "editor",
          "viewer",
        ),
    },
    async () => {
      return getDatasetTypes();
    },
  );

  app.post(
    "/api/dataset-types",
    {
      preHandler:
        requireRole(
          "admin",
          "editor",
        ),
    },
    async (
      request,
      reply,
    ) => {
      const parsed =
        createDatasetTypeSchema.safeParse(
          request.body,
        );

      if (!parsed.success) {
        return reply
          .code(400)
          .send({
            message:
              "Invalid dataset type.",
            errors:
              parsed.error.flatten(),
          });
      }

      const classIds =
        parsed.data.classes.map(
          (item) =>
            item.class_id,
        );

      const classNames =
        parsed.data.classes.map(
          (item) =>
            item.class_name
              .trim()
              .toLowerCase(),
        );

      if (
        new Set(classIds).size !==
        classIds.length
      ) {
        return reply
          .code(400)
          .send({
            message:
              "Class IDs must be unique.",
          });
      }

      if (
        new Set(classNames).size !==
        classNames.length
      ) {
        return reply
          .code(400)
          .send({
            message:
              "Class names must be unique.",
          });
      }

      try {
        return await createDatasetType(
          parsed.data,
        );
      } catch (error) {
        if (
          error &&
          typeof error ===
            "object" &&
          "code" in error &&
          error.code ===
            "23505"
        ) {
          return reply
            .code(409)
            .send({
              message:
                "Dataset type already exists.",
            });
        }

        throw error;
      }
    },
  );

  app.get(
    "/api/dataset-types/:id",
    {
      preHandler:
        requireRole(
          "admin",
          "editor",
          "viewer",
        ),
    },
    async (
      request,
      reply,
    ) => {
      const parsed =
        getRouteId(request);

      if (!parsed.success) {
        return reply
          .code(400)
          .send({
            message:
              "Invalid dataset type ID.",
          });
      }

      const datasetType =
        await getDatasetType(
          parsed.data,
        );

      if (!datasetType) {
        return reply
          .code(404)
          .send({
            message:
              "Dataset type not found.",
          });
      }

      return datasetType;
    },
  );

  app.patch(
    "/api/dataset-types/:id",
    {
      preHandler:
        requireRole(
          "admin",
          "editor",
        ),
    },
    async (
      request,
      reply,
    ) => {
      const id =
        getRouteId(request);

      if (!id.success) {
        return reply
          .code(400)
          .send({
            message:
              "Invalid dataset type ID.",
          });
      }

      const parsed =
        updateDatasetTypeSchema.safeParse(
          request.body,
        );

      if (!parsed.success) {
        return reply
          .code(400)
          .send({
            message:
              "Invalid dataset type.",
            errors:
              parsed.error.flatten(),
          });
      }

      try {
        const result =
          await updateDatasetType(
            id.data,
            parsed.data,
          );

        if (!result) {
          return reply
            .code(404)
            .send({
              message:
                "Dataset type not found.",
            });
        }

        return result;
      } catch (error) {
        if (
          error &&
          typeof error ===
            "object" &&
          "code" in error &&
          error.code ===
            "23505"
        ) {
          return reply
            .code(409)
            .send({
              message:
                "Dataset type name already exists.",
            });
        }

        throw error;
      }
    },
  );

  app.delete(
    "/api/dataset-types/:id",
    {
      preHandler:
        requireRole(
          "admin",
          "editor",
        ),
    },
    async (
      request,
      reply,
    ) => {
      const id =
        getRouteId(request);

      if (!id.success) {
        return reply
          .code(400)
          .send({
            message:
              "Invalid dataset type ID.",
          });
      }

      try {
        const deleted =
          await deleteDatasetType(
            id.data,
          );

        if (!deleted) {
          return reply
            .code(404)
            .send({
              message:
                "Dataset type not found.",
            });
        }

        return {
          success: true,
        };
      } catch (error) {
        if (
          error &&
          typeof error ===
            "object" &&
          "code" in error &&
          error.code ===
            "23503"
        ) {
          return reply
            .code(409)
            .send({
              message:
                "Dataset type cannot be deleted because it is already used by an upload.",
            });
        }

        throw error;
      }
    },
  );

  app.get(
    "/api/dataset-types/:id/classes",
    {
      preHandler:
        requireRole(
          "admin",
          "editor",
          "viewer",
        ),
    },
    async (
      request,
      reply,
    ) => {
      const id =
        getRouteId(request);

      if (!id.success) {
        return reply
          .code(400)
          .send({
            message:
              "Invalid dataset type ID.",
          });
      }

      const datasetType =
        await getDatasetType(
          id.data,
        );

      if (!datasetType) {
        return reply
          .code(404)
          .send({
            message:
              "Dataset type not found.",
          });
      }

      return datasetType.classes;
    },
  );

  app.get(
    "/api/dataset-types/:id/class-map",
    {
      preHandler:
        requireRole(
          "admin",
          "editor",
          "viewer",
        ),
    },
    async (
      request,
      reply,
    ) => {
      const id =
        getRouteId(request);

      if (!id.success) {
        return reply
          .code(400)
          .send({
            message:
              "Invalid dataset type ID.",
          });
      }

      const datasetType =
        await getDatasetType(
          id.data,
        );

      if (!datasetType) {
        return reply
          .code(404)
          .send({
            message:
              "Dataset type not found.",
          });
      }

      const classMap =
        await getDatasetClassMap(
          id.data,
        );

      return Object.fromEntries(
        classMap,
      );
    },
  );

  app.get(
    "/api/dataset-types/:id/class-id",
    {
      preHandler:
        requireRole(
          "admin",
          "editor",
          "viewer",
        ),
    },
    async (
      request,
      reply,
    ) => {
      const id =
        getRouteId(request);

      if (!id.success) {
        return reply
          .code(400)
          .send({
            message:
              "Invalid dataset type ID.",
          });
      }

      const query =
        z.object({
          className:
            z.string()
              .trim()
              .min(1),
        }).safeParse(
          request.query,
        );

      if (!query.success) {
        return reply
          .code(400)
          .send({
            message:
              "className is required.",
          });
      }

      const datasetType =
        await getDatasetType(
          id.data,
        );

      if (!datasetType) {
        return reply
          .code(404)
          .send({
            message:
              "Dataset type not found.",
          });
      }

      const classId =
        await getDatasetClassId(
          id.data,
          query.data.className,
        );

      if (classId === null) {
        return reply
          .code(404)
          .send({
            message:
              "Class is not part of this dataset type.",
          });
      }

      return {
        class_name:
          query.data.className,
        class_id:
          classId,
      };
    },
  );

  app.get(
    "/api/dataset-uploads",
    {
      preHandler:
        requireRole(
          "admin",
          "editor",
          "viewer",
        ),
    },
    async (request) => {
      const query =
        uploadQuerySchema.parse(
          request.query,
        );

      const offset =
        (query.page - 1) *
        query.limit;

      const result =
        await getDatasetUploads({
          clientId:
            query.clientId,
          viewId:
            query.viewId,
          datasetTypeId:
            query.datasetTypeId,
          limit:
            query.limit,
          offset,
        });

      return {
        items:
          result.items,
        page:
          query.page,
        limit:
          query.limit,
        total:
          result.total,
        totalPages:
          Math.ceil(
            result.total /
              query.limit,
          ),
      };
    },
  );
}