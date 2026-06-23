import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import storyRouter from "./story.js";
import adminRouter from "./admin.js";

const router: IRouter = Router();
router.use(healthRouter);
router.use(storyRouter);
router.use(adminRouter);

export default router;
