import { User } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError, assertNotBlocked } from "../errors/AppError";

export async function findUserByFid(farcasterFid: number): Promise<User> {
  const user = await prisma.user.findUnique({ where: { farcasterFid } });
  if (!user) {
    throw new AppError("USER_NOT_FOUND", `User with FID ${farcasterFid} not found`, 404);
  }
  return user;
}

export async function requireActiveUser(farcasterFid: number): Promise<User> {
  const user = await findUserByFid(farcasterFid);
  assertNotBlocked(user.isBlocked, `fid:${farcasterFid}`);
  return user;
}
