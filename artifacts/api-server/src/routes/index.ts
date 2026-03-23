import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import catalogsRouter from "./catalogs";
import templatesRouter from "./schema/templates";
import sectionsRouter from "./schema/sections";
import attributesRouter from "./schema/attributes";
import relationshipsRouter from "./schema/relationships";
import publishRouter from "./schema/publish";
import entriesRouter from "./entries";
import graphqlRouter from "./graphql";
import adminUsersRouter from "./admin/users";
import catalogRolesRouter from "./catalogRoles";
import { authenticate } from "../middleware/authenticate";
import { requirePlatformAdmin } from "../middleware/requirePlatformAdmin";

const router: IRouter = Router();

router.use(healthRouter);

// Auth routes (A-01) — public
router.use("/auth", authRouter);

// Admin routes (A-03) — protected: authenticate + requirePlatformAdmin
router.use("/admin/users", authenticate, requirePlatformAdmin, adminUsersRouter);

// Catalog role routes (A-04) — protected: authenticate; per-route permission checks in service
router.use("/catalog-roles", authenticate, catalogRolesRouter);

// Catalog routes (A-05) — authenticate required; per-route requireCatalogRole inside router
router.use("/catalogs", authenticate, catalogsRouter);

// Schema routes (A-05) — authenticate required; per-route requireCatalogRole inside each router
router.use("/schema/templates", authenticate, templatesRouter);
router.use("/schema/sections", authenticate, sectionsRouter);
router.use("/schema/attributes", authenticate, attributesRouter);
router.use("/schema/relationships", authenticate, relationshipsRouter);
router.use("/schema/publish", authenticate, publishRouter);

// Entry routes (A-05) — authenticate required; per-route requireCatalogRole inside router
router.use("/entries", authenticate, entriesRouter);

// GraphQL engine (A-05) — authenticate required; requireCatalogRole inside router
router.use("/graphql", authenticate, graphqlRouter);

export default router;
