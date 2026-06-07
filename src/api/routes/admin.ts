import { Router } from "express";
import { env } from "../../config/env";
import {
  flagSubmission,
  founderAirdropPoints,
  founderReviewSubmission,
} from "../../services/adminService";
import { asyncHandler } from "../middleware/asyncHandler";
import {
  flagSubmissionSchema,
  founderAirdropSchema,
  founderReviewSchema,
} from "../validators/schemas";

export const adminRouter = Router();

adminRouter.post(
  "/api/admin/airdrop",
  asyncHandler(async (req, res) => {
    const body = founderAirdropSchema.parse(req.body);
    const result = await founderAirdropPoints(
      body.adminFid,
      body.targetFid,
      body.amount,
      body.reason,
      env.founderFids,
    );
    res.status(201).json({ data: result });
  }),
);

adminRouter.post(
  "/api/flags",
  asyncHandler(async (req, res) => {
    const body = flagSubmissionSchema.parse(req.body);
    const result = await flagSubmission(body.reporterFid, body.castHash, body.reason);
    res.status(201).json({ data: result });
  }),
);

adminRouter.post(
  "/api/admin/review",
  asyncHandler(async (req, res) => {
    const body = founderReviewSchema.parse(req.body);
    const result = await founderReviewSubmission(
      body.adminFid,
      body.castHash,
      body.action,
      body.reason,
      env.founderFids,
    );
    res.json({ data: result });
  }),
);
