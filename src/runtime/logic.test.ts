import { describe, expect, it } from "vitest";
import {
  buildDailySummary,
  buildThresholds,
  classifyPosture,
  computeAchievements,
  computeIdentity,
  computeScore,
  computeStreak,
  getDistanceStatus,
  getSensitivityMultiplier,
} from "@/runtime/logic";
import type { DailySummary, PoseSampleRecord, SessionRecord } from "@/runtime/types";

function createSession(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    id: overrides.id ?? "session-1",
    dayKey: overrides.dayKey ?? "2026-04-10",
    startedAt: overrides.startedAt ?? new Date("2026-04-10T09:00:00").getTime(),
    endedAt: overrides.endedAt ?? new Date("2026-04-10T10:00:00").getTime(),
    durationMs: overrides.durationMs ?? 60 * 60 * 1000,
    trackedMs: overrides.trackedMs ?? 45 * 60 * 1000,
    goodMs: overrides.goodMs ?? 30 * 60 * 1000,
    warningMs: overrides.warningMs ?? 10 * 60 * 1000,
    badMs: overrides.badMs ?? 5 * 60 * 1000,
    analyzingMs: overrides.analyzingMs ?? 5 * 60 * 1000,
    issueMs: overrides.issueMs ?? {
      "forward-head": 10 * 60 * 1000,
      "torso-lean": 3 * 60 * 1000,
      "shoulder-tilt": 2 * 60 * 1000,
    },
    deviationSum: overrides.deviationSum ?? 12,
    deviationSamples: overrides.deviationSamples ?? 30,
    deviationDurationMs: overrides.deviationDurationMs,
    correctionSuccessCount: overrides.correctionSuccessCount ?? 4,
    interventionCount: overrides.interventionCount ?? 6,
    overlayCount: overrides.overlayCount ?? 1,
    breakReminderCount: overrides.breakReminderCount ?? 2,
    screenDistanceWarningCount: overrides.screenDistanceWarningCount ?? 1,
    longestFocusBlockMs: overrides.longestFocusBlockMs ?? 18 * 60 * 1000,
    score: overrides.score ?? 78,
  };
}

function createSample(overrides: Partial<PoseSampleRecord> = {}): PoseSampleRecord {
  return {
    dayKey: overrides.dayKey ?? "2026-04-10",
    sessionId: overrides.sessionId ?? "session-1",
    timestamp: overrides.timestamp ?? new Date("2026-04-10T09:00:00").getTime(),
    postureState: overrides.postureState ?? "good",
    issue: overrides.issue ?? null,
    deviationRatio: overrides.deviationRatio ?? 0.2,
    metrics: overrides.metrics ?? {
      headForward: 0.06,
      torsoLean: 6,
      shoulderTilt: 4,
      screenDistanceRatio: 0.2,
      deviationRatio: 0.2,
    },
    landmarks: overrides.landmarks ?? {
      nose: null,
      leftEar: null,
      rightEar: null,
      leftEye: null,
      rightEye: null,
      leftShoulder: null,
      rightShoulder: null,
      leftHip: null,
      rightHip: null,
    },
  };
}

function createSummary(overrides: Partial<DailySummary> = {}): DailySummary {
  return {
    dayKey: overrides.dayKey ?? "2026-04-10",
    sessionsCount: overrides.sessionsCount ?? 1,
    firstSessionAt: overrides.firstSessionAt ?? new Date("2026-04-10T09:00:00").getTime(),
    lastSessionAt: overrides.lastSessionAt ?? new Date("2026-04-10T17:00:00").getTime(),
    trackedMs: overrides.trackedMs ?? 40 * 60 * 1000,
    durationMs: overrides.durationMs ?? 50 * 60 * 1000,
    goodMs: overrides.goodMs ?? 30 * 60 * 1000,
    warningMs: overrides.warningMs ?? 7 * 60 * 1000,
    badMs: overrides.badMs ?? 3 * 60 * 1000,
    analyzingMs: overrides.analyzingMs ?? 5 * 60 * 1000,
    issueMs: overrides.issueMs ?? {
      "forward-head": 8 * 60 * 1000,
      "torso-lean": 1 * 60 * 1000,
      "shoulder-tilt": 1 * 60 * 1000,
    },
    avgDeviation: overrides.avgDeviation ?? 0.22,
    score: overrides.score ?? 82,
    correctionSuccessCount: overrides.correctionSuccessCount ?? 5,
    interventionCount: overrides.interventionCount ?? 6,
    overlayCount: overrides.overlayCount ?? 1,
    breakReminderCount: overrides.breakReminderCount ?? 1,
    screenDistanceWarningCount: overrides.screenDistanceWarningCount ?? 0,
    longestFocusBlockMs: overrides.longestFocusBlockMs ?? 20 * 60 * 1000,
    bestHour: overrides.bestHour ?? 10,
    worstHour: overrides.worstHour ?? 15,
    hourlyTrend: overrides.hourlyTrend ?? [],
    dominantIssue: overrides.dominantIssue ?? "forward-head",
    streakEligible: overrides.streakEligible ?? true,
    lastSessionScore: overrides.lastSessionScore ?? overrides.score ?? 82,
  };
}

