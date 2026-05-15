import type { Landmark, NormalizedLandmark } from "@mediapipe/tasks-vision";
import { buildContextFeatures } from "@/runtime/context-features";
import type {
  CameraView,
  DistanceEstimate,
  FrameObservation,
  FrameMetricsResult,
  LandmarkPolicy,
  LandmarkSample,
  MetricAvailability,
  ObservationMode,
  ObservationConfidence,
  StoredLandmark,
  TrackingLostReason,
  TrackingReliability,
} from "@/runtime/types";

export type FrameMetricsComputation =
  | { ok: true; value: FrameMetricsResult }
  | { ok: false; reason: TrackingLostReason };

const MEASURED_HEAD_AND_SHOULDERS: MetricAvailability = {
  headForward: true,
  torsoLean: false,
  shoulderTilt: true,
};

const ASSUMED_HORIZONTAL_FOV_RADIANS = (60 * Math.PI) / 180;
export const NORMALIZED_FOCAL_LENGTH = 0.5 / Math.tan(ASSUMED_HORIZONTAL_FOV_RADIANS / 2);
export const ASSUMED_INTEROCULAR_DISTANCE_CM = 6.3;
const ASSUMED_FACE_WIDTH_CM = 14;

const FACE_LEFT_OUTER_EYE = 33;
const FACE_LEFT_INNER_EYE = 133;
const FACE_RIGHT_INNER_EYE = 362;
const FACE_RIGHT_OUTER_EYE = 263;
const FACE_LEFT_CHEEK = 234;
const FACE_RIGHT_CHEEK = 454;
const FACE_NOSE_TIP = 1;

function toStoredLandmark(landmark?: NormalizedLandmark | Landmark | null): StoredLandmark | null {
  if (!landmark) return null;

  return {
    x: roundLandmarkValue(landmark.x),
    y: roundLandmarkValue(landmark.y),
    z: roundLandmarkValue(landmark.z),
    visibility: roundLandmarkValue(landmark.visibility),
  };
}

function roundLandmarkValue(value: number) {
  return Math.round(value * 1000) / 1000;
}

function midpoint(first: Landmark, second: Landmark) {
  return {
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2,
    z: (first.z + second.z) / 2,
    visibility: Math.min(first.visibility, second.visibility),
  };
}

function midpoint2d(
  first: Landmark | NormalizedLandmark | undefined,
  second: Landmark | NormalizedLandmark | undefined,
) {
  if (!first || !second) return null;

  return {
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2,
    z: (first.z + second.z) / 2,
    visibility: Math.min(first.visibility ?? 1, second.visibility ?? 1),
  };
}

function hasConfidence(visibilityThreshold: number, ...landmarks: Array<Landmark | NormalizedLandmark | undefined>) {
  return landmarks.every((landmark) => landmark && landmark.visibility >= visibilityThreshold);
}

function averageConfidence(landmarks: Array<Landmark | NormalizedLandmark | undefined>, fallback = 0) {
  const present = landmarks.filter((landmark): landmark is Landmark | NormalizedLandmark => Boolean(landmark));
  if (!present.length) return fallback;
  return present.reduce((sum, landmark) => sum + (landmark.visibility ?? fallback), 0) / present.length;
}

function radiansToDegrees(radians: number) {
  return (radians * 180) / Math.PI;
}

