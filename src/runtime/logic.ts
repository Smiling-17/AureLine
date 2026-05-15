import type {
  CameraView,
  DailySummary,
  DistanceEstimateSource,
  HourlyTrendPoint,
  IdentitySnapshot,
  IssueFamily,
  LiveMetrics,
  MetricAvailability,
  MetricThresholds,
  PoseSampleRecord,
  PostureBaseline,
  RuntimeAchievement,
  SessionRecord,
  TaskState,
} from "@/runtime/types";

export const DEFAULT_METRIC_AVAILABILITY: MetricAvailability = {
  headForward: true,
  torsoLean: true,
  shoulderTilt: true,
};

export function createEmptyTaskDurations(): Record<TaskState, number> {
  return {
    typing: 0,
    reading: 0,
    handwriting: 0,
    "phone-tablet": 0,
    "idle-focus": 0,
    unknown: 0,
  };
}

const ISSUE_METRIC_WEIGHTS: Record<IssueFamily, number> = {
  "forward-head": 0.45,
  "shoulder-tilt": 0.2,
  "torso-lean": 0.35,
};

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function round(value: number, precision = 3) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

export function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

export function getDayKey(timestamp: number) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getSensitivityMultiplier(sensitivity: number) {
  const normalized = clamp((sensitivity - 20) / 80, 0, 1);
  return 1.25 - normalized * 0.45;
}

export function buildThresholds(
  baseline: PostureBaseline,
  sensitivity: number,
  metricAvailability: MetricAvailability = DEFAULT_METRIC_AVAILABILITY,
): MetricThresholds {
  const multiplier = getSensitivityMultiplier(sensitivity);

  return {
    baseline,
    warning: {
      headForward: baseline.headForward + 0.035 * multiplier,
      torsoLean: baseline.torsoLean + 7 * multiplier,
      shoulderTilt: baseline.shoulderTilt + 6 * multiplier,
      screenDistanceRatio: baseline.screenDistanceRatio,
      deviationRatio: 0,
    },
    bad: {
      headForward: baseline.headForward + 0.07 * multiplier,
      torsoLean: baseline.torsoLean + 14 * multiplier,
      shoulderTilt: baseline.shoulderTilt + 12 * multiplier,
      screenDistanceRatio: baseline.screenDistanceRatio,
      deviationRatio: 0,
    },
    metricAvailability,
  };
}

function getBaselineDeviationRatio(value: number, baseline: number, bad: number) {
  return clamp((value - baseline) / (bad - baseline || 1), 0, 1);
}

function combineMetricAvailability(first: MetricAvailability, second: MetricAvailability): MetricAvailability {
  return {
    headForward: first.headForward && second.headForward,
    torsoLean: first.torsoLean && second.torsoLean,
    shoulderTilt: first.shoulderTilt && second.shoulderTilt,
  };
}

export function getMetricSeverities(
  metrics: Omit<LiveMetrics, "deviationRatio">,
  thresholds: MetricThresholds,
  metricAvailability: MetricAvailability,
) {
  const head = metricAvailability.headForward
    ? clamp(
        (metrics.headForward - thresholds.warning.headForward) /
          (thresholds.bad.headForward - thresholds.warning.headForward || 1),
        0,
        2,
      )
    : 0;
  const torso = metricAvailability.torsoLean
    ? clamp(
        (metrics.torsoLean - thresholds.warning.torsoLean) /
          (thresholds.bad.torsoLean - thresholds.warning.torsoLean || 1),
        0,
        2,
      )
    : 0;
  const shoulders = metricAvailability.shoulderTilt
    ? clamp(
        (metrics.shoulderTilt - thresholds.warning.shoulderTilt) /
          (thresholds.bad.shoulderTilt - thresholds.warning.shoulderTilt || 1),
        0,
        2,
      )
    : 0;

  return {
    "forward-head": head,
    "torso-lean": torso,
    "shoulder-tilt": shoulders,
  } satisfies Record<IssueFamily, number>;
}

