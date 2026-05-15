import { averageContextFeatures, mergeContextFeatures, EMPTY_CONTEXT_FEATURES } from "@/runtime/context-features";
import { clamp } from "@/runtime/logic";
import type {
  ContextFeatures,
  LandmarkSample,
  ObservationMode,
  TaskInference,
  TaskState,
} from "@/runtime/types";

const WINDOW_MS = 3000;
const HYSTERESIS_MS = 2000;
const MIN_CONFIDENCE = 0.6;
const MIN_MARGIN = 0.15;

export interface TaskWindowSample {
  timestamp: number;
  contextFeatures: ContextFeatures;
  landmarks: LandmarkSample;
  observationMode: ObservationMode;
}

export interface TaskInferenceState {
  detectedTask: TaskState;
  confidence: number;
  stabilizedAt: number;
  candidateTask: TaskState | null;
  candidateStartedAt: number | null;
  aggregatedFeatures: ContextFeatures;
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
  samples: TaskWindowSample[],
  selector: (sample: TaskWindowSample) => LandmarkSample[keyof LandmarkSample] | null | undefined,
) {
  const motions: number[] = [];
  for (let index = 1; index < samples.length; index += 1) {
    motions.push(pointDistance(selector(samples[index - 1]), selector(samples[index])));
  }
  return average(motions);
}

function deriveDynamicFeatures(samples: TaskWindowSample[]) {
  const observationMode = samples.at(-1)?.observationMode ?? "pose-fallback";
  const averageFeatures = averageContextFeatures(samples.map((sample) => sample.contextFeatures));
  const leftWristMotion = meanSequentialMotion(samples, (sample) => sample.landmarks.leftWrist ?? null);
  const rightWristMotion = meanSequentialMotion(samples, (sample) => sample.landmarks.rightWrist ?? null);
  const leftIndexMotion = meanSequentialMotion(samples, (sample) => sample.landmarks.leftIndex ?? null);
  const rightIndexMotion = meanSequentialMotion(samples, (sample) => sample.landmarks.rightIndex ?? null);
  const leftActivity = leftWristMotion * 0.6 + leftIndexMotion * 0.4;
  const rightActivity = rightWristMotion * 0.6 + rightIndexMotion * 0.4;
  const bilateralHandActivity = clamp((Math.min(leftActivity, rightActivity) / 0.012) * 0.6 + (Math.max(leftActivity, rightActivity) / 0.02) * 0.4, 0, 1);
  const dominantFineMotorHand = leftActivity > 0.012 && rightActivity > 0.012 && Math.abs(leftActivity - rightActivity) <= 0.004
    ? "both"
    : leftActivity > rightActivity && leftActivity > 0.01
      ? "left"
      : rightActivity > leftActivity && rightActivity > 0.01
        ? "right"
        : "none";

  return {
    observationMode,
    features: mergeContextFeatures(averageFeatures, {
      bilateralHandActivity,
      dominantFineMotorHand,
    }),
    leftActivity,
    rightActivity,
  };
}

