import { Router } from "express";
import { submitVote } from "../../services/epochService";
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
