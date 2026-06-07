import { z } from "zod";

export const fidSchema = z.coerce.number().int().positive();

export const processChannelPostSchema = z.object({
  fid: fidSchema,
  castHash: z.string().min(1),
  likes: z.coerce.number().int().min(0),
  recasts: z.coerce.number().int().min(0),
  premiumInteractions: z.coerce.number().int().min(0),
});

export const submitFitPicSchema = z.object({
  farcasterFid: fidSchema,
  farcasterCastHash: z.string().min(1),
  imageUrl: z.string().url(),
  hasPhysicalProof: z.boolean().default(false),
});

export const castVoteSchema = z.object({
  voterFid: fidSchema,
  castHash: z.string().min(1),
});

export const founderAirdropSchema = z.object({
  adminFid: fidSchema,
  targetFid: fidSchema,
  amount: z.coerce.number().int().positive(),
  reason: z.string().min(3),
});

export const flagSubmissionSchema = z.object({
  reporterFid: fidSchema,
  castHash: z.string().min(1),
  reason: z.string().min(3),
});

export const founderReviewSchema = z.object({
  adminFid: fidSchema,
  castHash: z.string().min(1),
  action: z.enum(["APPROVE", "REJECT"]),
  reason: z.string().min(3),
});

export const votingFeedQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  epochId: z.string().optional(),
});
