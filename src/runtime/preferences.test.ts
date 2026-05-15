import { afterEach, describe, expect, it, vi } from "vitest";
import {
  defaultRuntimePreferences,
  loadRuntimePreferences,
  normalizeReminderMinutes,
  saveRuntimePreferences,
} from "@/runtime/preferences";
import type { RuntimePreferences } from "@/runtime/types";

const STORAGE_KEY = "ai-posture-coach-preferences-v1";

function stubLocalStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));

  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
    },
  });

  return store;
}

describe("runtime preferences", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps camera selection optional by default", () => {
    expect(loadRuntimePreferences()).toEqual(defaultRuntimePreferences);
    expect(loadRuntimePreferences().cameraDeviceId).toBeUndefined();
    expect(loadRuntimePreferences().landmarkPolicy).toBe("relaxed");
  });

  it("loads and persists the selected camera device id", () => {
    const store = stubLocalStorage({
      [STORAGE_KEY]: JSON.stringify({ cameraDeviceId: "camera-2" }),
    });

    expect(loadRuntimePreferences().cameraDeviceId).toBe("camera-2");

    const nextPreferences: RuntimePreferences = {
      ...defaultRuntimePreferences,
      cameraDeviceId: "camera-3",
    };
    saveRuntimePreferences(nextPreferences);

    expect(JSON.parse(store.get(STORAGE_KEY) ?? "{}")).toMatchObject({
      cameraDeviceId: "camera-3",
    });
  });

  it("persists landmark policy selection", () => {
    const store = stubLocalStorage({
      [STORAGE_KEY]: JSON.stringify({ landmarkPolicy: "strict" }),
    });

    expect(loadRuntimePreferences().landmarkPolicy).toBe("strict");

    saveRuntimePreferences({
      ...defaultRuntimePreferences,
      landmarkPolicy: "relaxed",
    });

    expect(JSON.parse(store.get(STORAGE_KEY) ?? "{}")).toMatchObject({
      landmarkPolicy: "relaxed",
    });
  });

  it("normalizes legacy demo reminder presets to the product health cadence", () => {
    expect(normalizeReminderMinutes(18)).toBe(50);
    expect(normalizeReminderMinutes(25)).toBe(50);
    expect(normalizeReminderMinutes(35)).toBe(50);
    expect(normalizeReminderMinutes(45)).toBe(45);
    expect(normalizeReminderMinutes(50)).toBe(50);
    expect(normalizeReminderMinutes(60)).toBe(60);

    stubLocalStorage({
      [STORAGE_KEY]: JSON.stringify({ reminderMinutes: 25 }),
    });

    expect(loadRuntimePreferences().reminderMinutes).toBe(50);
  });
});
