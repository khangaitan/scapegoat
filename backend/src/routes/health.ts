import { Router, type IRouter } from "express";
import { z } from "zod";

const HealthCheckResponse = z.object({ status: z.enum(["ok"]) });
const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  res.json(HealthCheckResponse.parse({ status: "ok" }));
});

export default router;
