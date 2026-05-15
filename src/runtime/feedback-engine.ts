import type { FeedbackLevel, TrackingReliability } from "@/runtime/types";
import type { PostureState } from "@/types/posture";

export type TriggerableFeedbackLevel = Extract<FeedbackLevel, 2 | 3 | 4>;

export function selectFeedbackLevel(
  input:
    | {
        ratio: number;
        trackingReliability: TrackingReliability;
        moderateElapsedMs: number;
        highElapsedMs: number;
        recentLevel3Count: number;
      }
    | PostureState,
  legacyElapsedMs?: number,
  legacyRecentLevel3Count?: number,
): TriggerableFeedbackLevel | null {
  if (typeof input === "string") {
    const elapsedMs = legacyElapsedMs ?? 0;
    const recentLevel3Count = legacyRecentLevel3Count ?? 0;
    if (input === "good") return null;
    if (recentLevel3Count >= 3) return 4;
    if (input === "bad" && elapsedMs >= 35_000) return 4;
    if (elapsedMs >= 20_000) return 3;
    if (elapsedMs >= 10_000) return 2;
    return null;
  }

  if (input.ratio < 0.8) return null;
  if (input.ratio >= 1.4 && input.trackingReliability !== "minimal") return 4;
  if (input.ratio >= 1 && input.recentLevel3Count >= 2 && input.trackingReliability !== "minimal") return 4;
  if (input.ratio >= 1 && input.highElapsedMs >= 8_000 && input.trackingReliability !== "minimal") return 3;
  if (input.ratio >= 0.8 && input.moderateElapsedMs >= 10_000) return 2;
  return null;
}

export function canTriggerFeedbackLevel(
  desiredLevel: TriggerableFeedbackLevel | null,
  highestLevelTriggered: 0 | FeedbackLevel,
  cooldownMs: number,
) {
  if (!desiredLevel || desiredLevel <= highestLevelTriggered) return false;

  const isEscalationFromExistingHeavyCue = highestLevelTriggered >= 2;
  return cooldownMs === 0 || isEscalationFromExistingHeavyCue;
}