describe("runtime logic", () => {
  it("maps sensitivity to tighter thresholds at higher values", () => {
    expect(getSensitivityMultiplier(20)).toBe(1.25);
    expect(getSensitivityMultiplier(100)).toBe(0.8);
  });

  it("builds thresholds from the baseline", () => {
    const thresholds = buildThresholds(
      {
        headForward: 0.04,
        torsoLean: 4,
        shoulderTilt: 3,
        screenDistanceRatio: 0.22,
      },
      100,
    );

    expect(thresholds.warning.headForward).toBeCloseTo(0.068, 3);
    expect(thresholds.bad.torsoLean).toBeCloseTo(15.2, 3);
    expect(thresholds.bad.shoulderTilt).toBeCloseTo(12.6, 3);
  });

  it("classifies warning and bad posture with the dominant issue", () => {
    const thresholds = buildThresholds(
      {
        headForward: 0.03,
        torsoLean: 3,
        shoulderTilt: 2,
        screenDistanceRatio: 0.22,
      },
      72,
    );

    const warning = classifyPosture(
      {
        headForward: thresholds.warning.headForward + 0.01,
        torsoLean: thresholds.warning.torsoLean - 1,
        shoulderTilt: thresholds.warning.shoulderTilt - 1,
        screenDistanceRatio: 0.22,
      },
      thresholds,
    );
    expect(warning.postureState).toBe("warning");
    expect(warning.currentIssue).toBe("forward-head");

    const bad = classifyPosture(
      {
        headForward: thresholds.warning.headForward + 0.01,
        torsoLean: thresholds.bad.torsoLean + 1,
        shoulderTilt: thresholds.warning.shoulderTilt + 0.2,
        screenDistanceRatio: 0.22,
      },
      thresholds,
    );
    expect(bad.postureState).toBe("bad");
    expect(bad.currentIssue).toBe("torso-lean");
    expect(bad.deviationRatio).toBeLessThanOrEqual(1);
  });

  it("does not penalize deviation when metrics are at the calibrated baseline", () => {
    const baseline = {
      headForward: 0.03,
      torsoLean: 3,
      shoulderTilt: 2,
      screenDistanceRatio: 0.22,
    };
    const thresholds = buildThresholds(baseline, 72);

    const result = classifyPosture(
      {
        headForward: baseline.headForward,
        torsoLean: baseline.torsoLean,
        shoulderTilt: baseline.shoulderTilt,
        screenDistanceRatio: baseline.screenDistanceRatio,
      },
      thresholds,
    );

    expect(result.postureState).toBe("good");
    expect(result.currentIssue).toBeNull();
    expect(result.deviationRatio).toBe(0);
  });

  it("normalizes score deviation when torso is unavailable", () => {
    const baseline = {
      headForward: 0.03,
      torsoLean: 3,
      shoulderTilt: 2,
      screenDistanceRatio: 0.22,
    };
    const thresholds = buildThresholds(baseline, 72, {
      headForward: true,
      torsoLean: false,
      shoulderTilt: true,
    });

    const result = classifyPosture(
      {
        headForward: thresholds.bad.headForward,
        torsoLean: thresholds.bad.torsoLean + 100,
        shoulderTilt: baseline.shoulderTilt,
        screenDistanceRatio: baseline.screenDistanceRatio,
      },
      thresholds,
      {
        headForward: true,
        torsoLean: false,
        shoulderTilt: true,
      },
    );

    expect(result.postureState).toBe("bad");
    expect(result.currentIssue).toBe("forward-head");
    expect(result.metricAvailability.torsoLean).toBe(false);
    expect(result.deviationRatio).toBeCloseTo(0.45 / 0.65);
  });

  it("detects screen distance relative to the calibrated baseline", () => {
    const baseline = {
      headForward: 0.03,
      torsoLean: 3,
      shoulderTilt: 2,
      screenDistanceRatio: 0.2,
    };

    expect(getDistanceStatus(baseline, 0.27)).toBe("too-close");
    expect(getDistanceStatus(baseline, 0.14)).toBe("too-far");
    expect(getDistanceStatus(baseline, 0.2)).toBe("ok");
  });

  it("uses softer too-close-only thresholds for screen-unknown distance mode", () => {
    const baseline = {
      headForward: 0.03,
      torsoLean: 3,
      shoulderTilt: 2,
      screenDistanceRatio: 0.2,
    };

    expect(getDistanceStatus(baseline, 0.25, "soft")).toBe("ok");
    expect(getDistanceStatus(baseline, 0.27, "soft")).toBe("too-close");
    expect(getDistanceStatus(baseline, 0.14, "soft")).toBe("ok");
  });

  it("does not flag too-far from side-view eye span unless face distance is highly reliable", () => {
    const baseline = {
      headForward: 0.03,
      torsoLean: 3,
      shoulderTilt: 2,
      screenDistanceRatio: 0.2,
      screenDistanceCm: 55,
    };

    expect(getDistanceStatus(baseline, 0.14, "active", 80, { cameraView: "side" })).toBe("ok");
    expect(getDistanceStatus(baseline, 0.14, "active", 80, {
      cameraView: "side",
      distanceEstimateConfidence: 0.92,
      distanceEstimateSource: "face-mesh",
    })).toBe("too-far");
  });

  it("still flags too-close when the calibrated baseline itself was already close but the absolute estimate drops below the floor", () => {
    const baseline = {
      headForward: 0.03,
      torsoLean: 3,
      shoulderTilt: 2,
      screenDistanceRatio: 0.28,
      screenDistanceCm: 33,
    };

    expect(getDistanceStatus(baseline, 0.3, "active", 34)).toBe("too-close");
    expect(getDistanceStatus(baseline, 0.3, "active", 44)).toBe("ok");
  });

  it("computes the posture score from bad-time ratio and average deviation", () => {
    expect(computeScore(60_000, 10_000, 5_000, 0.2)).toBe(77);
    expect(computeScore(0, 0, 0, 0)).toBe(0);
  });

  it("aggregates sessions and samples into a daily summary", () => {
    const summary = buildDailySummary(
      "2026-04-10",
      [createSession()],
      [
        createSample({ timestamp: new Date("2026-04-10T09:00:00").getTime(), postureState: "good" }),
        createSample({
          timestamp: new Date("2026-04-10T09:01:00").getTime(),
          postureState: "warning",
          issue: "forward-head",
          deviationRatio: 0.4,
        }),
        createSample({
          timestamp: new Date("2026-04-10T10:00:00").getTime(),
          postureState: "bad",
          issue: "torso-lean",
          deviationRatio: 0.7,
        }),
      ],
    );

    expect(summary.sessionsCount).toBe(1);
    expect(summary.hourlyTrend).toHaveLength(2);
    expect(summary.bestHour).not.toBeNull();
    expect(summary.dominantIssue).toBe("forward-head");
    expect(summary.score).toBeGreaterThan(0);
  });

  it("weights hourly samples by timestamp gaps instead of fixed sample count", () => {
    const summary = buildDailySummary(
      "2026-04-10",
      [
        createSession({
          trackedMs: 3000,
          goodMs: 1000,
          warningMs: 2000,
          badMs: 0,
          deviationSum: 1400,
          deviationSamples: 2,
          deviationDurationMs: 3000,
        }),
      ],
      [
        createSample({
          timestamp: new Date("2026-04-10T09:00:00").getTime(),
          postureState: "good",
          deviationRatio: 0.1,
        }),
        createSample({
          timestamp: new Date("2026-04-10T09:00:02").getTime(),
          postureState: "warning",
          issue: "forward-head",
          deviationRatio: 0.6,
        }),
      ],
    );

    expect(summary.avgDeviation).toBeCloseTo(1400 / 3000);
    expect(summary.hourlyTrend[0]?.trackedMs).toBe(3000);
    expect(summary.hourlyTrend[0]?.postureScore).toBe(93);
  });

  it("keeps dominant issue empty when no issue time was recorded", () => {
    const summary = buildDailySummary(
      "2026-04-10",
      [createSession({
        issueMs: {
          "forward-head": 0,
          "torso-lean": 0,
          "shoulder-tilt": 0,
        },
      })],
      [],
    );

    expect(summary.dominantIssue).toBeNull();
  });

  it("computes consecutive streaks from eligible days", () => {
    const summaries = [
      createSummary({ dayKey: "2026-04-08" }),
      createSummary({ dayKey: "2026-04-09" }),
      createSummary({ dayKey: "2026-04-10" }),
    ];

    expect(computeStreak(summaries, new Date("2026-04-11T12:00:00").getTime())).toBe(3);
  });

  it("resets streaks when the latest eligible day is skipped or today is already below threshold", () => {
    expect(computeStreak([
      createSummary({ dayKey: "2026-04-08" }),
      createSummary({ dayKey: "2026-04-09" }),
    ], new Date("2026-04-11T12:00:00").getTime())).toBe(0);

    expect(computeStreak([
      createSummary({ dayKey: "2026-04-10" }),
      createSummary({
        dayKey: "2026-04-11",
        score: 62,
        trackedMs: 35 * 60 * 1000,
        streakEligible: false,
      }),
    ], new Date("2026-04-11T12:00:00").getTime())).toBe(0);
  });

  it("unlocks achievements and identity from recent summaries", () => {
    const summaries = [
      createSummary({ dayKey: "2026-04-04", lastSessionAt: new Date("2026-04-04T18:15:00").getTime(), score: 84 }),
      createSummary({ dayKey: "2026-04-05", lastSessionAt: new Date("2026-04-05T18:30:00").getTime(), score: 88 }),
      createSummary({ dayKey: "2026-04-06", lastSessionAt: new Date("2026-04-06T18:45:00").getTime(), score: 86 }),
      createSummary({ dayKey: "2026-04-07", score: 80 }),
      createSummary({ dayKey: "2026-04-08", score: 81, issueMs: { "forward-head": 4, "torso-lean": 1, "shoulder-tilt": 1 } }),
      createSummary({ dayKey: "2026-04-09", score: 83, issueMs: { "forward-head": 3, "torso-lean": 1, "shoulder-tilt": 1 } }),
      createSummary({ dayKey: "2026-04-10", score: 82, issueMs: { "forward-head": 2, "torso-lean": 1, "shoulder-tilt": 1 } }),
    ];

    const achievements = computeAchievements(summaries, new Date("2026-04-11T12:00:00").getTime());
    const identity = computeIdentity(summaries);

    expect(achievements.find((item) => item.id === "desk-reset-streak")?.unlocked).toBe(true);
    expect(achievements.find((item) => item.id === "shoulder-saver")?.unlocked).toBe(true);
    expect(achievements.find((item) => item.id === "evening-finisher")?.unlocked).toBe(true);
    expect(identity.level).toBe("Focus Flow");
    expect(identity.progressValue).toBeGreaterThan(0);
  });

  it("uses last session score for Evening Finisher instead of daily score", () => {
    const summaries = [
      createSummary({ dayKey: "2026-04-08", lastSessionAt: new Date("2026-04-08T18:15:00").getTime(), score: 95, lastSessionScore: 60 }),
      createSummary({ dayKey: "2026-04-09", lastSessionAt: new Date("2026-04-09T18:15:00").getTime(), score: 95, lastSessionScore: 60 }),
      createSummary({ dayKey: "2026-04-10", lastSessionAt: new Date("2026-04-10T18:15:00").getTime(), score: 95, lastSessionScore: 60 }),
    ];

    expect(computeAchievements(summaries, new Date("2026-04-11T12:00:00").getTime()).find((item) => item.id === "evening-finisher")?.unlocked).toBe(false);

    const unlocked = summaries.map((summary) => ({ ...summary, lastSessionScore: 85 }));
    expect(computeAchievements(unlocked, new Date("2026-04-11T12:00:00").getTime()).find((item) => item.id === "evening-finisher")?.unlocked).toBe(true);
  });

  it("keeps achievement streak progress when today has not reached retention duration yet", () => {
    const achievements = computeAchievements([
      createSummary({ dayKey: "2026-04-06" }),
      createSummary({ dayKey: "2026-04-07" }),
      createSummary({ dayKey: "2026-04-08" }),
      createSummary({ dayKey: "2026-04-09" }),
      createSummary({ dayKey: "2026-04-10" }),
      createSummary({
        dayKey: "2026-04-11",
        trackedMs: 5 * 60 * 1000,
        score: 0,
        streakEligible: false,
      }),
    ], new Date("2026-04-11T12:00:00").getTime());

    expect(achievements.find((item) => item.id === "desk-reset-streak")?.unlocked).toBe(true);
  });

  it("keeps identity in waiting state until there are at least two qualifying days", () => {
    expect(computeIdentity([])).toMatchObject({
      vibe: "Waiting for enough data",
      progressValue: 0,
    });

    expect(computeIdentity([createSummary({ dayKey: "2026-04-10" })])).toMatchObject({
      vibe: "Waiting for enough data",
      progressValue: 0,
    });
  });

  it("requires Shoulder Saver days to be consecutive qualifying retention days", () => {
    const achievements = computeAchievements([
      createSummary({
        dayKey: "2026-04-06",
        issueMs: { "forward-head": 1, "torso-lean": 1, "shoulder-tilt": 1 },
      }),
      createSummary({
        dayKey: "2026-04-08",
        issueMs: { "forward-head": 1, "torso-lean": 1, "shoulder-tilt": 1 },
      }),
      createSummary({
        dayKey: "2026-04-09",
        issueMs: { "forward-head": 1, "torso-lean": 1, "shoulder-tilt": 1 },
      }),
    ]);

    expect(achievements.find((item) => item.id === "shoulder-saver")?.unlocked).toBe(false);
  });

  it("allows Shoulder Saver on consecutive retention days without requiring score streak eligibility", () => {
    const achievements = computeAchievements([
      createSummary({
        dayKey: "2026-04-08",
        score: 60,
        streakEligible: false,
        issueMs: { "forward-head": 1, "torso-lean": 1, "shoulder-tilt": 1 },
      }),
      createSummary({
        dayKey: "2026-04-09",
        score: 62,
        streakEligible: false,
        issueMs: { "forward-head": 1, "torso-lean": 1, "shoulder-tilt": 1 },
      }),
      createSummary({
        dayKey: "2026-04-10",
        score: 64,
        streakEligible: false,
        issueMs: { "forward-head": 1, "torso-lean": 1, "shoulder-tilt": 1 },
      }),
    ]);

    expect(achievements.find((item) => item.id === "shoulder-saver")?.unlocked).toBe(true);
  });

  it("derives identity specialty from the fastest-improving issue area", () => {
    const identity = computeIdentity([
      createSummary({
        dayKey: "2026-04-07",
        issueMs: { "forward-head": 20 * 60 * 1000, "torso-lean": 8 * 60 * 1000, "shoulder-tilt": 8 * 60 * 1000 },
      }),
      createSummary({
        dayKey: "2026-04-08",
        issueMs: { "forward-head": 18 * 60 * 1000, "torso-lean": 8 * 60 * 1000, "shoulder-tilt": 8 * 60 * 1000 },
      }),
      createSummary({
        dayKey: "2026-04-09",
        issueMs: { "forward-head": 4 * 60 * 1000, "torso-lean": 7 * 60 * 1000, "shoulder-tilt": 7 * 60 * 1000 },
      }),
      createSummary({
        dayKey: "2026-04-10",
        issueMs: { "forward-head": 3 * 60 * 1000, "torso-lean": 7 * 60 * 1000, "shoulder-tilt": 7 * 60 * 1000 },
      }),
    ]);

    expect(identity.specialty).toBe("Fast neck alignment recovery");
  });
});
