import type { RuntimePreferences } from "@/runtime/types";

const STORAGE_KEY = "ai-posture-coach-preferences-v1";
const HEALTH_REMINDER_MINUTES = new Set([45, 50, 60]);

export function normalizeReminderMinutes(minutes: number | undefined) {
  return minutes !== undefined && HEALTH_REMINDER_MINUTES.has(minutes) ? minutes : 50;
}

export const defaultRuntimePreferences: RuntimePreferences = {
  sensitivity: 72,
  feedbackMode: "gentle",
  reminderMinutes: 50,
  microCelebrations: true,
  localProcessing: true,
  remindersEnabled: true,
  cameraDeviceId: undefined,
  landmarkPolicy: "relaxed",
};

export function loadRuntimePreferences(): RuntimePreferences {
  if (typeof window === "undefined") {
    return defaultRuntimePreferences;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultRuntimePreferences;

    const parsed = JSON.parse(raw) as Partial<RuntimePreferences>;
    const next = {
      ...defaultRuntimePreferences,
      ...parsed,
    };
    return {
      ...next,
      reminderMinutes: normalizeReminderMinutes(next.reminderMinutes),
    };
  } catch {
    return defaultRuntimePreferences;
  }
}

export function saveRuntimePreferences(preferences: RuntimePreferences) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
}
