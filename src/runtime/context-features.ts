import { clamp } from "@/runtime/logic";
import type { ContextFeatures, LandmarkSample, ObservationConfidence } from "@/runtime/types";

export const EMPTY_CONTEXT_FEATURES: ContextFeatures = {
  gazeDown: 0,
  deskWork: 0,
  handheldDeviceProxy: 0,
  bilateralHandActivity: 0,
  dominantFineMotorHand: "none",
  handElevation: 0,
  torsoConfidence: 0,
  handConfidence: 0,
  occludedHands: true,
  occludedTorso: true,
};

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function horizontalDistance(
  first: LandmarkSample[keyof LandmarkSample] | null | undefined,
  second: LandmarkSample[keyof LandmarkSample] | null | undefined,
) {
  if (!first || !second) return null;
  return Math.abs(first.x - second.x);
}

function verticalDistance(
  first: LandmarkSample[keyof LandmarkSample] | null | undefined,
  second: LandmarkSample[keyof LandmarkSample] | null | undefined,
) {
  if (!first || !second) return null;
  return Math.abs(first.y - second.y);
}

function midpoint(
  first: LandmarkSample[keyof LandmarkSample] | null | undefined,
  second: LandmarkSample[keyof LandmarkSample] | null | undefined,
) {
  if (!first || !second) return null;

  return {
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2,
  };
}

export function buildContextFeatures(
  landmarks: LandmarkSample,
  subsystemConfidence: ObservationConfidence,
): ContextFeatures {
  const eyeMid = midpoint(landmarks.leftEye, landmarks.rightEye);
  const shoulderMid = midpoint(landmarks.leftShoulder, landmarks.rightShoulder);
  const wristMid = midpoint(landmarks.leftWrist ?? null, landmarks.rightWrist ?? null);
  const shoulderWidth = horizontalDistance(landmarks.leftShoulder, landmarks.rightShoulder) ?? 0.001;
  const wristWidth = horizontalDistance(landmarks.leftWrist ?? null, landmarks.rightWrist ?? null) ?? shoulderWidth;
  const noseToEyes = landmarks.nose && eyeMid ? landmarks.nose.y - eyeMid.y : 0;
  const wristBelowShoulders = wristMid && shoulderMid ? wristMid.y - shoulderMid.y : 0;
  const wristsNearCenter = wristMid && shoulderMid ? 1 - clamp(Math.abs(wristMid.x - shoulderMid.x) / 0.18, 0, 1) : 0;
  const leftDeskDepth = landmarks.leftWrist && landmarks.leftShoulder
    ? clamp((landmarks.leftWrist.y - landmarks.leftShoulder.y - 0.08) / 0.28, 0, 1)
    : 0;
  const rightDeskDepth = landmarks.rightWrist && landmarks.rightShoulder
    ? clamp((landmarks.rightWrist.y - landmarks.rightShoulder.y - 0.08) / 0.28, 0, 1)
    : 0;
  const handElevation = shoulderMid && wristMid
    ? clamp((shoulderMid.y - wristMid.y + 0.02) / 0.18, 0, 1)
    : 0;
  const deskWork = clamp(average([leftDeskDepth, rightDeskDepth]), 0, 1);
  const gazeDown = clamp((noseToEyes - 0.008) / 0.04, 0, 1);
  const handheldDeviceProxy = clamp(
    handElevation * 0.5 +
      wristsNearCenter * 0.25 +
      gazeDown * 0.25 +
      (wristWidth < shoulderWidth * 0.75 ? 0.1 : 0),
    0,
    1,
  );

  return {
    gazeDown,
    deskWork,
    handheldDeviceProxy,
    bilateralHandActivity: 0,
    dominantFineMotorHand: "none",
    handElevation,
    torsoConfidence: clamp(subsystemConfidence.torso, 0, 1),
    handConfidence: clamp(subsystemConfidence.hands, 0, 1),
    occludedHands: subsystemConfidence.hands < 0.45,
    occludedTorso: subsystemConfidence.torso < 0.45,
  };
}

export function mergeContextFeatures(
  base: ContextFeatures,
  updates: Partial<ContextFeatures>,
): ContextFeatures {
  return {
    ...base,
    ...updates,
  };
}

export function averageContextFeatures(items: Array<ContextFeatures | undefined>): ContextFeatures {
  const presentItems = items.filter((item): item is ContextFeatures => Boolean(item));
  if (!presentItems.length) {
    return EMPTY_CONTEXT_FEATURES;
  }

  const dominant = presentItems.reduce<Record<ContextFeatures["dominantFineMotorHand"], number>>(
    (accumulator, item) => {
      accumulator[item.dominantFineMotorHand] += 1;
      return accumulator;
    },
    { left: 0, right: 0, both: 0, none: 0 },
  );

  return {
    gazeDown: average(presentItems.map((item) => item.gazeDown)),
    deskWork: average(presentItems.map((item) => item.deskWork)),
    handheldDeviceProxy: average(presentItems.map((item) => item.handheldDeviceProxy)),
    bilateralHandActivity: average(presentItems.map((item) => item.bilateralHandActivity)),
    dominantFineMotorHand: (Object.entries(dominant).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "none") as ContextFeatures["dominantFineMotorHand"],
    handElevation: average(presentItems.map((item) => item.handElevation)),
    torsoConfidence: average(presentItems.map((item) => item.torsoConfidence)),
    handConfidence: average(presentItems.map((item) => item.handConfidence)),
    occludedHands: presentItems.every((item) => item.occludedHands),
    occludedTorso: presentItems.every((item) => item.occludedTorso),
  };
}
