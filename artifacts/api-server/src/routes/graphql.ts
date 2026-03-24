import { Router, type IRouter } from "express";
import { z } from "zod";
import { graphql } from "graphql";
import { getOrBuildSchema, SchemaUnreadyError } from "../graphql/engine";
import { getDb } from "../db/connection";
import type { GraphQLContext } from "../graphql/context";
import { ServiceError } from "../lib/errors";
import * as catalogRoleService from "../services/catalogRoleService";

const router: IRouter = Router();

const GraphQLRequestBody = z.object({
  query: z.string().min(1, "query must be a non-empty string"),
  variables: z.record(z.unknown()).optional(),
});

router.post("/", async (req, res) => {
  try {
    // --- 1. Parse request body ---
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

    // --- 2. Authentication check ---
    if (!req.user) {
      return res.status(401).json({
        data: null,
        error: { code: "UNAUTHORIZED", message: "Authentication required." },
      });
    }

    // --- 3. Resolve catalog role once per request (api_consumer allowed) ---
    let userCatalogRole: catalogRoleService.CatalogRole | "platform_admin" | null;

    if (req.user.systemRole === "platform_admin") {
      userCatalogRole = "platform_admin";
    } else {
      userCatalogRole = await catalogRoleService.getUserCatalogRole(catalogId, req.user.id);
      if (!userCatalogRole) {
        return res.status(403).json({
          data: null,
          error: { code: "FORBIDDEN", message: "You do not have access to this catalog." },
        });
      }
    }

    // --- 4. Build GraphQL schema + context ---
    const db = getDb();
    const { schema, snapshot, slugMap } = await getOrBuildSchema(db, catalogId);

    const context: GraphQLContext = {
      db,
      snapshot,
      slugMap,
      depth: 0,
      catalogId,
      userId: req.user.id,
      userCatalogRole,
    };

    // --- 5. Execute ---
    const result = await graphql({
      schema,
      source: query,
      contextValue: context,
      variableValues: variables,
    });

    // --- 6. Return standard GraphQL response ---
    // Resolver-level errors (FORBIDDEN, REFERENCE_NOT_FOUND, etc.) are returned
    // in `errors[]` with extensions.code — the HTTP status is still 200.
    const response: Record<string, unknown> = { data: result.data ?? null, error: null };
    if (result.errors && result.errors.length > 0) {
      response.errors = result.errors.map((e) => ({
        message: e.message,
        extensions: e.extensions ?? {},
      }));
    }
    return res.status(200).json(response);
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
});

export default router;
