import { clamp, getMetricSeverities } from "@/runtime/logic";
import type {
  ExposureLevel,
  ExposureSnapshot,
  InstantLoadState,
  IssueFamily,
  LiveMetrics,
  LoadSource,
  MetricAvailability,
  MetricThresholds,
  TaskState,
  TrackingReliability,
} from "@/runtime/types";
import type { VariabilitySnapshot } from "@/runtime/movement-variability";

export type ExposureProfile = TaskState | "screen-unknown";

const ISSUE_WEIGHTS: Record<IssueFamily, number> = {
  "forward-head": 0.45,
  "torso-lean": 0.35,
  "shoulder-tilt": 0.2,
};

const TASK_ALLOWANCES: Record<ExposureProfile, Record<IssueFamily, number>> = {
  typing: { "forward-head": 0.12, "torso-lean": 0.06, "shoulder-tilt": 0 },
  reading: { "forward-head": 0.2, "torso-lean": 0.1, "shoulder-tilt": 0.03 },
  handwriting: { "forward-head": 0.25, "torso-lean": 0.14, "shoulder-tilt": 0.08 },
  "phone-tablet": { "forward-head": 0.25, "torso-lean": 0.12, "shoulder-tilt": 0.03 },
  "idle-focus": { "forward-head": 0, "torso-lean": 0, "shoulder-tilt": 0 },
  "screen-unknown": { "forward-head": 0.16, "torso-lean": 0.1, "shoulder-tilt": 0.03 },
  unknown: { "forward-head": 0.2, "torso-lean": 0.12, "shoulder-tilt": 0.05 },
};

const HOLD_BUDGET_SECONDS: Record<ExposureProfile, number> = {
  typing: 120,
  reading: 180,
  handwriting: 150,
  "phone-tablet": 90,
  "idle-focus": 60,
  "screen-unknown": 90,
  unknown: 180,
};

const RELIABILITY_WEIGHT: Record<TrackingReliability, number> = {
  full: 1,
  partial: 0.6,
  minimal: 0.25,
};

export interface ExposureEngineState {
  budget: number;
  recoveryCandidateStartedAt: number | null;
  recoveryActive: boolean;
  recoveryCount: number;
  loadBlockActive: boolean;
}

export interface ExposureEvaluation {
  snapshot: ExposureSnapshot;
  state: ExposureEngineState;
  severities: Record<IssueFamily, number>;
}

function weightedLoad(severities: Record<IssueFamily, number>) {
  return clamp(
    Object.entries(severities).reduce((sum, [issue, severity]) => sum + severity * ISSUE_WEIGHTS[issue as IssueFamily], 0),
    0,
    2,
  );
}

export function previewRawLoad(severities: Record<IssueFamily, number>) {
  return weightedLoad(severities);
}

function getDominantIssue(severities: Record<IssueFamily, number>, minimumSeverity = 0) {
  const [issue, severity] = (Object.entries(severities) as Array<[IssueFamily, number]>)
    .sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
  return severity > minimumSeverity ? issue : null;
}

function toExposureLevel(ratio: number): ExposureLevel {
  if (ratio >= 1.4) return "critical";
  if (ratio >= 1) return "high";
  if (ratio >= 0.8) return "moderate";
  return "low";
}

function toInstantPostureState(adjustedLoad: number, instantSeverities: Record<IssueFamily, number>, rawLoad: number): "good" | "warning" | "bad" {
  const maxSeverity = Math.max(...Object.values(instantSeverities));
  if (adjustedLoad >= 0.75 || maxSeverity >= 1) return "bad";
  if (adjustedLoad >= 0.25 || maxSeverity >= 0.35 || rawLoad >= 0.55) return "warning";
  return "good";
}

function applyTaskAllowance(severity: number, allowance: number) {
  const reduced = clamp(severity - allowance, 0, 2);
  if (severity >= 1) return Math.max(reduced, severity * 0.55);
  if (severity >= 0.45) return Math.max(reduced, severity * 0.35);
  return reduced;
}

function toInstantLoadState(rawLoad: number, adjustedLoad: number): InstantLoadState {
  if (adjustedLoad < 0.15) {
    return rawLoad >= 0.25 ? "functional" : "neutral";
  }
  if (adjustedLoad < 0.75) return "elevated";
  return "high";
}

function buildLoadSource(adjustedLoad: number, variability: VariabilitySnapshot): LoadSource | null {
  if (variability.staticHold && adjustedLoad >= 0.2) {
    return "compound";
  }
  if (variability.staticHold) {
    return "static-hold";
  }
  if (adjustedLoad >= 0.15) {
    return "deviation";
  }
  return null;
}

export function createExposureEngineState(): ExposureEngineState {
  return {
    budget: 0,
    recoveryCandidateStartedAt: null,
    recoveryActive: false,
    recoveryCount: 0,
    loadBlockActive: false,
  };
}

