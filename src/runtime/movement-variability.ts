import { clamp } from "@/runtime/logic";
import type { LandmarkSample, LiveMetrics } from "@/runtime/types";

const STATIC_WINDOW_MS = 45_000;
const POSE_CHANGE_WINDOW_MS = 8_000;

export interface VariabilitySample {
  timestamp: number;
  metrics: LiveMetrics;
  landmarks: LandmarkSample;
  rawLoad: number;
}

export interface VariabilitySnapshot {
  staticHold: boolean;
  staticHoldSeconds: number;
  meanWristMotion: number;
  poseChangeMagnitude: number;
  healthyVariability: boolean;
  chaoticMovement: boolean;
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function pointDistance(
  first: LandmarkSample[keyof LandmarkSample] | null | undefined,
  second: LandmarkSample[keyof LandmarkSample] | null | undefined,
) {
  if (!first || !second) return 0;
  const dx = first.x - second.x;
  const dy = first.y - second.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function meanSequentialMotion(
  samples: VariabilitySample[],
  selector: (sample: VariabilitySample) => LandmarkSample[keyof LandmarkSample] | null | undefined,
) {
  const motions: number[] = [];
  for (let index = 1; index < samples.length; index += 1) {
    motions.push(pointDistance(selector(samples[index - 1]), selector(samples[index])));
  }
  return average(motions);
}

export function evaluateMovementVariability(
  samples: VariabilitySample[],
  timestamp: number,
): VariabilitySnapshot {
  const relevantSamples = samples.filter((sample) => timestamp - sample.timestamp <= STATIC_WINDOW_MS);
  const previousSample = [...relevantSamples]
    .reverse()
    .find((sample) => timestamp - sample.timestamp >= POSE_CHANGE_WINDOW_MS) ?? relevantSamples[0] ?? null;
  const currentSample = relevantSamples.at(-1) ?? null;
  const meanWristMotion = average([
    meanSequentialMotion(relevantSamples, (sample) => sample.landmarks.leftWrist ?? null),
    meanSequentialMotion(relevantSamples, (sample) => sample.landmarks.rightWrist ?? null),
  ]);
  const loadSpan = relevantSamples.length
    ? Math.max(...relevantSamples.map((sample) => sample.rawLoad)) - Math.min(...relevantSamples.map((sample) => sample.rawLoad))
    : 1;
  // Window span: the caller already prunes samples older than STATIC_WINDOW_MS
  // before passing them in, so the oldest sample is always < STATIC_WINDOW_MS old.
  // Checking >= STATIC_WINDOW_MS would never be true; use 85 % of the window as
  // the "full enough" threshold instead.
  const windowSpanMs = relevantSamples.length > 1
    ? (relevantSamples.at(-1)!.timestamp - relevantSamples[0].timestamp)
    : 0;
  const staticHold = relevantSamples.length > 1 &&
    windowSpanMs >= STATIC_WINDOW_MS * 0.85 &&
    loadSpan <= 0.18 &&
    meanWristMotion <= 0.015 &&
    average(relevantSamples.map((sample) => sample.rawLoad)) >= 0.3;
  const poseChangeMagnitude = previousSample && currentSample
    ? clamp(
        average([
          Math.abs(currentSample.metrics.headForward - previousSample.metrics.headForward) / 0.07,
          Math.abs(currentSample.metrics.torsoLean - previousSample.metrics.torsoLean) / 14,
          Math.abs(currentSample.metrics.shoulderTilt - previousSample.metrics.shoulderTilt) / 12,
        ]),
        0,
        2,
      )
    : 0;
  const healthyVariability = poseChangeMagnitude >= 0.18 && poseChangeMagnitude <= 0.95 && meanWristMotion <= 0.08;
  const chaoticMovement = poseChangeMagnitude > 1.25 || meanWristMotion > 0.12;

  return {
    staticHold,
    staticHoldSeconds: staticHold ? windowSpanMs / 1000 : 0,
    meanWristMotion,
    poseChangeMagnitude,
    healthyVariability,
    chaoticMovement,
  };
}
