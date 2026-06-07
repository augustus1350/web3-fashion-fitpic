import { User, UserTier } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { assertNotBlocked } from "../errors/AppError";

/** Creates a ROOKIE user on first Frame interaction (PoC convenience). */
export async function getOrCreateFrameUser(farcasterFid: number): Promise<User> {
  const user = await prisma.user.upsert({
    where: { farcasterFid },
    create: { farcasterFid, tier: UserTier.ROOKIE },
    update: {},
  });

  assertNotBlocked(user.isBlocked, "frame interaction");
  return user;
}
