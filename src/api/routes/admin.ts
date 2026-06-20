import { Router } from "express";
import { env } from "../../config/env";
import {
  flagSubmission,
  founderAirdropPoints,
  founderRemoveSubmission,
  founderReviewSubmission,
} from "../../services/adminService";
import { renderAdminPage } from "../../services/adminHtml";
import { asyncHandler } from "../middleware/asyncHandler";
import {
  flagSubmissionSchema,
  founderAirdropSchema,
  founderRemoveSchema,
  founderReviewSchema,
} from "../validators/schemas";
import { resolveBaseUrl } from "./frames";

export const adminRouter = Router();

adminRouter.get(
  "/admin",
  asyncHandler(async (req, res) => {
    res
      .status(200)
      .setHeader("Content-Type", "text/html; charset=utf-8")
      .send(renderAdminPage({ baseUrl: resolveBaseUrl(req) }));
  }),
);

adminRouter.post(
  "/api/admin/remove",
  asyncHandler(async (req, res) => {
    const body = founderRemoveSchema.parse(req.body);
    const result = await founderRemoveSubmission(
      body.adminFid,
      body.castHash,
      body.reason,
      env.founderFids,
    );
    res.json({ data: result });
  }),
);

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
