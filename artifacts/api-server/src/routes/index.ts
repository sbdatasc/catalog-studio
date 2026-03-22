import { Router, type IRouter } from "express";
import healthRouter from "./health";
import templatesRouter from "./schema/templates";
import sectionsRouter from "./schema/sections";
import attributesRouter from "./schema/attributes";
import referenceDataRouter from "./referenceData";

const router: IRouter = Router();

router.use(healthRouter);

// Schema routes
router.use("/schema/templates", templatesRouter);
router.use("/schema/sections", sectionsRouter);
router.use("/schema/attributes", attributesRouter);

// Reference data routes
router.use("/reference-data", referenceDataRouter);

export default router;
