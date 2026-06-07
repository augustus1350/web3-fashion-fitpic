import { describe, expect, it } from "vitest";
import {
  CHANNEL_POST_POINTS_CAP,
  POINTS_PER_LIKE,
  POINTS_PER_RECAST,
  PREMIUM_INTERACTION_EXPONENT,
} from "../../config/constants";
import { AppError } from "../../errors/AppError";
import { calculateEngagementPoints } from "../farcasterChannelService";

describe("calculateEngagementPoints", () => {
  it("awards standard points for likes and recasts", () => {
    const result = calculateEngagementPoints({
      likes: 10,
      recasts: 5,
      premiumInteractions: 0,
    });

    expect(result.rawPoints).toBe(10 * POINTS_PER_LIKE + 5 * POINTS_PER_RECAST);
    expect(result.cappedPoints).toBe(result.rawPoints);
    expect(result.capped).toBe(false);
  });

  it("applies exponential premium interaction boost", () => {
    const premiumOnly = calculateEngagementPoints({
      likes: 0,
      recasts: 0,
      premiumInteractions: 4,
    });

    expect(premiumOnly.rawPoints).toBe(Math.round(Math.pow(4, PREMIUM_INTERACTION_EXPONENT)));
  });

  it("caps points at CHANNEL_POST_POINTS_CAP", () => {
    const result = calculateEngagementPoints({
      likes: 100,
      recasts: 50,
      premiumInteractions: 20,
    });

    expect(result.rawPoints).toBeGreaterThan(CHANNEL_POST_POINTS_CAP);
    expect(result.cappedPoints).toBe(CHANNEL_POST_POINTS_CAP);
    expect(result.capped).toBe(true);
  });

  it("rejects negative engagement counts", () => {
    expect(() =>
      calculateEngagementPoints({ likes: -1, recasts: 0, premiumInteractions: 0 }),
    ).toThrow(AppError);
  });
});
