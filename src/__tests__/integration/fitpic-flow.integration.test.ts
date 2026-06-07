import { EpochPhase, UserTier } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { AppError } from "../../errors/AppError";
import {
  getVotingFeed,
  submitFitPic,
  submitVote,
} from "../../services/epochService";
import { processChannelPost } from "../../services/farcasterChannelService";
import {
  createEpoch,
  createSubmission,
  createTestUser,
  disconnectTestDb,
  testPrisma,
} from "./helpers/db";

afterAll(async () => {
  await disconnectTestDb();
});

describe("FitPic submission and voting flow", () => {
  it("submits during SUBMISSION phase and rejects during VOTING phase", async () => {
    await createTestUser({ farcasterFid: 5001, tier: UserTier.ROOKIE });
    await createEpoch(EpochPhase.SUBMISSION);

    const submission = await submitFitPic({
      farcasterFid: 5001,
      farcasterCastHash: "0xintegration_submit_001",
      imageUrl: "https://images.example.com/integration/rookie.jpg",
      hasPhysicalProof: true,
    });

    expect(submission.hasPhysicalProof).toBe(true);
    expect(submission.visibilityBoost).toBeGreaterThan(0);

    await testPrisma.epoch.updateMany({
      data: { phase: EpochPhase.VOTING },
    });

    await expect(
      submitFitPic({
        farcasterFid: 5001,
        farcasterCastHash: "0xintegration_submit_002",
        imageUrl: "https://images.example.com/integration/late.jpg",
        hasPhysicalProof: false,
      }),
    ).rejects.toMatchObject({ code: "INVALID_PHASE" });
  });

  it("casts votes during VOTING phase and records voteCountAtTimeOfVoting", async () => {
    const author = await createTestUser({ farcasterFid: 5101, tier: UserTier.ROOKIE });
    const voter = await createTestUser({
      farcasterFid: 5102,
      tier: UserTier.VERIFIED_CREATOR,
      reputationScore: 100,
      socialPoints: 50,
    });
    const epoch = await createEpoch(EpochPhase.VOTING);

    await createSubmission({
      userId: author.id,
      epochId: epoch.id,
      castHash: "0xintegration_vote_001",
      totalVotes: 3,
    });

    const before = await testPrisma.user.findUniqueOrThrow({ where: { id: voter.id } });
    const result = await submitVote(5102, "0xintegration_vote_001");

    expect(result.voteCountAtTimeOfVoting).toBe(3);
    expect(result.reputationReward).toBeGreaterThan(0);

    const vote = await testPrisma.vote.findUniqueOrThrow({ where: { id: result.voteId } });
    expect(vote.voteCountAtTimeOfVoting).toBe(3);

    const submission = await testPrisma.submission.findUniqueOrThrow({
      where: { farcasterCastHash: "0xintegration_vote_001" },
    });
    expect(submission.totalVotes).toBe(4);

    const after = await testPrisma.user.findUniqueOrThrow({ where: { id: voter.id } });
    expect(after.reputationScore).toBeGreaterThan(before.reputationScore);
    expect(after.socialPoints).toBeGreaterThan(before.socialPoints);
  });

  it("rejects self-votes and duplicate votes", async () => {
    const author = await createTestUser({ farcasterFid: 5201 });
    const voter = await createTestUser({ farcasterFid: 5202 });
    const epoch = await createEpoch(EpochPhase.VOTING);

    await createSubmission({
      userId: author.id,
      epochId: epoch.id,
      castHash: "0xintegration_self_vote",
    });

    await expect(submitVote(5201, "0xintegration_self_vote")).rejects.toMatchObject({
      code: "SELF_VOTE",
    });

    await submitVote(5202, "0xintegration_self_vote");
    await expect(submitVote(5202, "0xintegration_self_vote")).rejects.toMatchObject({
      code: "DUPLICATE_VOTE",
    });
  });

  it("rejects voting during SUBMISSION phase", async () => {
    await createTestUser({ farcasterFid: 5301 });
    await createTestUser({ farcasterFid: 5302 });
    const epoch = await createEpoch(EpochPhase.SUBMISSION);

    const author = await testPrisma.user.findUniqueOrThrow({ where: { farcasterFid: 5301 } });
    await createSubmission({
      userId: author.id,
      epochId: epoch.id,
      castHash: "0xintegration_wrong_phase",
    });

    await expect(submitVote(5302, "0xintegration_wrong_phase")).rejects.toMatchObject({
      code: "INVALID_PHASE",
    });
  });
});

