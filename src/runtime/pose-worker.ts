/// <reference lib="webworker" />

import {
  FilesetResolver,
  HolisticLandmarker,
  PoseLandmarker,
  type HolisticLandmarkerOptions,
  type PoseLandmarkerOptions,
} from "@mediapipe/tasks-vision";
import { computeFrameMetricsWithReason } from "@/runtime/pose-metrics";
import type { PoseWorkerMessage, PoseWorkerResult } from "@/runtime/worker-protocol";
import type { LandmarkPolicy, ObservationMode, WorkerErrorCode } from "@/runtime/types";

// MediaPipe's WASM glue code contains a block-level `function custom_dbg()` declaration
// inside an `if` block. In non-strict mode this is hoisted to the function scope, but
// in strict mode (ES module workers) it is block-scoped and inaccessible outside the `if`.
// Defining it on the global scope here ensures the bare `custom_dbg` identifier resolves
// correctly when MediaPipe calls it during WASM initialization.
(self as unknown as Record<string, unknown>).custom_dbg = (text: string) =>
  console.warn("[mediapipe]", text);

let visibilityThreshold = 0.5;
let landmarkPolicy: LandmarkPolicy = "relaxed";

let poseLandmarker: PoseLandmarker | null = null;
let holisticLandmarker: HolisticLandmarker | null = null;
let observationMode: ObservationMode = "pose-fallback";
let started = false;

type LandmarkerDelegate = "GPU" | "CPU";

const PREFERRED_DELEGATES: readonly LandmarkerDelegate[] = ["GPU", "CPU"];

type MediaPipeWorkerScope = DedicatedWorkerGlobalScope & {
  import?: (url: string) => Promise<void>;
  ModuleFactory?: unknown;
};

const workerScope = self as unknown as MediaPipeWorkerScope;

workerScope.import = async (url: string) => {
  const wasmModule = await import(/* @vite-ignore */ url) as { default?: unknown; ModuleFactory?: unknown };
  workerScope.ModuleFactory = wasmModule.default ?? wasmModule.ModuleFactory ?? workerScope.ModuleFactory;
};

function createGpuCanvas() {
  if (typeof OffscreenCanvas === "undefined") return null;
  return new OffscreenCanvas(1, 1);
}

function getDelegateAttempts() {
  return PREFERRED_DELEGATES.filter((delegate) => delegate === "CPU" || createGpuCanvas() !== null);
}

async function createHolisticLandmarker(
  vision: Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>,
  modelAssetPath: string,
  delegate: LandmarkerDelegate,
) {
  const canvas = delegate === "GPU" ? createGpuCanvas() : null;
  const options: HolisticLandmarkerOptions = {
    baseOptions: {
      modelAssetPath,
      delegate,
    },
    ...(canvas ? { canvas } : {}),
    runningMode: "VIDEO",
    minFaceDetectionConfidence: 0.5,
    minFacePresenceConfidence: 0.5,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minHandLandmarksConfidence: 0.5,
    outputFaceBlendshapes: false,
    outputPoseSegmentationMasks: false,
  };

  return HolisticLandmarker.createFromOptions(vision, options);
}

async function createPoseLandmarker(
  vision: Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>,
  modelAssetPath: string,
  delegate: LandmarkerDelegate,
) {
  const canvas = delegate === "GPU" ? createGpuCanvas() : null;
  const options: PoseLandmarkerOptions = {
    baseOptions: {
      modelAssetPath,
      delegate,
    },
    ...(canvas ? { canvas } : {}),
    runningMode: "VIDEO",
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
    outputSegmentationMasks: false,
  };

  return PoseLandmarker.createFromOptions(vision, options);
}

async function initializeWorker(wasmRoot: string, poseModelAssetPath: string, holisticModelAssetPath?: string) {
  const vision = await FilesetResolver.forVisionTasks(wasmRoot, true);

  holisticLandmarker = null;
  poseLandmarker = null;

  if (holisticModelAssetPath) {
    for (const delegate of getDelegateAttempts()) {
      try {
        holisticLandmarker = await createHolisticLandmarker(vision, holisticModelAssetPath, delegate);
        observationMode = "holistic";
        return;
      } catch (error) {
        console.warn(`[mediapipe] holistic ${delegate} init failed`, error);
      }
      holisticLandmarker = null;
    }
  }

  let lastPoseError: unknown = null;
  for (const delegate of getDelegateAttempts()) {
    try {
      poseLandmarker = await createPoseLandmarker(vision, poseModelAssetPath, delegate);
      observationMode = "pose-fallback";
      return;
    } catch (error) {
      lastPoseError = error;
      console.warn(`[mediapipe] pose ${delegate} init failed`, error);
    }
  }

  throw lastPoseError ?? new Error("MediaPipe Pose Landmarker failed to initialize.");
}

