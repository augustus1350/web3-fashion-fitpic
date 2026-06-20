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
import { looksLikeCastUrl, resolveCastImage } from "./castResolver";
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

const VOTING_FEED_LIMIT = 30;

function postUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, "")}/frames`;
}

type VotingFeed = Awaited<ReturnType<typeof getVotingFeed>>;

/** Wraps an index into valid feed bounds. */
function wrapIndex(index: number, length: number): number {
  return ((index % length) + length) % length;
}

/**
 * Renders one swipeable voting card. The feed position is carried in the
 * frame `state` (`vote:<idx>`) so Skip/Vote can page through all submissions.
 */
function renderVotingCard(
  ctx: FrameContext,
  feed: VotingFeed,
  index: number,
  headline?: string,
): string {
  const total = feed.length;
  const idx = wrapIndex(index, total);
  const item = feed[idx];
  const buttons =
    total > 1
      ? [{ label: "Vote 🔥" }, { label: "Skip ⏭" }]
      : [{ label: "Vote 🔥" }];

  return renderFramePage({
    baseUrl: ctx.baseUrl,
    imageUrl: item.imageUrl,
    title: headline ?? "FitPic - Voting phase",
    subtitle: `Look ${idx + 1}/${total} · ${item.totalVotes} votes`,
    postUrl: postUrl(ctx.baseUrl),
    state: `vote:${idx}`,
    buttons,
  });
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

/** Warpcast needs a real, reachable image; reject placeholders/non-https. */
function safeEmbedImage(candidate: string | undefined, fallback: string): string {
  if (
    !candidate ||
    !candidate.startsWith("https://") ||
    candidate.includes("example.com")
  ) {
    return fallback;
  }
  return candidate;
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
      imageUrl: safeEmbedImage(top?.imageUrl, FRAME_TEST_LOOKS[0].imageUrl),
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
      subtitle: "Paste a link to your Farcaster FitPic cast, then submit.",
      postUrl: url,
      textInput: true,
      textInputPlaceholder: "https://warpcast.com/you/0x… (your cast link)",
      buttons: [{ label: "Submit cast link" }],
    });
  }

  if (epoch.phase === EpochPhase.VOTING) {
    const feed = await getVotingFeed({ limit: VOTING_FEED_LIMIT });
    if (feed.length === 0) {
      return renderFramePage({
        baseUrl: ctx.baseUrl,
        imageUrl: FRAME_TEST_LOOKS[0].imageUrl,
        title: "FitPic - Voting phase",
        subtitle: "No submissions yet — check back soon.",
        postUrl: url,
        state: "vote:none",
        buttons: [{ label: "Refresh" }],
      });
    }
    return renderVotingCard(ctx, feed, 0);
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

  const input = payload.untrustedData?.inputText?.trim();

  if (!input) {
    return renderFramePage({
      baseUrl: ctx.baseUrl,
      imageUrl: FRAME_TEST_LOOKS[0].imageUrl,
      title: "Paste your cast link",
      subtitle: "Copy the link of a FitPic you posted on Farcaster and paste it above.",
      postUrl: postUrlValue,
      textInput: true,
      textInputPlaceholder: "https://warpcast.com/you/0x… (your cast link)",
      buttons: [{ label: "Submit cast link" }],
    });
  }

  try {
    let imageUrl: string;
    let castHash: string;

    if (looksLikeCastUrl(input)) {
      const resolved = await resolveCastImage(input);
      imageUrl = resolved.imageUrl;
      castHash = resolved.castHash;
    } else if (input.startsWith("https://")) {
      imageUrl = input;
      castHash = resolveCastHash(payload, fid);
    } else {
      throw new AppError(
        "INVALID_INPUT",
        "Paste a Farcaster cast link (warpcast.com or farcaster.xyz).",
      );
    }

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
      subtitle: `FID ${fid} · linked from your cast`,
      postUrl: postUrlValue,
      buttons: [{ label: "Submit another" }],
    });
  } catch (error) {
    const message =
      error instanceof AppError ? error.message : "Could not submit FitPic.";
    return renderFramePage({
      baseUrl: ctx.baseUrl,
      imageUrl: FRAME_TEST_LOOKS[0].imageUrl,
      title: "Submission failed",
      subtitle: message,
      postUrl: postUrlValue,
      textInput: true,
      textInputPlaceholder: "https://warpcast.com/you/0x… (your cast link)",
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
  const feed = await getVotingFeed({ limit: VOTING_FEED_LIMIT });

  if (feed.length === 0) {
    return renderFramePage({
      baseUrl: ctx.baseUrl,
      imageUrl: FRAME_TEST_LOOKS[0].imageUrl,
      title: "FitPic - Voting phase",
      subtitle: "No submissions yet — check back soon.",
      postUrl: postUrlValue,
      state: "vote:none",
      buttons: [{ label: "Refresh" }],
    });
  }

  const state = payload.untrustedData?.state ?? "";
  const match = state.match(/^vote:(\d+)$/);
  const currentIdx = wrapIndex(match ? Number(match[1]) : 0, feed.length);

  // Skip → page to the next look without voting.
  if (buttonIndex === 2 && feed.length > 1) {
    return renderVotingCard(ctx, feed, currentIdx + 1, "Skipped ⏭");
  }

  // Vote on the currently shown look.
  const fid = resolveFid(payload);
  await getOrCreateFrameUser(fid);
  const target = feed[currentIdx];

  try {
    const result = await submitVote(fid, target.farcasterCastHash);
    const updated = await getVotingFeed({ limit: VOTING_FEED_LIMIT });
    const nextFeed = updated.length > 0 ? updated : feed;
    return renderVotingCard(
      ctx,
      nextFeed,
      currentIdx + 1,
      `Vote counted! +${result.reputationReward} rep`,
    );
  } catch (error) {
    const message = error instanceof AppError ? error.message : "Could not cast vote.";
    return renderVotingCard(ctx, feed, currentIdx, message);
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
