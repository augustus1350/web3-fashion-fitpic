import { prisma } from "../lib/prisma";
import {
  CHANNEL_POST_POINTS_CAP,
  POINTS_PER_LIKE,
  POINTS_PER_RECAST,
  PREMIUM_INTERACTION_EXPONENT,
} from "../config/constants";
import { AppError, assertNotBlocked } from "../errors/AppError";
import { utcDateOnly } from "../utils/date";
import { findUserByFid } from "./userService";

export interface ChannelPostEngagement {
  likes: number;
  recasts: number;
  /** Recasts/likes from high-reputation or OpenRank-premium accounts. */
  premiumInteractions: number;
}

export interface ProcessChannelPostResult {
  farcasterFid: number;
  castHash: string;
  pointsAwarded: number;
  capped: boolean;
  isFirstPostOfDay: boolean;
}

/**
 * Calculates engagement-weighted social points with an exponential premium boost
 * and enforces a strict per-post global cap.
 */
export function calculateEngagementPoints(engagement: ChannelPostEngagement): {
  rawPoints: number;
  cappedPoints: number;
  capped: boolean;
} {
  const { likes, recasts, premiumInteractions } = engagement;

  if (likes < 0 || recasts < 0 || premiumInteractions < 0) {
    throw new AppError("INVALID_INPUT", "Engagement counts cannot be negative");
  }

  const basePoints = likes * POINTS_PER_LIKE + recasts * POINTS_PER_RECAST;
  const premiumBoost =
    premiumInteractions > 0
      ? Math.pow(premiumInteractions, PREMIUM_INTERACTION_EXPONENT)
      : 0;

  const rawPoints = Math.round(basePoints + premiumBoost);
  const cappedPoints = Math.min(rawPoints, CHANNEL_POST_POINTS_CAP);

  return {
    rawPoints,
    cappedPoints,
    capped: rawPoints > CHANNEL_POST_POINTS_CAP,
  };
}

/**
 * Scrapes / ingests a Farcaster channel post and awards social points.
 * Only the user's FIRST post of the UTC day is eligible.
 */
export async function processChannelPost(
  fid: number,
  castHash: string,
  likes: number,
  recasts: number,
  premiumInteractions: number,
): Promise<ProcessChannelPostResult> {
  if (!castHash?.trim()) {
    throw new AppError("INVALID_INPUT", "castHash is required");
  }

  const user = await findUserByFid(fid);
  assertNotBlocked(user.isBlocked, "processChannelPost");

  const today = utcDateOnly();

  const existingDailyPost = await prisma.dailyChannelPost.findUnique({
    where: {
      userId_postDate: { userId: user.id, postDate: today },
    },
  });

  if (existingDailyPost) {
    throw new AppError(
      "DAILY_POST_LIMIT",
      `FID ${fid} already received channel points for today's first post`,
      409,
    );
  }

  const duplicateCast = await prisma.dailyChannelPost.findUnique({
    where: { castHash },
  });
  if (duplicateCast) {
    throw new AppError("INVALID_INPUT", `Cast ${castHash} was already processed`, 409);
  }

  const { cappedPoints, capped } = calculateEngagementPoints({
    likes,
    recasts,
    premiumInteractions,
  });

  await prisma.$transaction([
    prisma.dailyChannelPost.create({
      data: {
        userId: user.id,
        castHash,
        pointsAwarded: cappedPoints,
        postDate: today,
      },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: { socialPoints: { increment: cappedPoints } },
    }),
  ]);

  return {
    farcasterFid: fid,
    castHash,
    pointsAwarded: cappedPoints,
    capped,
    isFirstPostOfDay: true,
  };
}