export function classifyPosture(
  metrics: Omit<LiveMetrics, "deviationRatio">,
  thresholds: MetricThresholds,
  frameMetricAvailability: MetricAvailability = DEFAULT_METRIC_AVAILABILITY,
): {
  postureState: "good" | "warning" | "bad";
  currentIssue: IssueFamily | null;
  deviationRatio: number;
  metricAvailability: MetricAvailability;
  severities: Record<IssueFamily, number>;
} {
  const metricAvailability = combineMetricAvailability(thresholds.metricAvailability, frameMetricAvailability);
  const severities = getMetricSeverities(metrics, thresholds, metricAvailability);
  const sortedIssues = Object.entries(severities).sort((a, b) => b[1] - a[1]) as Array<[IssueFamily, number]>;
  const [currentIssue, currentSeverity] = sortedIssues[0];

  const isBad =
    (metricAvailability.headForward && metrics.headForward >= thresholds.bad.headForward) ||
    (metricAvailability.torsoLean && metrics.torsoLean >= thresholds.bad.torsoLean) ||
    (metricAvailability.shoulderTilt && metrics.shoulderTilt >= thresholds.bad.shoulderTilt);

  const isWarning =
    (metricAvailability.headForward && metrics.headForward >= thresholds.warning.headForward) ||
    (metricAvailability.torsoLean && metrics.torsoLean >= thresholds.warning.torsoLean) ||
    (metricAvailability.shoulderTilt && metrics.shoulderTilt >= thresholds.warning.shoulderTilt);

  const headDeviation = metricAvailability.headForward
    ? getBaselineDeviationRatio(metrics.headForward, thresholds.baseline.headForward, thresholds.bad.headForward)
    : 0;
  const shoulderDeviation = metricAvailability.shoulderTilt
    ? getBaselineDeviationRatio(metrics.shoulderTilt, thresholds.baseline.shoulderTilt, thresholds.bad.shoulderTilt)
    : 0;
  const torsoDeviation = metricAvailability.torsoLean
    ? getBaselineDeviationRatio(metrics.torsoLean, thresholds.baseline.torsoLean, thresholds.bad.torsoLean)
    : 0;
  const activeWeight =
    (metricAvailability.headForward ? ISSUE_METRIC_WEIGHTS["forward-head"] : 0) +
    (metricAvailability.shoulderTilt ? ISSUE_METRIC_WEIGHTS["shoulder-tilt"] : 0) +
    (metricAvailability.torsoLean ? ISSUE_METRIC_WEIGHTS["torso-lean"] : 0);
  const deviationRatio = activeWeight > 0
    ? (
        headDeviation * ISSUE_METRIC_WEIGHTS["forward-head"] +
        shoulderDeviation * ISSUE_METRIC_WEIGHTS["shoulder-tilt"] +
        torsoDeviation * ISSUE_METRIC_WEIGHTS["torso-lean"]
      ) / activeWeight
    : 0;

  return {
    postureState: isBad ? "bad" : isWarning ? "warning" : "good",
    currentIssue: currentSeverity > 0 ? currentIssue : null,
    deviationRatio: clamp(deviationRatio, 0, 1),
    metricAvailability,
    severities,
  };
}

export function getDistanceStatus(
  baseline: PostureBaseline,
  ratio: number,
  mode: "active" | "soft" = "active",
  estimatedDistanceCm?: number | null,
  options: {
    cameraView?: CameraView;
    distanceEstimateConfidence?: number;
    distanceEstimateSource?: DistanceEstimateSource | null;
  } = {},
): "ok" | "too-close" | "too-far" {
  const near = baseline.screenDistanceRatio * (mode === "soft" ? 1.3 : 1.2);
  const far = baseline.screenDistanceRatio * 0.8;
  const baselineDistanceCm = baseline.screenDistanceCm;
  const absoluteNearThresholdCm = Math.max(mode === "soft" ? 38 : 40, (baselineDistanceCm ?? 48) - (mode === "soft" ? 6 : 8));
  const absoluteFarThresholdCm = Math.min(90, (baselineDistanceCm ?? 58) + 18);
  const canTrustFarDistance =
    options.cameraView === undefined ||
    options.cameraView === "frontal" ||
    (options.distanceEstimateSource === "face-mesh" && (options.distanceEstimateConfidence ?? 0) >= 0.9);

  if (estimatedDistanceCm !== undefined && estimatedDistanceCm !== null) {
    if (estimatedDistanceCm <= absoluteNearThresholdCm) return "too-close";
    if (mode !== "soft" && canTrustFarDistance && estimatedDistanceCm >= absoluteFarThresholdCm && ratio < far) return "too-far";
  }

  if (ratio > near) return "too-close";
  if (mode === "soft") return "ok";
  if (canTrustFarDistance && ratio < far) return "too-far";
  return "ok";
}