function scoreTasks(
  features: ContextFeatures,
  observationMode: ObservationMode,
  leftActivity: number,
  rightActivity: number,
) {
  const bothHandsActive = clamp((Math.min(leftActivity, rightActivity) - 0.006) / 0.01, 0, 1);
  const oneHandDominant = clamp((Math.abs(leftActivity - rightActivity) - 0.004) / 0.01, 0, 1);
  const lowHandActivity = 1 - clamp(Math.max(leftActivity, rightActivity) / 0.012, 0, 1);
  const lowHandElevation = 1 - features.handElevation;
  const lowHandheld = 1 - features.handheldDeviceProxy;
  const lowGazeDown = 1 - features.gazeDown;
  const scores: Record<TaskState, number> = {
    typing: observationMode === "pose-fallback"
      ? 0
      : clamp(features.deskWork * 0.35 + bothHandsActive * 0.35 + lowHandElevation * 0.2 + lowHandheld * 0.1 - features.gazeDown * 0.08, 0, 1),
    handwriting: observationMode === "pose-fallback"
      ? 0
      : clamp(features.deskWork * 0.25 + features.gazeDown * 0.3 + oneHandDominant * 0.3 + lowHandElevation * 0.15, 0, 1),
    reading: clamp(features.gazeDown * 0.4 + features.deskWork * 0.2 + lowHandActivity * 0.25 + lowHandheld * 0.15, 0, 1),
    "phone-tablet": observationMode === "pose-fallback"
      ? 0
      : clamp(features.handheldDeviceProxy * 0.45 + features.handElevation * 0.25 + features.gazeDown * 0.2 + lowHandActivity * 0.1, 0, 1),
    "idle-focus": clamp(lowGazeDown * 0.35 + lowHandActivity * 0.35 + lowHandheld * 0.15 + lowHandElevation * 0.15, 0, 1),
    // Pose-fallback means no hand mesh: raise the base so unknown reliably wins
    // over reading/idle-focus by at least MIN_MARGIN (0.15) after those are capped.
    unknown: clamp(
      (observationMode === "pose-fallback" ? 0.5 : 0.3) +
        (1 - features.handConfidence) * 0.35 +
        (1 - features.torsoConfidence) * 0.2,
      0,
      1,
    ),
  };

  if (observationMode === "pose-fallback") {
    scores.typing = 0;
    scores.handwriting = 0;
    scores["phone-tablet"] = 0;
    // Cap the tasks that rely implicitly on hand absence to avoid them beating
    // unknown (min ~0.5) when hands simply aren't tracked.
    scores.reading = Math.min(scores.reading, 0.3);
    scores["idle-focus"] = Math.min(scores["idle-focus"], 0.3);
  }

  return scores;
}

export function createTaskInferenceState(timestamp = 0): TaskInferenceState {
  return {
    detectedTask: "unknown",
    confidence: 0,
    stabilizedAt: timestamp,
    candidateTask: null,
    candidateStartedAt: null,
    aggregatedFeatures: EMPTY_CONTEXT_FEATURES,
  };
}

export function updateTaskInferenceState(
  state: TaskInferenceState,
  samples: TaskWindowSample[],
  timestamp: number,
): TaskInferenceState {
  const window = samples.filter((sample) => timestamp - sample.timestamp <= WINDOW_MS);
  if (!window.length) {
    return {
      ...state,
      aggregatedFeatures: EMPTY_CONTEXT_FEATURES,
    };
  }

  const { observationMode, features, leftActivity, rightActivity } = deriveDynamicFeatures(window);
  const scores = scoreTasks(features, observationMode, leftActivity, rightActivity);
  const ranked = (Object.entries(scores) as Array<[TaskState, number]>).sort((a, b) => b[1] - a[1]);
  const [bestTask, bestScore] = ranked[0] ?? ["unknown", 0];
  const [, secondScore = 0] = ranked[1] ?? ["unknown", 0];
  const confidence = clamp(bestScore, 0, 1);
  const margin = bestScore - secondScore;

  if (bestTask === state.detectedTask) {
    return {
      ...state,
      confidence,
      aggregatedFeatures: features,
      candidateTask: null,
      candidateStartedAt: null,
    };
  }

  if (confidence < MIN_CONFIDENCE || margin < MIN_MARGIN) {
    return {
      ...state,
      confidence,
      aggregatedFeatures: features,
      candidateTask: null,
      candidateStartedAt: null,
    };
  }

  if (state.candidateTask !== bestTask) {
    return {
      ...state,
      confidence,
      aggregatedFeatures: features,
      candidateTask: bestTask,
      candidateStartedAt: timestamp,
    };
  }

  if (state.candidateStartedAt !== null && timestamp - state.candidateStartedAt >= HYSTERESIS_MS) {
    return {
      detectedTask: bestTask,
      confidence,
      stabilizedAt: timestamp,
      candidateTask: null,
      candidateStartedAt: null,
      aggregatedFeatures: features,
    };
  }

  return {
    ...state,
    confidence,
    aggregatedFeatures: features,
  };
}

export function buildTaskInference(
  state: TaskInferenceState,
): TaskInference {
  return {
    detectedTask: state.detectedTask,
    confidence: state.confidence,
    stabilizedAt: state.stabilizedAt,
  };
}
