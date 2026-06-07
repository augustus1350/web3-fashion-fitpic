import { EpochPhase } from "@prisma/client";
import { FRAME_TEST_LOOKS } from "../config/frameTestImages";
import { SUBMISSION_PHASE_MS } from "../config/constants";
import { AppError } from "../errors/AppError";
import { prisma } from "../lib/prisma";
import {
  getOrCreateCurrentEpoch,
  getVotingFeed,
  submitFitPic,
  submitVote,
} from "./epochService";
import { renderEmbedPage, renderFramePage } from "./frameHtml";
import { getOrCreateFrameUser } from "./frameUserService";

export interface FrameActionPayload {
  untrustedData?: {
    fid?: number;
    buttonIndex?: number;
    inputText?: string;
    castId?: { fid?: number; hash?: string };
    state?: string;
  };
}

export interface FrameContext {
  baseUrl: string;
}

function postUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, "")}/frames`;
}

function resolveFid(payload: FrameActionPayload): number {
  const fid = payload.untrustedData?.fid;
  if (!fid || !Number.isInteger(fid) || fid <= 0) {
    throw new AppError("INVALID_INPUT", "Missing Farcaster FID in frame payload", 400);
  }
  return fid;
}

function resolveCastHash(payload: FrameActionPayload, fid: number): string {
  const hash = payload.untrustedData?.castId?.hash;
  if (hash?.trim()) {
    return hash.trim();
  }
  return `0xframe_${fid}_${Date.now()}`;
}

export async function renderHomeEmbed(ctx: FrameContext): Promise<string> {
  const epoch = await getOrCreateCurrentEpoch();

  if (epoch.phase === EpochPhase.SUBMISSION) {
    return renderEmbedPage({
      baseUrl: ctx.baseUrl,
      imageUrl: FRAME_TEST_LOOKS[0].imageUrl,
      title: "FitPic - Submission phase",
      subtitle: "Submit your look and earn channel points.",
    });
  }

  if (epoch.phase === EpochPhase.VOTING) {
    const feed = await getVotingFeed({ limit: 1 });
    const top = feed[0];
    return renderEmbedPage({
      baseUrl: ctx.baseUrl,
      imageUrl: top?.imageUrl ?? FRAME_TEST_LOOKS[0].imageUrl,
      title: "FitPic - Voting phase",
      subtitle: top ? `Vote on looks (${top.totalVotes} votes on leader)` : "Vote on community looks.",
    });
  }

  return renderEmbedPage({
    baseUrl: ctx.baseUrl,
    imageUrl: FRAME_TEST_LOOKS[1].imageUrl,
    title: "FitPic - Epoch ended",
    subtitle: "A new submission window opens soon.",
  });
}

export async function renderHomeFrame(ctx: FrameContext): Promise<string> {
  const epoch = await getOrCreateCurrentEpoch();
  const url = postUrl(ctx.baseUrl);

  if (epoch.phase === EpochPhase.SUBMISSION) {
    return renderFramePage({
      baseUrl: ctx.baseUrl,
      imageUrl: FRAME_TEST_LOOKS[0].imageUrl,
      title: "FitPic - Submission phase",
      subtitle: "Pick a test look or paste your own HTTPS image URL.",
      postUrl: url,
      textInput: true,
      textInputPlaceholder: "https://…/your-fitpic.jpg",
      buttons: FRAME_TEST_LOOKS.map((look) => ({
        label: `Submit ${look.label}`,
      })),
    });
  }

  if (epoch.phase === EpochPhase.VOTING) {
    const feed = await getVotingFeed({ limit: 1 });
    const top = feed[0];
    const imageUrl = top?.imageUrl ?? FRAME_TEST_LOOKS[0].imageUrl;

    return renderFramePage({
      baseUrl: ctx.baseUrl,
      imageUrl,
      title: "FitPic - Voting phase",
      subtitle: top
        ? `Vote on this look (${top.totalVotes} votes)`
        : "No submissions yet — check back soon.",
      postUrl: url,
      state: top ? `vote:${top.farcasterCastHash}` : "vote:none",
      buttons: top
        ? [{ label: "Vote 🔥" }, { label: "Skip" }]
        : [{ label: "Refresh" }],
    });
  }

  return renderFramePage({
    baseUrl: ctx.baseUrl,
    imageUrl: FRAME_TEST_LOOKS[1].imageUrl,
    title: "FitPic - Epoch ended",
    subtitle: "A new submission window opens soon.",
    postUrl: url,
    buttons: [{ label: "Refresh" }],
  });
}

export async function handleFrameAction(
  ctx: FrameContext,
  payload: FrameActionPayload,
): Promise<string> {
  const epoch = await getOrCreateCurrentEpoch();
  const url = postUrl(ctx.baseUrl);
  const buttonIndex = payload.untrustedData?.buttonIndex ?? 0;

  if (epoch.phase === EpochPhase.SUBMISSION) {
    return handleSubmissionAction(ctx, payload, url, buttonIndex);
  }

  if (epoch.phase === EpochPhase.VOTING) {
    return handleVotingAction(ctx, payload, url, buttonIndex);
  }

  return renderFramePage({
    baseUrl: ctx.baseUrl,
    imageUrl: FRAME_TEST_LOOKS[1].imageUrl,
    title: "Epoch ended",
    subtitle: "Refresh when the next epoch starts.",
    postUrl: url,
    buttons: [{ label: "Refresh" }],
  });
}

async function handleSubmissionAction(
  ctx: FrameContext,
  payload: FrameActionPayload,
  postUrlValue: string,
  buttonIndex: number,
): Promise<string> {
  const fid = resolveFid(payload);
  await getOrCreateFrameUser(fid);

  const customUrl = payload.untrustedData?.inputText?.trim();
  const preset = FRAME_TEST_LOOKS[buttonIndex - 1];

  if (!preset && !customUrl) {
    return renderFramePage({
      baseUrl: ctx.baseUrl,
      imageUrl: FRAME_TEST_LOOKS[0].imageUrl,
      title: "Pick a look or paste a URL",
      subtitle: "Use a button for test looks, or paste an HTTPS image link above.",
      postUrl: postUrlValue,
      textInput: true,
      textInputPlaceholder: "https://…/your-fitpic.jpg",
      buttons: FRAME_TEST_LOOKS.map((look) => ({ label: `Submit ${look.label}` })),
    });
  }

  const imageUrl = preset?.imageUrl ?? customUrl!;
  const castHash = resolveCastHash(payload, fid);

  try {
    const submission = await submitFitPic({
      farcasterFid: fid,
      farcasterCastHash: castHash,
      imageUrl,
      hasPhysicalProof: false,
    });

    return renderFramePage({
      baseUrl: ctx.baseUrl,
      imageUrl: submission.imageUrl,
      title: "FitPic submitted!",
      subtitle: `FID ${fid} · ${preset?.label ?? "Custom look"}`,
      postUrl: postUrlValue,
      buttons: [{ label: "Submit another" }],
    });
  } catch (error) {
    const message =
      error instanceof AppError ? error.message : "Could not submit FitPic.";
    return renderFramePage({
      baseUrl: ctx.baseUrl,
      imageUrl: imageUrl,
      title: "Submission failed",
      subtitle: message,
      postUrl: postUrlValue,
      buttons: [{ label: "Try again" }],
    });
  }
}

async function handleVotingAction(
  ctx: FrameContext,
  payload: FrameActionPayload,
  postUrlValue: string,
  buttonIndex: number,
): Promise<string> {
  if (buttonIndex === 2) {
    return renderHomeFrame(ctx);
  }

  const fid = resolveFid(payload);
  await getOrCreateFrameUser(fid);

  const state = payload.untrustedData?.state ?? "";
  const castHash = state.startsWith("vote:") ? state.slice(5) : "";

  if (!castHash || castHash === "none") {
    return renderHomeFrame(ctx);
  }

  try {
    const result = await submitVote(fid, castHash);
    const feed = await getVotingFeed({ limit: 1 });
    const next = feed.find((item) => item.farcasterCastHash !== castHash) ?? feed[0];

    return renderFramePage({
      baseUrl: ctx.baseUrl,
      imageUrl: next?.imageUrl ?? FRAME_TEST_LOOKS[2].imageUrl,
      title: "Vote counted!",
      subtitle: `+${result.reputationReward} reputation · ${result.socialPointsReward} social pts`,
      postUrl: postUrlValue,
      state: next ? `vote:${next.farcasterCastHash}` : "vote:none",
      buttons: next
        ? [{ label: "Vote next 🔥" }, { label: "Done" }]
        : [{ label: "Done" }],
    });
  } catch (error) {
    const message = error instanceof AppError ? error.message : "Could not cast vote.";
    return renderFramePage({
      baseUrl: ctx.baseUrl,
      imageUrl: FRAME_TEST_LOOKS[0].imageUrl,
      title: "Vote failed",
      subtitle: message,
      postUrl: postUrlValue,
      state: `vote:${castHash}`,
      buttons: [{ label: "Retry" }, { label: "Skip" }],
    });
  }
}

/** Dev helper: force current epoch into SUBMISSION phase for Frame testing. */
export async function setEpochToSubmissionForDev(): Promise<void> {
  const epoch = await getOrCreateCurrentEpoch();
  const now = new Date();

  await prisma.epoch.update({
    where: { id: epoch.id },
    data: {
      phase: EpochPhase.SUBMISSION,
      startTime: now,
      endTime: new Date(now.getTime() + SUBMISSION_PHASE_MS),
    },
  });
}
