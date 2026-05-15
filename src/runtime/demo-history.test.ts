import { describe, expect, it } from "vitest";
import { createDemoRecoveryActivities, createDemoRuntimeSnapshot } from "@/runtime/demo-history";
import { getDayKey } from "@/runtime/logic";

describe("demo runtime history", () => {
  const now = new Date("2026-05-06T15:30:00+07:00").getTime();

  it("creates a long-running, internally consistent history snapshot", () => {
    const snapshot = createDemoRuntimeSnapshot(now);
    const todayKey = getDayKey(now);

    expect(snapshot.summaries).toHaveLength(28);
    expect(snapshot.todaySummary?.dayKey).toBe(todayKey);
    expect(snapshot.todaySummary?.trackedMs).toBeGreaterThan(5 * 60 * 1000);
    expect(snapshot.recentEvents.length).toBeGreaterThan(5);
    expect(snapshot.achievements).toHaveLength(3);
    expect(snapshot.streak).toBeGreaterThan(0);
    expect(snapshot.identity.progressValue).toBeGreaterThan(0);

    for (const summary of snapshot.summaries) {
      expect(summary.goodMs + summary.warningMs + summary.badMs).toBe(summary.trackedMs);
      expect(summary.hourlyTrend.length).toBeGreaterThan(0);
      expect(summary.bestHour).not.toBeNull();
      expect(summary.worstHour).not.toBeNull();
    }

    const todayEvents = snapshot.recentEvents.filter((event) => event.dayKey === todayKey);
    expect(todayEvents.every((event) => event.timestamp <= now)).toBe(true);
  });

  it("creates sorted recovery activities for report and dashboard cards", () => {
    const activities = createDemoRecoveryActivities(now);

    expect(activities.length).toBeGreaterThan(10);
    expect(activities.some((activity) => activity.flowId === "desk-reset")).toBe(true);
    expect(activities.some((activity) => activity.targetArea === "neck")).toBe(true);
    expect(activities.some((activity) => activity.targetArea === "shoulders")).toBe(true);

    const timestamps = activities.map((activity) => activity.completedAt ?? activity.startedAt);
    const sorted = [...timestamps].sort((a, b) => b - a);
    expect(timestamps).toEqual(sorted);
  });
});
