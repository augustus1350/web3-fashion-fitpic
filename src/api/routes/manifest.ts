import { Router } from "express";
import { env } from "../../config/env";
import { asyncHandler } from "../middleware/asyncHandler";

export const manifestRouter = Router();

manifestRouter.get(
  "/.well-known/farcaster.json",
  asyncHandler(async (_req, res) => {
    const baseUrl = env.appUrl ?? "https://example.com";
    const image =
      "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400&auto=format&fit=crop";

    res.json({
      accountAssociation: env.accountAssociation ?? {
        header: "PLACEHOLDER",
        payload: "PLACEHOLDER",
        signature: "PLACEHOLDER",
      },
      frame: {
        version: "1",
        name: "FitPic PoC",
        iconUrl: image,
        homeUrl: `${baseUrl}/frames`,
        splashImageUrl: image,
        splashBackgroundColor: "#111111",
        heroImageUrl: image,
        tagline: "Submit and vote on FitPics",
        ogTitle: "FitPic",
        ogDescription: "Farcaster-native fashion voting PoC",
        ogImageUrl: image,
      },
    });
  }),
);
