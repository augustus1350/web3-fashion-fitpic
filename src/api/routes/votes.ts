import { Router } from "express";
import { submitVote } from "../../services/epochService";
import { getOrCreateFrameUser } from "../../services/frameUserService";
import { asyncHandler } from "../middleware/asyncHandler";
import { castVoteSchema } from "../validators/schemas";

export const votesRouter = Router();

votesRouter.post(
  "/api/votes",
  asyncHandler(async (req, res) => {
    const body = castVoteSchema.parse(req.body);
    const result = await submitVote(body.voterFid, body.castHash);
    res.status(201).json({ data: result });
  }),
);

/** Mini App vote: creates the voter if needed and ignores phase gating. */
votesRouter.post(
  "/api/votes/cast",
  asyncHandler(async (req, res) => {
    const fid = Number(req.body?.fid);
    const castHash = String(req.body?.castHash ?? "").trim();
    if (!Number.isInteger(fid) || fid <= 0) {
      res.status(400).json({ error: { message: "Valid fid is required" } });
      return;
    }
    if (!castHash) {
      res.status(400).json({ error: { message: "castHash is required" } });
      return;
    }

    await getOrCreateFrameUser(fid);
    const result = await submitVote(fid, castHash, { enforcePhase: false });
    res.status(201).json({ data: result });
  }),
);