export function computeScore(trackedMs: number, warningMs: number, badMs: number, avgDeviation: number) {
  if (trackedMs <= 0) return 0;

  const legacyBadRatio = (warningMs + badMs) / trackedMs;
  const legacyScore = 100 * (1 - (0.6 * legacyBadRatio + 0.4 * avgDeviation));
  return Math.round(clamp(legacyScore, 0, 100));
}

export function computeExposureScore(input: {
  trackedMs: number;
  moderateExposureMs: number;
  highExposureMs: number;
  staticHoldMs: number;
  recoveryCount: number;
}) {
  if (input.trackedMs <= 0) return 0;

  const moderateRatio = input.moderateExposureMs / input.trackedMs;
  const highRatio = input.highExposureMs / input.trackedMs;
  const staticHoldRatio = input.staticHoldMs / input.trackedMs;
  const score = 100 -
    35 * highRatio -
    20 * moderateRatio -
    15 * staticHoldRatio +
    Math.min(10, input.recoveryCount * 2);
  return Math.round(clamp(score, 0, 100));
}

function getSessionScore(session: SessionRecord | Pick<SessionRecord, "trackedMs" | "warningMs" | "badMs" | "deviationSum" | "deviationDurationMs" | "moderateExposureMs" | "highExposureMs" | "staticHoldMs" | "recoveryCount">) {
  if (
    session.moderateExposureMs !== undefined ||
    session.highExposureMs !== undefined ||
    session.staticHoldMs !== undefined ||
    session.recoveryCount !== undefined
  ) {
    return computeExposureScore({
      trackedMs: session.trackedMs,
      moderateExposureMs: session.moderateExposureMs ?? session.warningMs,
      highExposureMs: session.highExposureMs ?? session.badMs,
      staticHoldMs: session.staticHoldMs ?? 0,
      recoveryCount: session.recoveryCount ?? 0,
    });
  }

  const trackedMs = session.trackedMs;
  const avgDeviation = session.deviationDurationMs ? session.deviationSum / session.deviationDurationMs : 0;
  const badRatio = (session.warningMs + session.badMs) / trackedMs;
  const score = 100 * (1 - (0.6 * badRatio + 0.4 * avgDeviation));
  return Math.round(clamp(score, 0, 100));
}

function toExposureLevelBucket(sample: Pick<PoseSampleRecord, "exposureLevel" | "postureState">) {
  if (sample.exposureLevel) {
    return sample.exposureLevel;
  }

  if (sample.postureState === "warning") {
    return "moderate";
  }

  if (sample.postureState === "bad") {
    return "high";
  }

  return "low";
}

function getSampleStaticHold(sample: Pick<PoseSampleRecord, "staticHold" | "loadSource">) {
  if (sample.staticHold !== undefined) {
    return sample.staticHold;
  }

  return sample.loadSource === "static-hold" || sample.loadSource === "compound";
}

export function deriveDominantIssue(issueMs: Record<IssueFamily, number>): IssueFamily | null {
  const [dominantIssue, dominantIssueMs] = (Object.entries(issueMs) as Array<[IssueFamily, number]>)
    .sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
  return dominantIssueMs > 0 ? dominantIssue : null;
}

export function buildHourlyTrendPoint(input: {
  hour: number;
  trackedMs: number;
  lowExposureMs?: number;
  moderateExposureMs?: number;
  highExposureMs?: number;
  staticHoldMs?: number;
  recoveryCount?: number;
}): HourlyTrendPoint {
  const trackedMs = input.trackedMs;
  const lowExposureMs = input.lowExposureMs ?? 0;
  const moderateExposureMs = input.moderateExposureMs ?? 0;
  const highExposureMs = input.highExposureMs ?? 0;
  const staticHoldMs = input.staticHoldMs ?? 0;
  const recoveryCount = input.recoveryCount ?? 0;
  const postureScore = computeExposureScore({
    trackedMs,
    moderateExposureMs,
    highExposureMs,
    staticHoldMs,
    recoveryCount,
  });
  const focusScore = Math.round((lowExposureMs / Math.max(trackedMs, 1)) * 100);

  return {
    hour: input.hour,
    trackedMs,
    postureScore,
    focusScore,
    state: deriveHourState(postureScore),
    lowExposureMs,
    moderateExposureMs,
    highExposureMs,
    staticHoldMs,
    recoveryCount,
  };
}

