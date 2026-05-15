import {
  createContext,
  startTransition,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLanguage } from "@/components/shared/language-provider";
import type { Language } from "@/locales";
import { performCueFeedback, unlockAudioFeedback } from "@/runtime/audio";
import { resolveAppAsset } from "@/runtime/asset-path";
import { canTriggerFeedbackLevel, selectFeedbackLevel } from "@/runtime/feedback-engine";
import { ASSUMED_INTEROCULAR_DISTANCE_CM, NORMALIZED_FOCAL_LENGTH } from "@/runtime/pose-metrics";
import { EMPTY_CONTEXT_FEATURES } from "@/runtime/context-features";
import { computeExposureScore, createEmptyTaskDurations } from "@/runtime/logic";
import {
  createExposureEngineState,
  evaluateExposureFrame,
  previewRawLoad,
  type ExposureEngineState,
  type ExposureProfile,
} from "@/runtime/exposure-engine";
import {
  buildHourlyTrendPoint,
  buildDailySummary,
  buildThresholds,
  classifyPosture,
  clamp,
  computeAchievements,
  computeIdentity,
  computeStreak,
  DEFAULT_METRIC_AVAILABILITY,
  deriveBestWorstHours,
  deriveDominantIssue,
  getDayKey,
  getDistanceStatus,
  median,
  round,
} from "@/runtime/logic";
import { createDemoRecoveryActivities, createDemoRuntimeSnapshot } from "@/runtime/demo-history";
import { evaluateMovementVariability, type VariabilitySample } from "@/runtime/movement-variability";
import { loadRuntimePreferences, saveRuntimePreferences } from "@/runtime/preferences";
import { getCueCopy, getLevelLabel } from "@/runtime/runtime-copy";
import { buildTaskInference, createTaskInferenceState, type TaskInferenceState, type TaskWindowSample, updateTaskInferenceState } from "@/runtime/task-inference";
import { isFrameGapTooLarge, safeFrameDelta } from "@/runtime/time";
import {
  cleanupRuntimeData,
  loadRecoveryActivities,
  loadRuntimeSnapshot,
  persistRecoveryActivity,
  persistRuntimeSession,
} from "@/runtime/storage";
import type {
  CameraView,
  CameraDeviceInfo,
  ContextFeatures,
  DailySummary,
  DistanceEstimateSource,
  DistanceMode,
  DistanceSuppressionReason,
  DistanceStatus,
  ExposureLevel,
  ExposureSnapshot,
  FrameObservation,
  FeedbackLevel,
  InstantLoadState,
  IssueFamily,
  LandmarkPolicy,
  LiveMetrics,
  LoadSource,
  MetricAvailability,
  MetricThresholds,
  MonitoringStatus,
  ObservationMode,
  PoseSampleRecord,
  PostureBaseline,
  PostureEventRecord,
  RecoveryActivityRecord,
  RuntimeAchievement,
  RuntimeCue,
  RuntimeDiagnostics,
  RuntimeHistorySnapshot,
  RuntimePreferences,
  SessionRecord,
  TaskOverride,
  TaskState,
  TrackingReliability,
  IdentitySnapshot,
  TrackingLostReason,
  WorkerErrorCode,
} from "@/runtime/types";
import type { PoseWorkerResult } from "@/runtime/worker-protocol";
import type { CameraMode, PostureState } from "@/types/posture";

interface PostureRuntimeValue {
  monitoringStatus: MonitoringStatus;
  cameraMode: CameraMode;
  postureState: PostureState;
  liveMetrics: LiveMetrics | null;
  liveLandmarks: PoseSampleRecord["landmarks"] | null;
  currentIssue: IssueFamily | null;
  currentCue: RuntimeCue | null;
  sessionScore: number;
  liveScore: number;
  liveScoreReliable: boolean;
  calibrationProgress: number;
  cooldownRemainingMs: number;
  distanceStatus: DistanceStatus;
  distanceMode: DistanceMode;
  distanceSuppressionReason: DistanceSuppressionReason | null;
  detectedTask: TaskState;
  effectiveTask: TaskState;
  taskConfidence: number;
  taskOverride: TaskOverride;
  trackingReliability: TrackingReliability;
  instantLoadState: InstantLoadState;
  exposureLevel: ExposureLevel;
  staticHoldSeconds: number;
  recoveryCount: number;
  loadSource: LoadSource | null;
  stream: MediaStream | null;
  preferences: RuntimePreferences;
  cameraDevices: CameraDeviceInfo[];
  selectedCameraLabel: string | null;
  runtimeDiagnostics: RuntimeDiagnostics;
  todaySummary: DailySummary | null;
  summaries: DailySummary[];
  usingDemoHistory: boolean;
  feedbackHistory: PostureEventRecord[];
  recoveryActivities: RecoveryActivityRecord[];
  achievements: RuntimeAchievement[];
  streak: number;
  identity: IdentitySnapshot;
  runtimeError: string | null;
  startMonitoring: () => Promise<void>;
  stopMonitoring: () => Promise<void>;
  pauseMonitoring: () => void;
  resumeMonitoring: () => void;
  setTaskOverride: (task: TaskOverride) => void;
  updatePreferences: (updates: Partial<RuntimePreferences>) => void;
  refreshCameraDevices: () => Promise<void>;
  refreshRecoveryActivities: () => Promise<void>;
  recordRecoveryActivity: (activity: Omit<RecoveryActivityRecord, "id" | "dayKey">) => Promise<void>;
}

const PostureRuntimeContext = createContext<PostureRuntimeValue | null>(null);

interface SessionAccumulator {
  id: string;
  dayKey: string;
  startedAt: number;
  trackedMs: number;
  goodMs: number;
  warningMs: number;
  badMs: number;
  analyzingMs: number;
  issueMs: Record<IssueFamily, number>;
  deviationSum: number;
  deviationSamples: number;
  deviationDurationMs: number;
  correctionSuccessCount: number;
  interventionCount: number;
  overlayCount: number;
  breakReminderCount: number;
  screenDistanceWarningCount: number;
  longestFocusBlockMs: number;
  currentFocusBlockMs: number;
  nextReminderTrackedMs: number;
  moderateExposureMs: number;
  highExposureMs: number;
  staticHoldMs: number;
  recoveryMs: number;
  recoveryCount: number;
  taskMs: Record<TaskState, number>;
}

interface CalibrationAccumulator {
  startedAt: number;
  validMs: number;
  torsoValidMs: number;
  headForward: number[];
  torsoLean: number[];
  shoulderTilt: number[];
  screenDistanceRatio: number[];
  world3DInterocularCm: number[];
}

interface StopMonitoringOptions {
  finalStatus?: Extract<MonitoringStatus, "idle" | "error">;
  finalizeReason?: "user-stop" | "worker-error";
}

interface FrameDecisionContext {
  postureState: PostureState;
  cameraView: CameraView;
  trackingReliability: TrackingReliability;
  exposureLevel: ExposureLevel;
  taskState: TaskState;
  loadSource: LoadSource | null;
  distanceEstimateCm: number | null;
  distanceEstimateConfidence: number;
  distanceEstimateSource: DistanceEstimateSource | null;
  faceConfidence: number;
}

interface DistanceFlowState {
  mode: DistanceMode;
  suppressionReason: DistanceSuppressionReason | null;
  dwellMs: number;
}

interface DistanceSignal {
  estimatedDistanceCm: number | null;
  confidence: number;
  source: DistanceEstimateSource | null;
  faceConfidence: number;
}

interface AutoResumeState {
  pending: boolean;
  frozenTask: TaskState;
  candidateTask: TaskState | null;
  candidateStartedAt: number | null;
  pendingStartedAt: number | null;
}

type CalibrationRetryReason = TrackingLostReason | "bad-baseline" | "unstable-baseline" | null;

const INITIAL_HISTORY: RuntimeHistorySnapshot = {
  summaries: [],
  todaySummary: null,
  recentEvents: [],
  achievements: [],
  streak: 0,
  identity: {
    level: "Reset Starter",
    vibe: "Waiting for enough data",
    specialty: "Posture data will appear after your first session",
    progressValue: 0,
  },
};

const TARGET_CAPTURE_FPS = 10;
const CALIBRATION_DURATION_MS = 5_000;
const CALIBRATION_REQUIRED_VALID_MS = 2_500;
const CALIBRATION_RETRY_TIMEOUT_MS = 10_000;
const CALIBRATION_RETRY_STABLE_MS = 700;
const CALIBRATION_RELAXED_TORSO_REQUIRED_MS = 700;
const CALIBRATION_STRICT_TORSO_REQUIRED_MS = 2_500;
const CALIBRATION_MAX_BASELINE_HEAD_FORWARD = 0.1;
const CALIBRATION_MAX_BASELINE_TORSO_LEAN = 8;
const CALIBRATION_MAX_BASELINE_SHOULDER_TILT = 5;
const ENABLE_DEMO_HISTORY = import.meta.env.MODE !== "test";
const REPORT_READY_TRACKED_MS = 5 * 60 * 1000;

function hasReportReadyHistory(snapshot: RuntimeHistorySnapshot) {
  return (
    (snapshot.todaySummary?.trackedMs ?? 0) >= REPORT_READY_TRACKED_MS ||
    snapshot.summaries.some((summary) => summary.trackedMs >= REPORT_READY_TRACKED_MS)
  );
}

function getDisplayHistorySnapshot(snapshot: RuntimeHistorySnapshot, now = Date.now()) {
  const shouldUseDemoHistory = ENABLE_DEMO_HISTORY && !hasReportReadyHistory(snapshot);

  return {
    demoSnapshot: shouldUseDemoHistory ? createDemoRuntimeSnapshot(now) : null,
    shouldUseDemoHistory,
  };
}

function createAutoResumeState(frozenTask: TaskState = "unknown"): AutoResumeState {
  return {
    pending: false,
    frozenTask,
    candidateTask: null,
    candidateStartedAt: null,
    pendingStartedAt: null,
  };
}

function isSingleHandFineMotor(features: ContextFeatures) {
  return features.dominantFineMotorHand === "left" || features.dominantFineMotorHand === "right";
}

function shouldUseScreenUnknownProfile(features: ContextFeatures, reliability: TrackingReliability) {
  if (reliability === "minimal") return false;
  if (features.handheldDeviceProxy >= 0.35) return false;
  if (features.gazeDown >= 0.65) return false;
  if (features.handElevation >= 0.35) return false;
  if (features.deskWork >= 0.55 && isSingleHandFineMotor(features) && features.bilateralHandActivity <= 0.45) {
    return false;
  }

  return features.deskWork >= 0.3 || features.torsoConfidence >= 0.6;
}

function resolveExposureProfile(
  taskState: TaskState,
  features: ContextFeatures,
  reliability: TrackingReliability,
): ExposureProfile {
  if (taskState === "unknown" && shouldUseScreenUnknownProfile(features, reliability)) {
    return "screen-unknown";
  }

  return taskState;
}

function hasReliableFaceDistanceSignal(signal: DistanceSignal) {
  return signal.source === "face-mesh" && signal.confidence >= 0.65 && signal.faceConfidence >= 0.72 && signal.estimatedDistanceCm !== null;
}

function shouldForceFaceDistanceSoftMode(taskState: TaskState, signal: DistanceSignal) {
  // Tier 1 — high-quality face-mesh signal: override any task (including handwriting)
  // when the user is within 38 cm.  Face-mesh is precise enough to trust even during
  // tasks that naturally involve leaning forward.
  if (hasReliableFaceDistanceSignal(signal) && signal.estimatedDistanceCm! <= 38) {
    return true;
  }
  // Tier 2 — pose-fallback (no holistic model): handwriting and phone/tablet are
  // softer, but not silent. A clearly close estimate should still become a gentle
  // distance advisory instead of a normal "task suppressed" state.
  const hasConfidentSignal =
    signal.estimatedDistanceCm !== null &&
    signal.confidence >= 0.5 &&
    signal.faceConfidence >= 0.5;
  const softTaskCutoff = taskState === "handwriting" || taskState === "phone-tablet" ? 42 : 45;
  return hasConfidentSignal && signal.estimatedDistanceCm! <= softTaskCutoff;
}

function getDistanceFlowState(
  taskState: TaskState,
  profile: ExposureProfile,
  reliability: TrackingReliability,
  signal: DistanceSignal,
): DistanceFlowState {
  if (reliability === "minimal" && !hasReliableFaceDistanceSignal(signal)) {
    return {
      mode: "suppressed-reliability",
      suppressionReason: "minimal-reliability",
      dwellMs: 0,
    };
  }

  if (taskState === "typing" || taskState === "idle-focus") {
    return {
      mode: "active",
      suppressionReason: null,
      dwellMs: 5000,
    };
  }

  if (profile === "screen-unknown") {
    return {
      mode: "soft",
      suppressionReason: null,
      dwellMs: 7000,
    };
  }

  if (shouldForceFaceDistanceSoftMode(taskState, signal)) {
    return {
      mode: "soft",
      suppressionReason: null,
      dwellMs: 4000,
    };
  }

  return {
    mode: "suppressed-task",
    suppressionReason: "non-screen-task",
    dwellMs: 0,
  };
}

function computeFrameLiveScore(previousScore: number | null, snapshot: ExposureSnapshot) {
  const livePenalty = Math.min(70, snapshot.adjustedLoad * 70) +
    (snapshot.staticHold ? 15 : 0) +
    Math.min(15, snapshot.ratio * 10);
  const rawScore = Math.round(clamp(100 - livePenalty, 0, 100));
  if (previousScore === null) {
    return rawScore;
  }

  const alpha = 0.35;
  return Math.round(previousScore + (rawScore - previousScore) * alpha);
}

