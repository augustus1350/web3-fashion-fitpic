import { Router } from "express";
import { env } from "../../config/env";
import { getOrCreateCurrentEpoch } from "../../services/epochService";
import { renderAppPage } from "../../services/appHtml";
import { asyncHandler } from "../middleware/asyncHandler";
import { resolveBaseUrl } from "./frames";

export const appRouter = Router();

appRouter.get(
  "/app",
  asyncHandler(async (req, res) => {
    const baseUrl = resolveBaseUrl(req);
    const epoch = await getOrCreateCurrentEpoch();
    res
      .status(200)
      .setHeader("Content-Type", "text/html; charset=utf-8")
      .send(
        renderAppPage({
          baseUrl,
          phase: epoch.phase,
          devRoutes: env.enableDevRoutes || env.nodeEnv !== "production",
        }),
      );
  }),
);
