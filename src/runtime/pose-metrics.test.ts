import { describe, expect, it } from "vitest";
import { computeFrameMetrics, computeFrameMetricsWithReason } from "@/runtime/pose-metrics";
import type { Landmark, NormalizedLandmark } from "@mediapipe/tasks-vision";

function landmark(overrides: Partial<Landmark> = {}): Landmark {
  return {
    x: overrides.x ?? 0,
    y: overrides.y ?? 0,
    z: overrides.z ?? 0,
    visibility: overrides.visibility ?? 0.95,
  };
}

function createPose() {
  const world = Array.from({ length: 33 }, () => landmark());
  const normalized = Array.from({ length: 33 }, () => landmark()) as NormalizedLandmark[];

  world[0] = landmark({ z: 0.05 });
  // ±0.0315 m gives a 3-D interocular distance of 6.3 cm — the population average.
  world[2] = landmark({ x: -0.0315, z: 0.08 });
  world[5] = landmark({ x: 0.0315, z: 0.08 });
  world[7] = landmark({ x: -0.05, z: 0.1 });
  world[8] = landmark({ x: 0.05, z: 0.1 });
  world[11] = landmark({ x: -0.2, y: 0, z: 0.2 });
  world[12] = landmark({ x: 0.2, y: 0, z: 0.2 });
  world[23] = landmark({ x: -0.18, y: 0.5, z: 0.2 });
  world[24] = landmark({ x: 0.18, y: 0.5, z: 0.2 });

  normalized[0] = landmark({ x: 0.5, y: 0.2, z: 0 }) as NormalizedLandmark;
  normalized[2] = landmark({ x: 0.45, y: 0.2, z: 0 }) as NormalizedLandmark;
  normalized[5] = landmark({ x: 0.55, y: 0.2, z: 0 }) as NormalizedLandmark;
  normalized[7] = landmark({ x: 0.42, y: 0.22, z: 0 }) as NormalizedLandmark;
  normalized[8] = landmark({ x: 0.58, y: 0.22, z: 0 }) as NormalizedLandmark;
  normalized[11] = landmark({ x: 0.4, y: 0.4, z: 0 }) as NormalizedLandmark;
  normalized[12] = landmark({ x: 0.6, y: 0.5, z: 0 }) as NormalizedLandmark;
  normalized[23] = landmark({ x: 0.42, y: 0.75, z: 0 }) as NormalizedLandmark;
  normalized[24] = landmark({ x: 0.58, y: 0.75, z: 0 }) as NormalizedLandmark;

  return { world, normalized };
}

function createFaceLandmarks() {
  const face = Array.from({ length: 478 }, () => landmark({ x: 0.5, y: 0.25, z: 0 })) as NormalizedLandmark[];
  face[33] = landmark({ x: 0.44, y: 0.22, z: 0 }) as NormalizedLandmark;
  face[133] = landmark({ x: 0.48, y: 0.22, z: 0 }) as NormalizedLandmark;
  face[263] = landmark({ x: 0.56, y: 0.22, z: 0 }) as NormalizedLandmark;
  face[362] = landmark({ x: 0.52, y: 0.22, z: 0 }) as NormalizedLandmark;
  face[234] = landmark({ x: 0.38, y: 0.24, z: 0 }) as NormalizedLandmark;
  face[454] = landmark({ x: 0.62, y: 0.24, z: 0 }) as NormalizedLandmark;
  face[1] = landmark({ x: 0.5, y: 0.255, z: 0 }) as NormalizedLandmark;
  return face;
}

