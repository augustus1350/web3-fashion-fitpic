import { EpochPhase, SubmissionStatus, UserTier } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import {
  flagSubmission,
  founderAirdropPoints,
  founderReviewSubmission,
} from "../../services/adminService";
import {
  createEpoch,
  createSubmission,
  createTestUser,
  disconnectTestDb,
  testPrisma,
} from "./helpers/db";

const FOUNDER_FIDS = [1];

afterAll(async () => {
  await disconnectTestDb();
});

describe("Admin and moderation flow", () => {
  it("founder airdrops points with audit log", async () => {
    await createTestUser({ farcasterFid: 1, tier: UserTier.ELITE_CURATOR });
    const target = await createTestUser({ farcasterFid: 10001, socialPoints: 10 });

    const result = await founderAirdropPoints(
      1,
      10001,
      100,
      "Genesis grant for onboarding",
      FOUNDER_FIDS,
    );

    expect(result.amount).toBe(100);
    expect(result.newSocialPoints).toBe(110);

    const log = await testPrisma.adminLog.findUniqueOrThrow({
      where: { id: result.adminLogId },
    });
    expect(log.action).toBe("FOUNDER_AIRDROP_POINTS");
    expect(log.targetFid).toBe(target.farcasterFid);
  });

  it("rejects unauthorized founder actions", async () => {
    await createTestUser({ farcasterFid: 10002 });

    await expect(
      founderAirdropPoints(10002, 10002, 50, "Self grant", FOUNDER_FIDS),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED_ADMIN" });
  });

  it("flags submission without auto-banning the user", async () => {
    const author = await createTestUser({ farcasterFid: 10101 });
    const reporter = await createTestUser({ farcasterFid: 10102 });
    const epoch = await createEpoch(EpochPhase.VOTING);

    await createSubmission({
      userId: author.id,
      epochId: epoch.id,
      castHash: "0xflag_target",
    });

    const result = await flagSubmission(10102, "0xflag_target", "Suspected bot engagement");

    expect(result.status).toBe(SubmissionStatus.FLAGGED);

    const authorAfter = await testPrisma.user.findUniqueOrThrow({
      where: { id: author.id },
    });
    expect(authorAfter.isBlocked).toBe(false);
  });

  it("founder approves flagged submission back to PENDING", async () => {
    await createTestUser({ farcasterFid: 1, tier: UserTier.ELITE_CURATOR });
    const author = await createTestUser({ farcasterFid: 10201 });
    const epoch = await createEpoch(EpochPhase.VOTING);

    await createSubmission({
      userId: author.id,
      epochId: epoch.id,
      castHash: "0xreview_approve",
      status: SubmissionStatus.FLAGGED,
    });

    const result = await founderReviewSubmission(
      1,
      "0xreview_approve",
      "APPROVE",
      "Verified authentic FitPic",
      FOUNDER_FIDS,
    );

    expect(result.submissionStatus).toBe(SubmissionStatus.PENDING);
    expect(result.ownerFlaggedForBanReview).toBe(false);
  });

  it("founder rejects submission and flags owner for manual ban review", async () => {
    await createTestUser({ farcasterFid: 1, tier: UserTier.ELITE_CURATOR });
    const author = await createTestUser({ farcasterFid: 10301 });
    const epoch = await createEpoch(EpochPhase.VOTING);

    await createSubmission({
      userId: author.id,
      epochId: epoch.id,
      castHash: "0xreview_reject",
      status: SubmissionStatus.FLAGGED,
    });

    const result = await founderReviewSubmission(
      1,
      "0xreview_reject",
      "REJECT",
      "Stock photo confirmed",
      FOUNDER_FIDS,
    );

    expect(result.submissionStatus).toBe(SubmissionStatus.REJECTED);
    expect(result.ownerFlaggedForBanReview).toBe(true);

    const authorAfter = await testPrisma.user.findUniqueOrThrow({
      where: { id: author.id },
    });
    expect(authorAfter.isBlocked).toBe(false);
  });
});
