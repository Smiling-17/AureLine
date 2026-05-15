import {
  buildHourlyTrendPoint,
  computeAchievements,
  computeIdentity,
  computeStreak,
  deriveBestWorstHours,
  deriveDominantIssue,
  getDayKey,
} from "@/runtime/logic";
import type {
  DailySummary,
  IssueFamily,
  PostureEventRecord,
  RecoveryActivityRecord,
  RuntimeHistorySnapshot,
  TaskState,
} from "@/runtime/types";
import type { BodyArea } from "@/types/posture";

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const DEMO_DAY_COUNT = 28;

const issueRotation: IssueFamily[] = [
  "forward-head",
  "torso-lean",
  "shoulder-tilt",
  "forward-head",
  "torso-lean",
  "forward-head",
  "shoulder-tilt",
];

const recoveryFlows: Array<{
  flowId: string;
  targetArea: BodyArea;
  completedSeconds: number;
  source: RecoveryActivityRecord["source"];
}> = [
  { flowId: "desk-reset", targetArea: "back", completedSeconds: 300, source: "break-cue" },
  { flowId: "desk-neck-decompression", targetArea: "neck", completedSeconds: 240, source: "report" },
  { flowId: "shoulder-opener-sequence", targetArea: "shoulders", completedSeconds: 360, source: "dashboard" },
  { flowId: "thoracic-mobility-arc", targetArea: "back", completedSeconds: 480, source: "recovery" },
  { flowId: "hip-reset-long-sitting", targetArea: "hips", completedSeconds: 420, source: "recovery" },
];