export function getHoldBudgetSeconds(task: ExposureProfile) {
  return HOLD_BUDGET_SECONDS[task];
}

export function evaluateExposureFrame(
  state: ExposureEngineState,
  input: {
    timestamp: number;
    deltaMs: number;
    metrics: Omit<LiveMetrics, "deviationRatio">;
    thresholds: MetricThresholds;
    metricAvailability: MetricAvailability;
    taskState: ExposureProfile;
    trackingReliability: TrackingReliability;
    variability: VariabilitySnapshot;
  },
): ExposureEvaluation {
  const rawSeverities = getMetricSeverities(input.metrics, input.thresholds, input.metricAvailability);
  const adjustedSeverities = (Object.entries(rawSeverities) as Array<[IssueFamily, number]>).reduce<Record<IssueFamily, number>>(
    (accumulator, [issue, severity]) => {
      accumulator[issue] = applyTaskAllowance(severity, TASK_ALLOWANCES[input.taskState][issue]);
      return accumulator;
    },
    {
      "forward-head": 0,
      "torso-lean": 0,
      "shoulder-tilt": 0,
    },
  );
  const rawLoad = weightedLoad(rawSeverities);
  const adjustedLoad = weightedLoad(adjustedSeverities);
  const rawIssue = getDominantIssue(rawSeverities, 0.45);
  const adjustedIssue = getDominantIssue(adjustedSeverities, 0.25);
  const instantIssue = adjustedIssue ?? rawIssue;
  const instantPostureState = toInstantPostureState(adjustedLoad, adjustedSeverities, rawLoad);
  const holdBudget = HOLD_BUDGET_SECONDS[input.taskState];
  const reliabilityWeight = RELIABILITY_WEIGHT[input.trackingReliability];
  const staticMultiplier = input.variability.staticHold ? 1.35 : 1;
  const loadContribution = Math.max(adjustedLoad, input.variability.staticHold ? 0.35 : 0);
  const deltaSeconds = Math.max(input.deltaMs, 0) / 1000;
  let budget = state.budget;
  let recoveryCandidateStartedAt = state.recoveryCandidateStartedAt;
  let recoveryActive = state.recoveryActive;
  let recoveryCount = state.recoveryCount;
  let loadBlockActive = state.loadBlockActive || adjustedLoad >= 0.35 || budget / holdBudget >= 0.8;

  if (loadBlockActive && adjustedLoad < 0.3 && input.variability.poseChangeMagnitude >= 0.18 && !input.variability.chaoticMovement) {
    if (!recoveryCandidateStartedAt) {
      recoveryCandidateStartedAt = input.timestamp;
    }

    if (!recoveryActive && recoveryCandidateStartedAt && input.timestamp - recoveryCandidateStartedAt >= 8000) {
      recoveryActive = true;
      recoveryCount += 1;
    }
  } else if (adjustedLoad >= 0.35 || input.variability.chaoticMovement) {
    recoveryCandidateStartedAt = null;
    recoveryActive = false;
  }

  if (deltaSeconds > 0) {
    if (input.variability.staticHold && loadContribution > 0) {
      budget += deltaSeconds * loadContribution * staticMultiplier * reliabilityWeight;
    } else if (recoveryActive && adjustedLoad < 0.3) {
      budget = Math.max(0, budget - deltaSeconds * 0.7 * holdBudget * 0.02);
    } else if (adjustedLoad < 0.3) {
      budget = Math.max(0, budget - deltaSeconds * 0.25);
    } else {
      budget += deltaSeconds * loadContribution * staticMultiplier * reliabilityWeight;
    }
  }

  const ratio = holdBudget > 0 ? budget / holdBudget : 0;
  const exposureLevel = toExposureLevel(ratio);
  if (exposureLevel === "low") {
    loadBlockActive = false;
    recoveryCandidateStartedAt = null;
    // Only clear recoveryActive if it was already true last frame. When it was
    // just activated this frame the caller has not yet seen it, so preserve it
    // for one frame so the reward can fire before it is cleared.
    if (state.recoveryActive) {
      recoveryActive = false;
    }
  }

  return {
    snapshot: {
      adjustedLoad,
      rawLoad,
      budget,
      ratio,
      instantLoadState: toInstantLoadState(rawLoad, adjustedLoad),
      instantPostureState,
      instantIssue,
      instantSeverities: adjustedSeverities,
      rawIssue,
      exposureLevel,
      staticHold: input.variability.staticHold,
      staticHoldSeconds: input.variability.staticHoldSeconds,
      recoveryActive,
      recoveryCount,
      loadSource: buildLoadSource(adjustedLoad, input.variability),
      currentIssue: instantIssue,
      postureState: instantPostureState,
    },
    state: {
      budget,
      recoveryCandidateStartedAt,
      recoveryActive,
      recoveryCount,
      loadBlockActive,
    },
    severities: adjustedSeverities,
  };
}