function smoothDistanceEstimate(
  previousDistanceCm: number | null,
  nextDistanceCm: number | null,
) {
  if (nextDistanceCm === null) return null;
  if (previousDistanceCm === null) return nextDistanceCm;
  return previousDistanceCm + (nextDistanceCm - previousDistanceCm) * 0.2;
}

function createRuntimeDiagnostics(preferences: RuntimePreferences): RuntimeDiagnostics {
  return {
    workerReady: false,
    framesProcessed: 0,
    validFrames: 0,
    trackingLostFrames: 0,
    lastTrackingLostReason: null,
    lastWorkerError: null,
    calibrationElapsedMs: 0,
    calibrationValidMs: 0,
    selectedCameraLabel: null,
    selectedCameraDeviceId: preferences.cameraDeviceId ?? null,
    metricAvailability: DEFAULT_METRIC_AVAILABILITY,
    observationMode: null,
    cameraView: "unknown",
  };
}

function getCameraLostReasonMessage(language: Language, reason: TrackingLostReason | null) {
  if (!reason) {
    return language === "vi"
      ? "Đang tìm đủ landmark từ camera."
      : "Looking for enough camera landmarks.";
  }

  const copy: Record<TrackingLostReason, { vi: string; en: string }> = {
    "no-pose": {
      vi: "Chưa thấy người trong khung hình. Hãy ngồi vào giữa camera.",
      en: "No body detected. Sit in the center of the camera frame.",
    },
    "low-confidence-face": {
      vi: "Chưa đủ landmark khuôn mặt. Hãy để camera thấy rõ mũi và mắt.",
      en: "Face landmarks are not reliable yet. Keep your nose and eyes visible.",
    },
    "low-confidence-shoulders": {
      vi: "Chưa thấy rõ hai vai. Hãy lùi nhẹ hoặc chỉnh góc camera.",
      en: "Shoulder landmarks are not reliable yet. Move back or adjust the camera angle.",
    },
    "low-confidence-hips": {
      vi: "Chưa thấy rõ vùng hông. Hãy lùi nhẹ để camera thấy thân trên nhiều hơn.",
      en: "Hip landmarks are not reliable yet. Move back so the camera can see more of your torso.",
    },
    "head-reference-missing": {
      vi: "Chưa đo được hướng đầu. Hãy để camera thấy rõ tai hoặc mắt.",
      en: "Head reference is missing. Keep your ears or eyes visible.",
    },
  };

  return language === "vi" ? copy[reason].vi : copy[reason].en;
}

function mergeHourlyTrend(base: DailySummary["hourlyTrend"], current: DailySummary["hourlyTrend"]) {
  const map = new Map<number, DailySummary["hourlyTrend"][number]>();
  for (const point of base) {
    map.set(point.hour, point);
  }

  for (const point of current) {
    const existing = map.get(point.hour);
    if (!existing) {
      map.set(point.hour, point);
      continue;
    }

    map.set(point.hour, {
      ...buildHourlyTrendPoint({
        hour: point.hour,
        trackedMs: existing.trackedMs + point.trackedMs,
        lowExposureMs: (existing.lowExposureMs ?? 0) + (point.lowExposureMs ?? 0),
        moderateExposureMs: (existing.moderateExposureMs ?? 0) + (point.moderateExposureMs ?? 0),
        highExposureMs: (existing.highExposureMs ?? 0) + (point.highExposureMs ?? 0),
        staticHoldMs: (existing.staticHoldMs ?? 0) + (point.staticHoldMs ?? 0),
        recoveryCount: (existing.recoveryCount ?? 0) + (point.recoveryCount ?? 0),
      }),
    });
  }

  return [...map.values()].sort((a, b) => a.hour - b.hour);
}

function mergeSummary(base: DailySummary | null, current: DailySummary | null) {
  if (!base) return current;
  if (!current) return base;

  const merged: DailySummary = {
    ...base,
    sessionsCount: base.sessionsCount + current.sessionsCount,
    firstSessionAt: base.firstSessionAt ?? current.firstSessionAt,
    lastSessionAt: current.lastSessionAt ?? base.lastSessionAt,
    trackedMs: base.trackedMs + current.trackedMs,
    durationMs: base.durationMs + current.durationMs,
    goodMs: base.goodMs + current.goodMs,
    warningMs: base.warningMs + current.warningMs,
    badMs: base.badMs + current.badMs,
    analyzingMs: base.analyzingMs + current.analyzingMs,
    issueMs: {
      "forward-head": base.issueMs["forward-head"] + current.issueMs["forward-head"],
      "torso-lean": base.issueMs["torso-lean"] + current.issueMs["torso-lean"],
      "shoulder-tilt": base.issueMs["shoulder-tilt"] + current.issueMs["shoulder-tilt"],
    },
    avgDeviation: 0,
    score: 0,
    correctionSuccessCount: base.correctionSuccessCount + current.correctionSuccessCount,
    interventionCount: base.interventionCount + current.interventionCount,
    overlayCount: base.overlayCount + current.overlayCount,
    breakReminderCount: base.breakReminderCount + current.breakReminderCount,
    screenDistanceWarningCount: base.screenDistanceWarningCount + current.screenDistanceWarningCount,
    longestFocusBlockMs: Math.max(base.longestFocusBlockMs, current.longestFocusBlockMs),
    moderateExposureMs: (base.moderateExposureMs ?? base.warningMs) + (current.moderateExposureMs ?? current.warningMs),
    highExposureMs: (base.highExposureMs ?? base.badMs) + (current.highExposureMs ?? current.badMs),
    staticHoldMs: (base.staticHoldMs ?? 0) + (current.staticHoldMs ?? 0),
    recoveryMs: (base.recoveryMs ?? 0) + (current.recoveryMs ?? 0),
    recoveryCount: (base.recoveryCount ?? 0) + (current.recoveryCount ?? 0),
    taskMs: {
      typing: (base.taskMs?.typing ?? 0) + (current.taskMs?.typing ?? 0),
      reading: (base.taskMs?.reading ?? 0) + (current.taskMs?.reading ?? 0),
      handwriting: (base.taskMs?.handwriting ?? 0) + (current.taskMs?.handwriting ?? 0),
      "phone-tablet": (base.taskMs?.["phone-tablet"] ?? 0) + (current.taskMs?.["phone-tablet"] ?? 0),
      "idle-focus": (base.taskMs?.["idle-focus"] ?? 0) + (current.taskMs?.["idle-focus"] ?? 0),
      unknown: (base.taskMs?.unknown ?? 0) + (current.taskMs?.unknown ?? 0),
    },
    bestHour: null,
    worstHour: null,
    hourlyTrend: mergeHourlyTrend(base.hourlyTrend, current.hourlyTrend),
    dominantIssue: null,
    streakEligible: false,
    lastSessionScore: current.lastSessionAt !== null ? current.lastSessionScore : base.lastSessionScore,
  };

  merged.avgDeviation = clamp(
    ((base.avgDeviation * base.trackedMs) + (current.avgDeviation * current.trackedMs)) /
      Math.max(merged.trackedMs, 1),
    0,
    1,
  );
  merged.score = computeExposureScore({
    trackedMs: merged.trackedMs,
    moderateExposureMs: merged.moderateExposureMs ?? merged.warningMs,
    highExposureMs: merged.highExposureMs ?? merged.badMs,
    staticHoldMs: merged.staticHoldMs ?? 0,
    recoveryCount: merged.recoveryCount ?? 0,
  });
  merged.streakEligible = merged.trackedMs >= 30 * 60 * 1000 && merged.score >= 70;
  const { bestHour, worstHour } = deriveBestWorstHours(merged.hourlyTrend);
  merged.bestHour = bestHour;
  merged.worstHour = worstHour;
  merged.dominantIssue = deriveDominantIssue(merged.issueMs);

  return merged;
}

function createSessionAccumulator(preferences: RuntimePreferences, startedAt = Date.now()): SessionAccumulator {
  return {
    id: crypto.randomUUID(),
    dayKey: getDayKey(startedAt),
    startedAt,
    trackedMs: 0,
    goodMs: 0,
    warningMs: 0,
    badMs: 0,
    analyzingMs: 0,
    issueMs: {
      "forward-head": 0,
      "torso-lean": 0,
      "shoulder-tilt": 0,
    },
    deviationSum: 0,
    deviationSamples: 0,
    deviationDurationMs: 0,
    correctionSuccessCount: 0,
    interventionCount: 0,
    overlayCount: 0,
    breakReminderCount: 0,
    screenDistanceWarningCount: 0,
    longestFocusBlockMs: 0,
    currentFocusBlockMs: 0,
    nextReminderTrackedMs: preferences.reminderMinutes * 60 * 1000,
    moderateExposureMs: 0,
    highExposureMs: 0,
    staticHoldMs: 0,
    recoveryMs: 0,
    recoveryCount: 0,
    taskMs: createEmptyTaskDurations(),
  };
}

function buildSessionRecord(session: SessionAccumulator, endedAt: number): SessionRecord {
  const durationMs = endedAt - session.startedAt;
  const score = computeExposureScore({
    trackedMs: session.trackedMs,
    moderateExposureMs: session.moderateExposureMs,
    highExposureMs: session.highExposureMs,
    staticHoldMs: session.staticHoldMs,
    recoveryCount: session.recoveryCount,
  });

  return {
    id: session.id,
    dayKey: session.dayKey,
    startedAt: session.startedAt,
    endedAt,
    durationMs,
    trackedMs: session.trackedMs,
    goodMs: session.goodMs,
    warningMs: session.warningMs,
    badMs: session.badMs,
    analyzingMs: session.analyzingMs,
    issueMs: session.issueMs,
    deviationSum: session.deviationSum,
    deviationSamples: session.deviationSamples,
    deviationDurationMs: session.deviationDurationMs,
    correctionSuccessCount: session.correctionSuccessCount,
    interventionCount: session.interventionCount,
    overlayCount: session.overlayCount,
    breakReminderCount: session.breakReminderCount,
    screenDistanceWarningCount: session.screenDistanceWarningCount,
    longestFocusBlockMs: session.longestFocusBlockMs,
    score,
    lastSessionScore: score,
    moderateExposureMs: session.moderateExposureMs,
    highExposureMs: session.highExposureMs,
    staticHoldMs: session.staticHoldMs,
    recoveryMs: session.recoveryMs,
    recoveryCount: session.recoveryCount,
    taskMs: session.taskMs,
  };
}

function createCalibrationAccumulator(startedAt = Date.now()): CalibrationAccumulator {
  return {
    startedAt,
    validMs: 0,
    torsoValidMs: 0,
    headForward: [],
    torsoLean: [],
    shoulderTilt: [],
    screenDistanceRatio: [],
    world3DInterocularCm: [],
  };
}

function buildCalibrationBaseline(accumulator: CalibrationAccumulator): PostureBaseline {
  // Use the person-specific interocular distance measured from world landmarks when
  // enough samples have been collected; otherwise fall back to the population average.
  // This eliminates per-person variance (~±10%) without any user input.
  const medianEyeSpan = median(accumulator.screenDistanceRatio);
  const medianInterocularCm = accumulator.world3DInterocularCm.length >= 5
    ? median(accumulator.world3DInterocularCm)
    : ASSUMED_INTEROCULAR_DISTANCE_CM;

  // calibratedK = focal_length × real_interocular_cm.
  // K is the person+camera constant for this session.  At runtime:
  //   distance_cm = calibratedK / currentScreenDistanceRatio
  // The FOV assumption baked into NORMALIZED_FOCAL_LENGTH cancels in ratio-based
  // threshold comparisons, and the interocular term is now person-specific.
  const calibratedK = NORMALIZED_FOCAL_LENGTH * medianInterocularCm;

  return {
    headForward: median(accumulator.headForward),
    torsoLean: median(accumulator.torsoLean),
    shoulderTilt: median(accumulator.shoulderTilt),
    screenDistanceRatio: medianEyeSpan,
    screenDistanceCm: medianEyeSpan > 0 ? calibratedK / medianEyeSpan : undefined,
    calibratedK,
  };
}