export function deriveBestWorstHours(hourlyTrend: HourlyTrendPoint[]) {
  if (!hourlyTrend.length) {
    return {
      bestHour: null,
      worstHour: null,
    };
  }

  const sortedByScore = [...hourlyTrend].sort((a, b) => b.postureScore - a.postureScore);
  return {
    bestHour: sortedByScore[0]?.hour ?? null,
    worstHour: sortedByScore[sortedByScore.length - 1]?.hour ?? null,
  };
}

export function createEmptyDailySummary(dayKey: string): DailySummary {
  return {
    dayKey,
    sessionsCount: 0,
    firstSessionAt: null,
    lastSessionAt: null,
    trackedMs: 0,
    durationMs: 0,
    goodMs: 0,
    warningMs: 0,
    badMs: 0,
    analyzingMs: 0,
    issueMs: {
      "forward-head": 0,
      "torso-lean": 0,
      "shoulder-tilt": 0,
    },
    avgDeviation: 0,
    score: 0,
    correctionSuccessCount: 0,
    interventionCount: 0,
    overlayCount: 0,
    breakReminderCount: 0,
    screenDistanceWarningCount: 0,
    longestFocusBlockMs: 0,
    bestHour: null,
    worstHour: null,
    hourlyTrend: [],
    dominantIssue: null,
    streakEligible: false,
    lastSessionScore: undefined,
    moderateExposureMs: 0,
    highExposureMs: 0,
    staticHoldMs: 0,
    recoveryMs: 0,
    recoveryCount: 0,
    taskMs: createEmptyTaskDurations(),
  };
}

function deriveHourState(score: number): "good" | "warning" | "bad" {
  if (score >= 80) return "good";
  if (score >= 60) return "warning";
  return "bad";
}

function buildHourlyTrend(samples: PoseSampleRecord[]): HourlyTrendPoint[] {
  const byHour = new Map<number, {
    trackedMs: number;
    lowExposureMs: number;
    moderateExposureMs: number;
    highExposureMs: number;
    staticHoldMs: number;
    recoveryCount: number;
  }>();
  const recoverySnapshotsBySession = new Map<string, number>();

  const orderedSamples = [...samples].sort((a, b) => a.timestamp - b.timestamp);
  for (const [index, sample] of orderedSamples.entries()) {
    const next = orderedSamples[index + 1];
    const nextGap = next?.sessionId === sample.sessionId ? next.timestamp - sample.timestamp : 1000;
    const sampleMs = nextGap > 0 && nextGap <= 5000 ? nextGap : 1000;
    const hour = new Date(sample.timestamp).getHours();
    const entry = byHour.get(hour) ?? {
      trackedMs: 0,
      lowExposureMs: 0,
      moderateExposureMs: 0,
      highExposureMs: 0,
      staticHoldMs: 0,
      recoveryCount: 0,
    };
    const exposureLevel = toExposureLevelBucket(sample);
    const previousRecoverySnapshot = recoverySnapshotsBySession.get(sample.sessionId) ?? 0;
    const currentRecoverySnapshot = sample.recoveryCountSnapshot ?? previousRecoverySnapshot;
    const recoveryIncrement = Math.max(0, currentRecoverySnapshot - previousRecoverySnapshot);

    entry.trackedMs += sampleMs;
    if (exposureLevel === "moderate") entry.moderateExposureMs += sampleMs;
    if (exposureLevel === "high" || exposureLevel === "critical") entry.highExposureMs += sampleMs;
    if (exposureLevel === "low") entry.lowExposureMs += sampleMs;
    if (getSampleStaticHold(sample)) entry.staticHoldMs += sampleMs;
    entry.recoveryCount += recoveryIncrement;
    byHour.set(hour, entry);
    recoverySnapshotsBySession.set(sample.sessionId, currentRecoverySnapshot);
  }

  return [...byHour.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([hour, value]) => buildHourlyTrendPoint({
      hour,
      trackedMs: value.trackedMs,
      lowExposureMs: value.lowExposureMs,
      moderateExposureMs: value.moderateExposureMs,
      highExposureMs: value.highExposureMs,
      staticHoldMs: value.staticHoldMs,
      recoveryCount: value.recoveryCount,
    }));
}

