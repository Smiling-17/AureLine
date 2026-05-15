import type {
  ExposureLevel,
  IssueFamily,
  LandmarkSample,
  LoadSource,
  MonitoringStatus,
  RuntimeCue,
} from "@/runtime/types";
import type { CameraMode, PostureState } from "@/types/posture";

export type ProductZoneKey =
  | "shoulder-straps"
  | "core-module"
  | "front-stabilization"
  | "adaptive-support";

export type HapticZoneKey =
  | "center-back"
  | "left-shoulder"
  | "right-shoulder"
  | "front-chest";

export type WearableSceneMode = "product" | "companion" | "story";
export type WearablePostureState = "idle" | PostureState;
export type WearableCameraPreset = "overview" | ProductZoneKey;

export interface ProductZoneDefinition {
  key: ProductZoneKey;
  messageKey: "shoulderStraps" | "coreModule" | "frontStabilization" | "adaptiveSupport";
  meshNodes: string[];
  hotspotNode: string;
  focusNode?: string;
  hapticZones: HapticZoneKey[];
  tone: "cyan" | "mint" | "violet" | "amber";
}

export interface HapticZoneDefinition {
  key: HapticZoneKey;
  label: string;
  productZone: ProductZoneKey;
  hotspotNode: string;
}

export interface WearableSceneState {
  postureState: WearablePostureState;
  activeHapticZones: HapticZoneKey[];
  activeProductZones: ProductZoneKey[];
  correctionFlash: boolean;
  tensionAssist: boolean;
  cameraPreset: WearableCameraPreset;
}

export const PRODUCT_ZONES: ProductZoneDefinition[] = [
  {
    key: "shoulder-straps",
    messageKey: "shoulderStraps",
    meshNodes: ["ShoulderStrap_L", "ShoulderStrap_R"],
    hotspotNode: "Hotspot_LeftShoulder",
    focusNode: "Focus_Shoulders",
    hapticZones: ["left-shoulder", "right-shoulder"],
    tone: "mint",
  },
  {
    key: "core-module",
    messageKey: "coreModule",
    meshNodes: ["CoreModule"],
    hotspotNode: "Hotspot_CoreModule",
    focusNode: "Focus_CoreModule",
    hapticZones: ["center-back"],
    tone: "cyan",
  },
  {
    key: "front-stabilization",
    messageKey: "frontStabilization",
    meshNodes: ["FrontStabilizationStrap"],
    hotspotNode: "Hotspot_FrontStrap",
    focusNode: "Focus_FrontStrap",
    hapticZones: ["front-chest"],
    tone: "violet",
  },
  {
    key: "adaptive-support",
    messageKey: "adaptiveSupport",
    meshNodes: ["AdaptiveSupport_L", "AdaptiveSupport_R"],
    hotspotNode: "Hotspot_AdaptiveSupport",
    focusNode: "Focus_AdaptiveSupport",
    hapticZones: ["center-back"],
    tone: "amber",
  },
];

export const PRODUCT_ZONE_BY_KEY = Object.fromEntries(
  PRODUCT_ZONES.map((zone) => [zone.key, zone]),
) as Record<ProductZoneKey, ProductZoneDefinition>;

export const HAPTIC_ZONES: HapticZoneDefinition[] = [
  {
    key: "center-back",
    label: "Core Module",
    productZone: "core-module",
    hotspotNode: "Hotspot_CoreModule",
  },
  {
    key: "left-shoulder",
    label: "Left Shoulder",
    productZone: "shoulder-straps",
    hotspotNode: "Hotspot_LeftShoulder",
  },
  {
    key: "right-shoulder",
    label: "Right Shoulder",
    productZone: "shoulder-straps",
    hotspotNode: "Hotspot_RightShoulder",
  },
  {
    key: "front-chest",
    label: "Front Strap",
    productZone: "front-stabilization",
    hotspotNode: "Hotspot_FrontStrap",
  },
];

export const HAPTIC_ZONE_BY_KEY = Object.fromEntries(
  HAPTIC_ZONES.map((zone) => [zone.key, zone]),
) as Record<HapticZoneKey, HapticZoneDefinition>;

export const REQUIRED_WEARABLE_NODE_NAMES = [
  "CoreModule",
  "ShoulderStrap_L",
  "ShoulderStrap_R",
  "FrontStabilizationStrap",
  "AdaptiveSupport_L",
  "AdaptiveSupport_R",
  "Hotspot_CoreModule",
  "Hotspot_LeftShoulder",
  "Hotspot_RightShoulder",
  "Hotspot_FrontStrap",
  "Hotspot_AdaptiveSupport",
] as const;

export const OPTIONAL_WEARABLE_FOCUS_NODES = [
  "Focus_CoreModule",
  "Focus_Shoulders",
  "Focus_FrontStrap",
  "Focus_AdaptiveSupport",
] as const;

const CALIBRATION_STATUSES: MonitoringStatus[] = [
  "calibrating",
  "calibration-retry",
  "initializing",
  "requesting-permission",
];

const SHOULDER_SIDE_THRESHOLD = 0.018;
const STATIC_HOLD_TENSION_SECONDS = 15;

export function getMissingWearableNodeNames(nodeNames: Iterable<string>) {
  const names = new Set(nodeNames);
  return REQUIRED_WEARABLE_NODE_NAMES.filter((name) => !names.has(name));
}

