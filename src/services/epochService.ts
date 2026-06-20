import { Epoch, EpochPhase, Submission, UserTier } from "@prisma/client";
import { prisma } from "../lib/prisma";
import {
  PHYSICAL_PROOF_VISIBILITY_BOOST,
  SUBMISSION_PHASE_MS,
  VOTING_PHASE_MS,
} from "../config/constants";
import { calculateRookieSlotCount } from "../utils/feedQuota";
import { AppError, assertNotBlocked } from "../errors/AppError";
import { requireActiveUser } from "./userService";
import { castVote } from "./votingService";

export interface SubmitFitPicInput {
  farcasterFid: number;
  farcasterCastHash: string;
  imageUrl: string;
  hasPhysicalProof: boolean;
}

export interface VotingFeedOptions {
  limit?: number;
  epochId?: string;
}

export interface VotingFeedItem extends Submission {
  user: { tier: UserTier };
}

/**
 * Returns the currently active epoch, lazily creating the first cycle if none exists.
 */
export async function getOrCreateCurrentEpoch(): Promise<Epoch> {
  const now = new Date();

  const active = await prisma.epoch.findFirst({
    where: {
      startTime: { lte: now },
      endTime: { gt: now },
      phase: { not: EpochPhase.ENDED },
    },
    orderBy: { startTime: "desc" },
  });

  if (active) {
    return maybeAdvanceEpochPhase(active, now);
  }

  return prisma.epoch.create({
    data: {
      phase: EpochPhase.SUBMISSION,
      startTime: now,
      endTime: new Date(now.getTime() + SUBMISSION_PHASE_MS),
    },
  });
}

async function maybeAdvanceEpochPhase(epoch: Epoch, now: Date): Promise<Epoch> {
  if (now < epoch.endTime) {
    return epoch;
  }

  if (epoch.phase === EpochPhase.SUBMISSION) {
    return prisma.epoch.update({
      where: { id: epoch.id },
      data: {
        phase: EpochPhase.VOTING,
        startTime: now,
        endTime: new Date(now.getTime() + VOTING_PHASE_MS),
      },
    });
  }

  if (epoch.phase === EpochPhase.VOTING) {
    const ended = await prisma.epoch.update({
      where: { id: epoch.id },
      data: {
        phase: EpochPhase.ENDED,
        endTime: now,
      },
    });

    const nextStart = now;
    return prisma.epoch.create({
      data: {
        phase: EpochPhase.SUBMISSION,
        startTime: nextStart,
        endTime: new Date(nextStart.getTime() + SUBMISSION_PHASE_MS),
      },
    });
  }

  return epoch;
}

export async function requireEpochPhase(required: EpochPhase): Promise<Epoch> {
  const epoch = await getOrCreateCurrentEpoch();
  if (epoch.phase !== required) {
    throw new AppError(
      "INVALID_PHASE",
      `Action requires ${required} phase; current phase is ${epoch.phase}`,
      403,
    );
  }
  return epoch;
}

/**
 * Submits a FitPic during the SUBMISSION phase.
 * Physical proof bypasses rookie visibility filters and grants an initial boost.
 */
export async function submitFitPic(
  input: SubmitFitPicInput,
  options: { enforcePhase?: boolean } = {},
): Promise<Submission> {
  const { farcasterFid, farcasterCastHash, imageUrl, hasPhysicalProof } = input;

  if (!farcasterCastHash?.trim() || !imageUrl?.trim()) {
    throw new AppError("INVALID_INPUT", "castHash and imageUrl are required");
  }

  const user = await requireActiveUser(farcasterFid);
  const epoch =
    options.enforcePhase === false
      ? await getOrCreateCurrentEpoch()
      : await requireEpochPhase(EpochPhase.SUBMISSION);

  const existing = await prisma.submission.findUnique({
    where: { farcasterCastHash },
  });
  if (existing) {
    throw new AppError(
      "DUPLICATE_SUBMISSION",
      `Submission with cast hash ${farcasterCastHash} already exists`,
      409,
    );
  }

  const visibilityBoost =
    hasPhysicalProof && user.tier === UserTier.ROOKIE
      ? PHYSICAL_PROOF_VISIBILITY_BOOST
      : hasPhysicalProof
        ? Math.floor(PHYSICAL_PROOF_VISIBILITY_BOOST / 2)
        : 0;

  return prisma.submission.create({
    data: {
      userId: user.id,
      epochId: epoch.id,
      farcasterCastHash,
      imageUrl,
      hasPhysicalProof,
      visibilityBoost,
    },
  });
}

/**
 * Delegates to the voting engine; only callable during VOTING phase.
 */
export async function submitVote(
  voterFid: number,
  castHash: string,
  options: { enforcePhase?: boolean } = {},
) {
  if (options.enforcePhase !== false) {
    await requireEpochPhase(EpochPhase.VOTING);
  }
  return castVote(voterFid, castHash);
}

/**
 * Builds a voting feed with a guaranteed 20% ROOKIE visibility quota.
 * Non-rookie slots are filled by vote count + visibility boost (physical proof).
 */
export async function getVotingFeed(
  options: VotingFeedOptions = {},
): Promise<VotingFeedItem[]> {
  const limit = options.limit ?? 20;
  const epoch = options.epochId
    ? await prisma.epoch.findUnique({ where: { id: options.epochId } })
    : await getOrCreateCurrentEpoch();

  if (!epoch) {
    throw new AppError("EPOCH_NOT_FOUND", "Epoch not found", 404);
  }

  const rookieSlotCount = calculateRookieSlotCount(limit);
  const generalSlotCount = limit - rookieSlotCount;

  const eligibleWhere = {
    epochId: epoch.id,
    status: "PENDING" as const,
    user: { isBlocked: false },
  };

  const [rookiePosts, generalPosts] = await Promise.all([
    prisma.submission.findMany({
      where: {
        ...eligibleWhere,
        user: { ...eligibleWhere.user, tier: UserTier.ROOKIE },
      },
      include: { user: { select: { tier: true } } },
      orderBy: [{ visibilityBoost: "desc" }, { timestamp: "asc" }],
      take: rookieSlotCount,
    }),
    prisma.submission.findMany({
      where: {
        ...eligibleWhere,
        user: { ...eligibleWhere.user, tier: { not: UserTier.ROOKIE } },
      },
      include: { user: { select: { tier: true } } },
      orderBy: [{ totalVotes: "desc" }, { visibilityBoost: "desc" }],
      take: generalSlotCount,
    }),
  ]);

  const seen = new Set<string>();
  const merged: VotingFeedItem[] = [];

  const interleave = (rookie: VotingFeedItem[], general: VotingFeedItem[]) => {
    const maxLen = Math.max(rookie.length, general.length);
    for (let i = 0; i < maxLen && merged.length < limit; i++) {
      if (i < rookie.length && !seen.has(rookie[i].id)) {
        merged.push(rookie[i]);
        seen.add(rookie[i].id);
      }
      if (merged.length < limit && i < general.length && !seen.has(general[i].id)) {
        merged.push(general[i]);
        seen.add(general[i].id);
      }
    }
  };

  interleave(rookiePosts, generalPosts);

  if (merged.length < limit) {
    const backfill = await prisma.submission.findMany({
      where: {
        ...eligibleWhere,
        id: { notIn: [...seen] },
      },
      include: { user: { select: { tier: true } } },
      orderBy: [{ visibilityBoost: "desc" }, { totalVotes: "desc" }],
      take: limit - merged.length,
    });
    merged.push(...backfill);
  }

  return merged;
}