export function buildDailySummary(dayKey: string, sessions: SessionRecord[], samples: PoseSampleRecord[]): DailySummary {
  const summary = createEmptyDailySummary(dayKey);

  if (!sessions.length) {
    return summary;
  }

  let deviationWeight = 0;
  let deviationSum = 0;
  let latestSession: SessionRecord | null = null;

  for (const session of sessions) {
    summary.sessionsCount += 1;
    summary.firstSessionAt = summary.firstSessionAt === null
      ? session.startedAt
      : Math.min(summary.firstSessionAt, session.startedAt);
    summary.lastSessionAt = summary.lastSessionAt === null
      ? session.endedAt
      : Math.max(summary.lastSessionAt, session.endedAt);
    summary.durationMs += session.durationMs;
    summary.trackedMs += session.trackedMs;
    summary.goodMs += session.goodMs;
    summary.warningMs += session.warningMs;
    summary.badMs += session.badMs;
    summary.analyzingMs += session.analyzingMs;
    summary.issueMs["forward-head"] += session.issueMs["forward-head"];
    summary.issueMs["torso-lean"] += session.issueMs["torso-lean"];
    summary.issueMs["shoulder-tilt"] += session.issueMs["shoulder-tilt"];
    summary.correctionSuccessCount += session.correctionSuccessCount;
    summary.interventionCount += session.interventionCount;
    summary.overlayCount += session.overlayCount;
    summary.breakReminderCount += session.breakReminderCount;
    summary.screenDistanceWarningCount += session.screenDistanceWarningCount;
    summary.longestFocusBlockMs = Math.max(summary.longestFocusBlockMs, session.longestFocusBlockMs);
    summary.moderateExposureMs = (summary.moderateExposureMs ?? 0) + (session.moderateExposureMs ?? session.warningMs);
    summary.highExposureMs = (summary.highExposureMs ?? 0) + (session.highExposureMs ?? session.badMs);
    summary.staticHoldMs = (summary.staticHoldMs ?? 0) + (session.staticHoldMs ?? 0);
    summary.recoveryMs = (summary.recoveryMs ?? 0) + (session.recoveryMs ?? 0);
    summary.recoveryCount = (summary.recoveryCount ?? 0) + (session.recoveryCount ?? 0);
    const sessionTaskMs = session.taskMs ?? createEmptyTaskDurations();
    const summaryTaskMs = summary.taskMs ?? createEmptyTaskDurations();
    summary.taskMs = {
      typing: summaryTaskMs.typing + sessionTaskMs.typing,
      reading: summaryTaskMs.reading + sessionTaskMs.reading,
      handwriting: summaryTaskMs.handwriting + sessionTaskMs.handwriting,
      "phone-tablet": summaryTaskMs["phone-tablet"] + sessionTaskMs["phone-tablet"],
      "idle-focus": summaryTaskMs["idle-focus"] + sessionTaskMs["idle-focus"],
      unknown: summaryTaskMs.unknown + sessionTaskMs.unknown,
    };
    if (!latestSession || session.endedAt > latestSession.endedAt) {
      latestSession = session;
    }

    deviationSum += session.deviationSum;
    deviationWeight += session.deviationDurationMs ?? session.deviationSamples;
  }

  summary.avgDeviation = deviationWeight > 0 ? clamp(deviationSum / deviationWeight, 0, 1) : 0;
  summary.score = getSessionScore({
    trackedMs: summary.trackedMs,
    warningMs: summary.warningMs,
    badMs: summary.badMs,
    deviationSum: summary.avgDeviation * Math.max(summary.trackedMs, 1),
    deviationDurationMs: summary.trackedMs,
    moderateExposureMs: summary.moderateExposureMs,
    highExposureMs: summary.highExposureMs,
    staticHoldMs: summary.staticHoldMs,
    recoveryCount: summary.recoveryCount,
  });
  summary.lastSessionScore = latestSession?.lastSessionScore ?? latestSession?.score;
  summary.hourlyTrend = buildHourlyTrend(samples);
  summary.streakEligible = summary.trackedMs >= 30 * 60 * 1000 && summary.score >= 70;
  const { bestHour, worstHour } = deriveBestWorstHours(summary.hourlyTrend);
  summary.bestHour = bestHour;
  summary.worstHour = worstHour;
  summary.dominantIssue = deriveDominantIssue(summary.issueMs);

  return summary;
}

