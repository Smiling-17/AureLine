import { describe, expect, it } from "vitest";
import {
  deriveWearableCompanionState,
  getShoulderTiltHapticZones,
  mapIssueToHapticZones,
  shouldShowCorrectionFlash,
  shouldShowTensionAssist,
} from "@/components/wearable/wearable-scene";
import type { LandmarkSample, RuntimeCue } from "@/runtime/types";

function landmarks(leftY: number, rightY: number): LandmarkSample {
  const point = (y: number) => ({ x: 0.5, y, z: 0, visibility: 0.95 });
  return {
    nose: null,
    leftEar: null,
    rightEar: null,
    leftEye: null,
    rightEye: null,
    leftShoulder: point(leftY),
    rightShoulder: point(rightY),
    leftHip: null,
    rightHip: null,
  };
}

describe("wearable scene mapping", () => {
  it("maps forward head only to the center-back haptic zone", () => {
    expect(mapIssueToHapticZones("forward-head", null)).toEqual(["center-back"]);
  });

  it("maps shoulder tilt to the higher left shoulder when landmarks show left is raised", () => {
    expect(getShoulderTiltHapticZones(landmarks(0.32, 0.38))).toEqual(["left-shoulder"]);
  });

  it("maps shoulder tilt to the higher right shoulder when landmarks show right is raised", () => {
    expect(getShoulderTiltHapticZones(landmarks(0.4, 0.33))).toEqual(["right-shoulder"]);
  });

  it("activates both shoulders when the side cannot be resolved confidently", () => {
    expect(getShoulderTiltHapticZones(landmarks(0.35, 0.36))).toEqual([
      "left-shoulder",
      "right-shoulder",
    ]);
    expect(getShoulderTiltHapticZones(null)).toEqual(["left-shoulder", "right-shoulder"]);
  });

  it("derives correction flash from reward cues", () => {
    const cue: RuntimeCue = {
      level: 1,
      issue: "forward-head",
      title: "Nice correction!",
      detail: "Good correction",
      createdAt: 1,
      kind: "reward",
    };

    expect(shouldShowCorrectionFlash(cue)).toBe(true);
    expect(shouldShowCorrectionFlash(null)).toBe(false);
  });

  it("derives tension assist from static hold and high exposure states", () => {
    expect(
      shouldShowTensionAssist({
        currentIssue: null,
        exposureLevel: "low",
        staticHoldSeconds: 16,
        loadSource: null,
      }),
    ).toBe(true);
    expect(
      shouldShowTensionAssist({
        currentIssue: null,
        exposureLevel: "critical",
        staticHoldSeconds: 0,
        loadSource: null,
      }),
    ).toBe(true);
  });

  it("combines runtime signals for the dashboard companion scene", () => {
    const state = deriveWearableCompanionState({
      postureState: "warning",
      currentIssue: "shoulder-tilt",
      currentCue: null,
      cameraMode: "on",
      monitoringStatus: "tracking",
      exposureLevel: "moderate",
      staticHoldSeconds: 0,
      loadSource: "deviation",
      liveLandmarks: landmarks(0.31, 0.39),
    });

    expect(state.activeHapticZones).toEqual(["left-shoulder"]);
    expect(state.activeProductZones).toEqual(["shoulder-straps"]);
    expect(state.correctionFlash).toBe(false);
    expect(state.tensionAssist).toBe(false);
  });
});
