import { Router } from "express";
import { processChannelPost } from "../../services/farcasterChannelService";
import { asyncHandler } from "../middleware/asyncHandler";
import { processChannelPostSchema } from "../validators/schemas";

export const channelRouter = Router();

channelRouter.post(
  "/api/channel/process",
  asyncHandler(async (req, res) => {
    const body = processChannelPostSchema.parse(req.body);
    const result = await processChannelPost(
      body.fid,
      body.castHash,
      body.likes,
      body.recasts,
      body.premiumInteractions,
    );
    res.status(201).json({ data: result });
  }),
);
