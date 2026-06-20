import { Router } from "express";
import { getVotingFeed, submitFitPic } from "../../services/epochService";
import { resolveCastImage } from "../../services/castResolver";
import { getOrCreateFrameUser } from "../../services/frameUserService";
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

/** Resolve a Farcaster cast link to its image without creating a submission. */
submissionsRouter.post(
  "/api/cast/preview",
  asyncHandler(async (req, res) => {
    const castUrl = String(req.body?.castUrl ?? "").trim();
    const resolved = await resolveCastImage(castUrl);
    res.json({ data: { imageUrl: resolved.imageUrl, castHash: resolved.castHash } });
  }),
);

/** Submit a FitPic by linking to a cast you posted on Farcaster. */
submissionsRouter.post(
  "/api/submissions/from-cast",
  asyncHandler(async (req, res) => {
    const fid = Number(req.body?.fid);
    const castUrl = String(req.body?.castUrl ?? "").trim();
    if (!Number.isInteger(fid) || fid <= 0) {
      res.status(400).json({ error: { message: "Valid fid is required" } });
      return;
    }

    await getOrCreateFrameUser(fid);
    const resolved = await resolveCastImage(castUrl);

    const submission = await submitFitPic({
      farcasterFid: fid,
      farcasterCastHash: resolved.castHash,
      imageUrl: resolved.imageUrl,
      hasPhysicalProof: false,
    });

    res.status(201).json({
      data: {
        id: submission.id,
        imageUrl: resolved.imageUrl,
        castHash: resolved.castHash,
        sourceUrl: resolved.sourceUrl,
      },
    });
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
