import { Router, type IRouter } from "express";
import healthRouter from "./health";
import entityTypesRouter from "./schema/entityTypes";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/schema/entity-types", entityTypesRouter);

export default router;
