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
import { looksLikeCastUrl, resolveOwnedCastImage } from "./castResolver";
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
      ? [{ label: "Vote 🔥" }, { label: "Skip ⏭" }, { label: "Back ⬅" }]
      : [{ label: "Vote 🔥" }, { label: "Back ⬅" }];

  return renderFramePage({
    baseUrl: ctx.baseUrl,
    imageUrl: item.imageUrl,
    title: headline ?? "Vote on FitPics",
    subtitle: `Look ${idx + 1}/${total} · ${item.totalVotes} votes`,
    postUrl: postUrl(ctx.baseUrl),
    state: `vote:${idx}`,
    buttons,
  });
}

/** Phase-independent home: submit a cast link OR browse & vote. */
function renderHome(ctx: FrameContext, headline?: string): string {
  return renderFramePage({
    baseUrl: ctx.baseUrl,
    imageUrl: FRAME_TEST_LOOKS[0].imageUrl,
    title: headline ?? "FitPic",
    subtitle: "Paste your Farcaster FitPic cast link to submit — or browse & vote.",
    postUrl: postUrl(ctx.baseUrl),
    state: "home",
    textInput: true,
    textInputPlaceholder: "https://warpcast.com/you/0x… (your cast link)",
    buttons: [{ label: "Submit cast link" }, { label: "Browse & vote 👀" }],
  });
}

function resolveFid(payload: FrameActionPayload): number {
  const fid = payload.untrustedData?.fid;
  if (!fid || !Number.isInteger(fid) || fid <= 0) {
    throw new AppError("INVALID_INPUT", "Missing Farcaster FID in frame payload", 400);
  }
  return fid;
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
  const feed = await getVotingFeed({ limit: 1 }).catch(() => []);
  const top = feed[0];
  return renderEmbedPage({
    baseUrl: ctx.baseUrl,
    imageUrl: safeEmbedImage(top?.imageUrl, FRAME_TEST_LOOKS[0].imageUrl),
    title: "FitPic",
    subtitle: "Submit your look or vote on community FitPics.",
  });
}

export async function renderHomeFrame(ctx: FrameContext): Promise<string> {
  return renderHome(ctx);
}

export async function handleFrameAction(
  ctx: FrameContext,
  payload: FrameActionPayload,
): Promise<string> {
  const url = postUrl(ctx.baseUrl);
  const buttonIndex = payload.untrustedData?.buttonIndex ?? 0;
  const state = payload.untrustedData?.state ?? "";

  // In the voting view: vote / skip / back.
  if (state.startsWith("vote:")) {
    return handleVotingAction(ctx, payload, url, buttonIndex);
  }

  // Home view: button 2 = browse & vote, otherwise submit the pasted cast link.
  if (buttonIndex === 2) {
    const feed = await getVotingFeed({ limit: VOTING_FEED_LIMIT });
    if (feed.length === 0) {
      return renderHome(ctx, "No submissions yet — be the first!");
    }
    return renderVotingCard(ctx, feed, 0);
  }

  return handleSubmissionAction(ctx, payload, url, buttonIndex);
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
    return renderHome(ctx, "Paste your cast link above to submit");
  }

  try {
    if (!looksLikeCastUrl(input)) {
      throw new AppError(
        "INVALID_INPUT",
        "Paste a link to your own Farcaster cast (warpcast.com or farcaster.xyz).",
      );
    }

    const resolved = await resolveOwnedCastImage(input, fid);

    const submission = await submitFitPic(
      {
        farcasterFid: fid,
        farcasterCastHash: resolved.castHash,
        imageUrl: resolved.imageUrl,
        hasPhysicalProof: false,
      },
      { enforcePhase: false },
    );

    return renderFramePage({
      baseUrl: ctx.baseUrl,
      imageUrl: submission.imageUrl,
      title: "FitPic submitted!",
      subtitle: `FID ${fid} · linked from your cast`,
      postUrl: postUrlValue,
      state: "home",
      buttons: [{ label: "Submit another" }, { label: "Browse & vote 👀" }],
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
      state: "home",
      textInput: true,
      textInputPlaceholder: "https://warpcast.com/you/0x… (your cast link)",
      buttons: [{ label: "Try again" }, { label: "Browse & vote 👀" }],
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
  const multi = feed.length > 1;

  // Back ⬅ to home (button 3 when multi, button 2 when single).
  if ((multi && buttonIndex === 3) || (!multi && buttonIndex === 2)) {
    return renderHome(ctx);
  }

  // Skip ⏭ → page to the next look without voting.
  if (multi && buttonIndex === 2) {
    return renderVotingCard(ctx, feed, currentIdx + 1, "Skipped ⏭");
  }

  // Vote on the currently shown look.
  const fid = resolveFid(payload);
  await getOrCreateFrameUser(fid);
  const target = feed[currentIdx];

  try {
    const result = await submitVote(fid, target.farcasterCastHash, {
      enforcePhase: false,
    });
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