describe("pose metrics", () => {
  it("computes frame metrics from the required landmark subset", () => {
    const { world, normalized } = createPose();
    const result = computeFrameMetrics(world, normalized, 1000, 0.5);

    expect(result).not.toBeNull();
    expect(result?.metrics.headForward).toBeCloseTo(0.1);
    expect(result?.metrics.torsoLean).toBeCloseTo(0);
    expect(result?.metrics.shoulderTilt).toBeCloseTo(26.565, 3);
    expect(result?.metrics.screenDistanceRatio).toBeCloseTo(0.1);
    expect(result?.metricAvailability).toEqual({
      headForward: true,
      torsoLean: true,
      shoulderTilt: true,
    });
    expect(result?.cameraView).toBe("frontal");
  });

  it("marks shoulder tilt unavailable when a side camera projection collapses shoulder span", () => {
    const { world, normalized } = createPose();
    normalized[11] = landmark({ x: 0.51, y: 0.4, z: 0 }) as NormalizedLandmark;
    normalized[12] = landmark({ x: 0.53, y: 0.65, z: 0 }) as NormalizedLandmark;

    const result = computeFrameMetricsWithReason(world, normalized, 1000, 0.5, "relaxed");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.cameraView).toBe("side");
      expect(result.value.metrics.shoulderTilt).toBeGreaterThan(80);
      expect(result.value.metricAvailability).toEqual({
        headForward: true,
        torsoLean: true,
        shoulderTilt: false,
      });
    }
  });

  it("rejects frames when mandatory landmarks fall below confidence", () => {
    const { world, normalized } = createPose();
    world[0] = landmark({ visibility: 0.2 });

    expect(computeFrameMetrics(world, normalized, 1000, 0.5)).toBeNull();
    expect(computeFrameMetricsWithReason(world, normalized, 1000, 0.5)).toEqual({
      ok: false,
      reason: "low-confidence-face",
    });
  });

  it("falls back from ears to eyes for forward-head measurement", () => {
    const { world, normalized } = createPose();
    world[7] = landmark({ visibility: 0.2 });
    world[8] = landmark({ visibility: 0.2 });

    const result = computeFrameMetrics(world, normalized, 1000, 0.5);

    expect(result).not.toBeNull();
    expect(result?.metrics.headForward).toBeCloseTo(0.12);
  });

  it("rejects frames when neither the ear pair nor eye pair can measure head position", () => {
    const { world, normalized } = createPose();
    world[2] = landmark({ visibility: 0.2 });
    world[5] = landmark({ visibility: 0.2 });
    world[7] = landmark({ visibility: 0.2 });
    world[8] = landmark({ visibility: 0.2 });

    expect(computeFrameMetrics(world, normalized, 1000, 0.5)).toBeNull();
    expect(computeFrameMetricsWithReason(world, normalized, 1000, 0.5)).toEqual({
      ok: false,
      reason: "head-reference-missing",
    });
  });

  it("returns shoulder, hip, and face tracking lost reasons", () => {
    const shoulderPose = createPose();
    shoulderPose.normalized[11] = landmark({ visibility: 0.2 }) as NormalizedLandmark;
    expect(computeFrameMetricsWithReason(shoulderPose.world, shoulderPose.normalized, 1000, 0.5)).toEqual({
      ok: false,
      reason: "low-confidence-shoulders",
    });

    const hipPose = createPose();
    hipPose.world[23] = landmark({ visibility: 0.2 });
    expect(computeFrameMetricsWithReason(hipPose.world, hipPose.normalized, 1000, 0.5)).toEqual({
      ok: false,
      reason: "low-confidence-hips",
    });

    const facePose = createPose();
    facePose.normalized[2] = landmark({ visibility: 0.2 }) as NormalizedLandmark;
    expect(computeFrameMetricsWithReason(facePose.world, facePose.normalized, 1000, 0.5)).toEqual({
      ok: false,
      reason: "low-confidence-face",
    });
  });

  it("keeps relaxed frames valid without hips and marks torso as unavailable", () => {
    const { world, normalized } = createPose();
    world[23] = landmark({ visibility: 0.2 });
    world[24] = landmark({ visibility: 0.2 });
    normalized[23] = landmark({ visibility: 0.2 }) as NormalizedLandmark;
    normalized[24] = landmark({ visibility: 0.2 }) as NormalizedLandmark;

    expect(computeFrameMetricsWithReason(world, normalized, 1000, 0.5, "strict")).toEqual({
      ok: false,
      reason: "low-confidence-hips",
    });
    expect(computeFrameMetricsWithReason(world, normalized, 1000, 0.5, "strict", { observationMode: "holistic" })).toEqual({
      ok: false,
      reason: "low-confidence-hips",
    });

    const relaxed = computeFrameMetricsWithReason(world, normalized, 1000, 0.5, "relaxed");

    expect(relaxed.ok).toBe(true);
    if (relaxed.ok) {
      expect(relaxed.value.metrics.torsoLean).toBe(0);
      expect(relaxed.value.metricAvailability).toEqual({
        headForward: true,
        torsoLean: false,
        shoulderTilt: true,
      });
    }
  });

  it("rounds and limits stored landmark samples to the posture metric subset", () => {
    const { world, normalized } = createPose();
    normalized[0] = landmark({ x: 0.123456, y: 0.654321, z: 0.987654, visibility: 0.876543 }) as NormalizedLandmark;

    const result = computeFrameMetricsWithReason(world, normalized, 1000, 0.5, "relaxed");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.landmarks.nose).toMatchObject({
        x: 0.123,
        y: 0.654,
        z: 0.988,
        visibility: 0.877,
      });
      expect("leftKnee" in result.value.landmarks).toBe(false);
      expect("rightKnee" in result.value.landmarks).toBe(false);
    }
  });

  it("derives a distance estimate from face landmarks when holistic face mesh is available", () => {
    const { world, normalized } = createPose();
    const result = computeFrameMetricsWithReason(world, normalized, 1000, 0.5, "relaxed", {
      faceLandmarks: createFaceLandmarks(),
      observationMode: "holistic",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.metrics.screenDistanceRatio).toBeCloseTo(0.08, 3);
      expect(result.value.distanceEstimate).toMatchObject({
        source: "face-mesh",
      });
      expect(result.value.distanceEstimate?.centimeters).toBeGreaterThan(45);
      expect(result.value.distanceEstimate?.centimeters).toBeLessThan(70);
      expect(result.value.distanceEstimate?.confidence).toBeGreaterThan(0.6);
    }
  });
});
