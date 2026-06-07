import { Request, Response, Router } from "express";
import { env } from "../../config/env";
import {
  FrameActionPayload,
  handleFrameAction,
  renderHomeEmbed,
  renderHomeFrame,
  setEpochToSubmissionForDev,
} from "../../services/frameService";
import { asyncHandler } from "../middleware/asyncHandler";

export const framesRouter = Router();

/** Farcaster requires HTTPS in all frame meta URLs. */
export function resolveBaseUrl(req: Request): string {
  if (env.appUrl?.startsWith("https://")) {
    return env.appUrl;
  }

  const host = req.get("host") ?? "localhost:3000";
  const forwardedProto = req.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol =
    forwardedProto === "https" ||
    host.includes("trycloudflare.com") ||
    host.includes("loca.lt") ||
    host.includes("onrender.com")
      ? "https"
      : req.protocol;

  const base = `${protocol}://${host}`.replace(/\/$/, "");

  if (!base.startsWith("https://") && !host.startsWith("localhost")) {
    console.warn(
      "[frames] WARNING: Frame URLs must be HTTPS. Set APP_URL=https://your-tunnel.trycloudflare.com in .env",
    );
  }

  return base;
}

async function serveFramePage(req: Request, res: Response): Promise<void> {
  const baseUrl = resolveBaseUrl(req);
  const html = await renderHomeFrame({ baseUrl });
  res
    .status(200)
    .setHeader("Content-Type", "text/html; charset=utf-8")
    .setHeader("Cache-Control", "public, max-age=60")
    .send(html);
}

/** Root URL — Warpcast Embed Tool scrapes fc:miniapp from here. */
framesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const baseUrl = resolveBaseUrl(req);
    const html = await renderHomeEmbed({ baseUrl });
    res
      .status(200)
      .setHeader("Content-Type", "text/html; charset=utf-8")
      .setHeader("Cache-Control", "public, max-age=60")
      .send(html);
  }),
);

framesRouter.get("/frames", asyncHandler(serveFramePage));

framesRouter.get(
  "/frames/debug",
  asyncHandler(async (req, res) => {
    const baseUrl = resolveBaseUrl(req);
    const html = await renderHomeEmbed({ baseUrl });
    const names = [...html.matchAll(/<meta name="(fc:[^"]+)" content="([^"]*)"/g)].map(
      (m) => ({ name: m[1], content: m[2] }),
    );
    res.json({
      baseUrl,
      appUrlFromEnv: env.appUrl ?? null,
      hasFcFrame: names.some((m) => m.name === "fc:frame"),
      hasFcMiniapp: names.some((m) => m.name === "fc:miniapp"),
      allHttps: names.every((m) => !m.content.startsWith("http:")),
      metaTags: names,
    });
  }),
);

framesRouter.post(
  "/frames",
  asyncHandler(async (req, res) => {
    const html = await handleFrameAction(
      { baseUrl: resolveBaseUrl(req) },
      req.body as FrameActionPayload,
    );
    res.status(200).type("text/html").send(html);
  }),
);

/** Dev-only: switch epoch to SUBMISSION so you can test picture uploads in the Frame. */
framesRouter.post(
  "/frames/dev/submission-phase",
  asyncHandler(async (_req, res) => {
    if (env.nodeEnv === "production" && !env.enableDevRoutes) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    await setEpochToSubmissionForDev();
    res.json({
      ok: true,
      message: "Epoch set to SUBMISSION. Open /frames in Warpcast to submit a test look.",
    });
  }),
);
