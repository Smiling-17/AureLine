import { describe, expect, it } from "vitest";
import {
  getCompletedRecoverySecondsForDay,
  issueToRecoveryBodyArea,
  selectRecoveryRecommendation,
} from "@/runtime/recovery";
import type { RecoveryActivityRecord } from "@/runtime/types";
import type { ExerciseCard } from "@/types/posture";

const cards: ExerciseCard[] = [
  {
    id: "desk-reset",
    title: "Desk reset",
    description: "Whole body reset",
    duration: "5 min",
    durationSeconds: 300,
    difficulty: "easy",
    targetArea: "back",
    intensity: "reset",
    safetyNote: "Stop if pain appears.",
    steps: [],
  },
  {
    id: "neck-flow",
    title: "Neck flow",
    description: "Neck reset",
    duration: "4 min",
    durationSeconds: 240,
    difficulty: "easy",
    targetArea: "neck",
    intensity: "reset",
    safetyNote: "Stop if pain appears.",
    steps: [],
  },
  {
    id: "shoulder-flow",
    title: "Shoulder flow",
    description: "Shoulder reset",
    duration: "6 min",
    durationSeconds: 360,
    difficulty: "easy",
    targetArea: "shoulders",
    intensity: "ease-in",
    safetyNote: "Stop if pain appears.",
    steps: [],
  },
];

function completion(overrides: Partial<RecoveryActivityRecord> = {}): RecoveryActivityRecord {
  return {
    dayKey: overrides.dayKey ?? "2026-04-12",
    flowId: overrides.flowId ?? "desk-reset",
    targetArea: overrides.targetArea ?? "back",
    source: overrides.source ?? "recovery",
    startedAt: overrides.startedAt ?? new Date("2026-04-12T09:00:00").getTime(),
    completedAt: "completedAt" in overrides
      ? overrides.completedAt ?? null
      : new Date("2026-04-12T09:05:00").getTime(),
    completedSeconds: overrides.completedSeconds ?? 300,
  };
}

describe("recovery recommendation", () => {
  it("maps posture issues to recovery body areas", () => {
    expect(issueToRecoveryBodyArea("forward-head")).toBe("neck");
    expect(issueToRecoveryBodyArea("shoulder-tilt")).toBe("shoulders");
    expect(issueToRecoveryBodyArea("torso-lean")).toBe("back");
    expect(issueToRecoveryBodyArea(null)).toBe("back");
  });

  it("prioritizes too-close distance advisories toward neck recovery", () => {
    expect(selectRecoveryRecommendation({
      cards,
      dominantIssue: "shoulder-tilt",
      distanceStatus: "too-close",
    })).toMatchObject({
      flowId: "neck-flow",
      targetArea: "neck",
      reason: "distance",
    });
  });

  it("uses issue-specific flows and desk reset fallback", () => {
    expect(selectRecoveryRecommendation({ cards, dominantIssue: "shoulder-tilt" })).toMatchObject({
      flowId: "shoulder-flow",
      targetArea: "shoulders",
      reason: "issue",
    });

    expect(selectRecoveryRecommendation({ cards, dominantIssue: null, latestCueKind: "break" })).toMatchObject({
      flowId: "desk-reset",
      targetArea: "back",
      reason: "break",
    });
  });

  it("uses load-based reset instead of inventing an issue when live issue is null", () => {
    expect(selectRecoveryRecommendation({
      cards,
      dominantIssue: null,
      loadSource: "static-hold",
      effectiveTask: "typing",
    })).toMatchObject({
      flowId: "shoulder-flow",
      targetArea: "shoulders",
      reason: "load",
    });
  });

  it("sums completed recovery seconds for report recovery minutes", () => {
    expect(getCompletedRecoverySecondsForDay([
      completion({ completedSeconds: 300 }),
      completion({ flowId: "neck-flow", completedSeconds: 120 }),
      completion({ dayKey: "2026-04-11", completedSeconds: 999 }),
      completion({ completedAt: null, completedSeconds: 500 }),
    ], "2026-04-12")).toBe(420);
  });
});