function startOfDay(timestamp: number) {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function minutes(value: number) {
  return Math.round(value * MINUTE_MS);
}

function hoursFromDay(dayStart: number, hour: number, minute = 0) {
  return dayStart + hour * HOUR_MS + minute * MINUTE_MS;
}

function createIssueMs(input: {
  warningMs: number;
  badMs: number;
  dominantIssue: IssueFamily;
  index: number;
}): Record<IssueFamily, number> {
  const totalIssueMs = Math.round(input.warningMs * 0.78 + input.badMs);
  const secondaryIssue = input.dominantIssue === "forward-head" ? "torso-lean" : "forward-head";
  const tertiaryIssue = input.dominantIssue === "shoulder-tilt" ? "torso-lean" : "shoulder-tilt";
  const dominantRatio = 0.52 + (input.index % 3) * 0.05;
  const secondaryRatio = 0.26 - (input.index % 2) * 0.03;
  const issueMs = {
    "forward-head": 0,
    "torso-lean": 0,
    "shoulder-tilt": 0,
  } satisfies Record<IssueFamily, number>;

  issueMs[input.dominantIssue] = Math.round(totalIssueMs * dominantRatio);
  issueMs[secondaryIssue] = Math.round(totalIssueMs * secondaryRatio);
  issueMs[tertiaryIssue] = Math.max(
    0,
    totalIssueMs - issueMs[input.dominantIssue] - issueMs[secondaryIssue],
  );

  return issueMs;
}

function createTaskMs(trackedMs: number, index: number): Record<TaskState, number> {
  const typingRatio = 0.42 + (index % 4) * 0.02;
  const readingRatio = 0.2 + (index % 3) * 0.015;
  const handwritingRatio = 0.06 + (index % 2) * 0.015;
  const phoneRatio = 0.05 + (index % 5 === 0 ? 0.04 : 0);
  const idleRatio = 0.18 + (index % 3) * 0.012;
  const typing = Math.round(trackedMs * typingRatio);
  const reading = Math.round(trackedMs * readingRatio);
  const handwriting = Math.round(trackedMs * handwritingRatio);
  const phone = Math.round(trackedMs * phoneRatio);
  const idle = Math.round(trackedMs * idleRatio);

  return {
    typing,
    reading,
    handwriting,
    "phone-tablet": phone,
    "idle-focus": idle,
    unknown: Math.max(0, trackedMs - typing - reading - handwriting - phone - idle),
  };
}

function createHourlyTrend(input: {
  score: number;
  trackedMs: number;
  recoveryCount: number;
  index: number;
}) {
  const hours = [8, 9, 10, 11, 13, 14, 15, 16, 17];
  const weights = [0.1, 0.12, 0.14, 0.11, 0.1, 0.12, 0.13, 0.1, 0.08];
  return hours.map((hour, hourIndex) => {
    const trackedMs = Math.max(minutes(12), Math.round(input.trackedMs * weights[hourIndex]));
    const lateDayDrag = hour >= 14 ? 0.06 + (input.index % 4) * 0.01 : 0;
    const quality = Math.max(0.42, Math.min(0.9, input.score / 100 - lateDayDrag + (hourIndex % 3) * 0.025));
    const highRatio = Math.max(0.02, 0.24 - quality * 0.18 + (hour === 14 ? 0.04 : 0));
    const moderateRatio = Math.max(0.1, 0.34 - quality * 0.14 + (hour >= 15 ? 0.03 : 0));
    const highExposureMs = Math.round(trackedMs * highRatio);
    const moderateExposureMs = Math.round(trackedMs * moderateRatio);
    const staticHoldMs = Math.round(trackedMs * (hour >= 14 ? 0.07 : 0.03));
    const lowExposureMs = Math.max(0, trackedMs - moderateExposureMs - highExposureMs);
    const recoveryCount = hourIndex === 4 || hourIndex === 7 ? Math.min(1, input.recoveryCount) : 0;

    return buildHourlyTrendPoint({
      hour,
      trackedMs,
      lowExposureMs,
      moderateExposureMs,
      highExposureMs,
      staticHoldMs,
      recoveryCount,
    });
  });
}

function createDemoSummary(now: number, index: number): DailySummary {
  const daysAgo = DEMO_DAY_COUNT - 1 - index;
  const dayStart = startOfDay(now - daysAgo * DAY_MS);
  const dayKey = getDayKey(dayStart);
  const progress = index / Math.max(1, DEMO_DAY_COUNT - 1);
  const trackedMs = minutes(150 + progress * 145 + (index % 5) * 14 + (index % 3) * 9);
  const highRatio = Math.max(0.045, 0.19 - progress * 0.1 + (index % 6 === 0 ? 0.035 : 0));
  const warningRatio = Math.max(0.14, 0.32 - progress * 0.13 + (index % 4 === 1 ? 0.035 : 0));
  const badMs = Math.round(trackedMs * highRatio);
  const warningMs = Math.round(trackedMs * warningRatio);
  const goodMs = Math.max(0, trackedMs - warningMs - badMs);
  const analyzingMs = minutes(6 + (index % 4) * 2);
  const recoveryCount = index % 6 === 0 ? 3 : index % 3 === 0 ? 2 : 1;
  const recoveryMs = recoveryCount * minutes(index % 2 === 0 ? 5 : 4);
  const moderateExposureMs = Math.round(warningMs * 0.92);
  const highExposureMs = Math.round(badMs * 0.95);
  const staticHoldMs = Math.round((warningMs + badMs) * (0.16 + (index % 3) * 0.03));
  const score = Math.round(Math.min(94, Math.max(58, 62 + progress * 27 + (index % 5) * 1.2 - (index % 7 === 0 ? 3 : 0))));
  const lastSessionScore = Math.min(96, score + (index % 4) - 1);
  const dominantIssue = issueRotation[index % issueRotation.length];
  const issueMs = createIssueMs({ warningMs, badMs, dominantIssue, index });
  const hourlyTrend = createHourlyTrend({ score, trackedMs, recoveryCount, index });
  const { bestHour, worstHour } = deriveBestWorstHours(hourlyTrend);
  const plannedFirstSessionAt = hoursFromDay(dayStart, 8, 35 + (index % 5) * 3);
  const plannedLastSessionAt = hoursFromDay(dayStart, index % 4 === 0 ? 18 : 17, 20 + (index % 4) * 7);
  const lastSessionAt = daysAgo === 0
    ? Math.max(dayStart, Math.min(plannedLastSessionAt, now - minutes(8)))
    : plannedLastSessionAt;
  const firstSessionAt = daysAgo === 0
    ? Math.max(dayStart, Math.min(plannedFirstSessionAt, lastSessionAt - minutes(35)))
    : plannedFirstSessionAt;

  return {
    dayKey,
    sessionsCount: 2 + (index % 3),
    firstSessionAt,
    lastSessionAt,
    trackedMs,
    durationMs: trackedMs + analyzingMs + minutes(42 + (index % 5) * 8),
    goodMs,
    warningMs,
    badMs,
    analyzingMs,
    issueMs,
    avgDeviation: Math.max(0.08, Math.round((0.31 - progress * 0.15 + (index % 4) * 0.01) * 1000) / 1000),
    score,
    lastSessionScore,
    correctionSuccessCount: Math.round(7 + progress * 15 + (index % 4)),
    interventionCount: Math.round(10 + progress * 18 + (index % 5)),
    overlayCount: 2 + (index % 4),
    breakReminderCount: recoveryCount + (index % 2),
    screenDistanceWarningCount: Math.max(0, 5 - Math.round(progress * 4) + (index % 5 === 0 ? 1 : 0)),
    longestFocusBlockMs: minutes(34 + progress * 38 + (index % 3) * 6),
    bestHour,
    worstHour,
    hourlyTrend,
    dominantIssue: deriveDominantIssue(issueMs),
    streakEligible: trackedMs >= minutes(30) && score >= 70,
    moderateExposureMs,
    highExposureMs,
    staticHoldMs,
    recoveryMs,
    recoveryCount,
    taskMs: createTaskMs(trackedMs, index),
  };
}

function createDemoEvents(now: number): PostureEventRecord[] {
  const todayStart = startOfDay(now);
  const yesterdayStart = todayStart - DAY_MS;
  const twoDaysAgoStart = todayStart - 2 * DAY_MS;
  const sessionId = (day: string, suffix: string) => `demo-${day}-${suffix}`;
  const recent = (offsetMinutes: number) => Math.min(now - minutes(2), Math.max(todayStart, now - minutes(offsetMinutes)));

  const events: PostureEventRecord[] = [
    {
      dayKey: getDayKey(todayStart),
      sessionId: sessionId(getDayKey(todayStart), "pm-focus"),
      timestamp: recent(24),
      kind: "correction-success",
      postureState: "good",
      issue: "forward-head",
      level: 1,
      detail: "Neck alignment recovered and held for a full focus block.",
      taskState: "typing",
      trackingReliability: "full",
      exposureLevel: "low",
      loadSource: "deviation",
    },
    {
      dayKey: getDayKey(todayStart),
      sessionId: sessionId(getDayKey(todayStart), "pm-focus"),
      timestamp: recent(88),
      kind: "break-reminder",
      postureState: "warning",
      issue: "torso-lean",
      level: 2,
      detail: "Static hold built up after 46 minutes; a short reset was recommended.",
      taskState: "reading",
      trackingReliability: "full",
      exposureLevel: "moderate",
      loadSource: "static-hold",
    },
    {
      dayKey: getDayKey(todayStart),
      sessionId: sessionId(getDayKey(todayStart), "late-morning"),
      timestamp: recent(156),
      kind: "feedback",
      postureState: "warning",
      issue: "shoulder-tilt",
      level: 2,
      detail: "Left shoulder drift appeared during mouse-heavy work.",
      taskState: "typing",
      trackingReliability: "full",
      exposureLevel: "moderate",
      loadSource: "deviation",
    },
    {
      dayKey: getDayKey(todayStart),
      sessionId: sessionId(getDayKey(todayStart), "morning"),
      timestamp: recent(235),
      kind: "distance-warning",
      postureState: "warning",
      issue: "forward-head",
      level: 2,
      detail: "Screen distance was close for 90 seconds, then returned to baseline.",
      taskState: "typing",
      trackingReliability: "partial",
      exposureLevel: "moderate",
      loadSource: "compound",
    },
    {
      dayKey: getDayKey(yesterdayStart),
      sessionId: sessionId(getDayKey(yesterdayStart), "evening"),
      timestamp: hoursFromDay(yesterdayStart, 18, 12),
      kind: "correction-success",
      postureState: "good",
      issue: "torso-lean",
      level: 1,
      detail: "Evening session finished above 80 after the thoracic reset.",
      taskState: "reading",
      trackingReliability: "full",
      exposureLevel: "low",
      loadSource: "deviation",
    },
    {
      dayKey: getDayKey(yesterdayStart),
      sessionId: sessionId(getDayKey(yesterdayStart), "afternoon"),
      timestamp: hoursFromDay(yesterdayStart, 14, 35),
      kind: "feedback",
      postureState: "bad",
      issue: "forward-head",
      level: 3,
      detail: "Forward-head load crossed the high threshold during a long review task.",
      taskState: "reading",
      trackingReliability: "full",
      exposureLevel: "high",
      loadSource: "compound",
    },
    {
      dayKey: getDayKey(yesterdayStart),
      sessionId: sessionId(getDayKey(yesterdayStart), "morning"),
      timestamp: hoursFromDay(yesterdayStart, 10, 24),
      kind: "correction-success",
      postureState: "good",
      issue: "shoulder-tilt",
      level: 1,
      detail: "Shoulder drift reduced after keyboard and mouse were re-centered.",
      taskState: "typing",
      trackingReliability: "full",
      exposureLevel: "low",
      loadSource: "deviation",
    },
    {
      dayKey: getDayKey(twoDaysAgoStart),
      sessionId: sessionId(getDayKey(twoDaysAgoStart), "pm"),
      timestamp: hoursFromDay(twoDaysAgoStart, 16, 5),
      kind: "break-reminder",
      postureState: "warning",
      issue: "torso-lean",
      level: 2,
      detail: "Recovery prompt triggered after a prolonged static trunk hold.",
      taskState: "idle-focus",
      trackingReliability: "full",
      exposureLevel: "moderate",
      loadSource: "static-hold",
    },
    {
      dayKey: getDayKey(twoDaysAgoStart),
      sessionId: sessionId(getDayKey(twoDaysAgoStart), "am"),
      timestamp: hoursFromDay(twoDaysAgoStart, 9, 15),
      kind: "state-change",
      postureState: "good",
      issue: null,
      detail: "Morning calibration held stable across the first session.",
      taskState: "typing",
      trackingReliability: "full",
      exposureLevel: "low",
      loadSource: null,
    },
  ];

  return events.sort((a, b) => b.timestamp - a.timestamp);
}

export function createDemoRecoveryActivities(now = Date.now()): RecoveryActivityRecord[] {
  return Array.from({ length: 16 }, (_, index) => {
    const daysAgo = Math.floor(index / 2);
    const dayStart = startOfDay(now - daysAgo * DAY_MS);
    const flow = recoveryFlows[index % recoveryFlows.length];
    const startedAt = hoursFromDay(dayStart, index % 2 === 0 ? 12 : 16, 10 + (index % 5) * 7);

    return {
      id: -(index + 1),
      dayKey: getDayKey(dayStart),
      flowId: flow.flowId,
      targetArea: flow.targetArea,
      source: flow.source,
      startedAt,
      completedAt: startedAt + flow.completedSeconds * 1000,
      completedSeconds: flow.completedSeconds,
    };
  }).sort((a, b) => (b.completedAt ?? b.startedAt) - (a.completedAt ?? a.startedAt));
}

export function createDemoRuntimeSnapshot(now = Date.now()): RuntimeHistorySnapshot {
  const summaries = Array.from({ length: DEMO_DAY_COUNT }, (_, index) => createDemoSummary(now, index));
  const todaySummary = summaries.at(-1) ?? null;

  return {
    summaries,
    todaySummary,
    recentEvents: createDemoEvents(now),
    achievements: computeAchievements(summaries, now),
    streak: computeStreak(summaries, now),
    identity: computeIdentity(summaries),
  };
}
