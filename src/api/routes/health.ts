import { Router } from "express";
import { getOrCreateCurrentEpoch } from "../../services/epochService";
import { asyncHandler } from "../middleware/asyncHandler";

export const healthRouter = Router();

healthRouter.get(
  "/health",
  asyncHandler(async (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  }),
);

healthRouter.get(
  "/api/epoch/current",
  asyncHandler(async (_req, res) => {
    const epoch = await getOrCreateCurrentEpoch();
    res.json({ data: epoch });
  }),
);
