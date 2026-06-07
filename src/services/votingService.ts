import { UserTier } from "@prisma/client";
import { prisma } from "../lib/prisma";
import {
  BASE_VOTE_REPUTATION_REWARD,
  BASE_VOTE_SOCIAL_POINTS_REWARD,
  CLIQUE_FARMING_DAMPENING_FACTOR,
  HIGH_CONSENSUS_VOTE_THRESHOLD,
  TRENDSETTER_EARLY_VOTE_THRESHOLD,
  TRENDSETTER_ELITE_VOTE_THRESHOLD,
  TRENDSETTER_MULTIPLIER,
} from "../config/constants";
import { AppError, assertNotBlocked } from "../errors/AppError";
import { requireActiveUser } from "./userService";

export interface CastVoteResult {
  voteId: string;
  submissionId: string;
  voteCountAtTimeOfVoting: number;
  reputationReward: number;
  socialPointsReward: number;
  trendsetterMultiplier: number;
  cliqueFarmingPenaltyApplied: boolean;
}

/**
 * Asymptotic dampener: voting on high-consensus posts yields diminishing returns.
 * reward = base / (1 + factor * totalVotes)
 */
export function calculateCliqueFarmingMultiplier(totalVotesAtVoteTime: number): number {
  if (totalVotesAtVoteTime < 0) {
    throw new AppError("INVALID_INPUT", "totalVotes cannot be negative");
  }
  return 1 / (1 + CLIQUE_FARMING_DAMPENING_FACTOR * totalVotesAtVoteTime);
}

export function isEarlyVote(voteCountAtTimeOfVoting: number): boolean {
  return voteCountAtTimeOfVoting < TRENDSETTER_EARLY_VOTE_THRESHOLD;
}

/**
 * Casts a vote on a submission during the VOTING phase.
 * Records voteCountAtTimeOfVoting for retroactive trendsetter settlement.
 */
export async function castVote(
  voterFid: number,
  castHash: string,
): Promise<CastVoteResult> {
  if (!castHash?.trim()) {
    throw new AppError("INVALID_INPUT", "castHash is required");
  }

  const voter = await requireActiveUser(voterFid);

  const submission = await prisma.submission.findUnique({
    where: { farcasterCastHash: castHash },
    include: { user: true },
  });

  if (!submission) {
    throw new AppError("SUBMISSION_NOT_FOUND", `No submission for cast ${castHash}`, 404);
  }

  if (submission.status !== "PENDING") {
    throw new AppError(
      "SUBMISSION_NOT_ELIGIBLE",
      `Submission is ${submission.status} and cannot receive votes`,
      403,
    );
  }

  assertNotBlocked(submission.user.isBlocked, "vote on submission owner");

  if (submission.userId === voter.id) {
    throw new AppError("SELF_VOTE", "Users cannot vote on their own submissions", 403);
  }

  const existingVote = await prisma.vote.findUnique({
    where: {
      userId_submissionId: { userId: voter.id, submissionId: submission.id },
    },
  });
  if (existingVote) {
    throw new AppError("DUPLICATE_VOTE", "User already voted on this submission", 409);
  }

  const voteCountAtTimeOfVoting = submission.totalVotes;
  const cliqueMultiplier = calculateCliqueFarmingMultiplier(voteCountAtTimeOfVoting);
  const cliqueFarmingPenaltyApplied = voteCountAtTimeOfVoting >= HIGH_CONSENSUS_VOTE_THRESHOLD;

  const reputationReward = Math.round(BASE_VOTE_REPUTATION_REWARD * cliqueMultiplier);
  const socialPointsReward = Math.round(BASE_VOTE_SOCIAL_POINTS_REWARD * cliqueMultiplier);

  const result = await prisma.$transaction(async (tx) => {
    const vote = await tx.vote.create({
      data: {
        userId: voter.id,
        submissionId: submission.id,
        voteCountAtTimeOfVoting,
        reputationReward,
        socialPointsReward,
        trendsetterMultiplier: 1.0,
      },
    });

    await tx.submission.update({
      where: { id: submission.id },
      data: { totalVotes: { increment: 1 } },
    });

    await tx.user.update({
      where: { id: voter.id },
      data: {
        reputationScore: { increment: reputationReward },
        socialPoints: { increment: socialPointsReward },
      },
    });

    return vote;
  });

  if (voter.tier === UserTier.ELITE_CURATOR) {
    await settleTrendsetterRewards(submission.id);
  }

  return {
    voteId: result.id,
    submissionId: submission.id,
    voteCountAtTimeOfVoting,
    reputationReward,
    socialPointsReward,
    trendsetterMultiplier: 1.0,
    cliqueFarmingPenaltyApplied,
  };
}

/**
 * When elite curators drive consensus, retroactively reward early trendsetters.
 */
export async function settleTrendsetterRewards(submissionId: string): Promise<number> {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      votes: { include: { user: true } },
    },
  });

  if (!submission) {
    throw new AppError("SUBMISSION_NOT_FOUND", `Submission ${submissionId} not found`, 404);
  }

  const eliteVotesOnSubmission = submission.votes.filter(
    (v) => v.user.tier === UserTier.ELITE_CURATOR,
  ).length;

  if (eliteVotesOnSubmission < TRENDSETTER_ELITE_VOTE_THRESHOLD) {
    return 0;
  }

  const earlyVotes = submission.votes.filter(
    (v) =>
      isEarlyVote(v.voteCountAtTimeOfVoting) &&
      v.trendsetterMultiplier === 1.0 &&
      v.user.tier !== UserTier.ELITE_CURATOR,
  );

  if (earlyVotes.length === 0) {
    return 0;
  }

  let rewardedCount = 0;

  await prisma.$transaction(async (tx) => {
    for (const vote of earlyVotes) {
      const bonusReputation = Math.round(
        vote.reputationReward * (TRENDSETTER_MULTIPLIER - 1),
      );
      const bonusSocial = Math.round(
        vote.socialPointsReward * (TRENDSETTER_MULTIPLIER - 1),
      );

      if (bonusReputation === 0 && bonusSocial === 0) {
        continue;
      }

      await tx.vote.update({
        where: { id: vote.id },
        data: { trendsetterMultiplier: TRENDSETTER_MULTIPLIER },
      });

      await tx.user.update({
        where: { id: vote.userId },
        data: {
          reputationScore: { increment: bonusReputation },
          socialPoints: { increment: bonusSocial },
        },
      });

      rewardedCount++;
    }
  });

  return rewardedCount;
}
