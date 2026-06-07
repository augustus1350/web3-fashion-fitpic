import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env" });

function parseFounderFids(raw: string | undefined): number[] {
  if (!raw?.trim()) {
    return [1];
  }
  return raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
}

export const env = {
  port: Number(process.env.PORT ?? 3000),
  nodeEnv: process.env.NODE_ENV ?? "development",
  founderFids: parseFounderFids(process.env.FOUNDER_FIDS),
  /** Public HTTPS URL for Frame meta tags (tunnel, Render, etc.). */
  appUrl: (process.env.APP_URL ?? process.env.RENDER_EXTERNAL_URL)?.replace(
    /\/$/,
    "",
  ),
  /** Allows /frames/dev/* helpers on deployed PoC instances. */
  enableDevRoutes: process.env.ENABLE_DEV_ROUTES === "1",
};
