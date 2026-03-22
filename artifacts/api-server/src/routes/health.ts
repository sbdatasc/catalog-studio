import { Router, type IRouter } from "express";
import type { HealthStatus } from "@workspace/api-zod";
import { sendSuccess } from "../lib/response";

const router: IRouter = Router();

router.get("/healthz", (_req, res): void => {
  const data: HealthStatus = { status: "ok" };
  sendSuccess(res, data);
});

export default router;
