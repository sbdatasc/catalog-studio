import { Router, type IRouter } from "express";
import { z } from "zod";
import { graphql } from "graphql";
import { getOrBuildSchema, SchemaUnreadyError } from "../graphql/engine";
import { buildSlugMap } from "../graphql/engine";
import { getDb } from "../db/connection";
import type { GraphQLContext } from "../graphql/context";
import { ServiceError } from "../lib/errors";
import { requireCatalogRole } from "../middleware/requireCatalogRole";

const router: IRouter = Router();

const GraphQLRequestBody = z.object({
  query: z.string().min(1, "query must be a non-empty string"),
  variables: z.record(z.unknown()).optional(),
});

router.post(
  "/",
  requireCatalogRole("viewer", (req) => {
    const variables = req.body?.variables;
    const catalogId = variables?.catalogId;
    if (!catalogId || typeof catalogId !== "string") {
      throw new ServiceError("NOT_FOUND", "catalogId variable is required");
    }
    return catalogId;
  }),
  async (req, res) => {
    try {
      const parseResult = GraphQLRequestBody.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          data: null,
          error: {
            code: "GRAPHQL_QUERY_INVALID",
            message: parseResult.error.errors.map((e) => e.message).join("; "),
          },
        });
      }

      const { query, variables } = parseResult.data;

      const catalogId = variables?.catalogId;
      if (!catalogId || typeof catalogId !== "string") {
        return res.status(400).json({
          data: null,
          error: {
            code: "VALIDATION_ERROR",
            message: "catalogId variable is required",
          },
        });
      }

      const db = getDb();
      const { schema, snapshot, slugMap } = await getOrBuildSchema(db, catalogId);

      const context: GraphQLContext = {
        db,
        snapshot,
        slugMap,
        depth: 0,
        catalogId,
      };

      const result = await graphql({
        schema,
        source: query,
        contextValue: context,
        variableValues: variables,
      });

      if (result.errors && result.errors.length > 0) {
        return res.status(400).json({
          data: null,
          error: {
            code: "GRAPHQL_QUERY_INVALID",
            message: result.errors[0].message,
          },
        });
      }

      return res.status(200).json({ data: result.data ?? null, error: null });
    } catch (err) {
      if (err instanceof SchemaUnreadyError) {
        return res.status(503).json({
          data: null,
          error: {
            code: "GRAPHQL_SCHEMA_UNREADY",
            message: "No published schema found for this catalog. Publish the schema first.",
          },
        });
      }
      if (err instanceof ServiceError) {
        return res.status(400).json({
          data: null,
          error: { code: err.code, message: err.message },
        });
      }
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          data: null,
          error: { code: "VALIDATION_ERROR", message: err.errors.map((e) => e.message).join("; ") },
        });
      }
      console.error("GraphQL route unexpected error:", err);
      return res.status(500).json({
        data: null,
        error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
      });
    }
  },
);

export default router;
