import { Router, type IRouter } from "express";
import healthRouter from "./health";
import catalogsRouter from "./catalogs";
import templatesRouter from "./schema/templates";
import sectionsRouter from "./schema/sections";
import attributesRouter from "./schema/attributes";

const router: IRouter = Router();

router.use(healthRouter);

// Catalog routes
router.use("/catalogs", catalogsRouter);

// Schema routes (templates, sections, attributes)
router.use("/schema/templates", templatesRouter);
router.use("/schema/sections", sectionsRouter);
router.use("/schema/attributes", attributesRouter);

export default router;
