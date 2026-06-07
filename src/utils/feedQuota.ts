import { ROOKIE_VISIBILITY_QUOTA } from "../config/constants";

/** Computes how many feed slots are reserved for rookie-tier submissions. */
export function calculateRookieSlotCount(
  limit: number,
  quota = ROOKIE_VISIBILITY_QUOTA,
): number {
  if (limit < 1) {
    return 0;
  }
  return Math.max(1, Math.floor(limit * quota));
}
