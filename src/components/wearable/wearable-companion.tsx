import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { useLanguage } from "@/components/shared/language-provider";
import { CyberButton, CyberCard } from "@/components/cyber/cyber-ui";
import { usePostureRuntime } from "@/runtime/posture-runtime-provider";
import { WearableModel } from "./wearable-model";
import {
  HAPTIC_ZONES,
  PRODUCT_ZONE_BY_KEY,
  deriveWearableCompanionState,
  type HapticZoneKey,
  type ProductZoneKey,
  type WearablePostureState,
  type WearableSceneState,
} from "./wearable-scene";

const ZONE_NAMES_EN: Record<HapticZoneKey, string> = {
  "center-back": "Core Module",
  "left-shoulder": "Left Shoulder",
  "right-shoulder": "Right Shoulder",
  "front-chest": "Front Strap",
};

const ZONE_NAMES_VI: Record<HapticZoneKey, string> = {
  "center-back": "Module Trung Tâm",
  "left-shoulder": "Vai Trái",
  "right-shoulder": "Vai Phải",
  "front-chest": "Dây Trước",
};

const ALL_ZONES = HAPTIC_ZONES.map((zone) => zone.key);

function SceneLights() {
  return (
    <>
      <ambientLight intensity={0.62} />
      <directionalLight position={[2, 4, 3]} intensity={1.2} />
      <directionalLight position={[-2, 1, -2]} intensity={0.42} color="#8b9ab5" />
      <pointLight position={[0, 0.8, 1.6]} intensity={0.35} color="#00d4ff" />
    </>
  );
}

function WearableBloom({ active }: { active: boolean }) {
  return (
    <EffectComposer multisampling={0}>
      <Bloom
        intensity={active ? 0.85 : 0.35}
        luminanceThreshold={0.08}
        luminanceSmoothing={0.45}
      />
    </EffectComposer>
  );
}

function toneForState(state: WearablePostureState, correctionFlash: boolean, tensionAssist: boolean) {
  if (correctionFlash) return "cyber-tone-mint";
  if (tensionAssist) return "cyber-tone-amber";
  if (state === "good") return "cyber-tone-mint";
  if (state === "warning") return "cyber-tone-amber";
  if (state === "bad") return "cyber-tone-red";
  return "cyber-tone-cyan";
}

function CompanionCanvas({ state }: { state: WearableSceneState }) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      camera={{ position: [0.4, 0.28, 3.15], fov: 44 }}
      style={{ background: "transparent" }}
    >
      <SceneLights />
      <Suspense fallback={null}>
        <WearableModel
          sceneMode="companion"
          postureState={state.postureState}
          activeHapticZones={state.activeHapticZones}
          activeProductZones={state.activeProductZones}
          correctionFlash={state.correctionFlash}
          tensionAssist={state.tensionAssist}
          cameraPreset={state.cameraPreset}
          rotationSpeed={state.cameraPreset === "overview" ? 0.18 : 0.05}
          scale={0.74}
          showHapticZones
          showHotspots={false}
        />
      </Suspense>
      <WearableBloom active={state.activeHapticZones.length > 0 || state.correctionFlash || state.tensionAssist} />
    </Canvas>
  );
}

