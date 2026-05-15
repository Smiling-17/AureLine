import { describe, expect, it } from "vitest";
import { buildTaskInference, createTaskInferenceState, updateTaskInferenceState, type TaskWindowSample } from "@/runtime/task-inference";
import type { ContextFeatures, LandmarkSample } from "@/runtime/types";

const landmark = (x: number, y: number) => ({ x, y, z: 0, visibility: 0.95 });

function createLandmarks(overrides: Partial<LandmarkSample> = {}): LandmarkSample {
  return {
    nose: landmark(0.5, 0.2),
    leftEar: landmark(0.42, 0.22),
    rightEar: landmark(0.58, 0.22),
    leftEye: landmark(0.45, 0.18),
    rightEye: landmark(0.55, 0.18),
    leftShoulder: landmark(0.42, 0.42),
    rightShoulder: landmark(0.58, 0.42),
    leftHip: landmark(0.44, 0.72),
    rightHip: landmark(0.56, 0.72),
    leftElbow: landmark(0.4, 0.55),
    rightElbow: landmark(0.6, 0.55),
    leftWrist: landmark(0.38, 0.72),
    rightWrist: landmark(0.62, 0.72),
    leftIndex: landmark(0.37, 0.75),
    rightIndex: landmark(0.63, 0.75),
    ...overrides,
  };
}

function createFeatures(overrides: Partial<ContextFeatures> = {}): ContextFeatures {
  return {
    gazeDown: 0.8,
    deskWork: 0.85,
    handheldDeviceProxy: 0.05,
    bilateralHandActivity: 0,
    dominantFineMotorHand: "none",
    handElevation: 0.05,
    torsoConfidence: 0.95,
    handConfidence: 0.9,
    occludedHands: false,
    occludedTorso: false,
    ...overrides,
  };
}

function stepState(samples: TaskWindowSample[]) {
  let state = createTaskInferenceState();
  for (const sample of samples) {
    state = updateTaskInferenceState(state, samples.filter((item) => item.timestamp <= sample.timestamp), sample.timestamp);
  }
  return buildTaskInference(state);
}

describe("task inference", () => {
  it("detects handwriting from desk work, gaze down, and one-hand fine motor activity", () => {
    const samples: TaskWindowSample[] = [0, 1000, 2000, 3000].map((timestamp, index) => ({
      timestamp,
      observationMode: "holistic",
      contextFeatures: createFeatures(),
      landmarks: createLandmarks({
        leftWrist: landmark(0.38 + index * 0.02, 0.72),
        leftIndex: landmark(0.37 + index * 0.025, 0.75),
        rightWrist: landmark(0.62, 0.72),
        rightIndex: landmark(0.63, 0.75),
      }),
    }));

    const inference = stepState(samples);
    expect(inference.detectedTask).toBe("handwriting");
    expect(inference.confidence).toBeGreaterThanOrEqual(0.6);
  });

  it("limits pose fallback mode to reading, idle-focus, or unknown", () => {
    const samples: TaskWindowSample[] = [0, 1000, 2000, 3000].map((timestamp) => ({
      timestamp,
      observationMode: "pose-fallback",
      contextFeatures: createFeatures({
        gazeDown: 0.7,
        deskWork: 0.35,
        handConfidence: 0.1,
        occludedHands: true,
      }),
      landmarks: createLandmarks(),
    }));

    const inference = stepState(samples);
    expect(["reading", "idle-focus", "unknown"]).toContain(inference.detectedTask);
    expect(inference.detectedTask).not.toBe("typing");
    expect(inference.detectedTask).not.toBe("handwriting");
    expect(inference.detectedTask).not.toBe("phone-tablet");
  });
});
