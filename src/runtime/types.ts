import type { BodyArea, FeedbackMode } from "@/types/posture";

export type MonitoringStatus =
  | "idle"
  | "requesting-permission"
  | "initializing"
  | "calibrating"
  | "calibration-retry"
  | "tracking"
  | "analyzing"
  | "paused"
  | "error";

export type IssueFamily = "forward-head" | "torso-lean" | "shoulder-tilt";
export type DistanceStatus = "ok" | "too-close" | "too-far";
export type DistanceMode = "active" | "soft" | "suppressed-task" | "suppressed-reliability";
export type DistanceSuppressionReason = "non-screen-task" | "minimal-reliability" | "side-view-distance-unreliable";
export type DistanceEstimateSource = "face-mesh" | "pose-eye-fallback";
export type CameraView = "side" | "frontal" | "unknown";
export type FeedbackLevel = 1 | 2 | 3 | 4;
export type LandmarkPolicy = "relaxed" | "strict";
export type TaskState = "typing" | "reading" | "handwriting" | "phone-tablet" | "idle-focus" | "unknown";
export type TaskOverride = TaskState | "auto";
export type TrackingReliability = "full" | "partial" | "minimal";
export type InstantLoadState = "neutral" | "functional" | "elevated" | "high";
export type ExposureLevel = "low" | "moderate" | "high" | "critical";
export type LoadSource = "deviation" | "static-hold" | "compound";
export type ObservationMode = "holistic" | "pose-fallback";
export type DominantFineMotorHand = "left" | "right" | "both" | "none";
export type TrackingLostReason =
  | "no-pose"
  | "low-confidence-face"
  | "low-confidence-shoulders"
  | "low-confidence-hips"
  | "head-reference-missing";
export type WorkerErrorCode =
  | "not-initialized"
  | "mediapipe-init-failed"
  | "frame-processing-failed"
  | "worker-crashed"
  | "message-error";

export interface RuntimePreferences {
  sensitivity: number;
  feedbackMode: FeedbackMode;
  reminderMinutes: number;
  microCelebrations: boolean;
  localProcessing: boolean;
  remindersEnabled: boolean;
  cameraDeviceId?: string;
  landmarkPolicy: LandmarkPolicy;
}

export interface CameraDeviceInfo {
  deviceId: string;
  label: string;
  isSelected: boolean;
}

export interface RuntimeDiagnostics {
  workerReady: boolean;
  framesProcessed: number;
  validFrames: number;
  trackingLostFrames: number;
  lastTrackingLostReason: TrackingLostReason | null;
  lastWorkerError: {
    code: WorkerErrorCode;
    message: string;
  } | null;
  calibrationElapsedMs: number;
  calibrationValidMs: number;
  selectedCameraLabel: string | null;
  selectedCameraDeviceId: string | null;
  metricAvailability: MetricAvailability;
  observationMode: ObservationMode | null;
  cameraView: CameraView;
}

export interface LiveMetrics {
  headForward: number;
  torsoLean: number;
  shoulderTilt: number;
  screenDistanceRatio: number;
  deviationRatio: number;
}

export interface MetricAvailability {
  headForward: boolean;
  torsoLean: boolean;
  shoulderTilt: boolean;
}

export interface PostureBaseline {
  headForward: number;
  torsoLean: number;
  shoulderTilt: number;
  screenDistanceRatio: number;
  screenDistanceCm?: number;
  calibratedK?: number;
}

export interface MetricThresholds {
  baseline: PostureBaseline;
  warning: LiveMetrics;
  bad: LiveMetrics;
  metricAvailability: MetricAvailability;
}

export interface RuntimeCue {
  level: FeedbackLevel;
  issue: IssueFamily | null;
  title: string;
  detail: string;
  createdAt: number;
  kind: "feedback" | "reward" | "break" | "distance" | "error";
  taskState?: TaskState;
  loadSource?: LoadSource | null;
}

export interface RuntimeAchievement {
  id: "desk-reset-streak" | "shoulder-saver" | "evening-finisher";
  title: string;
  description: string;
  progress: number;
  unlocked: boolean;
  unlockedAt?: number;
}

export interface StoredLandmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

export interface LandmarkSample {
  nose: StoredLandmark | null;
  leftEar: StoredLandmark | null;
  rightEar: StoredLandmark | null;
  leftEye: StoredLandmark | null;
  rightEye: StoredLandmark | null;
  leftShoulder: StoredLandmark | null;
  rightShoulder: StoredLandmark | null;
  leftHip: StoredLandmark | null;
  rightHip: StoredLandmark | null;
  leftElbow?: StoredLandmark | null;
  rightElbow?: StoredLandmark | null;
  leftWrist?: StoredLandmark | null;
  rightWrist?: StoredLandmark | null;
  leftIndex?: StoredLandmark | null;
  rightIndex?: StoredLandmark | null;
}

export interface ObservationConfidence {
  face: number;
  torso: number;
  hands: number;
}

export interface DistanceEstimate {
  centimeters: number;
  confidence: number;
  source: DistanceEstimateSource;
  world3DInterocularCm: number | null;
}

export interface ContextFeatures {
  gazeDown: number;
  deskWork: number;
  handheldDeviceProxy: number;
  bilateralHandActivity: number;
  dominantFineMotorHand: DominantFineMotorHand;
  handElevation: number;
  torsoConfidence: number;
  handConfidence: number;
  occludedHands: boolean;
  occludedTorso: boolean;
}

