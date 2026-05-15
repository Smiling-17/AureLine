import { describe, expect, it } from "vitest";
import { buildThresholds } from "@/runtime/logic";
import { createExposureEngineState, evaluateExposureFrame } from "@/runtime/exposure-engine";
import type { MetricAvailability, PostureBaseline } from "@/runtime/types";

const baseline: PostureBaseline = {
  headForward: 0.08,
  torsoLean: 3,
  shoulderTilt: 2,
  screenDistanceRatio: 0.12,
};

const availability: MetricAvailability = {
  headForward: true,
  torsoLean: true,
  shoulderTilt: true,
};

describe("exposure engine", () => {
  it("treats the same flexion as lower load for handwriting than typing", () => {
    const thresholds = buildThresholds(baseline, 72, availability);
    const state = createExposureEngineState();
    const metrics = {
      headForward: 0.14,
      torsoLean: 10,
      shoulderTilt: 3,
      screenDistanceRatio: 0.12,
    };

    const typing = evaluateExposureFrame(state, {
      timestamp: 1000,
      deltaMs: 1000,
      metrics,
      thresholds,
      metricAvailability: availability,
      taskState: "typing",
      trackingReliability: "full",
      variability: {
        staticHold: false,
        staticHoldSeconds: 0,
        meanWristMotion: 0.02,
        poseChangeMagnitude: 0.2,
        healthyVariability: true,
        chaoticMovement: false,
      },
    });
    const handwriting = evaluateExposureFrame(state, {
      timestamp: 1000,
      deltaMs: 1000,
      metrics,
      thresholds,
      metricAvailability: availability,
      taskState: "handwriting",
      trackingReliability: "full",
      variability: {
        staticHold: false,
        staticHoldSeconds: 0,
        meanWristMotion: 0.02,
        poseChangeMagnitude: 0.2,
        healthyVariability: true,
        chaoticMovement: false,
      },
    });

    expect(typing.snapshot.adjustedLoad).toBeGreaterThan(handwriting.snapshot.adjustedLoad);
    expect(handwriting.snapshot.instantLoadState).toBe("elevated");
    expect(handwriting.snapshot.instantPostureState).toBe("warning");
    expect(handwriting.snapshot.currentIssue).toBe("forward-head");
  });

  it("accumulates exposure from static hold even when task allowances make the pose mostly functional", () => {
    const thresholds = buildThresholds(baseline, 72, availability);
    const state = createExposureEngineState();
    const result = evaluateExposureFrame(state, {
      timestamp: 46_000,
      deltaMs: 46_000,
      metrics: {
        headForward: 0.125,
        torsoLean: 10,
        shoulderTilt: 3,
        screenDistanceRatio: 0.12,
      },
      thresholds,
      metricAvailability: availability,
      taskState: "handwriting",
      trackingReliability: "full",
      variability: {
        staticHold: true,
        staticHoldSeconds: 45,
        meanWristMotion: 0.005,
        poseChangeMagnitude: 0.05,
        healthyVariability: false,
        chaoticMovement: false,
      },
    });

    expect(result.snapshot.budget).toBeGreaterThan(0);
    expect(result.snapshot.loadSource).toMatch(/static-hold|compound/);
  });

  it("keeps severe live posture visible even when handwriting receives an ergonomic allowance", () => {
    const thresholds = buildThresholds(baseline, 72, availability);
    const result = evaluateExposureFrame(createExposureEngineState(), {
      timestamp: 1000,
      deltaMs: 1000,
      metrics: {
        headForward: 0.19,
        torsoLean: 18,
        shoulderTilt: 3,
        screenDistanceRatio: 0.12,
      },
      thresholds,
      metricAvailability: availability,
      taskState: "handwriting",
      trackingReliability: "full",
      variability: {
        staticHold: false,
        staticHoldSeconds: 0,
        meanWristMotion: 0.02,
        poseChangeMagnitude: 0.12,
        healthyVariability: true,
        chaoticMovement: false,
      },
    });

    expect(result.snapshot.exposureLevel).toBe("low");
    expect(result.snapshot.instantPostureState).toBe("bad");
    expect(result.snapshot.currentIssue).toBe("forward-head");
    expect(result.snapshot.rawIssue).toBe("forward-head");
  });

  it("treats screen-unknown as a softer screen task instead of the very-forgiving unknown profile", () => {
    const thresholds = buildThresholds(baseline, 72, availability);
    const metrics = {
      headForward: 0.16,
      torsoLean: 11,
      shoulderTilt: 4,
      screenDistanceRatio: 0.12,
    };

    const unknown = evaluateExposureFrame(createExposureEngineState(), {
      timestamp: 1000,
      deltaMs: 1000,
      metrics,
      thresholds,
      metricAvailability: availability,
      taskState: "unknown",
      trackingReliability: "partial",
      variability: {
        staticHold: false,
        staticHoldSeconds: 0,
        meanWristMotion: 0.01,
        poseChangeMagnitude: 0.1,
        healthyVariability: true,
        chaoticMovement: false,
      },
    });
    const screenUnknown = evaluateExposureFrame(createExposureEngineState(), {
      timestamp: 1000,
      deltaMs: 1000,
      metrics,
      thresholds,
      metricAvailability: availability,
      taskState: "screen-unknown",
      trackingReliability: "partial",
      variability: {
        staticHold: false,
        staticHoldSeconds: 0,
        meanWristMotion: 0.01,
        poseChangeMagnitude: 0.1,
        healthyVariability: true,
        chaoticMovement: false,
      },
    });

    expect(screenUnknown.snapshot.adjustedLoad).toBeGreaterThan(unknown.snapshot.adjustedLoad);
    expect(screenUnknown.snapshot.budget).toBeGreaterThan(unknown.snapshot.budget);
  });
});
