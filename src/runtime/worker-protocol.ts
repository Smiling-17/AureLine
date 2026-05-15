import type { FrameObservation, LandmarkPolicy, TrackingLostReason, WorkerErrorCode } from "@/runtime/types";

export type WorkerInitMessage = {
  type: "INIT";
  payload: {
    wasmRoot: string;
    poseModelAssetPath: string;
    holisticModelAssetPath?: string;
  };
};

export type WorkerStartMessage = { type: "START" };
export type WorkerStopMessage = { type: "STOP" };
export type WorkerUpdateConfigMessage = {
  type: "UPDATE_CONFIG";
  payload?: {
    visibilityThreshold?: number;
    landmarkPolicy?: LandmarkPolicy;
  };
};
export type WorkerProcessFrameMessage = {
  type: "PROCESS_FRAME";
  payload: {
    bitmap: ImageBitmap;
    timestamp: number;
  };
};

export type PoseWorkerMessage =
  | WorkerInitMessage
  | WorkerStartMessage
  | WorkerStopMessage
  | WorkerUpdateConfigMessage
  | WorkerProcessFrameMessage;

export type WorkerReadyMessage = { type: "READY" };
export type WorkerFrameMessage = { type: "FRAME_RESULT"; payload: FrameObservation };
export type WorkerTrackingLostMessage = {
  type: "TRACKING_LOST";
  payload: { timestamp: number; reason: TrackingLostReason };
};
export type WorkerErrorMessage = { type: "ERROR"; payload: { code: WorkerErrorCode; message: string } };

export type PoseWorkerResult =
  | WorkerReadyMessage
  | WorkerFrameMessage
  | WorkerTrackingLostMessage
  | WorkerErrorMessage;
