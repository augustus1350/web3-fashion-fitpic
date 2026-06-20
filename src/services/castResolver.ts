import { AppError } from "../errors/AppError";

export interface ResolvedCast {
  imageUrl: string;
  castHash: string;
  sourceUrl: string;
  /** FID of the cast author, when known (only via Neynar). */
  authorFid?: number;
}

/** Matches warpcast.com / farcaster.xyz cast links: /<user>/<hash> */
const CAST_URL_RE =
  /^https?:\/\/(?:www\.)?(warpcast\.com|farcaster\.xyz)\/([^/\s]+)\/([^/?#\s]+)/i;

const IMAGE_EXT_RE = /\.(jpe?g|png|gif|webp|avif)(\?|#|$)/i;

export function looksLikeCastUrl(value: string): boolean {
  return CAST_URL_RE.test(value.trim());
}

function parseCastUrl(
  value: string,
): { username: string; shortHash: string } | null {
  const m = value.trim().match(CAST_URL_RE);
  return m ? { username: m[2], shortHash: m[3] } : null;
}

/**
 * Resolves a Farcaster username (the author in a cast URL) to its FID using
 * public, key-less endpoints: Warpcast API first, fnames registry as fallback.
 */
async function resolveAuthorFidByUsername(
  username: string,
): Promise<number | null> {
  try {
    const res = await fetchWithTimeout(
      `https://api.warpcast.com/v2/user-by-username?username=${encodeURIComponent(username)}`,
      { headers: { accept: "application/json" } },
    );
    if (res.ok) {
      const data = (await res.json()) as {
        result?: { user?: { fid?: number } };
      };
      const fid = data.result?.user?.fid;
      if (typeof fid === "number") return fid;
    }
  } catch {
    /* fall through to fnames */
  }

  try {
    const res = await fetchWithTimeout(
      `https://fnames.farcaster.xyz/transfers/current?name=${encodeURIComponent(username)}`,
      { headers: { accept: "application/json" } },
    );
    if (res.ok) {
      const data = (await res.json()) as { transfer?: { to?: number } };
      if (typeof data.transfer?.to === "number") return data.transfer.to;
    }
  } catch {
    /* give up */
  }

  return null;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = 8000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

interface NeynarEmbed {
  url?: string;
  metadata?: { content_type?: string };
}

function firstImageEmbed(embeds: NeynarEmbed[] | undefined): string | null {
  if (!Array.isArray(embeds)) return null;
  for (const embed of embeds) {
    const url = embed?.url;
    if (!url) continue;
    const ct = embed?.metadata?.content_type ?? "";
    if (ct.startsWith("image/") || IMAGE_EXT_RE.test(url)) {
      return url;
    }
  }
  return null;
}

/** Strategy 1: Neynar API (accurate raw embed image). Requires NEYNAR_API_KEY. */
async function resolveViaNeynar(url: string): Promise<ResolvedCast | null> {
  const apiKey = process.env.NEYNAR_API_KEY?.trim();
  if (!apiKey) return null;

  try {
    const endpoint = `https://api.neynar.com/v2/farcaster/cast?type=url&identifier=${encodeURIComponent(url)}`;
    const res = await fetchWithTimeout(endpoint, {
      headers: { "x-api-key": apiKey, accept: "application/json" },
    });
    if (!res.ok) return null;

    const data = (await res.json()) as {
      cast?: { hash?: string; embeds?: NeynarEmbed[]; author?: { fid?: number } };
    };
    const image = firstImageEmbed(data.cast?.embeds);
    if (!image) return null;

    return {
      imageUrl: image,
      castHash: data.cast?.hash ?? "",
      sourceUrl: url,
      authorFid: data.cast?.author?.fid,
    };
  } catch {
    return null;
  }
}

function extractMetaImage(html: string): string | null {
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
  ];
  for (const re of patterns) {
    const match = html.match(re);
    if (match?.[1]) return match[1];
  }
  return null;
}

/** Strategy 2: scrape og:image from the cast page (no API key needed). */
async function resolveViaOgImage(
  url: string,
  shortHash: string,
): Promise<ResolvedCast | null> {
  try {
    const res = await fetchWithTimeout(url, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; FitPicBot/1.0; +https://fitpic.example)",
        accept: "text/html",
      },
    });
    if (!res.ok) return null;

    const html = await res.text();
    const image = extractMetaImage(html);
    if (!image) return null;

    return { imageUrl: image, castHash: shortHash, sourceUrl: url };
  } catch {
    return null;
  }
}

function normalizeHash(hash: string, fallback: string): string {
  const value = hash?.trim() || fallback;
  return value.startsWith("0x") ? value : `0x${value}`;
}

/**
 * Resolves a Farcaster cast link to its FitPic image.
 * Tries Neynar (if configured) then falls back to og:image scraping.
 */
export async function resolveCastImage(rawUrl: string): Promise<ResolvedCast> {
  const url = rawUrl?.trim() ?? "";
  const match = url.match(CAST_URL_RE);
  if (!match) {
    throw new AppError(
      "INVALID_INPUT",
      "Please paste a valid Farcaster cast link (warpcast.com or farcaster.xyz).",
      400,
    );
  }

  const shortHash = match[3];
  const hasNeynarKey = Boolean(process.env.NEYNAR_API_KEY?.trim());

  const viaNeynar = await resolveViaNeynar(url);
  if (viaNeynar) {
    return { ...viaNeynar, castHash: normalizeHash(viaNeynar.castHash, shortHash) };
  }

  // Fallback: og:image. Note: warpcast.com/farcaster.xyz are JS SPAs and do
  // NOT expose og:image, so this only helps for non-Farcaster image pages.
  const viaOg = await resolveViaOgImage(url, shortHash);
  if (viaOg) {
    return { ...viaOg, castHash: normalizeHash(viaOg.castHash, shortHash) };
  }

  if (!hasNeynarKey) {
    throw new AppError(
      "INVALID_INPUT",
      "Cast image lookup needs a Neynar API key. Set NEYNAR_API_KEY on the server (free tier at neynar.com).",
      422,
    );
  }

  throw new AppError(
    "INVALID_INPUT",
    "Could not find an image in that cast. Make sure the cast contains a photo and is public.",
    422,
  );
}

/**
 * Resolves a cast image and enforces that the cast belongs to `fid`.
 * Requires Neynar (author FID) so ownership can be verified.
 */
export async function resolveOwnedCastImage(
  rawUrl: string,
  fid: number,
): Promise<ResolvedCast> {
  const resolved = await resolveCastImage(rawUrl);

  // Author FID from Neynar if available, else derive from the URL username.
  let authorFid = resolved.authorFid;
  if (authorFid == null) {
    const parsed = parseCastUrl(rawUrl);
    if (parsed) {
      authorFid = (await resolveAuthorFidByUsername(parsed.username)) ?? undefined;
    }
  }

  if (authorFid == null) {
    throw new AppError(
      "INVALID_INPUT",
      "Could not verify the cast author. Paste the link directly from your own cast.",
      422,
    );
  }

  if (authorFid !== fid) {
    throw new AppError(
      "INVALID_INPUT",
      "You can only submit your own casts — paste a link to a FitPic that you posted.",
      403,
    );
  }

  return { ...resolved, authorFid };
}
