-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserTier" AS ENUM ('ROOKIE', 'VERIFIED_CREATOR', 'ELITE_CURATOR');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('PENDING', 'FLAGGED', 'REJECTED');

-- CreateEnum
CREATE TYPE "EpochPhase" AS ENUM ('SUBMISSION', 'VOTING', 'ENDED');

-- CreateEnum
CREATE TYPE "FounderReviewAction" AS ENUM ('APPROVE', 'REJECT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "farcasterFid" INTEGER NOT NULL,
    "walletAddress" TEXT,
    "socialPoints" INTEGER NOT NULL DEFAULT 0,
    "reputationScore" INTEGER NOT NULL DEFAULT 0,
    "tier" "UserTier" NOT NULL DEFAULT 'ROOKIE',
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "epochId" TEXT NOT NULL,
    "farcasterCastHash" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "hasPhysicalProof" BOOLEAN NOT NULL DEFAULT false,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "visibilityBoost" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "voteCountAtTimeOfVoting" INTEGER NOT NULL,
    "reputationReward" INTEGER NOT NULL DEFAULT 0,
    "socialPointsReward" INTEGER NOT NULL DEFAULT 0,
    "trendsetterMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Epoch" (
    "id" TEXT NOT NULL,
    "phase" "EpochPhase" NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Epoch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminLog" (
    "id" TEXT NOT NULL,
    "adminFid" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "targetFid" INTEGER,
    "reason" TEXT NOT NULL,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyChannelPost" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "castHash" TEXT NOT NULL,
    "pointsAwarded" INTEGER NOT NULL,
    "postDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyChannelPost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_farcasterFid_key" ON "User"("farcasterFid");

-- CreateIndex
CREATE INDEX "User_tier_idx" ON "User"("tier");

-- CreateIndex
CREATE INDEX "User_isBlocked_idx" ON "User"("isBlocked");

-- CreateIndex
CREATE UNIQUE INDEX "Submission_farcasterCastHash_key" ON "Submission"("farcasterCastHash");

-- CreateIndex
CREATE INDEX "Submission_epochId_status_idx" ON "Submission"("epochId", "status");

-- CreateIndex
CREATE INDEX "Submission_userId_idx" ON "Submission"("userId");

-- CreateIndex
CREATE INDEX "Submission_totalVotes_idx" ON "Submission"("totalVotes");

-- CreateIndex
CREATE INDEX "Vote_submissionId_idx" ON "Vote"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "Vote_userId_submissionId_key" ON "Vote"("userId", "submissionId");

-- CreateIndex
CREATE INDEX "Epoch_phase_startTime_endTime_idx" ON "Epoch"("phase", "startTime", "endTime");

-- CreateIndex
CREATE INDEX "AdminLog_adminFid_idx" ON "AdminLog"("adminFid");

-- CreateIndex
CREATE INDEX "AdminLog_targetFid_idx" ON "AdminLog"("targetFid");

-- CreateIndex
CREATE UNIQUE INDEX "DailyChannelPost_castHash_key" ON "DailyChannelPost"("castHash");

-- CreateIndex
CREATE UNIQUE INDEX "DailyChannelPost_userId_postDate_key" ON "DailyChannelPost"("userId", "postDate");

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_epochId_fkey" FOREIGN KEY ("epochId") REFERENCES "Epoch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyChannelPost" ADD CONSTRAINT "DailyChannelPost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

