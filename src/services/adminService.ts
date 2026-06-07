import { FounderReviewAction, Prisma, SubmissionStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError, assertNotBlocked } from "../errors/AppError";
import { findUserByFid } from "./userService";

export interface FounderAirdropResult {
  targetFid: number;
  amount: number;
  newSocialPoints: number;
  adminLogId: string;
}

export interface FlagSubmissionResult {
  castHash: string;
  status: SubmissionStatus;
  adminLogId: string;
}

export interface FounderReviewResult {
  castHash: string;
  action: FounderReviewAction;
  submissionStatus: SubmissionStatus;
  ownerFlaggedForBanReview: boolean;
  adminLogId: string;
}

async function logAdminAction(params: {
  adminFid: number;
  action: string;
  targetFid?: number;
  reason: string;
  metadata?: Prisma.InputJsonValue;
}): Promise<string> {
  const log = await prisma.adminLog.create({
    data: {
      adminFid: params.adminFid,
      action: params.action,
      targetFid: params.targetFid ?? null,
      reason: params.reason,
      metadata: params.metadata,
    },
  });
  return log.id;
}

function assertFounderAuthorized(adminFid: number, allowedFids: number[]): void {
  if (!allowedFids.includes(adminFid)) {
    throw new AppError(
      "UNAUTHORIZED_ADMIN",
      `FID ${adminFid} is not authorized for founder actions`,
      403,
    );
  }
}

/**
 * Manually inject Genesis Points / Foundation Grants with transparent audit logging.
 */
export async function founderAirdropPoints(
  adminFid: number,
  targetFid: number,
  amount: number,
  reason: string,
  allowedFounderFids: number[],
): Promise<FounderAirdropResult> {
  assertFounderAuthorized(adminFid, allowedFounderFids);

  if (!reason?.trim()) {
    throw new AppError("INVALID_INPUT", "Airdrop reason is required for transparency");
  }
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new AppError("INVALID_INPUT", "Airdrop amount must be a positive integer");
  }

  const target = await findUserByFid(targetFid);
  assertNotBlocked(target.isBlocked, "founderAirdropPoints target");

  const updated = await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: target.id },
      data: { socialPoints: { increment: amount } },
    });

    const log = await tx.adminLog.create({
      data: {
        adminFid,
        action: "FOUNDER_AIRDROP_POINTS",
        targetFid,
        reason,
        metadata: { amount, grantType: "GENESIS_OR_FOUNDATION" },
      },
    });

    return { user, adminLogId: log.id };
  });

  return {
    targetFid,
    amount,
    newSocialPoints: updated.user.socialPoints,
    adminLogId: updated.adminLogId,
  };
}

/**
 * Community report flags a submission for manual review.
 * Does NOT auto-block or ban the submitter.
 */
export async function flagSubmission(
  reporterFid: number,
  castHash: string,
  reason: string,
): Promise<FlagSubmissionResult> {
  if (!castHash?.trim()) {
    throw new AppError("INVALID_INPUT", "castHash is required");
  }
  if (!reason?.trim()) {
    throw new AppError("INVALID_INPUT", "Flag reason is required");
  }

  const reporter = await findUserByFid(reporterFid);
  assertNotBlocked(reporter.isBlocked, "flagSubmission");

  const submission = await prisma.submission.findUnique({
    where: { farcasterCastHash: castHash },
    include: { user: true },
  });

  if (!submission) {
    throw new AppError("SUBMISSION_NOT_FOUND", `No submission for cast ${castHash}`, 404);
  }

  if (submission.status === SubmissionStatus.FLAGGED) {
    throw new AppError("ALREADY_FLAGGED", "Submission is already flagged for review", 409);
  }

  if (submission.status === SubmissionStatus.REJECTED) {
    throw new AppError(
      "SUBMISSION_NOT_ELIGIBLE",
      "Rejected submissions cannot be flagged",
      403,
    );
  }

  const { updated, adminLogId } = await prisma.$transaction(async (tx) => {
    const updatedSubmission = await tx.submission.update({
      where: { id: submission.id },
      data: { status: SubmissionStatus.FLAGGED },
    });

    const log = await tx.adminLog.create({
      data: {
        adminFid: reporterFid,
        action: "COMMUNITY_FLAG_SUBMISSION",
        targetFid: submission.user.farcasterFid,
        reason,
        metadata: { castHash },
      },
    });

    return { updated: updatedSubmission, adminLogId: log.id };
  });

  return {
    castHash,
    status: updated.status,
    adminLogId,
  };
}

/**
 * Founder manually approves (clears flag) or rejects a flagged submission.
 * REJECT removes the post and flags the owner for manual ban review (no auto-ban).
 */
export async function founderReviewSubmission(
  adminFid: number,
  castHash: string,
  action: FounderReviewAction,
  reason: string,
  allowedFounderFids: number[],
): Promise<FounderReviewResult> {
  assertFounderAuthorized(adminFid, allowedFounderFids);

  if (!castHash?.trim() || !reason?.trim()) {
    throw new AppError("INVALID_INPUT", "castHash and reason are required");
  }

  const submission = await prisma.submission.findUnique({
    where: { farcasterCastHash: castHash },
    include: { user: true },
  });

  if (!submission) {
    throw new AppError("SUBMISSION_NOT_FOUND", `No submission for cast ${castHash}`, 404);
  }

  assertNotBlocked(submission.user.isBlocked, "founderReviewSubmission owner");

  if (submission.status !== SubmissionStatus.FLAGGED) {
    throw new AppError(
      "SUBMISSION_NOT_ELIGIBLE",
      `Founder review requires FLAGGED status; current status is ${submission.status}`,
      403,
    );
  }

  const ownerFid = submission.user.farcasterFid;

  if (action === FounderReviewAction.APPROVE) {
    const [updated, log] = await prisma.$transaction([
      prisma.submission.update({
        where: { id: submission.id },
        data: { status: SubmissionStatus.PENDING },
      }),
      prisma.adminLog.create({
        data: {
          adminFid,
          action: "FOUNDER_APPROVE_SUBMISSION",
          targetFid: ownerFid,
          reason,
          metadata: { castHash, priorStatus: SubmissionStatus.FLAGGED },
        },
      }),
    ]);

    return {
      castHash,
      action,
      submissionStatus: updated.status,
      ownerFlaggedForBanReview: false,
      adminLogId: log.id,
    };
  }

  if (action === FounderReviewAction.REJECT) {
    const [updated, log] = await prisma.$transaction([
      prisma.submission.update({
        where: { id: submission.id },
        data: { status: SubmissionStatus.REJECTED },
      }),
      prisma.adminLog.create({
        data: {
          adminFid,
          action: "FOUNDER_REJECT_SUBMISSION",
          targetFid: ownerFid,
          reason,
          metadata: {
            castHash,
            priorStatus: SubmissionStatus.FLAGGED,
            ownerFlaggedForBanReview: true,
          },
        },
      }),
    ]);

    return {
      castHash,
      action,
      submissionStatus: updated.status,
      ownerFlaggedForBanReview: true,
      adminLogId: log.id,
    };
  }

  throw new AppError("INVALID_INPUT", `Unsupported review action: ${action}`);
}
