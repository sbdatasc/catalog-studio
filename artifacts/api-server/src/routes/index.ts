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
import { authenticateOptional } from "../middleware/authenticateOptional";
import { requirePlatformAdmin } from "../middleware/requirePlatformAdmin";

const router: IRouter = Router();

router.use(healthRouter);

// Auth routes (A-01) — public
router.use("/auth", authRouter);

// Admin routes (A-03) — protected: authenticate + requirePlatformAdmin
router.use("/admin/users", authenticate, requirePlatformAdmin, adminUsersRouter);

// Catalog role routes (A-04) — protected: authenticate; per-route permission checks in service
router.use("/catalog-roles", authenticate, catalogRolesRouter);

// Catalog routes — authenticateOptional so POST can record the creator
router.use("/catalogs", authenticateOptional, catalogsRouter);

// Schema routes (templates, sections, attributes, relationships, publish)
router.use("/schema/templates", templatesRouter);
router.use("/schema/sections", sectionsRouter);
router.use("/schema/attributes", attributesRouter);
router.use("/schema/relationships", relationshipsRouter);
router.use("/schema/publish", publishRouter);

// Entry routes (O-01)
router.use("/entries", entriesRouter);

// GraphQL engine (G-01)
router.use("/graphql", graphqlRouter);

export default router;
