/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "@/components/shared/language-provider";
import { resetAudioFeedbackForTests } from "@/runtime/audio";
import { PostureRuntimeProvider, usePostureRuntime } from "@/runtime/posture-runtime-provider";
import { loadRecentEvents } from "@/runtime/storage";
import type { PoseWorkerMessage, PoseWorkerResult } from "@/runtime/worker-protocol";
import type {
  ContextFeatures,
  FrameMetricsResult,
  LandmarkSample,
  MetricAvailability,
  RuntimePreferences,
  TrackingLostReason,
  WorkerErrorCode,
} from "@/runtime/types";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const landmark = { x: 0.5, y: 0.5, z: 0, visibility: 0.95 };
const landmarks: LandmarkSample = {
  nose: landmark,
  leftEar: landmark,
  rightEar: landmark,
  leftEye: landmark,
  rightEye: landmark,
  leftShoulder: landmark,
  rightShoulder: landmark,
  leftHip: landmark,
  rightHip: landmark,
};

const neutralMetrics: FrameMetricsResult["metrics"] = {
  headForward: 0.08,
  torsoLean: 3,
  shoulderTilt: 2,
  screenDistanceRatio: 0.12,
};

const heavyLoadMetrics: FrameMetricsResult["metrics"] = {
  headForward: 0.22,
  torsoLean: 20,
  shoulderTilt: 20,
  screenDistanceRatio: 0.12,
};

const allMetricsAvailable: MetricAvailability = {
  headForward: true,
  torsoLean: true,
  shoulderTilt: true,
};

const relaxedMetricsAvailable: MetricAvailability = {
  headForward: true,
  torsoLean: false,
  shoulderTilt: true,
};

const defaultContextFeatures: ContextFeatures = {
  gazeDown: 0.15,
  deskWork: 0.4,
  handheldDeviceProxy: 0.05,
  bilateralHandActivity: 0.15,
  dominantFineMotorHand: "both",
  handElevation: 0.05,
  torsoConfidence: 0.9,
  handConfidence: 0.85,
  occludedHands: false,
  occludedTorso: false,
};

class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((event: MessageEvent<PoseWorkerResult>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessageerror: (() => void) | null = null;
  started = false;
  config: PoseWorkerMessage | null = null;

  constructor() {
    FakeWorker.instances.push(this);
  }

  postMessage(message: PoseWorkerMessage) {
    if (message.type === "INIT") {
      queueMicrotask(() => this.emit({ type: "READY" }));
    }
    if (message.type === "START") {
      this.started = true;
    }
    if (message.type === "STOP") {
      this.started = false;
    }
    if (message.type === "UPDATE_CONFIG") {
      this.config = message;
    }
  }

  terminate() {
    this.started = false;
  }

  emit(result: PoseWorkerResult) {
    this.onmessage?.({ data: result } as MessageEvent<PoseWorkerResult>);
  }

  emitObservation(
    timestamp: number,
    overrides: Omit<Partial<FrameMetricsResult>, "contextFeatures"> & { contextFeatures?: Partial<ContextFeatures> } = {},
  ) {
    this.emit({
      type: "FRAME_RESULT",
      payload: {
        timestamp,
        metrics: overrides.metrics ?? neutralMetrics,
        metricAvailability: overrides.metricAvailability ?? allMetricsAvailable,
        landmarks: { ...landmarks, ...(overrides.landmarks ?? {}) },
        contextFeatures: {
          ...defaultContextFeatures,
          ...(overrides.contextFeatures ?? {}),
        },
        subsystemConfidence: overrides.subsystemConfidence ?? { face: 0.95, torso: 0.9, hands: 0.85 },
        distanceEstimate: overrides.distanceEstimate ?? null,
        trackingReliability: overrides.trackingReliability ?? "full",
        observationMode: overrides.observationMode ?? "holistic",
        cameraView: overrides.cameraView ?? "frontal",
      },
    });
  }

  emitFrame(timestamp: number, metrics = neutralMetrics, metricAvailability = allMetricsAvailable) {
    this.emitObservation(timestamp, { metrics, metricAvailability });
  }

  emitTrackingLost(timestamp: number, reason: TrackingLostReason = "no-pose") {
    this.emit({
      type: "TRACKING_LOST",
      payload: {
        timestamp,
        reason,
      },
    });
  }

  emitError(code: WorkerErrorCode = "frame-processing-failed", message = "Synthetic worker failure") {
    this.emit({
      type: "ERROR",
      payload: {
        code,
        message,
      },
    });
  }
}

let root: Root | null = null;
let runtime: ReturnType<typeof usePostureRuntime> | null = null;

function stubCueAudio() {
  resetAudioFeedbackForTests();

  const state = {
    oscillatorStarts: 0,
    resumes: 0,
    spoken: [] as string[],
  };

  class FakeAudioContext {
    state: AudioContextState = "suspended";
    currentTime = 0;
    destination = {};

    async resume() {
      state.resumes += 1;
      this.state = "running";
    }

    createOscillator() {
      return {
        type: "sine",
        frequency: { value: 0 },
        connect: vi.fn(),
        start: vi.fn(() => {
          state.oscillatorStarts += 1;
        }),
        stop: vi.fn(),
      };
    }

    createGain() {
      return {
        gain: { value: 0 },
        connect: vi.fn(),
      };
    }
  }

  class FakeSpeechSynthesisUtterance {
    rate = 1;
    pitch = 1;
    volume = 1;

    constructor(public text: string) {}
  }

  const speechSynthesis = {
    cancel: vi.fn(),
    speak: vi.fn((utterance: FakeSpeechSynthesisUtterance) => {
      state.spoken.push(utterance.text);
    }),
  };

  vi.stubGlobal("AudioContext", FakeAudioContext);
  vi.stubGlobal("SpeechSynthesisUtterance", FakeSpeechSynthesisUtterance);
  vi.stubGlobal("speechSynthesis", speechSynthesis);
  Object.defineProperty(window, "AudioContext", { configurable: true, value: FakeAudioContext });
  Object.defineProperty(window, "SpeechSynthesisUtterance", { configurable: true, value: FakeSpeechSynthesisUtterance });
  Object.defineProperty(window, "speechSynthesis", { configurable: true, value: speechSynthesis });

  return state;
}

function RuntimeHarness() {
  runtime = usePostureRuntime();
  return null;
}

function renderRuntime(children: ReactNode = <RuntimeHarness />) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      <LanguageProvider>
        <PostureRuntimeProvider>{children}</PostureRuntimeProvider>
      </LanguageProvider>,
    );
  });
}

