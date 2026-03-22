import { Router, type IRouter } from "express";
import healthRouter from "./health";
import catalogsRouter from "./catalogs";
import templatesRouter from "./schema/templates";
import sectionsRouter from "./schema/sections";
import attributesRouter from "./schema/attributes";
import relationshipsRouter from "./schema/relationships";

const router: IRouter = Router();

router.use(healthRouter);

// Catalog routes
router.use("/catalogs", catalogsRouter);

// Schema routes (templates, sections, attributes, relationships)
router.use("/schema/templates", templatesRouter);
router.use("/schema/sections", sectionsRouter);
router.use("/schema/attributes", attributesRouter);
router.use("/schema/relationships", relationshipsRouter);

export default router;