function getPreviousDayKey(dayKey: string) {
  return getDayKey(new Date(`${dayKey}T00:00:00`).getTime() - 24 * 60 * 60 * 1000);
}

function getConsecutiveEligibleSummariesEndingAt(summaries: DailySummary[], targetDayKey: string) {
  const byDay = new Map(summaries.map((summary) => [summary.dayKey, summary]));
  const consecutive: DailySummary[] = [];
  let dayKey = targetDayKey;

  while (true) {
    const summary = byDay.get(dayKey);
    if (!summary?.streakEligible) break;
    consecutive.unshift(summary);
    dayKey = getPreviousDayKey(dayKey);
  }

  return consecutive;
}

function getLatestSummary(summaries: DailySummary[]) {
  return [...summaries].sort((a, b) => (a.dayKey > b.dayKey ? 1 : -1)).at(-1) ?? null;
}

export function computeStreak(summaries: DailySummary[], asOf = Date.now()) {
  const ordered = [...summaries].sort((a, b) => (a.dayKey > b.dayKey ? 1 : -1));
  const latest = getLatestSummary(ordered);
  if (!latest) return 0;

  const todayKey = getDayKey(asOf);
  const yesterdayKey = getPreviousDayKey(todayKey);
  let targetDayKey: string | null = null;

  if (latest.dayKey === todayKey) {
    if (latest.trackedMs >= 30 * 60 * 1000 && !latest.streakEligible) return 0;
    targetDayKey = latest.streakEligible ? todayKey : yesterdayKey;
  } else if (latest.dayKey === yesterdayKey) {
    targetDayKey = latest.streakEligible ? yesterdayKey : null;
  } else {
    return 0;
  }

  if (!targetDayKey) return 0;
  return getConsecutiveEligibleSummariesEndingAt(ordered, targetDayKey).length;
}

function getAchievementStreak(summaries: DailySummary[], asOf = Date.now()) {
  return computeStreak(summaries, asOf);
}

function isRetentionEligible(summary: DailySummary) {
  return summary.trackedMs >= 30 * 60 * 1000;
}

function getConsecutiveRetentionSummariesEndingAt(summaries: DailySummary[], targetDayKey: string) {
  const byDay = new Map(summaries.map((summary) => [summary.dayKey, summary]));
  const consecutive: DailySummary[] = [];
  let dayKey = targetDayKey;

  while (true) {
    const summary = byDay.get(dayKey);
    if (!summary || !isRetentionEligible(summary)) break;
    consecutive.unshift(summary);
    dayKey = getPreviousDayKey(dayKey);
  }

  return consecutive;
}

function getLatestConsecutiveRetentionSummaries(summaries: DailySummary[]) {
  const latest = [...summaries]
    .filter(isRetentionEligible)
    .sort((a, b) => (a.dayKey > b.dayKey ? 1 : -1))
    .at(-1);

  if (!latest) return [];
  return getConsecutiveRetentionSummariesEndingAt(summaries, latest.dayKey);
}

function getRollingCalendarWindow(summaries: DailySummary[], endDayKey: string, days: number) {
  const start = new Date(`${endDayKey}T00:00:00`).getTime() - (days - 1) * 24 * 60 * 60 * 1000;
  const startDayKey = getDayKey(start);
  return summaries.filter((summary) => summary.dayKey >= startDayKey && summary.dayKey <= endDayKey);
}