self.onmessage = async (event: MessageEvent<PoseWorkerMessage>) => {
  const postResult = (result: PoseWorkerResult) => {
    (self as unknown as DedicatedWorkerGlobalScope).postMessage(result);
  };
  const postError = (code: WorkerErrorCode, message: string) => {
    postResult({ type: "ERROR", payload: { code, message } });
  };

  try {
    switch (event.data.type) {
      case "INIT": {
        try {
          await initializeWorker(
            event.data.payload.wasmRoot,
            event.data.payload.poseModelAssetPath,
            event.data.payload.holisticModelAssetPath,
          );
          postResult({ type: "READY" });
        } catch (error) {
          const message = error instanceof Error ? error.message : "MediaPipe Pose Landmarker failed to initialize.";
          postError("mediapipe-init-failed", message);
        }
        break;
      }
      case "START": {
        started = true;
        break;
      }
      case "STOP": {
        started = false;
        break;
      }
      case "UPDATE_CONFIG": {
        if (event.data.payload?.visibilityThreshold !== undefined) {
          visibilityThreshold = event.data.payload.visibilityThreshold;
        }
        if (event.data.payload?.landmarkPolicy) {
          landmarkPolicy = event.data.payload.landmarkPolicy;
        }
        break;
      }
      case "PROCESS_FRAME": {
        const { bitmap, timestamp } = event.data.payload;
        if (!poseLandmarker && !holisticLandmarker) {
          postError("not-initialized", "Pose worker not initialized.");
          bitmap.close();
          break;
        }

        if (!started) {
          bitmap.close();
          break;
        }

        let poseResult: ReturnType<PoseLandmarker["detectForVideo"]> | null = null;
        let holisticResult: ReturnType<HolisticLandmarker["detectForVideo"]> | null = null;
        try {
          // `timestamp` is performance.now() from the main thread, a small
          // monotonically-increasing value that MediaPipe requires. We must NOT
          // use Date.now() here or the graph throws "Packet timestamp mismatch".
          if (observationMode === "holistic" && holisticLandmarker) {
            holisticResult = holisticLandmarker.detectForVideo(bitmap, timestamp);
          } else if (poseLandmarker) {
            poseResult = poseLandmarker.detectForVideo(bitmap, timestamp);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "Pose frame processing failed.";
          postError("frame-processing-failed", message);
          break;
        } finally {
          bitmap.close();
        }

        // Use wall-clock time for everything returned to the main thread so that
        // business logic (calibration deltas, DB storage, cooldown comparisons)
        // stays consistent with the Date.now() values already used there.
        const wallTimestamp = Date.now();

        const normalizedLandmarks = observationMode === "holistic"
          ? holisticResult?.poseLandmarks[0]
          : poseResult?.landmarks[0];
        const worldLandmarks = observationMode === "holistic"
          ? holisticResult?.poseWorldLandmarks[0]
          : poseResult?.worldLandmarks[0];

        if (!normalizedLandmarks || !worldLandmarks) {
          postResult({ type: "TRACKING_LOST", payload: { timestamp: wallTimestamp, reason: "no-pose" } });
          break;
        }

        const metrics = computeFrameMetricsWithReason(
          worldLandmarks,
          normalizedLandmarks,
          wallTimestamp,
          visibilityThreshold,
          landmarkPolicy,
          {
            leftHandLandmarks: observationMode === "holistic" ? holisticResult?.leftHandLandmarks[0] : undefined,
            rightHandLandmarks: observationMode === "holistic" ? holisticResult?.rightHandLandmarks[0] : undefined,
            faceLandmarks: observationMode === "holistic" ? holisticResult?.faceLandmarks[0] : undefined,
            observationMode,
          },
        );
        if (!metrics.ok) {
          postResult({ type: "TRACKING_LOST", payload: { timestamp: wallTimestamp, reason: metrics.reason } });
          break;
        }

        postResult({ type: "FRAME_RESULT", payload: metrics.value });
        break;
      }
      default:
        break;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown pose worker error";
    postError("frame-processing-failed", message);
  }
};
