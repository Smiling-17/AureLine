import { openDB } from "idb";
import type {
  DailySummary,
  PoseSampleRecord,
  PostureEventRecord,
  RecoveryActivityRecord,
  RuntimeAchievement,
  RuntimeHistorySnapshot,
  SessionRecord,
} from "@/runtime/types";
import {
  buildDailySummary,
  computeAchievements,
  computeIdentity,
  computeStreak,
  getDayKey,
} from "@/runtime/logic";

const DB_NAME = "ai-posture-coach-runtime";
const DB_VERSION = 2;

async function getDb() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(database) {
      if (!database.objectStoreNames.contains("sessions")) {
        const sessions = database.createObjectStore("sessions", { keyPath: "id" });
        sessions.createIndex("by-day", "dayKey");
      }

      if (!database.objectStoreNames.contains("samples")) {
        const samples = database.createObjectStore("samples", { keyPath: "id", autoIncrement: true });
        samples.createIndex("by-day", "dayKey");
        samples.createIndex("by-session", "sessionId");
      }

      if (!database.objectStoreNames.contains("events")) {
        const events = database.createObjectStore("events", { keyPath: "id", autoIncrement: true });
        events.createIndex("by-day", "dayKey");
        events.createIndex("by-session", "sessionId");
      }

      if (!database.objectStoreNames.contains("dailySummaries")) {
        const summaries = database.createObjectStore("dailySummaries", { keyPath: "dayKey" });
        summaries.createIndex("by-day", "dayKey");
      }

      if (!database.objectStoreNames.contains("achievements")) {
        const achievements = database.createObjectStore("achievements", { keyPath: "id" });
        achievements.createIndex("by-id", "id");
      }

      if (!database.objectStoreNames.contains("recoveryActivities")) {
        const recoveryActivities = database.createObjectStore("recoveryActivities", { keyPath: "id", autoIncrement: true });
        recoveryActivities.createIndex("by-day", "dayKey");
        recoveryActivities.createIndex("by-flow", "flowId");
      }
    },
  });
}

function olderThan(timestamp: number, days: number) {
  return Date.now() - timestamp > days * 24 * 60 * 60 * 1000;
}

export async function cleanupRuntimeData() {
  const db = await getDb();
  const tx = db.transaction(["sessions", "samples", "events", "dailySummaries", "achievements", "recoveryActivities"], "readwrite");
  const sessionKeys = await tx.objectStore("sessions").getAllKeys();
  const sampleKeys = await tx.objectStore("samples").getAllKeys();
  const eventKeys = await tx.objectStore("events").getAllKeys();
  const dayKeys = await tx.objectStore("dailySummaries").getAllKeys();
  const recoveryKeys = await tx.objectStore("recoveryActivities").getAllKeys();

  for (const key of sessionKeys) {
    const value = await tx.objectStore("sessions").get(key);
    if (value && olderThan(value.endedAt, 180)) {
      await tx.objectStore("sessions").delete(key);
    }
  }

  for (const key of sampleKeys) {
    const value = await tx.objectStore("samples").get(key);
    if (value && olderThan(value.timestamp, 30)) {
      await tx.objectStore("samples").delete(key);
    }
  }

  for (const key of eventKeys) {
    const value = await tx.objectStore("events").get(key);
    if (value && olderThan(value.timestamp, 180)) {
      await tx.objectStore("events").delete(key);
    }
  }

  for (const key of dayKeys) {
    const value = await tx.objectStore("dailySummaries").get(key);
    if (value && value.lastSessionAt && olderThan(value.lastSessionAt, 180)) {
      await tx.objectStore("dailySummaries").delete(key);
    }
  }

  for (const key of recoveryKeys) {
    const value = await tx.objectStore("recoveryActivities").get(key) as RecoveryActivityRecord | undefined;
    const retentionAnchor = value?.completedAt ?? value?.startedAt;
    if (retentionAnchor && olderThan(retentionAnchor, 180)) {
      await tx.objectStore("recoveryActivities").delete(key);
    }
  }

  await tx.objectStore("achievements").clear();
  await tx.done;

  const summaries = await loadDailySummaries();
  const achievements = computeAchievements(summaries);
  const achievementTx = db.transaction("achievements", "readwrite");
  for (const achievement of achievements) {
    await achievementTx.store.put(achievement);
  }
  await achievementTx.done;
}

export async function persistRuntimeSession(
  session: SessionRecord,
  samples: PoseSampleRecord[],
  events: PostureEventRecord[],
) {
  const db = await getDb();
  const tx = db.transaction(["sessions", "samples", "events"], "readwrite");
  await tx.objectStore("sessions").put(session);

  for (const sample of samples) {
    await tx.objectStore("samples").add(sample);
  }

  for (const event of events) {
    await tx.objectStore("events").add(event);
  }

  await tx.done;
  await rebuildDailySummary(session.dayKey);
}

export async function rebuildDailySummary(dayKey: string) {
  const db = await getDb();
  const [sessions, samples] = await Promise.all([
    db.getAllFromIndex("sessions", "by-day", dayKey) as Promise<SessionRecord[]>,
    db.getAllFromIndex("samples", "by-day", dayKey) as Promise<PoseSampleRecord[]>,
  ]);

  const summary = buildDailySummary(dayKey, sessions, samples);
  await db.put("dailySummaries", summary);

  const summaries = await loadDailySummaries();
  const achievements = computeAchievements(summaries);
  const tx = db.transaction("achievements", "readwrite");
  for (const achievement of achievements) {
    await tx.store.put(achievement);
  }
  await tx.done;
}

export async function loadDailySummaries() {
  const db = await getDb();
  const summaries = await db.getAll("dailySummaries") as DailySummary[];
  return summaries.sort((a, b) => (a.dayKey > b.dayKey ? 1 : -1));
}

export async function loadRecentEvents(limit = 12) {
  const db = await getDb();
  const events = await db.getAll("events") as PostureEventRecord[];
  return events.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
}

export async function loadAchievements() {
  const db = await getDb();
  const achievements = await db.getAll("achievements") as RuntimeAchievement[];
  return achievements.sort((a, b) => a.title.localeCompare(b.title));
}

export async function persistRecoveryActivity(activity: RecoveryActivityRecord) {
  const db = await getDb();
  await db.add("recoveryActivities", activity);
}

export async function loadRecoveryActivities(limit = 100) {
  const db = await getDb();
  const activities = await db.getAll("recoveryActivities") as RecoveryActivityRecord[];
  return activities
    .sort((a, b) => (b.completedAt ?? b.startedAt) - (a.completedAt ?? a.startedAt))
    .slice(0, limit);
}

export async function loadRuntimeSnapshot(): Promise<RuntimeHistorySnapshot> {
  const [summaries, recentEvents, achievements] = await Promise.all([
    loadDailySummaries(),
    loadRecentEvents(),
    loadAchievements(),
  ]);

  const todayKey = getDayKey(Date.now());
  const todaySummary = summaries.find((summary) => summary.dayKey === todayKey) ?? null;

  return {
    summaries,
    todaySummary,
    recentEvents,
    achievements: achievements.length ? achievements : computeAchievements(summaries),
    streak: computeStreak(summaries),
    identity: computeIdentity(summaries),
  };
}
