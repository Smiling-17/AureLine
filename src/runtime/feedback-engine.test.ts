import { describe, expect, it } from "vitest";
import { canTriggerFeedbackLevel, selectFeedbackLevel } from "@/runtime/feedback-engine";

describe("feedback engine", () => {
  it("selects feedback levels at the product timing thresholds", () => {
    expect(selectFeedbackLevel("warning", 9_999, 0)).toBeNull();
    expect(selectFeedbackLevel("warning", 10_000, 0)).toBe(2);
    expect(selectFeedbackLevel("warning", 20_000, 0)).toBe(3);
    expect(selectFeedbackLevel("bad", 35_000, 0)).toBe(4);
  });

  it("promotes bad posture to level 4 after three level-3 cues in the rolling window", () => {
    expect(selectFeedbackLevel("bad", 12_000, 3)).toBe(4);
  });

  it("promotes repeated level-3 cues to level 4 even before the bad-posture duration threshold", () => {
    expect(selectFeedbackLevel("warning", 12_000, 3)).toBe(4);
  });

  it("uses exposure ratio and reliability for the task-aware engine", () => {
    expect(selectFeedbackLevel({
      ratio: 0.79,
      trackingReliability: "full",
      moderateElapsedMs: 20_000,
      highElapsedMs: 0,
      recentLevel3Count: 0,
    })).toBeNull();
    expect(selectFeedbackLevel({
      ratio: 0.8,
      trackingReliability: "full",
      moderateElapsedMs: 10_000,
      highElapsedMs: 0,
      recentLevel3Count: 0,
    })).toBe(2);
    expect(selectFeedbackLevel({
      ratio: 1,
      trackingReliability: "full",
      moderateElapsedMs: 12_000,
      highElapsedMs: 8_000,
      recentLevel3Count: 0,
    })).toBe(3);
    expect(selectFeedbackLevel({
      ratio: 1.4,
      trackingReliability: "minimal",
      moderateElapsedMs: 12_000,
      highElapsedMs: 8_000,
      recentLevel3Count: 0,
    })).toBe(2);
  });

  it("lets escalation happen even while the issue-family cooldown is active", () => {
    expect(canTriggerFeedbackLevel(2, 1, 0)).toBe(true);
    expect(canTriggerFeedbackLevel(2, 1, 20_000)).toBe(false);
    expect(canTriggerFeedbackLevel(3, 2, 20_000)).toBe(true);
    expect(canTriggerFeedbackLevel(4, 3, 20_000)).toBe(true);
  });
});