export function getShoulderTiltHapticZones(landmarks: LandmarkSample | null): HapticZoneKey[] {
  const left = landmarks?.leftShoulder;
  const right = landmarks?.rightShoulder;
  if (!left || !right) return ["left-shoulder", "right-shoulder"];

  const delta = left.y - right.y;
  if (Math.abs(delta) < SHOULDER_SIDE_THRESHOLD) {
    return ["left-shoulder", "right-shoulder"];
  }

  return delta < 0 ? ["left-shoulder"] : ["right-shoulder"];
}

export function mapIssueToHapticZones(issue: IssueFamily | null, landmarks: LandmarkSample | null) {
  if (issue === "forward-head") return ["center-back"] satisfies HapticZoneKey[];
  if (issue === "torso-lean") return ["center-back"] satisfies HapticZoneKey[];
  if (issue === "shoulder-tilt") return getShoulderTiltHapticZones(landmarks);
  return [] satisfies HapticZoneKey[];
}

export function mapHapticZonesToProductZones(hapticZones: Iterable<HapticZoneKey>) {
  const productZones = new Set<ProductZoneKey>();
  for (const hapticZone of hapticZones) {
    productZones.add(HAPTIC_ZONE_BY_KEY[hapticZone].productZone);
  }
  return [...productZones];
}

export function isWearableIdle(cameraMode: CameraMode, monitoringStatus: MonitoringStatus) {
  return cameraMode === "off" || CALIBRATION_STATUSES.includes(monitoringStatus);
}

export function shouldShowCorrectionFlash(currentCue: RuntimeCue | null) {
  return currentCue?.kind === "reward";
}

export function shouldShowTensionAssist(input: {
  currentIssue: IssueFamily | null;
  exposureLevel: ExposureLevel;
  staticHoldSeconds: number;
  loadSource: LoadSource | null;
}) {
  return (
    input.currentIssue === "torso-lean" ||
    input.loadSource === "static-hold" ||
    input.loadSource === "compound" ||
    input.staticHoldSeconds >= STATIC_HOLD_TENSION_SECONDS ||
    input.exposureLevel === "high" ||
    input.exposureLevel === "critical"
  );
}

export function deriveWearableCompanionState(input: {
  postureState: PostureState;
  currentIssue: IssueFamily | null;
  currentCue: RuntimeCue | null;
  cameraMode: CameraMode;
  monitoringStatus: MonitoringStatus;
  exposureLevel: ExposureLevel;
  staticHoldSeconds: number;
  loadSource: LoadSource | null;
  liveLandmarks: LandmarkSample | null;
}): WearableSceneState {
  if (isWearableIdle(input.cameraMode, input.monitoringStatus)) {
    return {
      postureState: "idle",
      activeHapticZones: [],
      activeProductZones: [],
      correctionFlash: false,
      tensionAssist: false,
      cameraPreset: "overview",
    };
  }

  const correctionFlash = shouldShowCorrectionFlash(input.currentCue);
  const tensionAssist = shouldShowTensionAssist(input);
  const activeHapticZones = new Set<HapticZoneKey>();

  if (input.postureState !== "good") {
    for (const zone of mapIssueToHapticZones(input.currentIssue, input.liveLandmarks)) {
      activeHapticZones.add(zone);
    }
  }

  if (tensionAssist) {
    activeHapticZones.add("center-back");
  }

  const activeProductZones = new Set(mapHapticZonesToProductZones(activeHapticZones));
  if (tensionAssist) {
    activeProductZones.add("adaptive-support");
  }

  return {
    postureState: correctionFlash ? "good" : input.postureState,
    activeHapticZones: [...activeHapticZones],
    activeProductZones: [...activeProductZones],
    correctionFlash,
    tensionAssist,
    cameraPreset: tensionAssist
      ? "adaptive-support"
      : activeProductZones.values().next().value ?? "overview",
  };
}

export function getStorySceneState(stepIndex: number): WearableSceneState {
  if (stepIndex <= 0) {
    return {
      postureState: "idle",
      activeHapticZones: [],
      activeProductZones: [],
      correctionFlash: false,
      tensionAssist: false,
      cameraPreset: "overview",
    };
  }

  if (stepIndex === 1) {
    return {
      postureState: "good",
      activeHapticZones: [],
      activeProductZones: ["core-module"],
      correctionFlash: false,
      tensionAssist: false,
      cameraPreset: "core-module",
    };
  }

  if (stepIndex === 2) {
    return {
      postureState: "warning",
      activeHapticZones: ["center-back", "left-shoulder", "right-shoulder"],
      activeProductZones: ["core-module", "shoulder-straps"],
      correctionFlash: false,
      tensionAssist: false,
      cameraPreset: "shoulder-straps",
    };
  }

  if (stepIndex === 3) {
    return {
      postureState: "warning",
      activeHapticZones: ["center-back"],
      activeProductZones: ["core-module", "adaptive-support"],
      correctionFlash: false,
      tensionAssist: true,
      cameraPreset: "adaptive-support",
    };
  }

  return {
    postureState: "good",
    activeHapticZones: [],
    activeProductZones: ["core-module"],
    correctionFlash: true,
    tensionAssist: false,
    cameraPreset: "overview",
  };
}