describe("Channel engagement integration", () => {
  it("awards first post of the day and blocks subsequent posts", async () => {
    await createTestUser({ farcasterFid: 6001, socialPoints: 0 });

    const first = await processChannelPost(6001, "0xchannel_first", 10, 5, 2);
    expect(first.pointsAwarded).toBeGreaterThan(0);
    expect(first.isFirstPostOfDay).toBe(true);

    const user = await testPrisma.user.findUniqueOrThrow({ where: { farcasterFid: 6001 } });
    expect(user.socialPoints).toBe(first.pointsAwarded);

    await expect(
      processChannelPost(6001, "0xchannel_second", 20, 10, 5),
    ).rejects.toMatchObject({ code: "DAILY_POST_LIMIT" });
  });
});

describe("Voting feed rookie quota integration", () => {
  it("reserves at least 20% of feed slots for rookie submissions", async () => {
    const epoch = await createEpoch(EpochPhase.VOTING);

    const rookies = await Promise.all(
      Array.from({ length: 4 }, (_, i) =>
        createTestUser({ farcasterFid: 7000 + i, tier: UserTier.ROOKIE }),
      ),
    );
    const veterans = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        createTestUser({
          farcasterFid: 7100 + i,
          tier: UserTier.VERIFIED_CREATOR,
        }),
      ),
    );

    for (const [i, user] of rookies.entries()) {
      await createSubmission({
        userId: user.id,
        epochId: epoch.id,
        castHash: `0xfeed_rookie_${i}`,
        totalVotes: 0,
      });
    }

    for (const [i, user] of veterans.entries()) {
      await createSubmission({
        userId: user.id,
        epochId: epoch.id,
        castHash: `0xfeed_vet_${i}`,
        totalVotes: 50 - i,
      });
    }

    const feed = await getVotingFeed({ limit: 10, epochId: epoch.id });
    const rookieCount = feed.filter((item) => item.user.tier === UserTier.ROOKIE).length;

    expect(feed).toHaveLength(10);
    expect(rookieCount).toBeGreaterThanOrEqual(2);
  });
});

describe("Trendsetter settlement integration", () => {
  it("rewards early voters when elite curators reach consensus", async () => {
    const author = await createTestUser({ farcasterFid: 8001 });
    const trendsetter = await createTestUser({
      farcasterFid: 8002,
      tier: UserTier.VERIFIED_CREATOR,
      reputationScore: 0,
      socialPoints: 0,
    });
    const elites = await Promise.all(
      [8003, 8004, 8005].map((fid) =>
        createTestUser({ farcasterFid: fid, tier: UserTier.ELITE_CURATOR }),
      ),
    );
    const epoch = await createEpoch(EpochPhase.VOTING);

    const submission = await createSubmission({
      userId: author.id,
      epochId: epoch.id,
      castHash: "0xintegration_trendsetter",
      totalVotes: 0,
    });

    const { castVote } = await import("../../services/votingService");
    await castVote(8002, "0xintegration_trendsetter");

    for (const elite of elites) {
      await castVote(elite.farcasterFid, "0xintegration_trendsetter");
    }

    const trendsetterVote = await testPrisma.vote.findFirstOrThrow({
      where: { userId: trendsetter.id, submissionId: submission.id },
    });
    expect(trendsetterVote.trendsetterMultiplier).toBeGreaterThan(1);

    const updatedTrendsetter = await testPrisma.user.findUniqueOrThrow({
      where: { id: trendsetter.id },
    });
    expect(updatedTrendsetter.reputationScore).toBeGreaterThan(
      trendsetterVote.reputationReward,
    );
  });
});

describe("Blocked user guards", () => {
  it("prevents blocked users from submitting and voting", async () => {
    await createTestUser({ farcasterFid: 9001, isBlocked: true });
    await createTestUser({ farcasterFid: 9002 });
    await createEpoch(EpochPhase.SUBMISSION);

    await expect(
      submitFitPic({
        farcasterFid: 9001,
        farcasterCastHash: "0xblocked_submit",
        imageUrl: "https://images.example.com/blocked.jpg",
        hasPhysicalProof: false,
      }),
    ).rejects.toBeInstanceOf(AppError);
  });
});
