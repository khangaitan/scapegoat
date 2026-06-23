import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { generateHostCode, listHostCodes } from "../lib/hostCodes";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  // Header-only to avoid leaking the token via browser history, referer
  // headers, or reverse-proxy access logs.
  const token = req.headers["x-admin-token"] as string | undefined;
  if (!token || token !== expected) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

router.get("/admin/codes", requireAdmin, async (_req, res) => {
  try {
    const codes = await listHostCodes();
    res.json({ codes });
  } catch (e: any) {
    logger.error({ err: e }, "list host codes failed");
    res.status(500).json({ error: e?.message || "failed" });
  }
});

router.post("/admin/codes", requireAdmin, async (req, res) => {
  try {
    const note = typeof req.body?.note === "string" ? req.body.note.slice(0, 200) : undefined;
    const code = await generateHostCode(note);
    res.json({ code });
  } catch (e: any) {
    logger.error({ err: e }, "generate host code failed");
    res.status(500).json({ error: e?.message || "failed" });
  }
});

export default router;