export interface TaskInference {
  detectedTask: TaskState;
  confidence: number;
  stabilizedAt: number;
}

export interface ExposureSnapshot {
  adjustedLoad: number;
  rawLoad: number;
  budget: number;
  ratio: number;
  instantLoadState: InstantLoadState;
  instantPostureState: "good" | "warning" | "bad";
  instantIssue: IssueFamily | null;
  instantSeverities: Record<IssueFamily, number>;
  rawIssue: IssueFamily | null;
  exposureLevel: ExposureLevel;
  staticHold: boolean;
  staticHoldSeconds: number;
  recoveryActive: boolean;
  recoveryCount: number;
  loadSource: LoadSource | null;
  currentIssue: IssueFamily | null;
  postureState: "good" | "warning" | "bad";
}

export interface PoseSampleRecord {
  id?: number;
  dayKey: string;
  sessionId: string;
  timestamp: number;
  postureState: "good" | "warning" | "bad";
  issue: IssueFamily | null;
  deviationRatio: number;
  metrics: LiveMetrics;
  metricAvailability?: MetricAvailability;
  landmarks: LandmarkSample;
  taskState?: TaskState;
  trackingReliability?: TrackingReliability;
  exposureLevel?: ExposureLevel;
  instantLoadState?: InstantLoadState;
  loadSource?: LoadSource | null;
  staticHold?: boolean;
  recoveryActive?: boolean;
  recoveryCountSnapshot?: number;
}

export interface PostureEventRecord {
  id?: number;
  dayKey: string;
  sessionId: string;
  timestamp: number;
  kind:
    | "session-start"
    | "session-stop"
    | "state-change"
    | "feedback"
    | "break-reminder"
    | "distance-warning"
    | "correction-success"
    | "overlay-snooze";
  postureState?: "good" | "warning" | "bad";
  issue?: IssueFamily | null;
  level?: FeedbackLevel;
  detail?: string;
  taskState?: TaskState;
  trackingReliability?: TrackingReliability;
  exposureLevel?: ExposureLevel;
  loadSource?: LoadSource | null;
}

export type RecoveryActivitySource =
  | "dashboard"
  | "report"
  | "recovery"
  | "break-cue"
  | "distance-advisory";

export interface RecoveryActivityRecord {
  id?: number;
  dayKey: string;
  flowId: string;
  targetArea: BodyArea;
  source: RecoveryActivitySource;
  startedAt: number;
  completedAt: number | null;
  completedSeconds: number;
}

export interface SessionRecord {
  id: string;
  dayKey: string;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  trackedMs: number;
  goodMs: number;
  warningMs: number;
  badMs: number;
  analyzingMs: number;
  issueMs: Record<IssueFamily, number>;
  deviationSum: number;
  deviationSamples: number;
  deviationDurationMs?: number;
  correctionSuccessCount: number;
  interventionCount: number;
  overlayCount: number;
  breakReminderCount: number;
  screenDistanceWarningCount: number;
  longestFocusBlockMs: number;
  score: number;
  lastSessionScore?: number;
  moderateExposureMs?: number;
  highExposureMs?: number;
  staticHoldMs?: number;
  recoveryMs?: number;
  recoveryCount?: number;
  taskMs?: Record<TaskState, number>;
}

export interface HourlyTrendPoint {
  hour: number;
  trackedMs: number;
  postureScore: number;
  focusScore: number;
  state: "good" | "warning" | "bad";
  lowExposureMs?: number;
  moderateExposureMs?: number;
  highExposureMs?: number;
  staticHoldMs?: number;
  recoveryCount?: number;
}

export interface DailySummary {
  dayKey: string;
  sessionsCount: number;
  firstSessionAt: number | null;
  lastSessionAt: number | null;
  trackedMs: number;
  durationMs: number;
  goodMs: number;
  warningMs: number;
  badMs: number;
  analyzingMs: number;
  issueMs: Record<IssueFamily, number>;
  avgDeviation: number;
  score: number;
  lastSessionScore?: number;
  correctionSuccessCount: number;
  interventionCount: number;
  overlayCount: number;
  breakReminderCount: number;
  screenDistanceWarningCount: number;
  longestFocusBlockMs: number;
  bestHour: number | null;
  worstHour: number | null;
  hourlyTrend: HourlyTrendPoint[];
  dominantIssue: IssueFamily | null;
  streakEligible: boolean;
  moderateExposureMs?: number;
  highExposureMs?: number;
  staticHoldMs?: number;
  recoveryMs?: number;
  recoveryCount?: number;
  taskMs?: Record<TaskState, number>;
}

export interface IdentitySnapshot {
  level: string;
  vibe: string;
  specialty: string;
  progressValue: number;
}

export interface RuntimeHistorySnapshot {
  summaries: DailySummary[];
  todaySummary: DailySummary | null;
  recentEvents: PostureEventRecord[];
  achievements: RuntimeAchievement[];
  streak: number;
  identity: IdentitySnapshot;
}

export interface FrameObservation {
  timestamp: number;
  metrics: Omit<LiveMetrics, "deviationRatio">;
  metricAvailability: MetricAvailability;
  landmarks: LandmarkSample;
  contextFeatures: ContextFeatures;
  subsystemConfidence: ObservationConfidence;
  distanceEstimate?: DistanceEstimate | null;
  trackingReliability: TrackingReliability;
  observationMode: ObservationMode;
  cameraView: CameraView;
}

export type FrameMetricsResult = FrameObservation;
