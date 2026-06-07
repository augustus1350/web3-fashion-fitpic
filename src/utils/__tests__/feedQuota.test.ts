import { describe, expect, it } from "vitest";
import { ROOKIE_VISIBILITY_QUOTA } from "../../config/constants";
import { calculateRookieSlotCount } from "../feedQuota";

describe("calculateRookieSlotCount", () => {
  it("allocates at least one rookie slot for any positive limit", () => {
    expect(calculateRookieSlotCount(1)).toBe(1);
    expect(calculateRookieSlotCount(5)).toBe(1);
  });

  it("reserves ~20% of feed slots for rookies", () => {
    expect(calculateRookieSlotCount(20)).toBe(4);
    expect(calculateRookieSlotCount(10)).toBe(2);
    expect(calculateRookieSlotCount(100)).toBe(20);
  });

  it("uses the configured default quota", () => {
    expect(calculateRookieSlotCount(50, ROOKIE_VISIBILITY_QUOTA)).toBe(10);
  });

  it("returns zero for non-positive limits", () => {
    expect(calculateRookieSlotCount(0)).toBe(0);
  });
});
