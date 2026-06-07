import { EpochPhase, SubmissionStatus, UserTier } from "@prisma/client";
import { SUBMISSION_PHASE_MS, VOTING_PHASE_MS } from "../../../config/constants";
import { disconnectPrisma, prisma } from "../../../lib/prisma";

export { prisma as testPrisma };

export async function resetDatabase(): Promise<void> {
  await prisma.$transaction([
    prisma.vote.deleteMany(),
    prisma.dailyChannelPost.deleteMany(),
    prisma.adminLog.deleteMany(),
    prisma.submission.deleteMany(),
    prisma.epoch.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}

export interface TestUserSpec {
  farcasterFid: number;
  tier?: UserTier;
  walletAddress?: string;
  socialPoints?: number;
  reputationScore?: number;
  isBlocked?: boolean;
}

export async function createTestUser(spec: TestUserSpec) {
  return prisma.user.create({
    data: {
      farcasterFid: spec.farcasterFid,
      tier: spec.tier ?? UserTier.ROOKIE,
      walletAddress: spec.walletAddress,
      socialPoints: spec.socialPoints ?? 0,
      reputationScore: spec.reputationScore ?? 0,
      isBlocked: spec.isBlocked ?? false,
    },
  });
}

export async function createEpoch(phase: EpochPhase) {
  const now = new Date();
  const durationMs =
    phase === EpochPhase.SUBMISSION ? SUBMISSION_PHASE_MS : VOTING_PHASE_MS;

  return prisma.epoch.create({
    data: {
      phase,
      startTime: now,
      endTime: new Date(now.getTime() + durationMs),
    },
  });
}

export async function createSubmission(params: {
  userId: string;
  epochId: string;
  castHash: string;
  imageUrl?: string;
  hasPhysicalProof?: boolean;
  visibilityBoost?: number;
  totalVotes?: number;
  status?: SubmissionStatus;
}) {
  return prisma.submission.create({
    data: {
      userId: params.userId,
      epochId: params.epochId,
      farcasterCastHash: params.castHash,
      imageUrl: params.imageUrl ?? "https://images.example.com/test/fitpic.jpg",
      hasPhysicalProof: params.hasPhysicalProof ?? false,
      visibilityBoost: params.visibilityBoost ?? 0,
      totalVotes: params.totalVotes ?? 0,
      status: params.status ?? SubmissionStatus.PENDING,
    },
  });
}

export async function disconnectTestDb(): Promise<void> {
  await disconnectPrisma();
}