export function computeAchievements(summaries: DailySummary[], asOf = Date.now()): RuntimeAchievement[] {
  const ordered = [...summaries].sort((a, b) => (a.dayKey > b.dayKey ? 1 : -1));
  const streak = getAchievementStreak(ordered, asOf);
  const latest = getLatestSummary(ordered);
  const recentSeven = latest
    ? getRollingCalendarWindow(ordered, latest.dayKey, 7).filter(isRetentionEligible)
    : [];
  const eveningHigh = recentSeven.filter((summary) => {
    if ((summary.lastSessionScore ?? summary.score) < 80 || !summary.lastSessionAt) return false;
    return new Date(summary.lastSessionAt).getHours() >= 18;
  }).length;
  const recentThree = getLatestConsecutiveRetentionSummaries(ordered).slice(-3);
  const shoulderSaver = recentThree.length === 3 &&
    recentThree.every((summary) => summary.issueMs["shoulder-tilt"] / Math.max(summary.trackedMs, 1) < 0.1);

  return [
    {
      id: "desk-reset-streak",
      title: "Desk Reset Streak",
      description: "Maintain 5 qualifying days in a row.",
      progress: clamp(Math.round((streak / 5) * 100), 0, 100),
      unlocked: streak >= 5,
    },
    {
      id: "shoulder-saver",
      title: "Shoulder Saver",
      description: "Keep shoulder drift low across 3 qualifying days.",
      progress: shoulderSaver ? 100 : clamp(Math.round((recentThree.length / 3) * 100), 0, 100),
      unlocked: shoulderSaver,
    },
    {
      id: "evening-finisher",
      title: "Evening Finisher",
      description: "Finish above 80 after 6 PM on 3 of the last 7 days.",
      progress: clamp(Math.round((eveningHigh / 3) * 100), 0, 100),
      unlocked: eveningHigh >= 3,
    },
  ];
}

export function computeIdentity(summaries: DailySummary[]): IdentitySnapshot {
  const eligibleSummaries = [...summaries]
    .filter((summary) => summary.trackedMs >= 30 * 60 * 1000)
    .sort((a, b) => (a.dayKey > b.dayKey ? 1 : -1))
    .slice(-7);
  if (eligibleSummaries.length < 2) {
    return {
      level: "Reset Starter",
      vibe: "Waiting for enough data",
      specialty: "Posture data will appear after two qualifying days",
      progressValue: 0,
    };
  }

  const avgScore = eligibleSummaries.length
    ? eligibleSummaries.reduce((sum, summary) => sum + summary.score, 0) / eligibleSummaries.length
    : 0;
  const interventionCount = eligibleSummaries.reduce((sum, summary) => sum + summary.interventionCount, 0);
  const correctionCount = eligibleSummaries.reduce((sum, summary) => sum + summary.correctionSuccessCount, 0);
  const correctionRate = interventionCount > 0 ? correctionCount / interventionCount : 0;
  const midpoint = Math.max(Math.floor(eligibleSummaries.length / 2), 1);
  const firstWindow = eligibleSummaries.slice(0, midpoint);
  const secondWindow = eligibleSummaries.slice(midpoint);
  const issueRatio = (items: DailySummary[], issue: IssueFamily) => {
    const trackedMs = items.reduce((sum, summary) => sum + summary.trackedMs, 0);
    const issueMs = items.reduce((sum, summary) => sum + summary.issueMs[issue], 0);
    return issueMs / Math.max(trackedMs, 1);
  };
  const issueImprovements = (["forward-head", "torso-lean", "shoulder-tilt"] as const).map((issue) => ({
    issue,
    improvement: issueRatio(firstWindow, issue) - issueRatio(secondWindow.length ? secondWindow : firstWindow, issue),
  }));
  const bestImprovement = issueImprovements.sort((a, b) => b.improvement - a.improvement)[0];
  const specialtyIssue = bestImprovement && bestImprovement.improvement > 0 ? bestImprovement.issue : null;

  const level = avgScore >= 88 ? "Alignment Pilot" : avgScore >= 78 ? "Focus Flow" : avgScore >= 68 ? "Steady Builder" : "Reset Starter";
  const vibe = correctionRate >= 0.75 ? "Calm accountability" : correctionRate >= 0.5 ? "Gentle recovery mode" : "Needs softer pacing";
  const specialty = specialtyIssue === "forward-head"
    ? "Fast neck alignment recovery"
    : specialtyIssue === "shoulder-tilt"
      ? "Low shoulder drift during focus blocks"
      : specialtyIssue === "torso-lean"
        ? "Better trunk stacking over long sessions"
        : "Keep tracking to reveal your strongest recovery pattern";

  return {
    level,
    vibe,
    specialty,
    progressValue: Math.round(clamp(avgScore, 0, 100)),
  };
}