function normalizedDistance(
  first: Landmark | NormalizedLandmark | null | undefined,
  second: Landmark | NormalizedLandmark | null | undefined,
) {
  if (!first || !second) return 0;
  const dx = first.x - second.x;
  const dy = first.y - second.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function estimateDistanceFromSpan(spanRatio: number, realWorldWidthCm: number) {
  if (spanRatio <= 0) return null;
  return (NORMALIZED_FOCAL_LENGTH * realWorldWidthCm) / spanRatio;
}

function getFaceLandmark(faceLandmarks: NormalizedLandmark[] | undefined, index: number) {
  return faceLandmarks && faceLandmarks.length > index ? faceLandmarks[index] : undefined;
}

function clampUnit(value: number) {
  return Math.min(1, Math.max(0, value));
}

// Returns the 3D interocular distance in centimetres measured from world landmarks.
// World landmarks are in metres (MediaPipe pose world space), so multiply by 100.
// Returns null when the result falls outside a plausible human range (4–10 cm).
function computeWorld3DInterocularCm(
  worldLeftEye: { x: number; y: number; z: number } | undefined,
  worldRightEye: { x: number; y: number; z: number } | undefined,
): number | null {
  if (!worldLeftEye || !worldRightEye) return null;
  const dx = worldLeftEye.x - worldRightEye.x;
  const dy = worldLeftEye.y - worldRightEye.y;
  const dz = worldLeftEye.z - worldRightEye.z;
  const distCm = Math.sqrt(dx * dx + dy * dy + dz * dz) * 100;
  return distCm >= 4 && distCm <= 10 ? distCm : null;
}

// Estimates cos(yaw) from how symmetrically the nose sits between the two cheeks.
// Returns 1 when the face is fully frontal, approaching 0 when nearly sideways.
// Uses Face Mesh landmarks: noseTip (1), leftCheek (234), rightCheek (454).
function computeYawCosine(
  noseTip: NormalizedLandmark | null | undefined,
  leftCheek: NormalizedLandmark | null | undefined,
  rightCheek: NormalizedLandmark | null | undefined,
): number {
  if (!noseTip || !leftCheek || !rightCheek) return 1;
  const dLeft = normalizedDistance(noseTip, leftCheek);
  const dRight = normalizedDistance(noseTip, rightCheek);
  const total = dLeft + dRight;
  if (total < 0.001) return 1;
  // When frontal: dLeft ≈ dRight → ratio ≈ 1.
  // When turned: the shorter side collapses toward 0.
  return clampUnit((2 * Math.min(dLeft, dRight)) / total);
}

function inferCameraView(input: {
  yawCosine: number;
  leftShoulder: Landmark | NormalizedLandmark;
  rightShoulder: Landmark | NormalizedLandmark;
  leftHip?: Landmark | NormalizedLandmark;
  rightHip?: Landmark | NormalizedLandmark;
  hasReliableHips: boolean;
}): CameraView {
  const shoulderSpan = Math.abs(input.leftShoulder.x - input.rightShoulder.x);
  const shoulderDrop = Math.abs(input.leftShoulder.y - input.rightShoulder.y);
  const shoulderMid = midpoint2d(input.leftShoulder, input.rightShoulder) ?? {
    x: (input.leftShoulder.x + input.rightShoulder.x) / 2,
    y: (input.leftShoulder.y + input.rightShoulder.y) / 2,
    z: (input.leftShoulder.z + input.rightShoulder.z) / 2,
    visibility: Math.min(input.leftShoulder.visibility ?? 1, input.rightShoulder.visibility ?? 1),
  };
  const hipMid = input.hasReliableHips && input.leftHip && input.rightHip
    ? midpoint2d(input.leftHip, input.rightHip)
    : null;
  const torsoHeight = hipMid ? Math.abs(hipMid.y - shoulderMid.y) : 0;
  const shoulderSpanRatio = torsoHeight > 0.08 ? shoulderSpan / torsoHeight : shoulderSpan / 0.3;

  if (input.yawCosine < 0.58) return "side";
  if (shoulderSpanRatio < 0.32 && shoulderDrop > 0.045) return "side";
  if (input.yawCosine >= 0.76 && shoulderSpanRatio >= 0.36) return "frontal";
  if (input.yawCosine >= 0.88 && shoulderSpan >= 0.12) return "frontal";
  return "unknown";
}

// Estimates the camera-to-face distance using pinhole projection.
// world3DInterocularCm: person-specific interocular distance measured from world landmarks
//   during the current frame. Falls back to the population average when unavailable.
// The returned object also carries world3DInterocularCm so the calibration accumulator
// can collect per-person measurements across calibration frames.
function estimateScreenDistance(
  poseLeftEye: NormalizedLandmark,
  poseRightEye: NormalizedLandmark,
  world3DInterocularCm: number | null,
  faceLandmarks?: NormalizedLandmark[],
): DistanceEstimate | null {
  const interocularCm = world3DInterocularCm ?? ASSUMED_INTEROCULAR_DISTANCE_CM;
  const poseEyeSpan = normalizedDistance(poseLeftEye, poseRightEye);
  const poseFallbackDistance = estimateDistanceFromSpan(poseEyeSpan, interocularCm);

  if (!faceLandmarks?.length) {
    if (!poseFallbackDistance) return null;
    return {
      centimeters: poseFallbackDistance,
      confidence: 0.42,
      source: "pose-eye-fallback",
      world3DInterocularCm,
    };
  }

  const leftEyeCenter = midpoint2d(
    getFaceLandmark(faceLandmarks, FACE_LEFT_OUTER_EYE),
    getFaceLandmark(faceLandmarks, FACE_LEFT_INNER_EYE),
  );
  const rightEyeCenter = midpoint2d(
    getFaceLandmark(faceLandmarks, FACE_RIGHT_OUTER_EYE),
    getFaceLandmark(faceLandmarks, FACE_RIGHT_INNER_EYE),
  );
  const noseTip = getFaceLandmark(faceLandmarks, FACE_NOSE_TIP);
  const leftCheek = getFaceLandmark(faceLandmarks, FACE_LEFT_CHEEK);
  const rightCheek = getFaceLandmark(faceLandmarks, FACE_RIGHT_CHEEK);

  const faceEyeSpan = normalizedDistance(leftEyeCenter, rightEyeCenter);
  const faceWidthSpan = normalizedDistance(leftCheek, rightCheek);
  // Use person-calibrated interocular distance for the eye-span estimate.
  const eyeDistanceCm = estimateDistanceFromSpan(faceEyeSpan, interocularCm);
  // Face width still uses the population average (no per-person world measurement available).
  const faceDistanceCm = estimateDistanceFromSpan(faceWidthSpan, ASSUMED_FACE_WIDTH_CM);

  const verticalEyeAlignment = leftEyeCenter && rightEyeCenter
    ? 1 - clampUnit(Math.abs(leftEyeCenter.y - rightEyeCenter.y) / 0.04)
    : 0;
  const noseSymmetry = noseTip && leftCheek && rightCheek && faceWidthSpan > 0
    ? 1 - clampUnit(Math.abs(normalizedDistance(noseTip, leftCheek) - normalizedDistance(noseTip, rightCheek)) / (faceWidthSpan * 0.3))
    : 0.4;
  const frontalConfidence = clampUnit(verticalEyeAlignment * 0.55 + noseSymmetry * 0.45);
  const faceVisibility = averageConfidence(
    [
      leftEyeCenter ?? undefined,
      rightEyeCenter ?? undefined,
      leftCheek,
      rightCheek,
      noseTip,
    ],
    0.85,
  );
  // Boost confidence when we have a person-calibrated interocular measurement.
  const calibrationBoost = world3DInterocularCm !== null ? 0.08 : 0;

  if (eyeDistanceCm && faceDistanceCm) {
    return {
      centimeters: eyeDistanceCm * 0.65 + faceDistanceCm * 0.35,
      confidence: clampUnit(0.5 + frontalConfidence * 0.25 + faceVisibility * 0.2 + calibrationBoost),
      source: "face-mesh",
      world3DInterocularCm,
    };
  }

  if (eyeDistanceCm) {
    return {
      centimeters: eyeDistanceCm,
      confidence: clampUnit(0.45 + frontalConfidence * 0.2 + faceVisibility * 0.2 + calibrationBoost),
      source: "face-mesh",
      world3DInterocularCm,
    };
  }

  if (faceDistanceCm) {
    return {
      centimeters: faceDistanceCm,
      // Base lifted to 0.42 to match the pose-eye-fallback floor — face-width-only
      // is no worse than pose-landmark-only as an initial estimate.
      confidence: clampUnit(0.42 + frontalConfidence * 0.2 + faceVisibility * 0.2 + calibrationBoost),
      source: "face-mesh",
      world3DInterocularCm,
    };
  }

  if (!poseFallbackDistance) return null;

  return {
    centimeters: poseFallbackDistance,
    confidence: 0.42,
    source: "pose-eye-fallback",
    world3DInterocularCm,
  };
}

function buildLandmarkSample(
  normalized: NormalizedLandmark[],
  leftHandLandmarks?: NormalizedLandmark[],
  rightHandLandmarks?: NormalizedLandmark[],
): LandmarkSample {
  return {
    nose: toStoredLandmark(normalized[0]),
    leftEye: toStoredLandmark(normalized[2]),
    rightEye: toStoredLandmark(normalized[5]),
    leftEar: toStoredLandmark(normalized[7]),
    rightEar: toStoredLandmark(normalized[8]),
    leftShoulder: toStoredLandmark(normalized[11]),
    rightShoulder: toStoredLandmark(normalized[12]),
    leftHip: toStoredLandmark(normalized[23]),
    rightHip: toStoredLandmark(normalized[24]),
    leftElbow: toStoredLandmark(normalized[13]),
    rightElbow: toStoredLandmark(normalized[14]),
    leftWrist: toStoredLandmark(leftHandLandmarks?.[0] ?? normalized[15]),
    rightWrist: toStoredLandmark(rightHandLandmarks?.[0] ?? normalized[16]),
    leftIndex: toStoredLandmark(leftHandLandmarks?.[8] ?? normalized[19]),
    rightIndex: toStoredLandmark(rightHandLandmarks?.[8] ?? normalized[20]),
  };
}

function deriveTrackingReliability(
  torsoConfidence: number,
  handConfidence: number,
): TrackingReliability {
  if (torsoConfidence >= 0.8 && handConfidence >= 0.55) {
    return "full";
  }
  if (torsoConfidence >= 0.6 || handConfidence >= 0.35) {
    return "partial";
  }
  return "minimal";
}

export function computeFrameMetrics(
  worldLandmarks: Landmark[],
  normalizedLandmarks: NormalizedLandmark[],
  timestamp: number,
  visibilityThreshold: number,
  landmarkPolicy: LandmarkPolicy = "strict",
): FrameMetricsResult | null {
  const result = computeFrameMetricsWithReason(
    worldLandmarks,
    normalizedLandmarks,
    timestamp,
    visibilityThreshold,
    landmarkPolicy,
  );
  return result.ok ? result.value : null;
}

export function computeFrameMetricsWithReason(
  worldLandmarks: Landmark[],
  normalizedLandmarks: NormalizedLandmark[],
  timestamp: number,
  visibilityThreshold: number,
  landmarkPolicy: LandmarkPolicy = "strict",
  options: {
    leftHandLandmarks?: NormalizedLandmark[];
    rightHandLandmarks?: NormalizedLandmark[];
    faceLandmarks?: NormalizedLandmark[];
    observationMode?: ObservationMode;
  } = {},
): FrameMetricsComputation {
  const worldNose = worldLandmarks[0];
  const worldLeftEye = worldLandmarks[2];
  const worldRightEye = worldLandmarks[5];
  const worldLeftEar = worldLandmarks[7];
  const worldRightEar = worldLandmarks[8];
  const worldLeftShoulder = worldLandmarks[11];
  const worldRightShoulder = worldLandmarks[12];
  const worldLeftHip = worldLandmarks[23];
  const worldRightHip = worldLandmarks[24];

  const nose = normalizedLandmarks[0];
  const leftEye = normalizedLandmarks[2];
  const rightEye = normalizedLandmarks[5];
  const leftShoulder = normalizedLandmarks[11];
  const rightShoulder = normalizedLandmarks[12];
  const leftHip = normalizedLandmarks[23];
  const rightHip = normalizedLandmarks[24];
  const leftWrist = normalizedLandmarks[15];
  const rightWrist = normalizedLandmarks[16];
  const leftIndex = normalizedLandmarks[19];
  const rightIndex = normalizedLandmarks[20];

  if (!worldLandmarks.length || !normalizedLandmarks.length) {
    return { ok: false, reason: "no-pose" };
  }

  if (!hasConfidence(visibilityThreshold, worldLeftShoulder, worldRightShoulder, leftShoulder, rightShoulder)) {
    return { ok: false, reason: "low-confidence-shoulders" };
  }

  const hasReliableHips = hasConfidence(visibilityThreshold, worldLeftHip, worldRightHip, leftHip, rightHip);
  if (landmarkPolicy === "strict" && !hasReliableHips) {
    return { ok: false, reason: "low-confidence-hips" };
  }
  if (!hasConfidence(visibilityThreshold, worldNose, nose, leftEye, rightEye)) {
    return { ok: false, reason: "low-confidence-face" };
  }

  const shoulderMid = midpoint(worldLeftShoulder, worldRightShoulder);
  const headMid = hasConfidence(visibilityThreshold, worldLeftEar, worldRightEar)
    ? midpoint(worldLeftEar, worldRightEar)
    : hasConfidence(visibilityThreshold, worldLeftEye, worldRightEye)
      ? midpoint(worldLeftEye, worldRightEye)
      : null;

  if (!headMid) {
    return { ok: false, reason: "head-reference-missing" };
  }

  const headForward = shoulderMid.z - headMid.z;
  const baseMetricAvailability: MetricAvailability = hasReliableHips
    ? { headForward: true, torsoLean: true, shoulderTilt: true }
    : MEASURED_HEAD_AND_SHOULDERS;
  const torsoLean = hasReliableHips
    ? (() => {
        const hipMid = midpoint(worldLeftHip, worldRightHip);
        const torsoVectorY = shoulderMid.y - hipMid.y;
        const torsoVectorZ = shoulderMid.z - hipMid.z;
        return radiansToDegrees(Math.atan2(Math.abs(torsoVectorZ), Math.abs(torsoVectorY || 0.0001)));
      })()
    : 0;
  const shoulderTilt = radiansToDegrees(
    Math.atan2(Math.abs(leftShoulder.y - rightShoulder.y), Math.abs(leftShoulder.x - rightShoulder.x || 0.0001)),
  );
  const eyeDx = leftEye.x - rightEye.x;
  const eyeDy = leftEye.y - rightEye.y;
  const faceLeftEyeCenter = midpoint2d(
    getFaceLandmark(options.faceLandmarks, FACE_LEFT_OUTER_EYE),
    getFaceLandmark(options.faceLandmarks, FACE_LEFT_INNER_EYE),
  );
  const faceRightEyeCenter = midpoint2d(
    getFaceLandmark(options.faceLandmarks, FACE_RIGHT_OUTER_EYE),
    getFaceLandmark(options.faceLandmarks, FACE_RIGHT_INNER_EYE),
  );
  const faceMeshNoseTip = getFaceLandmark(options.faceLandmarks, FACE_NOSE_TIP);
  const faceMeshLeftCheek = getFaceLandmark(options.faceLandmarks, FACE_LEFT_CHEEK);
  const faceMeshRightCheek = getFaceLandmark(options.faceLandmarks, FACE_RIGHT_CHEEK);

  // Raw eye span in normalised image coordinates (0–1).
  const rawEyeSpan = normalizedDistance(faceLeftEyeCenter, faceRightEyeCenter) || Math.sqrt(eyeDx * eyeDx + eyeDy * eyeDy);

  // Yaw correction: when the head turns, the projected 2-D eye span shrinks even though
  // the real distance to screen is unchanged.  Dividing by cos(yaw) restores the
  // frontal-equivalent span, preventing false "too-far" alerts during normal head movement.
  // Correction is only applied when yaw is non-trivial (cosine < 0.85 ≈ 32°) and is
  // capped at cosine = 0.45 (≈ 63°) to avoid extreme amplification on near-profile views.
  const yawCosine = computeYawCosine(faceMeshNoseTip, faceMeshLeftCheek, faceMeshRightCheek);
  const cameraView = inferCameraView({
    yawCosine,
    leftShoulder,
    rightShoulder,
    leftHip,
    rightHip,
    hasReliableHips,
  });
  const metricAvailability: MetricAvailability = {
    ...baseMetricAvailability,
    shoulderTilt: baseMetricAvailability.shoulderTilt && cameraView === "frontal",
  };
  const screenDistanceRatio = yawCosine < 0.85
    ? rawEyeSpan / Math.max(yawCosine, 0.45)
    : rawEyeSpan;

  // Person-specific 3-D interocular distance from world landmarks (metres → cm).
  // Available on every valid pose frame; used downstream for calibration.
  const world3DInterocularCm = computeWorld3DInterocularCm(worldLeftEye, worldRightEye);
  const distanceEstimate = estimateScreenDistance(leftEye, rightEye, world3DInterocularCm, options.faceLandmarks);
  const subsystemConfidence: ObservationConfidence = {
    face: averageConfidence([worldNose, worldLeftEye, worldRightEye, worldLeftEar, worldRightEar, nose, leftEye, rightEye]),
    torso: averageConfidence([worldLeftShoulder, worldRightShoulder, worldLeftHip, worldRightHip, leftShoulder, rightShoulder, leftHip, rightHip], hasReliableHips ? 0.9 : 0.55),
    hands: averageConfidence(
      [
        ...(options.leftHandLandmarks ?? []),
        ...(options.rightHandLandmarks ?? []),
        leftWrist,
        rightWrist,
        leftIndex,
        rightIndex,
      ],
      0,
    ),
  };
  const landmarks = buildLandmarkSample(normalizedLandmarks, options.leftHandLandmarks, options.rightHandLandmarks);
  const observationMode = options.observationMode ?? "pose-fallback";
  const trackingReliability = deriveTrackingReliability(subsystemConfidence.torso, subsystemConfidence.hands);
  const contextFeatures = buildContextFeatures(landmarks, subsystemConfidence);

  return {
    ok: true,
    value: {
      timestamp,
      metrics: {
        headForward,
        torsoLean,
        shoulderTilt,
        screenDistanceRatio,
      },
      metricAvailability,
      landmarks,
      contextFeatures,
      subsystemConfidence,
      distanceEstimate,
      trackingReliability,
      observationMode,
      cameraView,
    },
  };
}