export function WearableCompanionPanel() {
  const { messages, language } = useLanguage();
  const {
    postureState,
    currentIssue,
    currentCue,
    cameraMode,
    monitoringStatus,
    exposureLevel,
    staticHoldSeconds,
    loadSource,
    liveLandmarks,
    liveMetrics,
  } = usePostureRuntime();

  const w = messages.wearable;
  const zoneNames = language === "vi" ? ZONE_NAMES_VI : ZONE_NAMES_EN;
  const isWearableConnected = false;
  const sceneState = deriveWearableCompanionState({
    postureState,
    currentIssue,
    currentCue,
    cameraMode,
    monitoringStatus,
    exposureLevel,
    staticHoldSeconds,
    loadSource,
    liveLandmarks,
  });
  const displaySceneState: WearableSceneState = isWearableConnected
    ? sceneState
    : {
        ...sceneState,
        postureState: "idle",
        activeHapticZones: [],
        activeProductZones: [],
        correctionFlash: false,
        tensionAssist: false,
        cameraPreset: "overview",
      };
  const toneClass = isWearableConnected
    ? toneForState(sceneState.postureState, sceneState.correctionFlash, sceneState.tensionAssist)
    : "cyber-tone-muted";
  const statusLabel = isWearableConnected
    ? sceneState.correctionFlash
      ? w.companion.correctionLabel
      : sceneState.tensionAssist
        ? w.companion.tensionLabel
        : sceneState.postureState
    : w.companion.disconnectedLabel;
  const activeProductLabel = displaySceneState.activeProductZones
    .map((zone) => w.productZones[PRODUCT_ZONE_BY_KEY[zone].messageKey].name)
    .join(", ");
  const loadDetail = isWearableConnected && liveMetrics
    ? `${Math.round(liveMetrics.deviationRatio * 100)}% ${w.companion.loadLabel}`
    : isWearableConnected
      ? w.companion.noLoadLabel
      : w.companion.disconnectedLoadLabel;

  return (
    <CyberCard tone={isWearableConnected ? "cyan" : "muted"} className="overflow-hidden p-0">
      <div className="flex items-start justify-between gap-3 px-4 pt-4">
        <div>
          <p className="cyber-eyebrow">{w.companion.eyebrow}</p>
          <h3 className="mt-1 t-heading-md">
            {w.companion.title}
          </h3>
        </div>
        <span
          className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${toneClass} border-current/25 bg-current/8`}
        >
          {statusLabel}
        </span>
      </div>

      <div className="mt-3 h-[210px] w-full" style={{ background: "transparent" }} aria-hidden>
        <CompanionCanvas state={displaySceneState} />
      </div>

      <div className="px-4 pb-2">
        <p className="mb-2 text-xs font-semibold text-[var(--muted)]">
          {isWearableConnected && displaySceneState.activeHapticZones.length > 0
            ? w.companion.activeZonesLabel
            : isWearableConnected
              ? w.companion.noActiveZonesLabel
              : w.companion.disconnectedZonesLabel}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {ALL_ZONES.map((key) => {
            const isActive = isWearableConnected && displaySceneState.activeHapticZones.includes(key);
            return (
              <span
                key={key}
                className={`rounded-full border px-2 py-0.5 text-xs font-semibold transition-colors ${
                  isActive
                    ? "border-[var(--cyan)]/40 bg-[var(--cyan)]/12 text-[var(--cyan)]"
                    : "border-[var(--border-soft)] bg-[var(--surface)] text-[var(--muted)]"
                }`}
              >
                {zoneNames[key]}
              </span>
            );
          })}
        </div>
      </div>

      <div className="border-t border-[var(--border-soft)] px-4 py-3">
        <p className="text-xs leading-5 text-[var(--muted)]">
          {!isWearableConnected
            ? w.companion.disconnectedDescription
            : sceneState.correctionFlash
            ? w.companion.correctionDescription
            : sceneState.tensionAssist
              ? w.companion.tensionDescription
              : activeProductLabel || w.companion.description}
        </p>
        <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
          {loadDetail}
        </p>
        <div className="mt-3">
          <CyberButton variant="secondary" to="/wearable" className="w-full justify-center text-xs">
            {w.companion.viewCta}
          </CyberButton>
        </div>
      </div>
    </CyberCard>
  );
}

export function WearableStoryCanvas({
  sceneState,
  selectedZone,
}: {
  sceneState: WearableSceneState;
  selectedZone?: ProductZoneKey | null;
}) {
  return (
    <Canvas
      dpr={[1, 1.6]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      camera={{ position: [0.5, 0.8, 2.6], fov: 44 }}
      style={{ background: "transparent" }}
    >
      <SceneLights />
      <Suspense fallback={null}>
        <WearableModel
          sceneMode="story"
          postureState={sceneState.postureState}
          selectedZone={selectedZone}
          activeHapticZones={sceneState.activeHapticZones}
          activeProductZones={sceneState.activeProductZones}
          correctionFlash={sceneState.correctionFlash}
          tensionAssist={sceneState.tensionAssist}
          cameraPreset={sceneState.cameraPreset}
          rotationSpeed={sceneState.cameraPreset === "overview" ? 0.15 : 0.02}
          scale={1}
          showHapticZones
          showHotspots={false}
        />
      </Suspense>
      <WearableBloom active={sceneState.activeHapticZones.length > 0 || sceneState.tensionAssist || sceneState.correctionFlash} />
    </Canvas>
  );
}
