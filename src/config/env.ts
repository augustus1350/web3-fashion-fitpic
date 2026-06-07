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

export interface AccountAssociation {
  header: string;
  payload: string;
  signature: string;
}

/**
 * Reads the Farcaster account association from env.
 * Accepts either a full JSON object (FARCASTER_ACCOUNT_ASSOCIATION) or the
 * three individual fields. Returns null when not configured.
 */
function parseAccountAssociation(): AccountAssociation | null {
  const raw = process.env.FARCASTER_ACCOUNT_ASSOCIATION?.trim();
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<AccountAssociation> & {
        accountAssociation?: Partial<AccountAssociation>;
      };
      const obj = parsed.accountAssociation ?? parsed;
      if (obj.header && obj.payload && obj.signature) {
        return {
          header: obj.header,
          payload: obj.payload,
          signature: obj.signature,
        };
      }
    } catch {
      console.warn("[env] FARCASTER_ACCOUNT_ASSOCIATION is not valid JSON");
    }
  }

  const header = process.env.FARCASTER_HEADER?.trim();
  const payload = process.env.FARCASTER_PAYLOAD?.trim();
  const signature = process.env.FARCASTER_SIGNATURE?.trim();
  if (header && payload && signature) {
    return { header, payload, signature };
  }

  return null;
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
  /** Farcaster domain manifest account association (from Warpcast tool). */
  accountAssociation: parseAccountAssociation(),
};
