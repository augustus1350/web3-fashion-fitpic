import { Router } from "express";
import { getVotingFeed, submitFitPic } from "../../services/epochService";
import { asyncHandler } from "../middleware/asyncHandler";
import { submitFitPicSchema, votingFeedQuerySchema } from "../validators/schemas";

export const submissionsRouter = Router();

submissionsRouter.post(
  "/api/submissions",
  asyncHandler(async (req, res) => {
    const body = submitFitPicSchema.parse(req.body);
    const submission = await submitFitPic(body);
    res.status(201).json({ data: submission });
  }),
);

submissionsRouter.get(
  "/api/feed",
  asyncHandler(async (req, res) => {
    const query = votingFeedQuerySchema.parse(req.query);
    const feed = await getVotingFeed({
      limit: query.limit,
      epochId: query.epochId,
    });
    res.json({
      data: feed,
      meta: {
        count: feed.length,
        rookieQuota: 0.2,
      },
    });
  }),
);