async function startRuntime() {
  await act(async () => {
    await runtime?.startMonitoring();
  });
  expect(FakeWorker.instances.at(-1)?.started).toBe(true);
}

async function flushAsync() {
  await act(async () => {
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  });
}

async function waitForRuntime(predicate: () => boolean, timeoutMs = 1500) {
  const startedAt = Date.now();
  while (!predicate()) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error("Timed out while waiting for runtime state.");
    }
    await flushAsync();
  }
}

async function emitCalibrationRetry(worker: FakeWorker, start: number, reason: TrackingLostReason = "no-pose") {
  await act(async () => {
    for (let index = 0; index <= 11; index += 1) {
      worker.emitTrackingLost(start + index * 1000, reason);
    }
  });
}

async function stabilizeCalibrationRetry(worker: FakeWorker, start: number) {
  await act(async () => {
    worker.emitFrame(start);
    worker.emitFrame(start + 800);
  });
}

describe("posture runtime provider integration", () => {
  beforeEach(() => {
    localStorage.clear();
    FakeWorker.instances = [];
    runtime = null;
    vi.stubGlobal("Worker", FakeWorker);
    vi.stubGlobal("crypto", { randomUUID: () => "session-1" });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        enumerateDevices: vi.fn(async () => [
          {
            kind: "videoinput",
            deviceId: "camera-1",
            label: "Integrated Webcam",
          },
        ]),
        getUserMedia: vi.fn(async () => ({
          getTracks: () => [{ stop: vi.fn() }],
          getVideoTracks: () => [
            {
              label: "Integrated Webcam",
              getSettings: () => ({ deviceId: "camera-1" }),
            },
          ],
        })),
      },
    });
    Object.defineProperty(HTMLMediaElement.prototype, "play", {
      configurable: true,
      value: vi.fn(async () => undefined),
    });
  });

  afterEach(async () => {
    if (runtime?.monitoringStatus !== "idle") {
      await act(async () => {
        await runtime?.stopMonitoring();
      });
    }
    act(() => {
      root?.unmount();
    });
    root = null;
    resetAudioFeedbackForTests();
    vi.unstubAllGlobals();
  });

  it("calibrates from valid worker frames and starts scoring only after baseline", async () => {
    renderRuntime();
    await startRuntime();

    const worker = FakeWorker.instances.at(-1)!;
    const start = Date.now();

    expect(worker.config).toMatchObject({
      type: "UPDATE_CONFIG",
      payload: {
        landmarkPolicy: "relaxed",
      },
    });

    for (let index = 0; index <= 5; index += 1) {
      await act(async () => {
        worker.emitFrame(start + index * 1000);
      });
    }

    expect(runtime?.monitoringStatus).toBe("tracking");
    expect(runtime?.sessionScore).toBe(0);

    await act(async () => {
      worker.emitFrame(start + 6_000);
    });

    expect(runtime?.sessionScore).toBeGreaterThan(0);
    expect(runtime?.runtimeDiagnostics.validFrames).toBeGreaterThan(6);
    expect(runtime?.runtimeDiagnostics.selectedCameraLabel).toBe("Integrated Webcam");
  });

  it("calibrates in relaxed mode when hip landmarks are unavailable", async () => {
    renderRuntime();
    await startRuntime();

    const worker = FakeWorker.instances.at(-1)!;
    const start = Date.now();

    for (let index = 0; index <= 5; index += 1) {
      await act(async () => {
        worker.emitFrame(start + index * 1000, { ...neutralMetrics, torsoLean: 0 }, relaxedMetricsAvailable);
      });
    }

    expect(runtime?.monitoringStatus).toBe("tracking");
    expect(runtime?.runtimeDiagnostics.metricAvailability.torsoLean).toBe(false);

    await act(async () => {
      worker.emitFrame(start + 6_000, { ...neutralMetrics, torsoLean: 0 }, relaxedMetricsAvailable);
    });

    expect(runtime?.sessionScore).toBeGreaterThan(0);
    expect(runtime?.liveMetrics?.torsoLean).toBe(0);
  });

  it("does not loop calibration when the startup posture is already slouched", async () => {
    renderRuntime();
    await startRuntime();

    const worker = FakeWorker.instances.at(-1)!;
    const start = Date.now();

    for (let index = 0; index <= 5; index += 1) {
      await act(async () => {
        worker.emitFrame(start + index * 1000, heavyLoadMetrics);
      });
    }

    expect(runtime?.monitoringStatus).toBe("tracking");

    await act(async () => {
      worker.emitFrame(start + 6_000, heavyLoadMetrics);
    });

    expect(runtime?.monitoringStatus).toBe("tracking");
    expect(runtime?.liveScore).toBeLessThan(100);
    expect(runtime?.currentIssue).not.toBeNull();
  });

  it("keeps session score stable while live score reacts within a few frames", async () => {
    renderRuntime();
    await startRuntime();

    const worker = FakeWorker.instances.at(-1)!;
    const start = Date.now();

    for (let index = 0; index <= 15; index += 1) {
      await act(async () => {
        worker.emitFrame(start + index * 1000);
      });
    }

    await act(async () => {
      worker.emitObservation(start + 16_000, {
        contextFeatures: {
          gazeDown: 0.05,
          deskWork: 0.2,
          bilateralHandActivity: 0.05,
          dominantFineMotorHand: "none",
          handElevation: 0.05,
        },
      });
    });

    act(() => {
      runtime?.setTaskOverride("idle-focus");
    });

    await act(async () => {
      worker.emitObservation(start + 17_000, {
        metrics: heavyLoadMetrics,
        contextFeatures: {
          gazeDown: 0.05,
          deskWork: 0.2,
          bilateralHandActivity: 0.05,
          dominantFineMotorHand: "none",
          handElevation: 0.05,
        },
      });
      worker.emitObservation(start + 18_000, {
        metrics: heavyLoadMetrics,
        contextFeatures: {
          gazeDown: 0.05,
          deskWork: 0.2,
          bilateralHandActivity: 0.05,
          dominantFineMotorHand: "none",
          handElevation: 0.05,
        },
      });
      worker.emitObservation(start + 19_000, {
        metrics: heavyLoadMetrics,
        contextFeatures: {
          gazeDown: 0.05,
          deskWork: 0.2,
          bilateralHandActivity: 0.05,
          dominantFineMotorHand: "none",
          handElevation: 0.05,
        },
      });
    });

    expect(runtime?.sessionScore).toBe(100);
    expect(runtime?.liveScoreReliable).toBe(true);
    expect(runtime?.liveScore).toBeLessThan(runtime?.sessionScore ?? 100);
    expect(runtime?.postureState).not.toBe("good");
    expect(runtime?.currentIssue).not.toBeNull();
  });

  it("resets calibration and worker config when landmark policy changes mid-session", async () => {
    renderRuntime();
    await startRuntime();

    const worker = FakeWorker.instances.at(-1)!;
    const start = Date.now();

    for (let index = 0; index <= 15; index += 1) {
      await act(async () => {
        worker.emitFrame(start + index * 1000, { ...neutralMetrics, torsoLean: 0 }, relaxedMetricsAvailable);
      });
    }
    expect(runtime?.monitoringStatus).toBe("tracking");

    act(() => {
      runtime?.updatePreferences({ landmarkPolicy: "strict" });
    });

    expect(runtime?.monitoringStatus).toBe("calibrating");
    expect(runtime?.sessionScore).toBe(0);
    expect(worker.config).toMatchObject({
      type: "UPDATE_CONFIG",
      payload: {
        landmarkPolicy: "strict",
      },
    });
  });

  it("triggers break reminders by tracked time on the 45-60 minute health cadence", async () => {
    renderRuntime();
    act(() => {
      runtime?.updatePreferences({ reminderMinutes: 50 });
    });
    await startRuntime();

    const worker = FakeWorker.instances.at(-1)!;
    const start = Date.now();

    for (let index = 0; index <= 15; index += 1) {
      await act(async () => {
        worker.emitFrame(start + index * 1000);
      });
    }

    await act(async () => {
      for (let index = 16; index <= 50 * 60 + 20; index += 1) {
        worker.emitFrame(start + index * 1000);
      }
    });

    expect(runtime?.currentCue?.kind).toBe("break");
    expect(runtime?.todaySummary?.breakReminderCount).toBe(1);
  });

  it("uses the selected voice mode for timed break reminders", async () => {
    const audio = stubCueAudio();
    renderRuntime();
    act(() => {
      runtime?.updatePreferences({ feedbackMode: "voice", reminderMinutes: 50 });
    });
    await startRuntime();

    const worker = FakeWorker.instances.at(-1)!;
    const start = Date.now();

    for (let index = 0; index <= 15; index += 1) {
      await act(async () => {
        worker.emitFrame(start + index * 1000);
      });
    }

    await act(async () => {
      for (let index = 16; index <= 50 * 60 + 20; index += 1) {
        worker.emitFrame(start + index * 1000);
      }
    });

    expect(runtime?.currentCue?.kind).toBe("break");
    expect(audio.resumes).toBeGreaterThan(0);
    expect(audio.oscillatorStarts).toBeGreaterThan(0);
    expect(audio.spoken.at(-1)).toContain(runtime?.currentCue?.title);
  });

  it("surfaces sustained screen distance advisories without reducing posture score", async () => {
    renderRuntime();
    await startRuntime();

    const worker = FakeWorker.instances.at(-1)!;
    const start = Date.now();

    for (let index = 0; index <= 15; index += 1) {
      await act(async () => {
        worker.emitFrame(start + index * 1000);
      });
    }

    act(() => {
      runtime?.setTaskOverride("typing");
    });

    await act(async () => {
      for (let index = 16; index <= 22; index += 1) {
        worker.emitFrame(start + index * 1000, { ...neutralMetrics, screenDistanceRatio: 0.4 });
      }
    });

    expect(runtime?.distanceStatus).toBe("too-close");
    expect(runtime?.currentCue?.kind).toBe("distance");
    expect(runtime?.sessionScore).toBeGreaterThan(95);
  });

  it("uses the selected sound mode for distance advisories", async () => {
    const audio = stubCueAudio();
    renderRuntime();
    act(() => {
      runtime?.updatePreferences({ feedbackMode: "sound" });
    });
    await startRuntime();

    const worker = FakeWorker.instances.at(-1)!;
    const start = Date.now();

    for (let index = 0; index <= 15; index += 1) {
      await act(async () => {
        worker.emitFrame(start + index * 1000);
      });
    }

    act(() => {
      runtime?.setTaskOverride("typing");
    });

    await act(async () => {
      for (let index = 16; index <= 22; index += 1) {
        worker.emitFrame(start + index * 1000, { ...neutralMetrics, screenDistanceRatio: 0.4 });
      }
    });

    expect(runtime?.currentCue?.kind).toBe("distance");
    expect(audio.oscillatorStarts).toBeGreaterThan(0);
    expect(audio.spoken).toHaveLength(0);
  });

  it("restarts the distance advisory timer when the too-close/too-far direction changes", async () => {
    renderRuntime();
    await startRuntime();

    const worker = FakeWorker.instances.at(-1)!;
    const start = Date.now();

    for (let index = 0; index <= 15; index += 1) {
      await act(async () => {
        worker.emitFrame(start + index * 1000);
      });
    }

    act(() => {
      runtime?.setTaskOverride("typing");
    });

    await act(async () => {
      worker.emitFrame(start + 16_000, { ...neutralMetrics, screenDistanceRatio: 0.4 });
      worker.emitFrame(start + 17_000, { ...neutralMetrics, screenDistanceRatio: 0.4 });
      for (let index = 18; index <= 28; index += 1) {
        worker.emitFrame(start + index * 1000, { ...neutralMetrics, screenDistanceRatio: 0.02 });
      }
    });

    expect(runtime?.distanceStatus).toBe("too-far");
    expect(runtime?.currentCue?.kind).toBe("distance");
    expect(runtime?.todaySummary?.screenDistanceWarningCount).toBe(1);
  });

  it("does not treat side-camera eye span collapse as too-far distance", async () => {
    renderRuntime();
    await startRuntime();

    const worker = FakeWorker.instances.at(-1)!;
    const start = Date.now();

    for (let index = 0; index <= 15; index += 1) {
      await act(async () => {
        worker.emitFrame(start + index * 1000);
      });
    }

    act(() => {
      runtime?.setTaskOverride("typing");
    });

    await act(async () => {
      for (let index = 16; index <= 26; index += 1) {
        worker.emitObservation(start + index * 1000, {
          metrics: { ...neutralMetrics, screenDistanceRatio: 0.02 },
          cameraView: "side",
        });
      }
    });

    expect(runtime?.runtimeDiagnostics.cameraView).toBe("side");
    expect(runtime?.distanceStatus).toBe("ok");
    expect(runtime?.distanceSuppressionReason).toBe("side-view-distance-unreliable");
    expect(runtime?.currentCue?.kind).not.toBe("distance");
  });

  it("still detects too-close screen work when calibration happened from an already-close baseline", async () => {
    renderRuntime();
    await startRuntime();

    const worker = FakeWorker.instances.at(-1)!;
    const start = Date.now();

    for (let index = 0; index <= 15; index += 1) {
      await act(async () => {
        worker.emitObservation(start + index * 1000, {
          metrics: {
            ...neutralMetrics,
            screenDistanceRatio: 0.28,
          },
          distanceEstimate: {
            centimeters: 33,
            confidence: 0.82,
            source: "face-mesh",
            world3DInterocularCm: 6.3,
          },
        });
      });
    }

    act(() => {
      runtime?.setTaskOverride("typing");
    });

    await act(async () => {
      for (let index = 16; index <= 22; index += 1) {
        worker.emitObservation(start + index * 1000, {
          metrics: {
            ...neutralMetrics,
            screenDistanceRatio: 0.3,
          },
          distanceEstimate: {
            centimeters: 34,
            confidence: 0.82,
            source: "face-mesh",
            world3DInterocularCm: 6.3,
          },
        });
      }
    });

    expect(runtime?.distanceStatus).toBe("too-close");
    expect(runtime?.currentCue?.kind).toBe("distance");
  });

  it("restores distance detect in soft mode for unknown screen-like work", async () => {
    renderRuntime();
    await startRuntime();

    const worker = FakeWorker.instances.at(-1)!;
    const start = Date.now();

    for (let index = 0; index <= 5; index += 1) {
      await act(async () => {
        worker.emitFrame(start + index * 1000);
      });
    }

    await act(async () => {
      for (let index = 6; index <= 14; index += 1) {
        worker.emitObservation(start + index * 1000, {
          metrics: {
            ...neutralMetrics,
            screenDistanceRatio: 0.4,
          },
          trackingReliability: "partial",
          contextFeatures: {
            gazeDown: 0.55,
            deskWork: 0.4,
            handheldDeviceProxy: 0.3,
            bilateralHandActivity: 0.1,
            dominantFineMotorHand: "none",
            handElevation: 0.3,
            torsoConfidence: 0.3,
            handConfidence: 0.15,
          },
        });
      }
    });

    expect(runtime?.detectedTask).toBe("unknown");
    expect(runtime?.effectiveTask).toBe("unknown");
    expect(runtime?.distanceMode).toBe("soft");
    expect(runtime?.distanceStatus).toBe("too-close");
    expect(runtime?.currentCue?.kind).toBe("distance");
  });

  it("ignores late worker frames while paused and does not count the pause gap after resume", async () => {
    renderRuntime();
    await startRuntime();

    const worker = FakeWorker.instances.at(-1)!;
    const start = Date.now();

    for (let index = 0; index <= 6; index += 1) {
      await act(async () => {
        worker.emitFrame(start + index * 1000);
      });
    }

    const scoreBeforePause = runtime?.sessionScore ?? 0;
    act(() => {
      runtime?.pauseMonitoring();
    });

    await act(async () => {
      worker.emitFrame(start + 50 * 60 * 1000, {
        ...neutralMetrics,
        headForward: 1,
        shoulderTilt: 45,
      });
    });

    expect(runtime?.monitoringStatus).toBe("paused");
    expect(runtime?.sessionScore).toBe(scoreBeforePause);

    act(() => {
      runtime?.resumeMonitoring();
    });

    await act(async () => {
      worker.emitFrame(start + 50 * 60 * 1000 + 1000);
      worker.emitFrame(start + 50 * 60 * 1000 + 2000);
    });

    expect(runtime?.currentCue?.kind).not.toBe("break");
    expect(runtime?.todaySummary?.trackedMs ?? 0).toBeLessThan(10_000);
  });

  it("flushes the current session and releases runtime state when the worker fails", async () => {
    renderRuntime();
    await startRuntime();

    const worker = FakeWorker.instances.at(-1)!;
    const start = Date.now();

    for (let index = 0; index <= 17; index += 1) {
      await act(async () => {
        worker.emitFrame(start + index * 1000);
      });
    }

    await act(async () => {
      worker.emitError("frame-processing-failed", "Synthetic worker failure");
    });
    await waitForRuntime(() => runtime?.monitoringStatus === "error");

    const events = await loadRecentEvents(20);
    expect(runtime?.monitoringStatus).toBe("error");
    expect(runtime?.runtimeError).toBe("Synthetic worker failure");
    expect(runtime?.stream).toBeNull();
    expect(events.some((event) => event.kind === "session-stop" && event.detail?.includes("worker error"))).toBe(true);
  });

  it("surfaces calibration retry instead of silently resetting when landmarks never become valid", async () => {
    renderRuntime();
    await startRuntime();

    const worker = FakeWorker.instances.at(-1)!;
    const start = Date.now();

    for (let index = 0; index <= 21; index += 1) {
      await act(async () => {
        worker.emitTrackingLost(start + index * 1000);
      });
    }

    expect(runtime?.monitoringStatus).toBe("calibration-retry");
    expect(runtime?.runtimeDiagnostics.lastTrackingLostReason).toBe("no-pose");
    expect(runtime?.sessionScore).toBe(0);
  });

  it("keeps strict mode in calibration retry when hip landmarks are missing", async () => {
    renderRuntime();
    act(() => {
      runtime?.updatePreferences({ landmarkPolicy: "strict" });
    });
    await startRuntime();

    const worker = FakeWorker.instances.at(-1)!;
    const start = Date.now();

    for (let index = 0; index <= 21; index += 1) {
      await act(async () => {
        worker.emitTrackingLost(start + index * 1000, "low-confidence-hips");
      });
    }

    expect(worker.config).toMatchObject({
      type: "UPDATE_CONFIG",
      payload: {
        landmarkPolicy: "strict",
      },
    });
    expect(runtime?.monitoringStatus).toBe("calibration-retry");
    expect(runtime?.runtimeDiagnostics.lastTrackingLostReason).toBe("low-confidence-hips");
  });

  it("resets consecutive calibration retries when landmark policy starts a new calibration", async () => {
    renderRuntime();
    await startRuntime();

    const worker = FakeWorker.instances.at(-1)!;
    const start = Date.now();

    for (let cycle = 0; cycle < 3; cycle += 1) {
      const cycleStart = start + cycle * 14_000;
      await emitCalibrationRetry(worker, cycleStart);
      expect(runtime?.monitoringStatus).toBe("calibration-retry");

      await stabilizeCalibrationRetry(worker, cycleStart + 12_000);
      expect(runtime?.monitoringStatus).toBe("calibrating");
    }

    act(() => {
      runtime?.updatePreferences({ landmarkPolicy: "strict" });
    });
    expect(runtime?.monitoringStatus).toBe("calibrating");

    await emitCalibrationRetry(worker, start + 60_000, "low-confidence-hips");

    expect(runtime?.monitoringStatus).toBe("calibration-retry");
    expect(runtime?.runtimeDiagnostics.lastTrackingLostReason).toBe("low-confidence-hips");
  });

  it("persists the selected camera and falls back when the device disappears", async () => {
    renderRuntime();
    act(() => {
      runtime?.updatePreferences({ cameraDeviceId: "missing-camera" } satisfies Partial<RuntimePreferences>);
    });

    const mediaDevices = navigator.mediaDevices as MediaDevices & {
      getUserMedia: ReturnType<typeof vi.fn>;
    };
    mediaDevices.getUserMedia = vi
      .fn()
      .mockRejectedValueOnce(new DOMException("Missing camera", "NotFoundError"))
      .mockResolvedValueOnce({
        getTracks: () => [{ stop: vi.fn() }],
        getVideoTracks: () => [
          {
            label: "Fallback Webcam",
            getSettings: () => ({ deviceId: "fallback-camera" }),
          },
        ],
      });

    await startRuntime();

    expect(mediaDevices.getUserMedia).toHaveBeenCalledTimes(2);
    expect(runtime?.preferences.cameraDeviceId).toBeUndefined();
    expect(runtime?.runtimeDiagnostics.selectedCameraLabel).toBe("Fallback Webcam");
  });

  it("retries the default camera without facingMode when the user-facing constraint is rejected", async () => {
    renderRuntime();

    const mediaDevices = navigator.mediaDevices as MediaDevices & {
      getUserMedia: ReturnType<typeof vi.fn>;
    };
    mediaDevices.getUserMedia = vi
      .fn()
      .mockRejectedValueOnce(new DOMException("Cannot satisfy facing mode", "OverconstrainedError"))
      .mockResolvedValueOnce({
        getTracks: () => [{ stop: vi.fn() }],
        getVideoTracks: () => [
          {
            label: "Default Webcam",
            getSettings: () => ({ deviceId: "default-camera" }),
          },
        ],
      });

    await startRuntime();

    const firstCall = mediaDevices.getUserMedia.mock.calls[0]?.[0] as MediaStreamConstraints;
    const secondCall = mediaDevices.getUserMedia.mock.calls[1]?.[0] as MediaStreamConstraints;
    expect(mediaDevices.getUserMedia).toHaveBeenCalledTimes(2);
    expect(firstCall.video).toMatchObject({ facingMode: "user" });
    expect(secondCall.video).toMatchObject({
      width: { ideal: 1280 },
      height: { ideal: 720 },
    });
    expect(secondCall.video).not.toHaveProperty("facingMode");
    expect(runtime?.runtimeDiagnostics.selectedCameraLabel).toBe("Default Webcam");
  });

  it("does not trigger a feedback cue for short handwriting load that stays inside the hold budget", async () => {
    renderRuntime();
    await startRuntime();

    const worker = FakeWorker.instances.at(-1)!;
    const start = Date.now();

    for (let index = 0; index <= 15; index += 1) {
      await act(async () => {
        worker.emitObservation(start + index * 1000, {
          contextFeatures: {
            gazeDown: 0.85,
            deskWork: 0.85,
            bilateralHandActivity: 0.15,
            dominantFineMotorHand: "right",
            handElevation: 0.05,
          },
        });
      });
    }

    act(() => {
      runtime?.setTaskOverride("handwriting");
    });

    await act(async () => {
      for (let index = 16; index <= 35; index += 1) {
        worker.emitObservation(start + index * 1000, {
          metrics: {
            ...neutralMetrics,
            headForward: 0.14,
            torsoLean: 8,
          },
          contextFeatures: {
            gazeDown: 0.9,
            deskWork: 0.9,
            bilateralHandActivity: 0.1,
            dominantFineMotorHand: "right",
            handElevation: 0.05,
          },
        });
      }
    });

    expect(runtime?.effectiveTask).toBe("handwriting");
    expect(runtime?.currentIssue).toBe("forward-head");
    expect(runtime?.postureState).toBe("warning");
    expect(runtime?.currentCue?.kind).not.toBe("feedback");
  });

  it("keeps soft distance advisories active when handwriting is clearly too close", async () => {
    renderRuntime();
    await startRuntime();

    const worker = FakeWorker.instances.at(-1)!;
    const start = Date.now();

    for (let index = 0; index <= 15; index += 1) {
      await act(async () => {
        worker.emitObservation(start + index * 1000);
      });
    }

    act(() => {
      runtime?.setTaskOverride("handwriting");
    });

    await act(async () => {
      for (let index = 16; index <= 24; index += 1) {
        worker.emitObservation(start + index * 1000, {
          metrics: {
            ...neutralMetrics,
            screenDistanceRatio: 0.4,
          },
          contextFeatures: {
            gazeDown: 0.9,
            deskWork: 0.9,
            dominantFineMotorHand: "right",
          },
        });
      }
    });

    expect(runtime?.taskOverride).toBe("handwriting");
    expect(runtime?.effectiveTask).toBe("handwriting");
    expect(runtime?.distanceMode).toBe("soft");
    expect(runtime?.distanceStatus).toBe("too-close");
    expect(runtime?.currentCue?.kind).toBe("distance");
  });

  it("persists feedback metadata from the current frame instead of stale runtime state", async () => {
    renderRuntime();
    await startRuntime();

    const worker = FakeWorker.instances.at(-1)!;
    const start = Date.now();

    for (let index = 0; index <= 15; index += 1) {
      await act(async () => {
        worker.emitObservation(start + index * 1000);
      });
    }

    act(() => {
      runtime?.setTaskOverride("idle-focus");
    });

    await act(async () => {
      for (let index = 16; index <= 25; index += 1) {
        worker.emitObservation(start + index * 1000, {
          metrics: heavyLoadMetrics,
          trackingReliability: "full",
          contextFeatures: {
            gazeDown: 0.05,
            deskWork: 0.2,
            bilateralHandActivity: 0.05,
            dominantFineMotorHand: "none",
            handElevation: 0.05,
          },
        });
      }
    });

    await act(async () => {
      for (let index = 26; index <= 105; index += 1) {
        worker.emitObservation(start + index * 1000, {
          metrics: heavyLoadMetrics,
          trackingReliability: "partial",
          contextFeatures: {
            gazeDown: 0.05,
            deskWork: 0.2,
            bilateralHandActivity: 0.05,
            dominantFineMotorHand: "none",
            handElevation: 0.05,
          },
        });
      }
    });

    const feedbackEvent = runtime?.feedbackHistory.find((event) => event.kind === "feedback");
    expect(runtime?.currentCue?.kind).toBe("feedback");
    expect(feedbackEvent?.trackingReliability).toBe("partial");
    expect(feedbackEvent?.taskState).toBe("idle-focus");
    expect(feedbackEvent?.exposureLevel).toBe(runtime?.exposureLevel);
  });

  it("does not escalate to level 3 when the current frames are minimal reliability", async () => {
    renderRuntime();
    await startRuntime();

    const worker = FakeWorker.instances.at(-1)!;
    const start = Date.now();

    for (let index = 0; index <= 15; index += 1) {
      await act(async () => {
        worker.emitObservation(start + index * 1000);
      });
    }

    act(() => {
      runtime?.setTaskOverride("idle-focus");
    });

    await act(async () => {
      for (let index = 16; index <= 95; index += 1) {
        worker.emitObservation(start + index * 1000, {
          metrics: heavyLoadMetrics,
          trackingReliability: "full",
          contextFeatures: {
            gazeDown: 0.05,
            deskWork: 0.2,
            bilateralHandActivity: 0.05,
            dominantFineMotorHand: "none",
            handElevation: 0.05,
          },
        });
      }
    });

    expect(runtime?.currentCue?.kind).toBe("feedback");
    const feedbackLevelBeforeMinimal = runtime?.currentCue?.level;
    expect(feedbackLevelBeforeMinimal).toBeDefined();

    await act(async () => {
      for (let index = 96; index <= 135; index += 1) {
        worker.emitObservation(start + index * 1000, {
          metrics: heavyLoadMetrics,
          trackingReliability: "minimal",
          contextFeatures: {
            gazeDown: 0.05,
            deskWork: 0.2,
            bilateralHandActivity: 0.05,
            dominantFineMotorHand: "none",
            handElevation: 0.05,
          },
        });
      }
    });

    expect(runtime?.currentCue?.kind).toBe("feedback");
    expect(runtime?.currentCue?.level).toBe(feedbackLevelBeforeMinimal);
  });

  it("keeps the manual task frozen briefly when switching back to Auto", async () => {
    renderRuntime();
    await startRuntime();

    const worker = FakeWorker.instances.at(-1)!;
    const start = Date.now();

    for (let index = 0; index <= 15; index += 1) {
      await act(async () => {
        worker.emitObservation(start + index * 1000);
      });
    }

    await act(async () => {
      for (let index = 16; index <= 22; index += 1) {
        worker.emitObservation(start + index * 1000, {
          contextFeatures: {
            gazeDown: 0.85,
            deskWork: 0.8,
            bilateralHandActivity: 0.05,
            dominantFineMotorHand: "none",
            handElevation: 0.05,
          },
        });
      }
    });

    expect(runtime?.detectedTask).toBe("reading");

    act(() => {
      runtime?.setTaskOverride("handwriting");
    });

    expect(runtime?.effectiveTask).toBe("handwriting");

    act(() => {
      runtime?.setTaskOverride("auto");
    });

    expect(runtime?.taskOverride).toBe("auto");
    expect(runtime?.effectiveTask).toBe("handwriting");

    await act(async () => {
      worker.emitObservation(start + 23_000, {
        contextFeatures: {
          gazeDown: 0.85,
          deskWork: 0.8,
          bilateralHandActivity: 0.05,
          dominantFineMotorHand: "none",
          handElevation: 0.05,
        },
      });
      worker.emitObservation(start + 24_000, {
        contextFeatures: {
          gazeDown: 0.85,
          deskWork: 0.8,
          bilateralHandActivity: 0.05,
          dominantFineMotorHand: "none",
          handElevation: 0.05,
        },
      });
    });

    expect(runtime?.effectiveTask).toBe("handwriting");

    await act(async () => {
      worker.emitObservation(start + 25_000, {
        contextFeatures: {
          gazeDown: 0.85,
          deskWork: 0.8,
          bilateralHandActivity: 0.05,
          dominantFineMotorHand: "none",
          handElevation: 0.05,
        },
      });
    });

    expect(runtime?.effectiveTask).toBe("reading");
  });

  it("does not award a correction success until the exposure engine marks recovery active", async () => {
    renderRuntime();
    await startRuntime();

    const worker = FakeWorker.instances.at(-1)!;
    const start = Date.now();

    for (let index = 0; index <= 15; index += 1) {
      await act(async () => {
        worker.emitObservation(start + index * 1000);
      });
    }

    act(() => {
      runtime?.setTaskOverride("idle-focus");
    });

    await act(async () => {
      for (let index = 16; index <= 95; index += 1) {
        worker.emitObservation(start + index * 1000, {
          metrics: heavyLoadMetrics,
          trackingReliability: "full",
          contextFeatures: {
            gazeDown: 0.05,
            deskWork: 0.2,
            bilateralHandActivity: 0.05,
            dominantFineMotorHand: "none",
            handElevation: 0.05,
          },
        });
      }
    });

    expect(runtime?.currentCue?.kind).toBe("feedback");

    await act(async () => {
      for (let index = 40; index <= 49; index += 1) {
        worker.emitObservation(start + index * 1000, {
          metrics: neutralMetrics,
          trackingReliability: "full",
          contextFeatures: {
            gazeDown: 0.05,
            deskWork: 0.2,
            bilateralHandActivity: 0.05,
            dominantFineMotorHand: "none",
            handElevation: 0.05,
          },
        });
      }
    });

    expect(runtime?.feedbackHistory.some((event) => event.kind === "correction-success")).toBe(false);
    expect(runtime?.currentCue?.kind).not.toBe("reward");
  });

  it("uses the selected voice mode for correction rewards", async () => {
    const audio = stubCueAudio();
    renderRuntime();
    await startRuntime();

    const worker = FakeWorker.instances.at(-1)!;
    const start = Date.now();

    for (let index = 0; index <= 15; index += 1) {
      await act(async () => {
        worker.emitObservation(start + index * 1000);
      });
    }

    act(() => {
      runtime?.setTaskOverride("idle-focus");
    });

    await act(async () => {
      for (let index = 16; index <= 95; index += 1) {
        worker.emitObservation(start + index * 1000, {
          metrics: heavyLoadMetrics,
          trackingReliability: "full",
          contextFeatures: {
            gazeDown: 0.05,
            deskWork: 0.2,
            bilateralHandActivity: 0.05,
            dominantFineMotorHand: "none",
            handElevation: 0.05,
          },
        });
      }
    });

    expect(runtime?.currentCue?.kind).toBe("feedback");
    expect(audio.spoken).toHaveLength(0);

    act(() => {
      runtime?.updatePreferences({ feedbackMode: "voice" });
    });

    await act(async () => {
      for (let index = 96; index <= 130; index += 1) {
        const progress = ((index - 96) % 20) / 19;
        const recoveryMotionMetrics = {
          ...neutralMetrics,
          headForward: 0.08 + progress * 0.032,
          torsoLean: 3 + progress * 6.4,
          shoulderTilt: 2 + progress * 5.4,
        };
        worker.emitObservation(start + index * 1000, {
          metrics: recoveryMotionMetrics,
          trackingReliability: "full",
          contextFeatures: {
            gazeDown: 0.05,
            deskWork: 0.2,
            bilateralHandActivity: 0.05,
            dominantFineMotorHand: "none",
            handElevation: 0.05,
          },
        });
      }
    });

    expect(runtime?.currentCue?.kind).toBe("reward");
    expect(runtime?.feedbackHistory.some((event) => event.kind === "correction-success")).toBe(true);
    expect(audio.oscillatorStarts).toBeGreaterThan(0);
    expect(audio.spoken.at(-1)).toContain(runtime?.currentCue?.title);
  });

  it("suppresses distance advisories when reliability is minimal", async () => {
    renderRuntime();
    await startRuntime();

    const worker = FakeWorker.instances.at(-1)!;
    const start = Date.now();

    for (let index = 0; index <= 15; index += 1) {
      await act(async () => {
        worker.emitObservation(start + index * 1000);
      });
    }

    act(() => {
      runtime?.setTaskOverride("typing");
    });

    await act(async () => {
      for (let index = 16; index <= 26; index += 1) {
        worker.emitObservation(start + index * 1000, {
          metrics: {
            ...neutralMetrics,
            screenDistanceRatio: 0.4,
          },
          trackingReliability: "minimal",
          contextFeatures: {
            gazeDown: 0.05,
            deskWork: 0.75,
            bilateralHandActivity: 0.4,
            dominantFineMotorHand: "both",
            handElevation: 0.05,
          },
        });
      }
    });

    expect(runtime?.distanceStatus).toBe("ok");
    expect(runtime?.currentCue?.kind).not.toBe("distance");
  });

  it("keeps face-mesh close-up distance detection active even when posture reliability drops to minimal", async () => {
    renderRuntime();
    await startRuntime();

    const worker = FakeWorker.instances.at(-1)!;
    const start = Date.now();

    for (let index = 0; index <= 15; index += 1) {
      await act(async () => {
        worker.emitObservation(start + index * 1000, {
          distanceEstimate: {
            centimeters: 49,
            confidence: 0.82,
            source: "face-mesh",
            world3DInterocularCm: 6.3,
          },
        });
      });
    }

    act(() => {
      runtime?.setTaskOverride("handwriting");
    });

    await act(async () => {
      for (let index = 16; index <= 23; index += 1) {
        worker.emitObservation(start + index * 1000, {
          metrics: {
            ...neutralMetrics,
            screenDistanceRatio: 0.38,
          },
          subsystemConfidence: { face: 0.92, torso: 0.18, hands: 0.08 },
          trackingReliability: "minimal",
          distanceEstimate: {
            centimeters: 33,
            confidence: 0.84,
            source: "face-mesh",
            world3DInterocularCm: 6.3,
          },
          contextFeatures: {
            gazeDown: 0.3,
            deskWork: 0.15,
            handheldDeviceProxy: 0.05,
            bilateralHandActivity: 0,
            dominantFineMotorHand: "none",
            handElevation: 0,
            torsoConfidence: 0.18,
            handConfidence: 0.08,
            occludedHands: true,
            occludedTorso: true,
          },
        });
      }
    });

    expect(runtime?.trackingReliability).toBe("minimal");
    expect(runtime?.distanceMode).toBe("soft");
    expect(runtime?.distanceStatus).toBe("too-close");
  });
});