function standardDeviation(values: number[]) {
  if (values.length < 2) return 0;
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function buildCalibrationMetricAvailability(
  accumulator: CalibrationAccumulator,
  landmarkPolicy: LandmarkPolicy,
): MetricAvailability {
  return {
    headForward: true,
    shoulderTilt: true,
    torsoLean: accumulator.torsoValidMs >= (
      landmarkPolicy === "strict"
        ? CALIBRATION_STRICT_TORSO_REQUIRED_MS
        : CALIBRATION_RELAXED_TORSO_REQUIRED_MS
    ),
  };
}

function constrainStartupBaseline(
  baseline: PostureBaseline,
  metricAvailability: MetricAvailability,
): PostureBaseline {
  return {
    ...baseline,
    headForward: Math.min(baseline.headForward, CALIBRATION_MAX_BASELINE_HEAD_FORWARD),
    torsoLean: metricAvailability.torsoLean
      ? Math.min(baseline.torsoLean, CALIBRATION_MAX_BASELINE_TORSO_LEAN)
      : baseline.torsoLean,
    shoulderTilt: Math.min(baseline.shoulderTilt, CALIBRATION_MAX_BASELINE_SHOULDER_TILT),
  };
}

function getCalibrationQualityIssue(
  baseline: PostureBaseline,
  accumulator: CalibrationAccumulator,
  metricAvailability: MetricAvailability,
): Extract<CalibrationRetryReason, "bad-baseline" | "unstable-baseline"> | null {
  const unstable =
    standardDeviation(accumulator.headForward) > 0.045 ||
    (metricAvailability.torsoLean && standardDeviation(accumulator.torsoLean) > 7) ||
    standardDeviation(accumulator.shoulderTilt) > 6;
  if (unstable) return "unstable-baseline";
  return null;
}

function getCalibrationRetryDetail(language: Language, landmarkPolicy: LandmarkPolicy, reason?: CalibrationRetryReason) {
  if (reason === "bad-baseline") {
    return language === "vi"
      ? "Baseline hiện giống tư thế cúi/gù hoặc lệch vai. Hãy ngồi thẳng tự nhiên, mở vai nhẹ rồi app sẽ đo lại."
      : "The baseline already looks slouched or tilted. Sit naturally upright with relaxed shoulders, then the app will recalibrate.";
  }

  if (reason === "unstable-baseline") {
    return language === "vi"
      ? "Tư thế đang dao động nhiều trong lúc hiệu chỉnh. Hãy giữ yên vài giây để app lấy baseline ổn định."
      : "Your posture moved too much during calibration. Hold still for a few seconds so the app can capture a stable baseline.";
  }

  if (landmarkPolicy === "strict") {
    return language === "vi"
      ? "Strict mode cần thấy rõ mặt, vai và hông. Hãy lùi nhẹ để camera thấy đủ thân trên rồi app sẽ thử lại."
      : "Strict mode needs clear face, shoulder, and hip landmarks. Move back until your upper body is visible, then the app will retry.";
  }

  if (reason === "low-confidence-hips") {
    return language === "vi"
      ? "Relaxed mode vẫn có thể chạy với mặt và vai. Nếu muốn đo lưng chính xác hơn, hãy lùi nhẹ để camera thấy thêm vùng hông."
      : "Relaxed mode can still run with face and shoulders. Move back if you want a stronger torso measurement.";
  }

  return language === "vi"
    ? "Hãy giữ mặt và hai vai rõ trong khung hình. App sẽ thử lại khi thấy landmark ổn định."
    : "Keep your face and both shoulders visible. The app will retry once landmarks are stable.";
}

function combineMetricAvailability(first: MetricAvailability, second: MetricAvailability): MetricAvailability {
  return {
    headForward: first.headForward && second.headForward,
    torsoLean: first.torsoLean && second.torsoLean,
    shoulderTilt: first.shoulderTilt && second.shoulderTilt,
  };
}

export function PostureRuntimeProvider({ children }: { children: ReactNode }) {
  const { language } = useLanguage();
  const [preferences, setPreferences] = useState<RuntimePreferences>(loadRuntimePreferences);
  const [monitoringStatus, setMonitoringStatus] = useState<MonitoringStatus>("idle");
  const [postureState, setPostureState] = useState<PostureState>("good");
  const [liveMetrics, setLiveMetrics] = useState<LiveMetrics | null>(null);
  const [liveLandmarks, setLiveLandmarks] = useState<PoseSampleRecord["landmarks"] | null>(null);
  const [currentIssue, setCurrentIssue] = useState<IssueFamily | null>(null);
  const [currentCue, setCurrentCue] = useState<RuntimeCue | null>(null);
  const [sessionScore, setSessionScore] = useState(0);
  const [liveScore, setLiveScore] = useState(100);
  const [liveScoreReliable, setLiveScoreReliable] = useState(false);
  const [calibrationProgress, setCalibrationProgress] = useState(0);
  const [cooldownRemainingMs, setCooldownRemainingMs] = useState(0);
  const [distanceStatus, setDistanceStatus] = useState<DistanceStatus>("ok");
  const [distanceMode, setDistanceMode] = useState<DistanceMode>("suppressed-task");
  const [distanceSuppressionReason, setDistanceSuppressionReason] = useState<DistanceSuppressionReason | null>("non-screen-task");
  const [detectedTask, setDetectedTask] = useState<TaskState>("unknown");
  const [effectiveTaskState, setEffectiveTaskState] = useState<TaskState>("unknown");
  const [taskConfidence, setTaskConfidence] = useState(0);
  const [taskOverride, setTaskOverrideState] = useState<TaskOverride>("auto");
  const [trackingReliability, setTrackingReliability] = useState<TrackingReliability>("minimal");
  const [instantLoadState, setInstantLoadState] = useState<InstantLoadState>("neutral");
  const [exposureLevel, setExposureLevel] = useState<ExposureLevel>("low");
  const [staticHoldSeconds, setStaticHoldSeconds] = useState(0);
  const [recoveryCount, setRecoveryCount] = useState(0);
  const [loadSource, setLoadSource] = useState<LoadSource | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [history, setHistory] = useState<RuntimeHistorySnapshot>(INITIAL_HISTORY);
  const [demoHistory, setDemoHistory] = useState<RuntimeHistorySnapshot | null>(null);
  const [liveSessionSummary, setLiveSessionSummary] = useState<DailySummary | null>(null);
  const [feedbackHistory, setFeedbackHistory] = useState<PostureEventRecord[]>([]);
  const [recoveryActivities, setRecoveryActivities] = useState<RecoveryActivityRecord[]>([]);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [cameraDevices, setCameraDevices] = useState<CameraDeviceInfo[]>([]);
  const [runtimeDiagnostics, setRuntimeDiagnostics] = useState<RuntimeDiagnostics>(() => createRuntimeDiagnostics(preferences));

  const captureVideoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const workerReadyRef = useRef(false);
  const workerInitPromiseRef = useRef<Promise<void> | null>(null);
  const workerInitResolveRef = useRef<(() => void) | null>(null);
  const workerInitRejectRef = useRef<((reason?: unknown) => void) | null>(null);
  const captureLoopRef = useRef<number | null>(null);
  const frameInFlightRef = useRef(false);
  const sessionRef = useRef<SessionAccumulator | null>(null);
  const sampleBufferRef = useRef<PoseSampleRecord[]>([]);
  const eventBufferRef = useRef<PostureEventRecord[]>([]);
  const calibrationRef = useRef<CalibrationAccumulator | null>(null);
  const baselineRef = useRef<PostureBaseline | null>(null);
  const thresholdsRef = useRef<MetricThresholds | null>(null);
  const smoothedMetricsRef = useRef<LiveMetrics | null>(null);
  const smoothedDistanceEstimateCmRef = useRef<number | null>(null);
  const lastFrameTimestampRef = useRef<number | null>(null);
  const lastValidTimestampRef = useRef<number | null>(null);
  const lastSnapshotAtRef = useRef(0);
  const lastSampleTimestampRef = useRef(0);
  const retryValidStartedAtRef = useRef<number | null>(null);
  const observationWindowRef = useRef<TaskWindowSample[]>([]);
  const variabilityWindowRef = useRef<VariabilitySample[]>([]);
  const taskInferenceStateRef = useRef<TaskInferenceState>(createTaskInferenceState());
  const exposureStateRef = useRef<ExposureEngineState>(createExposureEngineState());
  const languageRef = useRef<Language>(language);
  const preferencesRef = useRef(preferences);
  const monitoringStatusRef = useRef<MonitoringStatus>(monitoringStatus);
  const postureStateRef = useRef<PostureState>(postureState);
  const liveScoreRef = useRef<number | null>(null);
  const effectiveTaskRef = useRef<TaskState>(effectiveTaskState);
  const taskOverrideRef = useRef<TaskOverride>(taskOverride);
  const autoResumeStateRef = useRef<AutoResumeState>(createAutoResumeState());
  const stopMonitoringRef = useRef<(options?: StopMonitoringOptions) => Promise<void>>(async () => {});
  const previousPostureStateRef = useRef<PostureState>("good");
  const currentIssueEpisodeRef = useRef<{
    issue: IssueFamily | null;
    moderateStartedAt: number;
    highStartedAt: number | null;
    highestLevelTriggered: 0 | 1 | 2 | 3 | 4;
  } | null>(null);
  const lastFeedbackByIssueRef = useRef<Record<IssueFamily, number>>({
    "forward-head": 0,
    "torso-lean": 0,
    "shoulder-tilt": 0,
  });
  const recentLevel3Ref = useRef<number[]>([]);
  const overlaySnoozedUntilRef = useRef(0);
  const activeOverlayRef = useRef(false);
  const goodRecoveryStartedAtRef = useRef<number | null>(null);
  const pendingRewardRef = useRef(false);
  const pendingRewardIssueRef = useRef<IssueFamily | null>(null);
  const lastRewardAtRef = useRef(0);
  const lastAnyFeedbackAtRef = useRef(0);
  const lastLevel3Or4FeedbackAtRef = useRef(0);
  const distanceWarningStartedAtRef = useRef<number | null>(null);
  const distanceWarningStatusRef = useRef<Exclude<DistanceStatus, "ok"> | null>(null);
  const distanceWarningClearedAtRef = useRef<number | null>(null);
  const lastDistanceWarningAtRef = useRef(0);
  const distanceCueActiveRef = useRef(false);
  const calibrationRetryCountRef = useRef(0);
  const monitoringStatusBeforePauseRef = useRef<MonitoringStatus>("tracking");

  function clearCaptureLoop() {
    if (captureLoopRef.current !== null) {
      window.clearInterval(captureLoopRef.current);
      captureLoopRef.current = null;
    }
    frameInFlightRef.current = false;
  }

  function releaseCurrentStream() {
    const currentStream = streamRef.current;
    if (currentStream) {
      currentStream.getTracks().forEach((track) => track.stop());
    }
    streamRef.current = null;
    setStream(null);
  }

  function resetWorker() {
    workerRef.current?.terminate();
    workerRef.current = null;
    workerReadyRef.current = false;
    workerInitPromiseRef.current = null;
    workerInitResolveRef.current = null;
    workerInitRejectRef.current = null;
    frameInFlightRef.current = false;
    setRuntimeDiagnostics((current) => ({ ...current, workerReady: false }));
  }

  function shouldIgnoreWorkerResult() {
    const status = monitoringStatusRef.current;
    return status === "paused" || status === "idle" || status === "error";
  }

  function handleWorkerFailure(code: WorkerErrorCode, message: string) {
    const pendingReject = workerInitRejectRef.current;
    void stopMonitoringRef.current({ finalStatus: "error", finalizeReason: "worker-error" });
    resetWorker();
    setRuntimeError(message);
    setRuntimeDiagnostics((current) => ({
      ...current,
      workerReady: false,
      lastWorkerError: { code, message },
    }));
    pendingReject?.(new Error(message));
  }

  async function refreshCameraDevices() {
    if (!navigator.mediaDevices?.enumerateDevices) {
      setCameraDevices([]);
      setRuntimeDiagnostics((current) => ({
        ...current,
        selectedCameraLabel: null,
        selectedCameraDeviceId: preferencesRef.current.cameraDeviceId ?? null,
      }));
      return;
    }

    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices
      .filter((device) => device.kind === "videoinput")
      .map<CameraDeviceInfo>((device, index) => ({
        deviceId: device.deviceId,
        label: device.label || `Camera ${index + 1}`,
        isSelected: device.deviceId === preferencesRef.current.cameraDeviceId,
      }));
    const selected = videoDevices.find((device) => device.isSelected);

    setCameraDevices(videoDevices);
    setRuntimeDiagnostics((current) => ({
      ...current,
      selectedCameraLabel: preferencesRef.current.cameraDeviceId ? selected?.label ?? null : current.selectedCameraLabel,
      selectedCameraDeviceId: preferencesRef.current.cameraDeviceId ?? current.selectedCameraDeviceId,
    }));
  }

  async function refreshRecoveryActivities() {
    const activities = await loadRecoveryActivities();
    setRecoveryActivities(activities);
  }

  function withDemoRecoveryActivities(activities: RecoveryActivityRecord[], now = Date.now()) {
    return [...activities, ...createDemoRecoveryActivities(now)]
      .sort((a, b) => (b.completedAt ?? b.startedAt) - (a.completedAt ?? a.startedAt))
      .slice(0, 100);
  }

  async function recordRecoveryActivity(activity: Omit<RecoveryActivityRecord, "id" | "dayKey">) {
    const record: RecoveryActivityRecord = {
      ...activity,
      dayKey: getDayKey(activity.completedAt ?? activity.startedAt),
    };

    if (preferencesRef.current.localProcessing) {
      await persistRecoveryActivity(record);
      await refreshRecoveryActivities();
    } else {
      setRecoveryActivities((current) => [record, ...current].slice(0, 100));
    }
  }

  function syncSelectedCameraFromStream(mediaStream: MediaStream) {
    const track = mediaStream.getVideoTracks()[0];
    const settings = track?.getSettings();
    const selectedDeviceId = settings?.deviceId ?? preferencesRef.current.cameraDeviceId ?? null;
    const selectedLabel = track?.label || cameraDevices.find((device) => device.deviceId === selectedDeviceId)?.label || null;

    setRuntimeDiagnostics((current) => ({
      ...current,
      selectedCameraLabel: selectedLabel,
      selectedCameraDeviceId: selectedDeviceId,
    }));
  }

  function buildVideoConstraints(cameraDeviceId?: string, preferUserFacing = true): MediaTrackConstraints {
    const base: MediaTrackConstraints = {
      width: { ideal: 1280 },
      height: { ideal: 720 },
    };

    if (cameraDeviceId) {
      return { ...base, deviceId: { exact: cameraDeviceId } };
    }

    return preferUserFacing ? { ...base, facingMode: "user" } : base;
  }

  function shouldRetryWithDefaultCamera(error: unknown) {
    const errorName = error instanceof DOMException ? error.name : "";
    return [
      "OverconstrainedError",
      "ConstraintNotSatisfiedError",
      "NotFoundError",
      "DevicesNotFoundError",
    ].includes(errorName);
  }

  function getUnsupportedCameraApiMessage() {
    return languageRef.current === "vi"
      ? "Trinh duyet hien tai khong ho tro Camera API. Hay mo bang Chrome/Edge hoac chay app Electron de cap quyen camera."
      : "Camera API is not available in this browser. Open the app in Chrome/Edge or run the Electron app to grant camera access.";
  }

  function getMonitoringStartErrorMessage(error: unknown) {
    if (error instanceof DOMException) {
      if (error.name === "NotAllowedError" || error.name === "SecurityError") {
        return languageRef.current === "vi"
          ? "Quyen camera dang bi chan. Hay cho phep camera cho trang nay roi bam Start lai."
          : "Camera permission is blocked. Allow camera access for this site, then press Start again.";
      }

      if (error.name === "NotReadableError" || error.name === "TrackStartError") {
        return languageRef.current === "vi"
          ? "Camera dang duoc ung dung khac su dung hoac he dieu hanh khong cho mo camera."
          : "The camera is already in use by another app, or the OS could not start it.";
      }

      if (shouldRetryWithDefaultCamera(error)) {
        return languageRef.current === "vi"
          ? "Khong tim thay camera phu hop. Hay kiem tra camera hoac chon lai camera trong Settings."
          : "No compatible camera was found. Check the camera or pick another one in Settings.";
      }
    }

    return error instanceof Error ? error.message : "Unable to start monitoring";
  }

  function clearMissingCameraPreference() {
    setPreferences((current) => {
      const next = { ...current, cameraDeviceId: undefined };
      preferencesRef.current = next;
      return next;
    });
  }

  async function requestMonitoringStream() {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error(getUnsupportedCameraApiMessage());
    }

    const getDefaultStream = async () => {
      try {
        return await navigator.mediaDevices.getUserMedia({
          video: buildVideoConstraints(undefined, true),
          audio: false,
        });
      } catch (error) {
        if (!shouldRetryWithDefaultCamera(error)) {
          throw error;
        }

        return navigator.mediaDevices.getUserMedia({
          video: buildVideoConstraints(undefined, false),
          audio: false,
        });
      }
    };

    const selectedDeviceId = preferencesRef.current.cameraDeviceId;
    if (!selectedDeviceId) {
      return getDefaultStream();
    }

    try {
      return await navigator.mediaDevices.getUserMedia({
        video: buildVideoConstraints(selectedDeviceId),
        audio: false,
      });
    } catch (error) {
      if (!shouldRetryWithDefaultCamera(error)) {
        throw error;
      }

      clearMissingCameraPreference();
      return getDefaultStream();
    }
  }

  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  useEffect(() => {
    monitoringStatusRef.current = monitoringStatus;
  }, [monitoringStatus]);

  useEffect(() => {
    postureStateRef.current = postureState;
  }, [postureState]);

  useEffect(() => {
    effectiveTaskRef.current = effectiveTaskState;
  }, [effectiveTaskState]);

  useEffect(() => {
    preferencesRef.current = preferences;
    saveRuntimePreferences(preferences);
  }, [preferences]);

  useEffect(() => {
    taskOverrideRef.current = taskOverride;
  }, [taskOverride]);

  useEffect(() => {
    void refreshCameraDevices().catch(() => {
      setCameraDevices([]);
    });
  }, [preferences.cameraDeviceId]);

  useEffect(() => {
    const active = monitoringStatus !== "idle" && monitoringStatus !== "error";
    window.desktopShell?.window.setMonitoringActive(active);

    return () => window.desktopShell?.window.setMonitoringActive(false);
  }, [monitoringStatus]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      await cleanupRuntimeData();
      const [snapshot, activities] = await Promise.all([
        loadRuntimeSnapshot(),
        loadRecoveryActivities(),
      ]);
      if (cancelled) return;
      const now = Date.now();
      const {
        demoSnapshot,
        shouldUseDemoHistory,
      } = getDisplayHistorySnapshot(snapshot, now);

      setHistory(snapshot);
      setDemoHistory(shouldUseDemoHistory ? demoSnapshot : null);
      setFeedbackHistory(snapshot.recentEvents);
      setRecoveryActivities(activities);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    streamRef.current = stream;
  }, [stream]);

  useEffect(() => {
    if (!captureVideoRef.current) return;

    captureVideoRef.current.srcObject = stream;
    if (stream) {
      void captureVideoRef.current.play().catch(() => {
        // Browser or OS permission issues are surfaced through startMonitoring.
      });
    }
  }, [stream]);

  useEffect(() => {
    if (!window.desktopShell) return;

    return window.desktopShell.tray.onAction((action) => {
      if (action.type === "overlay-snooze") {
        overlaySnoozedUntilRef.current = action.until;
        activeOverlayRef.current = false;
        appendEvent({
          kind: "overlay-snooze",
          detail: "Level 4 overlay snoozed for 60 seconds.",
          timestamp: Date.now(),
        });
      }

      if (action.type === "overlay-open-dashboard") {
        activeOverlayRef.current = false;
      }

      if (action.type === "quit") {
        void (async () => {
          await stopMonitoringRef.current();
          window.desktopShell?.window.notifyQuitReady();
        })();
      }
    });
  }, []);

  async function initializeWorker() {
    if (workerReadyRef.current) return;
    if (workerInitPromiseRef.current) return workerInitPromiseRef.current;

    workerRef.current = new Worker(new URL("./pose-worker.ts", import.meta.url), {
      type: "module",
    });

    workerRef.current.onmessage = (event: MessageEvent<PoseWorkerResult>) => {
      switch (event.data.type) {
        case "READY":
          workerReadyRef.current = true;
          setRuntimeDiagnostics((current) => ({
            ...current,
            workerReady: true,
            lastWorkerError: null,
          }));
          workerInitResolveRef.current?.();
          workerInitResolveRef.current = null;
          workerInitRejectRef.current = null;
          break;
        case "FRAME_RESULT":
          {
            const { timestamp, metricAvailability, observationMode, cameraView } = event.data.payload;
            frameInFlightRef.current = false;
            if (shouldIgnoreWorkerResult()) break;
            setRuntimeDiagnostics((current) => ({
              ...current,
              framesProcessed: current.framesProcessed + 1,
              validFrames: current.validFrames + 1,
              lastTrackingLostReason: null,
              metricAvailability,
              observationMode,
              cameraView,
            }));
            handleFrameResult(event.data.payload);
          }
          break;
        case "TRACKING_LOST":
          {
            const { timestamp, reason } = event.data.payload;
            frameInFlightRef.current = false;
            if (shouldIgnoreWorkerResult()) break;
            setRuntimeDiagnostics((current) => ({
              ...current,
              framesProcessed: current.framesProcessed + 1,
              trackingLostFrames: current.trackingLostFrames + 1,
              lastTrackingLostReason: reason,
            }));
            handleTrackingLoss(timestamp, reason);
          }
          break;
        case "ERROR":
          handleWorkerFailure(event.data.payload.code, event.data.payload.message);
          break;
      }
    };

    workerRef.current.onerror = (event) => {
      handleWorkerFailure("worker-crashed", event.message || "Pose worker crashed while loading MediaPipe.");
    };

    workerRef.current.onmessageerror = () => {
      handleWorkerFailure("message-error", "Pose worker returned an unreadable message.");
    };

    workerInitPromiseRef.current = new Promise<void>((resolve, reject) => {
      workerInitResolveRef.current = resolve;
      workerInitRejectRef.current = reject;
    });

    workerRef.current.postMessage({
      type: "INIT",
      payload: {
        wasmRoot: resolveAppAsset("mediapipe/wasm"),
        poseModelAssetPath: resolveAppAsset("models/pose_landmarker_lite.task"),
        holisticModelAssetPath: resolveAppAsset("models/holistic_landmarker.task"),
      },
    });

    return workerInitPromiseRef.current;
  }

  function appendEvent(event: Omit<PostureEventRecord, "sessionId" | "dayKey" | "timestamp"> & { timestamp?: number }) {
    const session = sessionRef.current;
    if (!session) return;

    const timestamp = event.timestamp ?? Date.now();
    const record: PostureEventRecord = {
      ...event,
      timestamp,
      sessionId: session.id,
      dayKey: getDayKey(timestamp),
    };

    eventBufferRef.current.push(record);
    if (record.kind !== "session-start" && record.kind !== "session-stop") {
      setFeedbackHistory((current) => [record, ...current].slice(0, 12));
    }
  }

  function refreshLiveSummary() {
    if (!sessionRef.current) {
      setLiveSessionSummary(null);
      return;
    }

    const tempSession = buildSessionRecord(sessionRef.current, Date.now());
    const liveSummary = buildDailySummary(sessionRef.current.dayKey, [tempSession], sampleBufferRef.current);
    setSessionScore(tempSession.score);
    setLiveSessionSummary(liveSummary);
  }

  function maybeRefreshLiveSummary(timestamp: number) {
    if (timestamp - lastSnapshotAtRef.current >= 1000) {
      lastSnapshotAtRef.current = timestamp;
      refreshLiveSummary();
    }
  }

  function hideOverlay() {
    if (!activeOverlayRef.current) return;
    window.desktopShell?.overlay.hide();
    activeOverlayRef.current = false;
  }

  function resetContinuousRuntimeTimers() {
    currentIssueEpisodeRef.current = null;
    goodRecoveryStartedAtRef.current = null;
    distanceWarningStartedAtRef.current = null;
    distanceWarningStatusRef.current = null;
    distanceWarningClearedAtRef.current = null;
    distanceCueActiveRef.current = false;
    setCooldownRemainingMs(0);
  }

  async function finalizeSession(endedAt: number, reason: StopMonitoringOptions["finalizeReason"] = "user-stop") {
    const session = sessionRef.current;
    if (!session) return;

    appendEvent({
      kind: "session-stop",
      detail: reason === "worker-error" ? "Session stopped after pose worker error." : "Session stopped.",
      timestamp: endedAt,
    });
    refreshLiveSummary();

    if (!preferencesRef.current.localProcessing) return;

    const sessionRecord = buildSessionRecord(session, endedAt);
    const samples = [...sampleBufferRef.current];
    const events = [...eventBufferRef.current];
    await persistRuntimeSession(sessionRecord, samples, events);
    const [snapshot, activities] = await Promise.all([
      loadRuntimeSnapshot(),
      loadRecoveryActivities(),
    ]);
    const now = Date.now();
    const {
      demoSnapshot,
      shouldUseDemoHistory,
    } = getDisplayHistorySnapshot(snapshot, now);
    startTransition(() => {
      setHistory(snapshot);
      setDemoHistory(shouldUseDemoHistory ? demoSnapshot : null);
      setFeedbackHistory(snapshot.recentEvents);
      setRecoveryActivities(activities);
    });
  }

  function resetRuntimeStateAfterStop(finalStatus: Extract<MonitoringStatus, "idle" | "error">) {
    sessionRef.current = null;
    sampleBufferRef.current = [];
    eventBufferRef.current = [];
    calibrationRef.current = null;
    baselineRef.current = null;
    thresholdsRef.current = null;
    smoothedMetricsRef.current = null;
    smoothedDistanceEstimateCmRef.current = null;
    lastFrameTimestampRef.current = null;
    lastValidTimestampRef.current = null;
    lastSampleTimestampRef.current = 0;
    retryValidStartedAtRef.current = null;
    calibrationRetryCountRef.current = 0;
    observationWindowRef.current = [];
    variabilityWindowRef.current = [];
    taskInferenceStateRef.current = createTaskInferenceState();
    exposureStateRef.current = createExposureEngineState();
    previousPostureStateRef.current = "good";
    pendingRewardRef.current = false;
    pendingRewardIssueRef.current = null;
    resetContinuousRuntimeTimers();
    setStream(null);
    setLiveMetrics(null);
    setLiveLandmarks(null);
    setCurrentIssue(null);
    setCurrentCue(null);
    setLiveSessionSummary(null);
    setPostureState("good");
    setDistanceStatus("ok");
    setDistanceMode("suppressed-task");
    setDistanceSuppressionReason("non-screen-task");
    setCalibrationProgress(0);
    setSessionScore(0);
    liveScoreRef.current = null;
    setLiveScore(100);
    setLiveScoreReliable(false);
    setDetectedTask("unknown");
    effectiveTaskRef.current = "unknown";
    setEffectiveTaskState("unknown");
    setTaskConfidence(0);
    taskOverrideRef.current = "auto";
    setTaskOverrideState("auto");
    autoResumeStateRef.current = createAutoResumeState();
    setTrackingReliability("minimal");
    setInstantLoadState("neutral");
    setExposureLevel("low");
    setStaticHoldSeconds(0);
    setRecoveryCount(0);
    setLoadSource(null);
    setRuntimeDiagnostics((current) => ({
      ...current,
      observationMode: null,
      cameraView: "unknown",
    }));
    monitoringStatusRef.current = finalStatus;
    setMonitoringStatus(finalStatus);
  }

  function rolloverSessionIfNeeded(timestamp: number) {
    const session = sessionRef.current;
    if (!session) return;

    const nextDayKey = getDayKey(timestamp);
    if (session.dayKey === nextDayKey) return;

    void finalizeSession(timestamp, "user-stop").catch((error) => {
      const message = error instanceof Error ? error.message : "Unable to persist the previous day session.";
      setRuntimeError(message);
    });
    sessionRef.current = createSessionAccumulator(preferencesRef.current, timestamp);
    sampleBufferRef.current = [];
    eventBufferRef.current = [];
    lastSampleTimestampRef.current = 0;
    lastFrameTimestampRef.current = timestamp;
    lastValidTimestampRef.current = null;
    lastSnapshotAtRef.current = timestamp;
    previousPostureStateRef.current = "good";
    observationWindowRef.current = [];
    variabilityWindowRef.current = [];
    taskInferenceStateRef.current = createTaskInferenceState(timestamp);
    exposureStateRef.current = createExposureEngineState();
    resetContinuousRuntimeTimers();
    appendEvent({ kind: "session-start", timestamp });
  }

  function showOverlay(level: FeedbackLevel, issue: IssueFamily, title: string, detail: string) {
    if (level !== 4 || Date.now() < overlaySnoozedUntilRef.current) return;
    window.desktopShell?.overlay.show({
      title,
      detail,
      issueLabel: issue,
      levelLabel: getLevelLabel(languageRef.current, level),
    });
    activeOverlayRef.current = true;
  }

  function resolveEffectiveTaskForFrame(timestamp: number, detectedTaskForFrame: TaskState, confidence: number) {
    const override = taskOverrideRef.current;
    if (override !== "auto") {
      autoResumeStateRef.current = createAutoResumeState(override);
      return override;
    }

    const autoResumeState = autoResumeStateRef.current;
    if (!autoResumeState.pending) {
      return detectedTaskForFrame;
    }

    // Latch pendingStartedAt to the first frame timestamp after entering pending.
    const pendingStartedAt = autoResumeState.pendingStartedAt ?? timestamp;
    if (autoResumeState.pendingStartedAt === null) {
      autoResumeStateRef.current = { ...autoResumeState, pendingStartedAt };
    }

    // Safety timeout: if pending lingers for >5 s the inferred task never
    // stabilised, so accept whatever is detected now to unblock the state machine.
    if (timestamp - pendingStartedAt >= 5000) {
      autoResumeStateRef.current = createAutoResumeState(detectedTaskForFrame);
      return detectedTaskForFrame;
    }

    if (confidence < 0.6) {
      autoResumeStateRef.current = {
        ...autoResumeState,
        candidateTask: null,
        candidateStartedAt: null,
      };
      return autoResumeState.frozenTask;
    }

    if (autoResumeState.candidateTask !== detectedTaskForFrame) {
      autoResumeStateRef.current = {
        ...autoResumeState,
        candidateTask: detectedTaskForFrame,
        candidateStartedAt: timestamp,
      };
      return autoResumeState.frozenTask;
    }

    if (autoResumeState.candidateStartedAt !== null && timestamp - autoResumeState.candidateStartedAt >= 2000) {
      autoResumeStateRef.current = createAutoResumeState(detectedTaskForFrame);
      return detectedTaskForFrame;
    }

    return autoResumeState.frozenTask;
  }

  function syncLiveScore(snapshot: ExposureSnapshot, frameTrackingReliability: TrackingReliability) {
    if (frameTrackingReliability === "minimal") {
      setLiveScoreReliable(false);
      return;
    }

    const nextScore = computeFrameLiveScore(liveScoreRef.current, snapshot);
    liveScoreRef.current = nextScore;
    setLiveScore(nextScore);
    setLiveScoreReliable(true);
  }

  function triggerCue(level: 2 | 3 | 4, issue: IssueFamily | null, timestamp: number, frameContext: FrameDecisionContext) {
    const copy = getCueCopy(languageRef.current, issue, {
      taskState: frameContext.taskState,
      loadSource: frameContext.loadSource,
    });
    const cue: RuntimeCue = {
      level,
      issue,
      title: copy.title,
      detail: copy.detail,
      createdAt: timestamp,
      kind: "feedback",
      taskState: frameContext.taskState,
      loadSource: frameContext.loadSource,
    };

    setCurrentCue(cue);
    currentIssueEpisodeRef.current = currentIssueEpisodeRef.current
      ? { ...currentIssueEpisodeRef.current, highestLevelTriggered: level }
      : null;
    if (issue) {
      lastFeedbackByIssueRef.current[issue] = timestamp;
    }
    lastAnyFeedbackAtRef.current = timestamp;
    pendingRewardRef.current = true;
    pendingRewardIssueRef.current = issue ?? pendingRewardIssueRef.current;
    sessionRef.current!.interventionCount += 1;

    if (level >= 3) {
      lastLevel3Or4FeedbackAtRef.current = timestamp;
    }

    if (level === 4 && issue) {
      sessionRef.current!.overlayCount += 1;
      showOverlay(level, issue, cue.title, cue.detail);
    }

    appendEvent({
      kind: "feedback",
      issue,
      level,
      detail: cue.detail,
      postureState: frameContext.postureState,
      timestamp,
      taskState: frameContext.taskState,
      loadSource: frameContext.loadSource,
      trackingReliability: frameContext.trackingReliability,
      exposureLevel: frameContext.exposureLevel,
    });

    if (level === 3) {
      recentLevel3Ref.current = [...recentLevel3Ref.current.filter((value) => timestamp - value <= 10 * 60 * 1000), timestamp];
    }

    performCueFeedback(preferencesRef.current.feedbackMode, cue.title, cue.detail, level);
  }

  function triggerBreakReminder(timestamp: number, frameContext: FrameDecisionContext) {
    const cue: RuntimeCue = {
      level: 2,
      issue: null,
      title: languageRef.current === "vi" ? "Đổi vị trí và nghỉ ngắn" : "Change position and take a short reset",
      detail: languageRef.current === "vi"
        ? "Bạn đã ngồi đủ lâu rồi. Hãy đứng dậy, nhìn ra xa và thả cổ, vai, lưng trong vài phút."
        : "You've held focus long enough. Stand up, look away, and unload your neck, shoulders, and back for a few minutes.",
      createdAt: timestamp,
      kind: "break",
      taskState: frameContext.taskState,
      loadSource: "static-hold",
    };

    setCurrentCue(cue);
    sessionRef.current!.breakReminderCount += 1;
    appendEvent({
      kind: "break-reminder",
      detail: cue.detail,
      timestamp,
      taskState: frameContext.taskState,
      trackingReliability: frameContext.trackingReliability,
      exposureLevel: frameContext.exposureLevel,
      loadSource: cue.loadSource,
    });

    performCueFeedback(preferencesRef.current.feedbackMode, cue.title, cue.detail, cue.level);
  }

  function triggerDistanceWarning(
    status: Exclude<DistanceStatus, "ok">,
    timestamp: number,
    frameContext: FrameDecisionContext,
  ) {
    const cue: RuntimeCue = {
      level: 1,
      issue: null,
      title: languageRef.current === "vi"
        ? (status === "too-close" ? "Bạn đang ngồi quá gần màn hình" : "Bạn đang ngồi hơi xa màn hình")
        : (status === "too-close" ? "You're sitting too close to the screen" : "You're sitting a bit far from the screen"),
      detail: languageRef.current === "vi"
        ? "Đây là nhắc nhở riêng cho công việc nhìn màn hình và không làm giảm điểm load."
        : "This is a screen-work distance advisory and does not lower your load score.",
      createdAt: timestamp,
      kind: "distance",
      taskState: frameContext.taskState,
    };

    setCurrentCue(cue);
    distanceCueActiveRef.current = true;
    sessionRef.current!.screenDistanceWarningCount += 1;
    appendEvent({
      kind: "distance-warning",
      detail: cue.detail,
      timestamp,
      taskState: frameContext.taskState,
      trackingReliability: frameContext.trackingReliability,
      exposureLevel: frameContext.exposureLevel,
    });

    performCueFeedback(preferencesRef.current.feedbackMode, cue.title, cue.detail, cue.level);
  }

  function triggerPositiveReward(issue: IssueFamily, timestamp: number, frameContext: FrameDecisionContext) {
    const cue: RuntimeCue = {
      level: 1,
      issue,
      title: languageRef.current === "vi" ? "Tốt lắm!" : "Nice correction!",
      detail: getCueCopy(languageRef.current, issue, {
        taskState: frameContext.taskState,
        loadSource: frameContext.loadSource,
      }).reward,
      createdAt: timestamp,
      kind: "reward",
      taskState: frameContext.taskState,
      loadSource: frameContext.loadSource,
    };

    sessionRef.current!.correctionSuccessCount += 1;
    setCurrentCue(cue);
    appendEvent({
      kind: "correction-success",
      issue,
      detail: cue.detail,
      timestamp,
      postureState: frameContext.postureState,
      taskState: frameContext.taskState,
      trackingReliability: frameContext.trackingReliability,
      exposureLevel: frameContext.exposureLevel,
      loadSource: frameContext.loadSource,
    });

    performCueFeedback(preferencesRef.current.feedbackMode, cue.title, cue.detail, cue.level);
  }

  function appendSample(
    timestamp: number,
    issue: IssueFamily | null,
    metrics: LiveMetrics,
    metricAvailability: MetricAvailability,
    landmarks: PoseSampleRecord["landmarks"],
    framePostureState: PostureState,
    taskState: TaskState,
    frameTrackingReliability: TrackingReliability,
    frameExposureLevel: ExposureLevel,
    frameInstantLoadState: InstantLoadState,
    frameLoadSource: LoadSource | null,
    frameStaticHold: boolean,
    frameRecoveryActive: boolean,
    frameRecoveryCount: number,
  ) {
    const session = sessionRef.current;
    if (!session) return;

    sampleBufferRef.current.push({
      dayKey: getDayKey(timestamp),
      sessionId: session.id,
      timestamp,
      postureState: framePostureState,
      issue,
      deviationRatio: round(metrics.deviationRatio),
      metrics: {
        headForward: round(metrics.headForward),
        torsoLean: round(metrics.torsoLean),
        shoulderTilt: round(metrics.shoulderTilt),
        screenDistanceRatio: round(metrics.screenDistanceRatio),
        deviationRatio: round(metrics.deviationRatio),
      },
      metricAvailability,
      landmarks,
      taskState,
      trackingReliability: frameTrackingReliability,
      exposureLevel: frameExposureLevel,
      instantLoadState: frameInstantLoadState,
      loadSource: frameLoadSource,
      staticHold: frameStaticHold,
      recoveryActive: frameRecoveryActive,
      recoveryCountSnapshot: frameRecoveryCount,
    });
  }

  function updateSessionDurations(
    timestamp: number,
    delta: number,
    issue: IssueFamily | null,
    framePostureState: PostureState,
    deviationRatio: number,
    taskState: TaskState,
    snapshot: ExposureSnapshot,
    frameContext: FrameDecisionContext,
  ) {
    const session = sessionRef.current;
    if (!session || delta <= 0) return;

    session.trackedMs += delta;
    if (framePostureState === "good") session.goodMs += delta;
    if (framePostureState === "warning") session.warningMs += delta;
    if (framePostureState === "bad") session.badMs += delta;
    if (issue) session.issueMs[issue] += delta;
    session.deviationSum += deviationRatio * delta;
    session.deviationSamples += 1;
    session.deviationDurationMs += delta;
    session.taskMs[taskState] += delta;
    if (snapshot.exposureLevel === "moderate") session.moderateExposureMs += delta;
    if (snapshot.exposureLevel === "high" || snapshot.exposureLevel === "critical") session.highExposureMs += delta;
    if (snapshot.staticHold) session.staticHoldMs += delta;
    if (snapshot.recoveryActive) session.recoveryMs += delta;
    session.recoveryCount = Math.max(session.recoveryCount, snapshot.recoveryCount);

    if (framePostureState === "good") {
      session.currentFocusBlockMs += delta;
      session.longestFocusBlockMs = Math.max(session.longestFocusBlockMs, session.currentFocusBlockMs);
    } else {
      session.currentFocusBlockMs = 0;
    }

    if (
      preferencesRef.current.remindersEnabled &&
      session.trackedMs >= session.nextReminderTrackedMs &&
      timestamp - lastLevel3Or4FeedbackAtRef.current > 5 * 60 * 1000
    ) {
      triggerBreakReminder(timestamp, frameContext);
      session.nextReminderTrackedMs += preferencesRef.current.reminderMinutes * 60 * 1000;
    }
  }

  function handleFeedbackFlow(
    timestamp: number,
    issue: IssueFamily | null,
    snapshot: ExposureSnapshot,
    frameContext: FrameDecisionContext,
  ) {
    if (snapshot.recoveryActive) {
      currentIssueEpisodeRef.current = null;
      setCooldownRemainingMs(0);
      return;
    }

    if (snapshot.ratio < 0.8) {
      currentIssueEpisodeRef.current = null;
      setCooldownRemainingMs(0);
      return;
    }

    const episode = currentIssueEpisodeRef.current;
    if (!episode || episode.issue !== issue) {
      currentIssueEpisodeRef.current = {
        issue,
        moderateStartedAt: timestamp,
        highStartedAt: snapshot.ratio >= 1 ? timestamp : null,
        highestLevelTriggered: snapshot.postureState === "good" ? 0 : 1,
      };
    }

    const currentEpisode = currentIssueEpisodeRef.current;
    if (!currentEpisode) {
      return;
    }

    if (snapshot.ratio >= 1) {
      currentEpisode.highStartedAt ??= timestamp;
    } else {
      currentEpisode.highStartedAt = null;
    }

    const lastIssueFeedbackAt = issue ? lastFeedbackByIssueRef.current[issue] : lastAnyFeedbackAtRef.current;
    const cooldown = Math.max(0, 30_000 - (timestamp - lastIssueFeedbackAt));
    setCooldownRemainingMs(cooldown);

    const recentLevel3Count = recentLevel3Ref.current.filter((value) => timestamp - value <= 10 * 60 * 1000).length;
    const desiredLevel = selectFeedbackLevel({
      ratio: snapshot.ratio,
      trackingReliability: frameContext.trackingReliability,
      moderateElapsedMs: timestamp - currentEpisode.moderateStartedAt,
      highElapsedMs: currentEpisode.highStartedAt ? timestamp - currentEpisode.highStartedAt : 0,
      recentLevel3Count,
    });

    if (desiredLevel && canTriggerFeedbackLevel(desiredLevel, currentEpisode.highestLevelTriggered, cooldown)) {
      triggerCue(desiredLevel, issue, timestamp, frameContext);
    }
  }

  function maybeHandleRecovery(
    timestamp: number,
    issue: IssueFamily | null,
    snapshot: ExposureSnapshot,
    frameContext: FrameDecisionContext,
  ) {
    const rewardIssue = pendingRewardIssueRef.current ?? issue;
    if (!pendingRewardRef.current || !rewardIssue) return;
    if (!snapshot.recoveryActive) {
      return;
    }

    pendingRewardRef.current = false;
    pendingRewardIssueRef.current = null;
    if (preferencesRef.current.microCelebrations && timestamp - lastRewardAtRef.current >= 60_000) {
      lastRewardAtRef.current = timestamp;
      triggerPositiveReward(rewardIssue, timestamp, frameContext);
    }
    hideOverlay();
  }

  function handleDistanceFlow(
    timestamp: number,
    ratio: number,
    frameContext: FrameDecisionContext,
    exposureProfile: ExposureProfile,
  ) {
    const baseline = baselineRef.current;
    if (!baseline) return;

    const flowState = getDistanceFlowState(frameContext.taskState, exposureProfile, frameContext.trackingReliability, {
      estimatedDistanceCm: frameContext.distanceEstimateCm,
      confidence: frameContext.distanceEstimateConfidence,
      source: frameContext.distanceEstimateSource,
      faceConfidence: frameContext.faceConfidence,
    });
    setDistanceMode(flowState.mode);

    if (flowState.mode === "suppressed-task" || flowState.mode === "suppressed-reliability") {
      distanceWarningStartedAtRef.current = null;
      distanceWarningStatusRef.current = null;
      distanceWarningClearedAtRef.current = null;
      setDistanceStatus("ok");
      setDistanceSuppressionReason(flowState.suppressionReason);
      if (distanceCueActiveRef.current) {
        distanceCueActiveRef.current = false;
        setCurrentCue(null);
      }
      return;
    }

    const sideViewFarSignalUnreliable =
      frameContext.cameraView !== "frontal" &&
      ratio < baseline.screenDistanceRatio * 0.8 &&
      !(frameContext.distanceEstimateSource === "face-mesh" && frameContext.distanceEstimateConfidence >= 0.9);
    const nextStatus = getDistanceStatus(baseline, ratio, flowState.mode, frameContext.distanceEstimateCm, {
      cameraView: frameContext.cameraView,
      distanceEstimateConfidence: frameContext.distanceEstimateConfidence,
      distanceEstimateSource: frameContext.distanceEstimateSource,
    });
    setDistanceSuppressionReason(
      nextStatus === "ok" && sideViewFarSignalUnreliable ? "side-view-distance-unreliable" : flowState.suppressionReason,
    );
    setDistanceStatus(nextStatus);
    if (nextStatus === "ok") {
      if (!distanceWarningClearedAtRef.current) {
        distanceWarningClearedAtRef.current = timestamp;
      }
      // After 2 s of stable "ok", dismiss the active distance cue so the user
      // gets immediate visual confirmation that their correction was registered.
      if (distanceCueActiveRef.current && timestamp - distanceWarningClearedAtRef.current >= 2000) {
        distanceCueActiveRef.current = false;
        setCurrentCue(null);
      }
      // After 5 s, also reset the dwell timer so a future warning can re-arm.
      if (timestamp - distanceWarningClearedAtRef.current >= 5000) {
        distanceWarningStartedAtRef.current = null;
        distanceWarningStatusRef.current = null;
        distanceWarningClearedAtRef.current = null;
      }
      return;
    }
    distanceWarningClearedAtRef.current = null;

    if (!distanceWarningStartedAtRef.current || distanceWarningStatusRef.current !== nextStatus) {
      distanceWarningStartedAtRef.current = timestamp;
      distanceWarningStatusRef.current = nextStatus;
      return;
    }

    if (timestamp - distanceWarningStartedAtRef.current >= flowState.dwellMs && timestamp - lastDistanceWarningAtRef.current >= 30_000) {
      lastDistanceWarningAtRef.current = timestamp;
      triggerDistanceWarning(nextStatus, timestamp, frameContext);
    }
  }

  function enterCalibrationRetry(timestamp: number, reason: CalibrationRetryReason) {
    calibrationRetryCountRef.current += 1;

    // After 3 consecutive failed calibrations escalate to a hard error rather
    // than looping forever, which would drain the CPU and confuse users.
    if (calibrationRetryCountRef.current > 3) {
      calibrationRef.current = null;
      retryValidStartedAtRef.current = null;
      lastFrameTimestampRef.current = null;
      monitoringStatusRef.current = "error";
      setMonitoringStatus("error");
      setCurrentCue({
        level: 1,
        issue: null,
        title: languageRef.current === "vi" ? "Không thể hiệu chỉnh" : "Calibration failed",
        detail: languageRef.current === "vi"
          ? "Hãy thử điều chỉnh góc camera hoặc ánh sáng, rồi bắt đầu lại."
          : "Adjust your camera angle or lighting, then restart monitoring.",
        createdAt: timestamp,
        kind: "error",
      });
      return;
    }

    calibrationRef.current = null;
    retryValidStartedAtRef.current = null;
    lastFrameTimestampRef.current = null;
    monitoringStatusRef.current = "calibration-retry";
    setMonitoringStatus("calibration-retry");
    setCurrentCue({
      level: 1,
      issue: null,
      title: reason === "bad-baseline" || reason === "unstable-baseline"
        ? languageRef.current === "vi" ? "Calibration cần tư thế trung tính" : "Calibration needs a neutral posture"
        : languageRef.current === "vi" ? "Calibration chưa đủ landmark" : "Calibration needs clearer landmarks",
      detail: getCalibrationRetryDetail(languageRef.current, preferencesRef.current.landmarkPolicy, reason),
      createdAt: timestamp,
      kind: "error",
    });
  }

  function handleTrackingLoss(timestamp: number, reason: TrackingLostReason) {
    rolloverSessionIfNeeded(timestamp);

    const session = sessionRef.current;
    if (!session) return;

    const previousFrameTimestamp = lastFrameTimestampRef.current;
    const delta = safeFrameDelta(previousFrameTimestamp, timestamp);
    lastFrameTimestampRef.current = timestamp;

    const calibration = calibrationRef.current;
    if (calibration) {
      const elapsed = timestamp - calibration.startedAt;
      setCalibrationProgress(clamp(elapsed / CALIBRATION_DURATION_MS, 0, 1));
      setRuntimeDiagnostics((current) => ({
        ...current,
        calibrationElapsedMs: elapsed,
        calibrationValidMs: calibration.validMs,
        lastTrackingLostReason: reason,
      }));

      if (elapsed > CALIBRATION_RETRY_TIMEOUT_MS && calibration.validMs < CALIBRATION_REQUIRED_VALID_MS) {
        enterCalibrationRetry(timestamp, reason);
      }

      return;
    }

    if (monitoringStatusRef.current === "calibration-retry") {
      retryValidStartedAtRef.current = null;
      setRuntimeDiagnostics((current) => ({
        ...current,
        lastTrackingLostReason: reason,
      }));
      return;
    }

    if (!lastValidTimestampRef.current || timestamp - lastValidTimestampRef.current > 1500) {
      session.analyzingMs += delta;
      monitoringStatusRef.current = "analyzing";
      setMonitoringStatus("analyzing");
      setCurrentIssue(null);
      setTrackingReliability("minimal");
      setLiveScoreReliable(false);
      setDistanceStatus("ok");
      setDistanceMode("suppressed-reliability");
      setDistanceSuppressionReason("minimal-reliability");
      resetContinuousRuntimeTimers();
      hideOverlay();
      maybeRefreshLiveSummary(timestamp);
    }
  }

  function handleFrameResult(observation: FrameObservation) {
    const {
      timestamp,
      metrics: rawMetrics,
      metricAvailability: frameMetricAvailability,
      landmarks,
      contextFeatures = EMPTY_CONTEXT_FEATURES,
      trackingReliability: observedTrackingReliability,
      observationMode: observedMode,
    } = observation;
    const observationMode = observedMode ?? "pose-fallback";
    const nextTrackingReliability = observedTrackingReliability ?? (
      observation.subsystemConfidence.torso >= 0.8 && observation.subsystemConfidence.hands >= 0.55
        ? "full"
        : observation.subsystemConfidence.torso >= 0.6 || observation.subsystemConfidence.hands >= 0.35
          ? "partial"
          : "minimal"
    );
    rolloverSessionIfNeeded(timestamp);

    const session = sessionRef.current;
    if (!session) return;

    lastValidTimestampRef.current = timestamp;

    if (monitoringStatusRef.current === "calibration-retry") {
      if (!retryValidStartedAtRef.current) {
        retryValidStartedAtRef.current = timestamp;
        setCurrentCue({
          level: 1,
          issue: null,
          title: languageRef.current === "vi" ? "Landmark đang ổn định lại" : "Landmarks are stabilizing",
          detail: getCalibrationRetryDetail(languageRef.current, preferencesRef.current.landmarkPolicy, null),
          createdAt: timestamp,
          kind: "error",
        });
        return;
      }

      if (timestamp - retryValidStartedAtRef.current < CALIBRATION_RETRY_STABLE_MS) {
        return;
      }

      retryValidStartedAtRef.current = null;
      calibrationRef.current = createCalibrationAccumulator(timestamp);
      lastFrameTimestampRef.current = timestamp;
      setCalibrationProgress(0);
      monitoringStatusRef.current = "calibrating";
      setMonitoringStatus("calibrating");
      setCurrentCue(null);
      // Return here so the first calibration frame is processed on the NEXT call
      // with a proper non-zero deltaMs rather than falling through with delta = 0.
      return;
    }

    if (monitoringStatusRef.current === "calibrating" || calibrationRef.current) {
      if (!calibrationRef.current) {
        calibrationRef.current = createCalibrationAccumulator(timestamp);
        lastFrameTimestampRef.current = timestamp;
        setCalibrationProgress(0);
      }

      const calibration = calibrationRef.current;
      if (!calibration) return;

      const delta = safeFrameDelta(lastFrameTimestampRef.current, timestamp);
      lastFrameTimestampRef.current = timestamp;
      calibration.validMs += delta;
      calibration.headForward.push(rawMetrics.headForward);
      calibration.shoulderTilt.push(rawMetrics.shoulderTilt);
      calibration.screenDistanceRatio.push(rawMetrics.screenDistanceRatio);
      if (observation.distanceEstimate?.world3DInterocularCm != null) {
        calibration.world3DInterocularCm.push(observation.distanceEstimate.world3DInterocularCm);
      }
      if (frameMetricAvailability.torsoLean) {
        calibration.torsoValidMs += delta;
        calibration.torsoLean.push(rawMetrics.torsoLean);
      }
      const elapsed = timestamp - calibration.startedAt;
      setCalibrationProgress(clamp(elapsed / CALIBRATION_DURATION_MS, 0, 1));
      setRuntimeDiagnostics((current) => ({
        ...current,
        calibrationElapsedMs: elapsed,
        calibrationValidMs: calibration.validMs,
        observationMode,
        cameraView: observation.cameraView,
      }));

      const strictTorsoReady = preferencesRef.current.landmarkPolicy !== "strict" || calibration.torsoValidMs >= CALIBRATION_STRICT_TORSO_REQUIRED_MS;
      if (elapsed >= CALIBRATION_DURATION_MS && calibration.validMs >= CALIBRATION_REQUIRED_VALID_MS && strictTorsoReady) {
        const measuredBaseline = buildCalibrationBaseline(calibration);
        const metricAvailability = buildCalibrationMetricAvailability(calibration, preferencesRef.current.landmarkPolicy);
        const qualityIssue = getCalibrationQualityIssue(measuredBaseline, calibration, metricAvailability);
        if (qualityIssue) {
          enterCalibrationRetry(timestamp, qualityIssue);
          return;
        }
        const baseline = constrainStartupBaseline(measuredBaseline, metricAvailability);
        calibrationRetryCountRef.current = 0;
        baselineRef.current = baseline;
        thresholdsRef.current = buildThresholds(baseline, preferencesRef.current.sensitivity, metricAvailability);
        calibrationRef.current = null;
        smoothedMetricsRef.current = {
          ...rawMetrics,
          torsoLean: metricAvailability.torsoLean ? rawMetrics.torsoLean : baseline.torsoLean,
          deviationRatio: 0,
        };
        // Initialise the smoothed distance from the calibration median (baked into
        // baseline.screenDistanceCm) rather than the last raw frame's span, which
        // can be momentarily noisy and produce a wrong initial value.
        smoothedDistanceEstimateCmRef.current = baseline.screenDistanceCm ?? null;
        setCalibrationProgress(1);
        setRuntimeDiagnostics((current) => ({
          ...current,
          calibrationElapsedMs: elapsed,
          calibrationValidMs: calibration.validMs,
          lastTrackingLostReason: null,
          metricAvailability,
          observationMode,
          cameraView: observation.cameraView,
        }));
        monitoringStatusRef.current = "tracking";
        setMonitoringStatus("tracking");
      } else if (
        elapsed > CALIBRATION_RETRY_TIMEOUT_MS &&
        (calibration.validMs < CALIBRATION_REQUIRED_VALID_MS ||
          (preferencesRef.current.landmarkPolicy === "strict" && calibration.torsoValidMs < CALIBRATION_STRICT_TORSO_REQUIRED_MS))
      ) {
        enterCalibrationRetry(timestamp, preferencesRef.current.landmarkPolicy === "strict" ? "low-confidence-hips" : null);
      }

      return;
    }

    const thresholds = thresholdsRef.current;
    if (!thresholds) {
      return;
    }

    setMonitoringStatus((current) => current === "paused" ? current : "tracking");

    const previousMetrics = smoothedMetricsRef.current;
    const effectiveMetricAvailability = combineMetricAvailability(thresholds.metricAvailability, frameMetricAvailability);
    const smoothed: LiveMetrics = {
      headForward: previousMetrics ? previousMetrics.headForward + (rawMetrics.headForward - previousMetrics.headForward) * 0.25 : rawMetrics.headForward,
      torsoLean: effectiveMetricAvailability.torsoLean
        ? previousMetrics
          ? previousMetrics.torsoLean + (rawMetrics.torsoLean - previousMetrics.torsoLean) * 0.25
          : rawMetrics.torsoLean
        : previousMetrics?.torsoLean ?? thresholds.baseline.torsoLean,
      shoulderTilt: previousMetrics ? previousMetrics.shoulderTilt + (rawMetrics.shoulderTilt - previousMetrics.shoulderTilt) * 0.25 : rawMetrics.shoulderTilt,
      screenDistanceRatio: previousMetrics ? previousMetrics.screenDistanceRatio + (rawMetrics.screenDistanceRatio - previousMetrics.screenDistanceRatio) * 0.25 : rawMetrics.screenDistanceRatio,
      deviationRatio: 0,
    };

    const classification = classifyPosture(smoothed, thresholds, effectiveMetricAvailability);
    smoothed.deviationRatio = classification.deviationRatio;
    smoothedMetricsRef.current = smoothed;
    // --- Calibrated distance pipeline ---
    // When a calibratedK constant is available (set at end of calibration), derive the
    // per-frame distance directly from the yaw-corrected screenDistanceRatio that was
    // already smoothed via EMA above.  This completely avoids recomputing from scratch
    // with the wrong-FOV formula on every frame, and benefits from the person-specific
    // interocular baked into K.
    //
    // Fallback (no calibratedK): keep the legacy smoothDistanceEstimate path unchanged.
    const calibratedK = baselineRef.current?.calibratedK;
    let smoothedDistanceCm: number | null;

    if (calibratedK && smoothed.screenDistanceRatio > 0) {
      // distance = K / span; span is already EMA-smoothed at α=0.25 above.
      // Clamp to a physically plausible desk range before EMA so that an extreme
      // head turn (small eye span) cannot pull the smoother toward 300+ cm values
      // and trigger spurious "too-far" warnings.
      const rawDistanceCm = Math.min(150, Math.max(20, calibratedK / smoothed.screenDistanceRatio));
      // α=0.35 gives a faster response than the legacy 0.20; the underlying ratio
      // is already pre-smoothed at α=0.25 so a second heavy pass would over-damp.
      const prev = smoothedDistanceEstimateCmRef.current;
      smoothedDistanceCm = prev !== null
        ? prev + (rawDistanceCm - prev) * 0.35
        : rawDistanceCm;
    } else {
      smoothedDistanceCm = smoothDistanceEstimate(
        smoothedDistanceEstimateCmRef.current,
        observation.distanceEstimate?.centimeters ?? null,
      );
    }
    smoothedDistanceEstimateCmRef.current = smoothedDistanceCm;
    const rawLoad = previewRawLoad(classification.severities);
    observationWindowRef.current = [
      ...observationWindowRef.current.filter((item) => timestamp - item.timestamp <= 4000),
      {
        timestamp,
        contextFeatures,
        landmarks,
        observationMode,
      },
    ];
    taskInferenceStateRef.current = updateTaskInferenceState(taskInferenceStateRef.current, observationWindowRef.current, timestamp);
    const taskInference = buildTaskInference(taskInferenceStateRef.current);
    const effectiveTask = resolveEffectiveTaskForFrame(timestamp, taskInference.detectedTask, taskInference.confidence);
    const taskFeatures = taskInferenceStateRef.current.aggregatedFeatures;
    const exposureProfile = resolveExposureProfile(effectiveTask, taskFeatures, nextTrackingReliability);
    variabilityWindowRef.current = [
      ...variabilityWindowRef.current.filter((item) => timestamp - item.timestamp <= 45_000),
      {
        timestamp,
        metrics: smoothed,
        landmarks,
        rawLoad,
      },
    ];
    const variability = evaluateMovementVariability(variabilityWindowRef.current, timestamp);
    const exposureEvaluation = evaluateExposureFrame(exposureStateRef.current, {
      timestamp,
      deltaMs: safeFrameDelta(lastFrameTimestampRef.current, timestamp),
      metrics: smoothed,
      thresholds,
      metricAvailability: classification.metricAvailability,
      taskState: exposureProfile,
      trackingReliability: nextTrackingReliability,
      variability,
    });
    const frameContext: FrameDecisionContext = {
      postureState: exposureEvaluation.snapshot.postureState,
      cameraView: observation.cameraView,
      trackingReliability: nextTrackingReliability,
      exposureLevel: exposureEvaluation.snapshot.exposureLevel,
      taskState: effectiveTask,
      loadSource: exposureEvaluation.snapshot.loadSource,
      // With calibratedK, the distance value is always valid (derived from the smoothed
      // screenDistanceRatio rather than a raw per-frame estimate), so we only gate on
      // the value being positive rather than requiring a minimum per-frame confidence.
      distanceEstimateCm: smoothedDistanceCm !== null && smoothedDistanceCm > 0 ? smoothedDistanceCm : null,
      // When calibratedK is active, boost confidence to reflect that we are using a
      // session-calibrated constant rather than a noisy per-frame pinhole estimate.
      distanceEstimateConfidence: calibratedK
        ? Math.min(0.92, (observation.distanceEstimate?.confidence ?? 0.42) + 0.25)
        : observation.distanceEstimate?.confidence ?? 0,
      distanceEstimateSource: observation.distanceEstimate?.source ?? null,
      faceConfidence: observation.subsystemConfidence.face ?? 0,
    };
    exposureStateRef.current = exposureEvaluation.state;
    postureStateRef.current = frameContext.postureState;
    effectiveTaskRef.current = frameContext.taskState;
    setLiveMetrics(smoothed);
    setLiveLandmarks(landmarks);
    setDetectedTask(taskInference.detectedTask);
    setEffectiveTaskState(frameContext.taskState);
    setTaskConfidence(taskInference.confidence);
    setTrackingReliability(nextTrackingReliability);
    setInstantLoadState(exposureEvaluation.snapshot.instantLoadState);
    setExposureLevel(exposureEvaluation.snapshot.exposureLevel);
    setStaticHoldSeconds(exposureEvaluation.snapshot.staticHoldSeconds);
    setRecoveryCount(exposureEvaluation.snapshot.recoveryCount);
    setLoadSource(exposureEvaluation.snapshot.loadSource);
    syncLiveScore(exposureEvaluation.snapshot, nextTrackingReliability);
    setRuntimeDiagnostics((current) => ({
      ...current,
      metricAvailability: classification.metricAvailability,
      observationMode,
      cameraView: observation.cameraView,
    }));
    if (previousPostureStateRef.current !== exposureEvaluation.snapshot.postureState) {
      appendEvent({
        kind: "state-change",
        postureState: frameContext.postureState,
        issue: exposureEvaluation.snapshot.currentIssue,
        detail: `Posture changed from ${previousPostureStateRef.current} to ${exposureEvaluation.snapshot.postureState}.`,
        timestamp,
        taskState: frameContext.taskState,
        loadSource: frameContext.loadSource,
        trackingReliability: frameContext.trackingReliability,
        exposureLevel: frameContext.exposureLevel,
      });
      previousPostureStateRef.current = frameContext.postureState;
    }
    setPostureState(frameContext.postureState);
    setCurrentIssue(exposureEvaluation.snapshot.currentIssue);

    const previousFrameTimestamp = lastFrameTimestampRef.current;
    const gapTooLarge = isFrameGapTooLarge(previousFrameTimestamp, timestamp);
    const delta = safeFrameDelta(previousFrameTimestamp, timestamp);
    lastFrameTimestampRef.current = timestamp;
    if (gapTooLarge) {
      session.currentFocusBlockMs = 0;
      resetContinuousRuntimeTimers();
    }
    updateSessionDurations(
      timestamp,
      delta,
      exposureEvaluation.snapshot.currentIssue,
      frameContext.postureState,
      classification.deviationRatio,
      frameContext.taskState,
      exposureEvaluation.snapshot,
      frameContext,
    );
    handleFeedbackFlow(timestamp, exposureEvaluation.snapshot.currentIssue, exposureEvaluation.snapshot, frameContext);
    maybeHandleRecovery(timestamp, exposureEvaluation.snapshot.currentIssue, exposureEvaluation.snapshot, frameContext);
    handleDistanceFlow(timestamp, smoothed.screenDistanceRatio, frameContext, exposureProfile);

    if (timestamp - lastSampleTimestampRef.current >= 1000) {
      lastSampleTimestampRef.current = timestamp;
      appendSample(
        timestamp,
        exposureEvaluation.snapshot.currentIssue,
        smoothed,
        classification.metricAvailability,
        landmarks,
        frameContext.postureState,
        frameContext.taskState,
        frameContext.trackingReliability,
        frameContext.exposureLevel,
        exposureEvaluation.snapshot.instantLoadState,
        frameContext.loadSource,
        exposureEvaluation.snapshot.staticHold,
        exposureEvaluation.snapshot.recoveryActive,
        exposureEvaluation.snapshot.recoveryCount,
      );
    }

    if (activeOverlayRef.current && exposureEvaluation.snapshot.exposureLevel === "low") {
      if (!goodRecoveryStartedAtRef.current) {
        goodRecoveryStartedAtRef.current = timestamp;
      } else if (timestamp - goodRecoveryStartedAtRef.current >= 5000) {
        hideOverlay();
      }
    }

    maybeRefreshLiveSummary(timestamp);
  }

  function startCaptureLoop() {
    clearCaptureLoop();

    captureLoopRef.current = window.setInterval(async () => {
      const video = captureVideoRef.current;
      if (
        !video ||
        !workerRef.current ||
        !workerReadyRef.current ||
        frameInFlightRef.current ||
        monitoringStatusRef.current === "paused" ||
        video.readyState < 2
      ) {
        return;
      }

      frameInFlightRef.current = true;
      try {
        const bitmap = await createImageBitmap(video);
        workerRef.current?.postMessage(
          {
            type: "PROCESS_FRAME",
            payload: {
              bitmap,
              // performance.now() is a small monotonically-increasing value required
              // by MediaPipe detectForVideo. Date.now() (Unix epoch ms)
              // overflows MediaPipe's internal timestamp and causes "Packet timestamp mismatch".
              timestamp: performance.now(),
            },
          },
          [bitmap],
        );
      } catch {
        frameInFlightRef.current = false;
      }
    }, 1000 / TARGET_CAPTURE_FPS);
  }

  async function startMonitoring() {
    if (monitoringStatus !== "idle" && monitoringStatus !== "error") {
      return;
    }

    if (preferencesRef.current.feedbackMode !== "gentle") {
      unlockAudioFeedback();
    }

    setRuntimeError(null);
    setCalibrationProgress(0);
    setRuntimeDiagnostics({
      ...createRuntimeDiagnostics(preferencesRef.current),
      workerReady: workerReadyRef.current,
      selectedCameraLabel: runtimeDiagnostics.selectedCameraLabel,
      selectedCameraDeviceId: preferencesRef.current.cameraDeviceId ?? null,
    });
    setMonitoringStatus("initializing");

    try {
      await initializeWorker();
      setMonitoringStatus("requesting-permission");

      const mediaStream = await requestMonitoringStream();
      syncSelectedCameraFromStream(mediaStream);
      void refreshCameraDevices().catch(() => {});

      sessionRef.current = createSessionAccumulator(preferencesRef.current);
      sampleBufferRef.current = [];
      eventBufferRef.current = [];
      calibrationRef.current = createCalibrationAccumulator();
      baselineRef.current = null;
      thresholdsRef.current = null;
      smoothedMetricsRef.current = null;
      smoothedDistanceEstimateCmRef.current = null;
      lastFrameTimestampRef.current = null;
      lastValidTimestampRef.current = null;
      lastSampleTimestampRef.current = 0;
      retryValidStartedAtRef.current = null;
      observationWindowRef.current = [];
      variabilityWindowRef.current = [];
      taskInferenceStateRef.current = createTaskInferenceState();
      exposureStateRef.current = createExposureEngineState();
      currentIssueEpisodeRef.current = null;
      recentLevel3Ref.current = [];
      distanceWarningStartedAtRef.current = null;
      distanceWarningStatusRef.current = null;
      activeOverlayRef.current = false;
      pendingRewardRef.current = false;
      pendingRewardIssueRef.current = null;
      previousPostureStateRef.current = "good";
      taskOverrideRef.current = "auto";
      autoResumeStateRef.current = createAutoResumeState();
      setTaskOverrideState("auto");

      appendEvent({ kind: "session-start", timestamp: Date.now() });
      workerRef.current?.postMessage({
        type: "UPDATE_CONFIG",
        payload: {
          visibilityThreshold: 0.5,
          landmarkPolicy: preferencesRef.current.landmarkPolicy,
        },
      });
      workerRef.current?.postMessage({ type: "START" });
      setStream(mediaStream);
      setPostureState("good");
      setCurrentIssue(null);
      setCurrentCue(null);
      setDistanceStatus("ok");
      setDistanceMode("suppressed-task");
      setDistanceSuppressionReason("non-screen-task");
      setSessionScore(0);
      liveScoreRef.current = null;
      setLiveScore(100);
      setLiveScoreReliable(false);
      setLiveMetrics(null);
      setLiveLandmarks(null);
      setLiveSessionSummary(null);
      setDetectedTask("unknown");
      effectiveTaskRef.current = "unknown";
      setEffectiveTaskState("unknown");
      setTaskConfidence(0);
      setTrackingReliability("minimal");
      setInstantLoadState("neutral");
      setExposureLevel("low");
      setStaticHoldSeconds(0);
      setRecoveryCount(0);
      setLoadSource(null);
      setMonitoringStatus("calibrating");
      startCaptureLoop();
    } catch (error) {
      const message = getMonitoringStartErrorMessage(error);
      setRuntimeError(message);
      setMonitoringStatus("error");
    }
  }

  async function stopMonitoring(options: StopMonitoringOptions = {}) {
    const finalStatus = options.finalStatus ?? "idle";
    const endedAt = Date.now();
    let finalizeError: unknown = null;

    clearCaptureLoop();
    workerRef.current?.postMessage({ type: "STOP" });
    hideOverlay();

    try {
      await finalizeSession(endedAt, options.finalizeReason ?? "user-stop");
    } catch (error) {
      finalizeError = error;
      const message = error instanceof Error ? error.message : "Unable to persist the posture session.";
      setRuntimeError(message);
    }

    try {
      await cleanupRuntimeData();
    } catch (error) {
      finalizeError ??= error;
      const message = error instanceof Error ? error.message : "Unable to clean up posture history.";
      setRuntimeError(message);
    } finally {
      releaseCurrentStream();
      resetRuntimeStateAfterStop(finalStatus);
    }

    if (finalizeError) {
      console.warn("Posture session finalization failed.", finalizeError);
    }
  }

  stopMonitoringRef.current = stopMonitoring;

  function pauseMonitoring() {
    if (monitoringStatusRef.current === "paused" || monitoringStatusRef.current === "idle" || monitoringStatusRef.current === "error") {
      return;
    }

    monitoringStatusBeforePauseRef.current = monitoringStatusRef.current;
    clearCaptureLoop();
    workerRef.current?.postMessage({ type: "STOP" });
    lastFrameTimestampRef.current = null;
    lastValidTimestampRef.current = null;
    resetContinuousRuntimeTimers();
    monitoringStatusRef.current = "paused";
    setMonitoringStatus("paused");
  }

  function resumeMonitoring() {
    if (!stream || monitoringStatusRef.current !== "paused") return;

    if (preferencesRef.current.feedbackMode !== "gentle") {
      unlockAudioFeedback();
    }

    const nextStatus = monitoringStatusBeforePauseRef.current;
    lastFrameTimestampRef.current = null;
    lastValidTimestampRef.current = null;

    if (nextStatus === "calibrating") {
      calibrationRef.current = createCalibrationAccumulator(Date.now());
      setCalibrationProgress(0);
      setRuntimeDiagnostics((current) => ({
        ...current,
        calibrationElapsedMs: 0,
        calibrationValidMs: 0,
        lastTrackingLostReason: null,
        cameraView: "unknown",
      }));
    }

    if (nextStatus === "calibration-retry") {
      retryValidStartedAtRef.current = null;
    }

    workerRef.current?.postMessage({ type: "START" });
    monitoringStatusRef.current = nextStatus;
    setMonitoringStatus(nextStatus);
    startCaptureLoop();
  }

  function setTaskOverride(task: TaskOverride) {
    const previousOverride = taskOverrideRef.current;
    const currentEffectiveTask = effectiveTaskRef.current;
    taskOverrideRef.current = task;

    if (task === "auto") {
      if (previousOverride !== "auto") {
        autoResumeStateRef.current = {
          pending: true,
          frozenTask: currentEffectiveTask,
          candidateTask: null,
          candidateStartedAt: null,
          pendingStartedAt: null, // set to frame timestamp on first call to resolveEffectiveTaskForFrame
        };
        effectiveTaskRef.current = currentEffectiveTask;
        setEffectiveTaskState(currentEffectiveTask);
      }
    } else {
      autoResumeStateRef.current = createAutoResumeState(task);
      effectiveTaskRef.current = task;
      setEffectiveTaskState(task);
    }

    setTaskOverrideState(task);
  }

  function updatePreferences(updates: Partial<RuntimePreferences>) {
    setPreferences((current) => {
      const next = {
        ...current,
        ...updates,
      };
      const landmarkPolicyChanged = updates.landmarkPolicy !== undefined && updates.landmarkPolicy !== current.landmarkPolicy;

      if (updates.feedbackMode === "sound" || updates.feedbackMode === "voice") {
        unlockAudioFeedback();
      }

      preferencesRef.current = next;
      workerRef.current?.postMessage({
        type: "UPDATE_CONFIG",
        payload: {
          visibilityThreshold: 0.5,
          landmarkPolicy: next.landmarkPolicy,
        },
      });

      if (baselineRef.current && !landmarkPolicyChanged) {
        thresholdsRef.current = buildThresholds(
          baselineRef.current,
          next.sensitivity,
          thresholdsRef.current?.metricAvailability ?? DEFAULT_METRIC_AVAILABILITY,
        );
      }

      if (sessionRef.current && updates.reminderMinutes !== undefined) {
        sessionRef.current.nextReminderTrackedMs = sessionRef.current.trackedMs + next.reminderMinutes * 60 * 1000;
      }

      if (sessionRef.current && landmarkPolicyChanged) {
        calibrationRetryCountRef.current = 0;
        calibrationRef.current = createCalibrationAccumulator();
        baselineRef.current = null;
        thresholdsRef.current = null;
        smoothedMetricsRef.current = null;
        smoothedDistanceEstimateCmRef.current = null;
        lastFrameTimestampRef.current = null;
        lastValidTimestampRef.current = null;
        retryValidStartedAtRef.current = null;
        observationWindowRef.current = [];
        variabilityWindowRef.current = [];
        taskInferenceStateRef.current = createTaskInferenceState();
        exposureStateRef.current = createExposureEngineState();
        setCalibrationProgress(0);
        setSessionScore(0);
        setLiveSessionSummary(null);
        setLiveMetrics(null);
        setLiveLandmarks(null);
        setCurrentIssue(null);
        setPostureState("good");
        setDetectedTask("unknown");
        effectiveTaskRef.current = taskOverrideRef.current === "auto" ? "unknown" : taskOverrideRef.current;
        setEffectiveTaskState(taskOverrideRef.current === "auto" ? "unknown" : taskOverrideRef.current);
        setTaskConfidence(0);
        setTrackingReliability("minimal");
        setInstantLoadState("neutral");
        setExposureLevel("low");
        setStaticHoldSeconds(0);
        setRecoveryCount(0);
        setLoadSource(null);
        setDistanceStatus("ok");
        setDistanceMode("suppressed-task");
        setDistanceSuppressionReason("non-screen-task");
        liveScoreRef.current = null;
        setLiveScore(100);
        setLiveScoreReliable(false);
        autoResumeStateRef.current = createAutoResumeState(taskOverrideRef.current === "auto" ? "unknown" : taskOverrideRef.current);
        setRuntimeDiagnostics((diagnostics) => ({
          ...diagnostics,
          calibrationElapsedMs: 0,
          calibrationValidMs: 0,
          lastTrackingLostReason: null,
          metricAvailability: DEFAULT_METRIC_AVAILABILITY,
          observationMode: diagnostics.observationMode,
          cameraView: "unknown",
        }));
        monitoringStatusRef.current = "calibrating";
        setMonitoringStatus("calibrating");
        setCurrentCue({
          level: 1,
          issue: null,
          title: languageRef.current === "vi" ? "Đang hiệu chỉnh lại" : "Recalibrating posture",
          detail: languageRef.current === "vi"
            ? "Bạn vừa đổi chế độ landmark, nên app sẽ đo baseline lại để tránh trộn dữ liệu cũ."
            : "Landmark mode changed, so the app is rebuilding the baseline instead of mixing old data.",
          createdAt: Date.now(),
          kind: "error",
        });
      }

      return next;
    });
  }

  const realMergedTodaySummary = useMemo(() => mergeSummary(history.todaySummary, liveSessionSummary), [history.todaySummary, liveSessionSummary]);
  const realMergedSummaries = useMemo(() => {
    if (!realMergedTodaySummary) return history.summaries;
    const summaries = history.summaries.filter((summary) => summary.dayKey !== realMergedTodaySummary.dayKey);
    return [...summaries, realMergedTodaySummary].sort((a, b) => (a.dayKey > b.dayKey ? 1 : -1));
  }, [history.summaries, realMergedTodaySummary]);
  const liveRuntimeActive = monitoringStatus !== "idle" && monitoringStatus !== "error";
  const usingDemoHistory = !liveRuntimeActive && demoHistory !== null;
  const displayTodaySummary = usingDemoHistory ? demoHistory.todaySummary : realMergedTodaySummary;
  const displaySummaries = usingDemoHistory ? demoHistory.summaries : realMergedSummaries;
  const displayFeedbackHistory = usingDemoHistory ? demoHistory.recentEvents : feedbackHistory;
  const displayRecoveryActivities = useMemo(
    () => usingDemoHistory ? withDemoRecoveryActivities(recoveryActivities) : recoveryActivities,
    [recoveryActivities, usingDemoHistory],
  );

  const achievements = useMemo(() => computeAchievements(displaySummaries), [displaySummaries]);
  const streak = useMemo(() => computeStreak(displaySummaries), [displaySummaries]);
  const identity = useMemo(() => computeIdentity(displaySummaries), [displaySummaries]);

  const cameraMode: CameraMode =
    !stream || monitoringStatus === "idle" || monitoringStatus === "error"
      ? "off"
      : monitoringStatus === "calibrating" ||
          monitoringStatus === "calibration-retry" ||
          monitoringStatus === "initializing" ||
          monitoringStatus === "analyzing"
        ? "analyzing"
        : "on";
  const effectiveTask = effectiveTaskState;

  const value = useMemo<PostureRuntimeValue>(() => ({
    monitoringStatus,
    cameraMode,
    postureState,
    liveMetrics,
    liveLandmarks,
    currentIssue,
    currentCue,
    sessionScore,
    liveScore,
    liveScoreReliable,
    calibrationProgress,
    cooldownRemainingMs,
    distanceStatus,
    distanceMode,
    distanceSuppressionReason,
    detectedTask,
    effectiveTask,
    taskConfidence,
    taskOverride,
    trackingReliability,
    instantLoadState,
    exposureLevel,
    staticHoldSeconds,
    recoveryCount,
    loadSource,
    stream,
    preferences,
    cameraDevices,
    selectedCameraLabel: runtimeDiagnostics.selectedCameraLabel,
    runtimeDiagnostics,
    todaySummary: displayTodaySummary,
    summaries: displaySummaries,
    usingDemoHistory,
    feedbackHistory: displayFeedbackHistory,
    recoveryActivities: displayRecoveryActivities,
    achievements,
    streak,
    identity,
    runtimeError,
    startMonitoring,
    stopMonitoring,
    pauseMonitoring,
    resumeMonitoring,
    setTaskOverride,
    updatePreferences,
    refreshCameraDevices,
    refreshRecoveryActivities,
    recordRecoveryActivity,
  }), [
    achievements,
    calibrationProgress,
    cameraMode,
    cameraDevices,
    cooldownRemainingMs,
    currentCue,
    currentIssue,
    detectedTask,
    distanceMode,
    distanceSuppressionReason,
    distanceStatus,
    effectiveTask,
    exposureLevel,
    displayFeedbackHistory,
    displayRecoveryActivities,
    displaySummaries,
    displayTodaySummary,
    instantLoadState,
    loadSource,
    recoveryCount,
    identity,
    liveMetrics,
    liveLandmarks,
    monitoringStatus,
    postureState,
    preferences,
    runtimeError,
    runtimeDiagnostics,
    liveScore,
    liveScoreReliable,
    sessionScore,
    setTaskOverride,
    staticHoldSeconds,
    stream,
    streak,
    effectiveTaskState,
    taskConfidence,
    taskOverride,
    trackingReliability,
    usingDemoHistory,
  ]);

  return (
    <PostureRuntimeContext.Provider value={value}>
      {children}
      <video ref={captureVideoRef} className="hidden" muted playsInline />
    </PostureRuntimeContext.Provider>
  );
}

export function usePostureRuntime() {
  const context = useContext(PostureRuntimeContext);

  if (!context) {
    throw new Error("usePostureRuntime must be used within PostureRuntimeProvider");
  }

  return context;
}
