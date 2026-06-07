import { describe, expect, it } from "vitest";
import {
  BASE_VOTE_REPUTATION_REWARD,
  CLIQUE_FARMING_DAMPENING_FACTOR,
  TRENDSETTER_EARLY_VOTE_THRESHOLD,
} from "../../config/constants";
import { AppError } from "../../errors/AppError";
import {
  calculateCliqueFarmingMultiplier,
  isEarlyVote,
} from "../votingService";

describe("calculateCliqueFarmingMultiplier", () => {
  it("returns 1.0 for zero existing votes (maximum reward)", () => {
    expect(calculateCliqueFarmingMultiplier(0)).toBe(1);
  });

  it("dampens rewards asymptotically as consensus grows", () => {
    const low = calculateCliqueFarmingMultiplier(5);
    const high = calculateCliqueFarmingMultiplier(50);

    expect(low).toBeGreaterThan(high);
    expect(high).toBeCloseTo(1 / (1 + CLIQUE_FARMING_DAMPENING_FACTOR * 50));
  });

  it("approaches zero on very high-consensus posts", () => {
    const multiplier = calculateCliqueFarmingMultiplier(1000);
    expect(multiplier).toBeLessThan(0.01);

    const reward = Math.round(BASE_VOTE_REPUTATION_REWARD * multiplier);
    expect(reward).toBe(0);
  });

  it("rejects negative vote counts", () => {
    expect(() => calculateCliqueFarmingMultiplier(-1)).toThrow(AppError);
  });
});

describe("isEarlyVote", () => {
  it("qualifies votes cast before the trendsetter threshold", () => {
    expect(isEarlyVote(0)).toBe(true);
    expect(isEarlyVote(TRENDSETTER_EARLY_VOTE_THRESHOLD - 1)).toBe(true);
  });

  it("does not qualify votes at or after the threshold", () => {
    expect(isEarlyVote(TRENDSETTER_EARLY_VOTE_THRESHOLD)).toBe(false);
    expect(isEarlyVote(100)).toBe(false);
  });
});
