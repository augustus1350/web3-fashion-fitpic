import { EpochPhase, SubmissionStatus, UserTier } from "@prisma/client";
import { ensureDatabaseReady } from "../src/lib/ensureDatabase";
import { disconnectPrisma, prisma } from "../src/lib/prisma";

const CAST = {
  rookie1: "0xseed_rookie_fitpic_001",
  rookie2: "0xseed_rookie_fitpic_002",
  verified: "0xseed_verified_fitpic_001",
  elite: "0xseed_elite_fitpic_001",
  flagged: "0xseed_flagged_fitpic_001",
} as const;

async function main() {
  await ensureDatabaseReady();
  console.log("Seeding FitPic PoC database...");

  await prisma.vote.deleteMany();
  await prisma.dailyChannelPost.deleteMany();
  await prisma.adminLog.deleteMany();
  await prisma.submission.deleteMany();
  await prisma.epoch.deleteMany();
  await prisma.user.deleteMany();

  const founder = await prisma.user.create({
    data: {
      farcasterFid: 1,
      walletAddress: "0xFounder00000000000000000000000000000001",
      socialPoints: 500,
      reputationScore: 1000,
      tier: UserTier.ELITE_CURATOR,
    },
  });

  const rookieA = await prisma.user.create({
    data: {
      farcasterFid: 1001,
      walletAddress: "0xRookieA000000000000000000000000000001",
      tier: UserTier.ROOKIE,
    },
  });

  const rookieB = await prisma.user.create({
    data: {
      farcasterFid: 1002,
      walletAddress: "0xRookieB000000000000000000000000000002",
      tier: UserTier.ROOKIE,
    },
  });

  const verified = await prisma.user.create({
    data: {
      farcasterFid: 2001,
      walletAddress: "0xVerified00000000000000000000000000001",
      socialPoints: 120,
      reputationScore: 350,
      tier: UserTier.VERIFIED_CREATOR,
    },
  });

  const elite = await prisma.user.create({
    data: {
      farcasterFid: 3001,
      walletAddress: "0xElite00000000000000000000000000000001",
      socialPoints: 800,
      reputationScore: 2500,
      tier: UserTier.ELITE_CURATOR,
    },
  });

  const now = new Date();
  const votingEpoch = await prisma.epoch.create({
    data: {
      phase: EpochPhase.VOTING,
      startTime: now,
      endTime: new Date(now.getTime() + 24 * 60 * 60 * 1000),
    },
  });

  const submissions = await Promise.all([
    prisma.submission.create({
      data: {
        userId: rookieA.id,
        epochId: votingEpoch.id,
        farcasterCastHash: CAST.rookie1,
        imageUrl:
          "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&auto=format&fit=crop",
        hasPhysicalProof: true,
        visibilityBoost: 100,
        totalVotes: 2,
      },
    }),
    prisma.submission.create({
      data: {
        userId: rookieB.id,
        epochId: votingEpoch.id,
        farcasterCastHash: CAST.rookie2,
        imageUrl:
          "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=800&auto=format&fit=crop",
        totalVotes: 0,
      },
    }),
    prisma.submission.create({
      data: {
        userId: verified.id,
        epochId: votingEpoch.id,
        farcasterCastHash: CAST.verified,
        imageUrl:
          "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800&auto=format&fit=crop",
        totalVotes: 8,
      },
    }),
    prisma.submission.create({
      data: {
        userId: elite.id,
        epochId: votingEpoch.id,
        farcasterCastHash: CAST.elite,
        imageUrl:
          "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800&auto=format&fit=crop",
        totalVotes: 15,
      },
    }),
    prisma.submission.create({
      data: {
        userId: verified.id,
        epochId: votingEpoch.id,
        farcasterCastHash: CAST.flagged,
        imageUrl:
          "https://images.unsplash.com/photo-1487222477894-8943e31ef7b2?w=800&auto=format&fit=crop",
        status: SubmissionStatus.FLAGGED,
      },
    }),
  ]);

  await prisma.adminLog.create({
    data: {
      adminFid: 1001,
      action: "COMMUNITY_FLAG_SUBMISSION",
      targetFid: verified.farcasterFid,
      reason: "Suspected stock photo — awaiting founder review",
      metadata: { castHash: CAST.flagged },
    },
  });

  await prisma.adminLog.create({
    data: {
      adminFid: founder.farcasterFid,
      action: "FOUNDER_AIRDROP_POINTS",
      targetFid: rookieA.farcasterFid,
      reason: "Genesis grant for first NFC-verified FitPic",
      metadata: { amount: 50, grantType: "GENESIS_OR_FOUNDATION" },
    },
  });

  await prisma.user.update({
    where: { id: rookieA.id },
    data: { socialPoints: { increment: 50 } },
  });

  console.log("Seed complete.");
  console.log({
    founderFid: founder.farcasterFid,
    epoch: { id: votingEpoch.id, phase: votingEpoch.phase },
    users: 5,
    submissions: submissions.length,
    sampleCastHashes: CAST,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await disconnectPrisma();
  });
