import { useEffect, useMemo, useRef } from "react";
import { Html, useGLTF } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  HAPTIC_ZONES,
  PRODUCT_ZONES,
  PRODUCT_ZONE_BY_KEY,
  getMissingWearableNodeNames,
  mapHapticZonesToProductZones,
  type HapticZoneKey,
  type ProductZoneKey,
  type WearableCameraPreset,
  type WearablePostureState,
  type WearableSceneMode,
} from "@/components/wearable/wearable-scene";

export type {
  HapticZoneKey,
  ProductZoneKey,
  WearableCameraPreset,
  WearablePostureState,
  WearableSceneMode,
} from "@/components/wearable/wearable-scene";

export interface WearableModelProps {
  postureState?: WearablePostureState;
  sceneMode?: WearableSceneMode;
  selectedZone?: ProductZoneKey | null;
  hoveredZone?: ProductZoneKey | null;
  activeHapticZones?: HapticZoneKey[];
  activeProductZones?: ProductZoneKey[];
  correctionFlash?: boolean;
  tensionAssist?: boolean;
  cameraPreset?: WearableCameraPreset;
  rotationSpeed?: number;
  scale?: number;
  yawOffset?: number;
  showHapticZones?: boolean;
  showHotspots?: boolean;
  showHotspotLabels?: boolean;
  showAssetContractWarning?: boolean;
  enableCameraFocus?: boolean;
  onZoneSelect?: (zone: ProductZoneKey) => void;
  onZoneHover?: (zone: ProductZoneKey | null) => void;
  getZoneLabel?: (zone: ProductZoneKey) => string;
}

const MODEL_PATH = "./models/model3D.glb";

const COLOURS = {
  idle: new THREE.Color(0x8b9ab5),
  good: new THREE.Color(0x00f5c0),
  warning: new THREE.Color(0xf59e0b),
  bad: new THREE.Color(0xef4444),
  hapticActive: new THREE.Color(0x00d4ff),
  hapticIdle: new THREE.Color(0x334155),
  tension: new THREE.Color(0xf59e0b),
  selected: new THREE.Color(0x00d4ff),
} as const;

const GLOBAL_EMISSIVE: Record<WearablePostureState, number> = {
  idle: 0,
  good: 0,
  warning: 0,
  bad: 0.08,
};

function cloneSceneWithIsolatedMaterials(rawScene: THREE.Group) {
  const clone = rawScene.clone(true);
  clone.traverse((child) => {
    if (child.name.startsWith("Hotspot_") || child.name.startsWith("Focus_")) {
      child.visible = false;
    }

    if (child instanceof THREE.Mesh) {
      if (Array.isArray(child.material)) {
        child.material = child.material.map((material) => material.clone());
      } else if (child.material) {
        child.material = child.material.clone();
      }
    }
  });
  return clone;
}

function collectObjectNames(root: THREE.Object3D) {
  const names: string[] = [];
  root.traverse((child) => {
    if (child.name) names.push(child.name);
  });
  return names;
}

function materialList(mesh: THREE.Mesh) {
  return Array.isArray(mesh.material) ? mesh.material : [mesh.material];
}

function setMaterialEmissive(material: THREE.Material, color: THREE.Color, intensity: number) {
  const maybeEmissive = material as THREE.Material & {
    emissive?: THREE.Color;
    emissiveIntensity?: number;
  };
  if (!maybeEmissive.emissive) return;
  maybeEmissive.emissive.copy(color);
  maybeEmissive.emissiveIntensity = intensity;
  material.needsUpdate = true;
}

function setObjectEmissive(object: THREE.Object3D | null | undefined, color: THREE.Color, intensity: number) {
  if (!object) return;
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    for (const material of materialList(child)) {
      setMaterialEmissive(material, color, intensity);
    }
  });
}

function getLocalPosition(root: THREE.Object3D, nodeName: string) {
  const object = root.getObjectByName(nodeName);
  if (!object) return null;

  root.updateMatrixWorld(true);
  const position = new THREE.Vector3();
  object.getWorldPosition(position);
  return root.worldToLocal(position);
}

function buildNodePositionMap(root: THREE.Object3D) {
  const positions = new Map<string, THREE.Vector3>();
  for (const zone of PRODUCT_ZONES) {
    const hotspot = getLocalPosition(root, zone.hotspotNode);
    if (hotspot) positions.set(zone.hotspotNode, hotspot);

    if (zone.focusNode) {
      const focus = getLocalPosition(root, zone.focusNode);
      if (focus) positions.set(zone.focusNode, focus);
    }
  }
  for (const zone of HAPTIC_ZONES) {
    const hotspot = getLocalPosition(root, zone.hotspotNode);
    if (hotspot) positions.set(zone.hotspotNode, hotspot);
  }
  return positions;
}

function getZoneFocusPosition(
  positions: Map<string, THREE.Vector3>,
  zone: ProductZoneKey | null | undefined,
) {
  if (!zone) return null;
  const definition = PRODUCT_ZONE_BY_KEY[zone];
  return (
    (definition.focusNode ? positions.get(definition.focusNode) : null) ??
    positions.get(definition.hotspotNode) ??
    null
  );
}

function AssetContractError({ missingNodes }: { missingNodes: string[] }) {
  return (
    <Html center>
      <div className="wearable-asset-contract">
        <strong>GLB contract missing</strong>
        <span>{missingNodes.join(", ")}</span>
      </div>
    </Html>
  );
}

function HapticIndicator({
  position,
  active,
  postureState,
}: {
  position: THREE.Vector3;
  active: boolean;
  postureState: WearablePostureState;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(({ clock }) => {
    if (!meshRef.current || !materialRef.current) return;
    if (active) {
      const t = clock.getElapsedTime();
      const pulse = 1 + Math.sin(t * 5.2) * 0.18;
      meshRef.current.scale.setScalar(pulse);
      materialRef.current.opacity = 0.58 + Math.sin(t * 5.2) * 0.22;
      return;
    }

    meshRef.current.scale.setScalar(1);
    materialRef.current.opacity = 0.16;
  });

  const color = active ? COLOURS.hapticActive : COLOURS.hapticIdle;
  const emissiveIntensity = active ? (postureState === "bad" ? 1.25 : 0.82) : 0;

  return (
    <mesh ref={meshRef} position={position}>
      <sphereGeometry args={[0.026, 16, 16]} />
      <meshStandardMaterial
        ref={materialRef}
        color={color}
        emissive={color}
        emissiveIntensity={emissiveIntensity}
        transparent
        opacity={0.16}
        depthWrite={false}
      />
    </mesh>
  );
}

function TensionAssistEffect({
  position,
  active,
}: {
  position: THREE.Vector3 | null;
  active: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(({ clock }) => {
    if (!groupRef.current || !materialRef.current) return;
    const t = clock.getElapsedTime();
    const pulse = active ? 1 + Math.sin(t * 3.6) * 0.1 : 0.86;
    groupRef.current.scale.setScalar(pulse);
    groupRef.current.rotation.z += active ? 0.012 : 0.003;
    materialRef.current.opacity = active ? 0.18 + Math.sin(t * 3.6) * 0.08 : 0.05;
  });

  if (!position) return null;

  return (
    <group ref={groupRef} position={position} visible={active}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.18, 0.006, 10, 72]} />
        <meshStandardMaterial
          ref={materialRef}
          color={COLOURS.tension}
          emissive={COLOURS.tension}
          emissiveIntensity={1.25}
          transparent
          opacity={0.16}
          depthWrite={false}
        />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, Math.PI / 2]}>
        <torusGeometry args={[0.13, 0.004, 10, 72]} />
        <meshStandardMaterial
          color={COLOURS.tension}
          emissive={COLOURS.tension}
          emissiveIntensity={0.8}
          transparent
          opacity={0.12}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

function ProductHotspot({
  zone,
  position,
  active,
  label,
  showLabel,
  onSelect,
  onHover,
}: {
  zone: ProductZoneKey;
  position: THREE.Vector3;
  active: boolean;
  label: string;
  showLabel: boolean;
  onSelect?: (zone: ProductZoneKey) => void;
  onHover?: (zone: ProductZoneKey | null) => void;
}) {
  return (
    <Html position={position} center distanceFactor={7} zIndexRange={[30, 0]}>
      <button
        type="button"
        className={`wearable-hotspot ${active ? "is-active" : ""}`}
        onClick={(event) => {
          event.stopPropagation();
          onSelect?.(zone);
        }}
        onPointerEnter={() => onHover?.(zone)}
        onPointerLeave={() => onHover?.(null)}
        aria-label={label}
      >
        <span className="wearable-hotspot-dot" />
        {showLabel ? <span className="wearable-hotspot-label">{label}</span> : null}
      </button>
    </Html>
  );
}

export function WearableModel({
  postureState = "idle",
  sceneMode = "product",
  selectedZone = null,
  hoveredZone = null,
  activeHapticZones = [],
  activeProductZones = [],
  correctionFlash = false,
  tensionAssist = false,
  cameraPreset = "overview",
  rotationSpeed = 0.22,
  scale = 1,
  yawOffset = 0,
  showHapticZones = true,
  showHotspots = false,
  showHotspotLabels = false,
  showAssetContractWarning = false,
  enableCameraFocus = true,
  onZoneSelect,
  onZoneHover,
  getZoneLabel,
}: WearableModelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const { scene: rawScene } = useGLTF(MODEL_PATH);

  const scene = useMemo(() => cloneSceneWithIsolatedMaterials(rawScene), [rawScene]);
  const nodeNames = useMemo(() => collectObjectNames(scene), [scene]);
  const missingNodes = useMemo(() => getMissingWearableNodeNames(nodeNames), [nodeNames]);
  const assetContractReady = missingNodes.length === 0;
  const nodePositions = useMemo(() => buildNodePositionMap(scene), [scene]);

  const activeHapticSet = useMemo(() => new Set(activeHapticZones), [activeHapticZones]);
  const activeProductSet = useMemo(() => {
    const zones = new Set<ProductZoneKey>(activeProductZones);
    for (const productZone of mapHapticZonesToProductZones(activeHapticZones)) {
      zones.add(productZone);
    }
    if (tensionAssist) zones.add("adaptive-support");
    if (correctionFlash) zones.add("core-module");
    if (selectedZone) zones.add(selectedZone);
    if (hoveredZone) zones.add(hoveredZone);
    return zones;
  }, [activeHapticZones, activeProductZones, correctionFlash, hoveredZone, selectedZone, tensionAssist]);

  useEffect(() => {
    const globalIntensity = correctionFlash ? 0.16 : GLOBAL_EMISSIVE[postureState];
    const globalColor = correctionFlash ? COLOURS.good : COLOURS[postureState];
    scene.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      for (const material of materialList(child)) {
        setMaterialEmissive(material, globalColor, globalIntensity);
      }
    });

    for (const zone of PRODUCT_ZONES) {
      const zoneActive = activeProductSet.has(zone.key);
      if (!zoneActive) continue;

      const zoneColor =
        tensionAssist && zone.key === "adaptive-support"
          ? COLOURS.tension
          : correctionFlash && zone.key === "core-module"
            ? COLOURS.good
            : zone.key === selectedZone || zone.key === hoveredZone
              ? COLOURS.selected
              : postureState === "bad"
                ? COLOURS.bad
                : postureState === "warning"
                  ? COLOURS.warning
                  : COLOURS.hapticActive;
      const intensity =
        tensionAssist && zone.key === "adaptive-support"
          ? 1.1
          : correctionFlash && zone.key === "core-module"
            ? 1.25
            : zone.key === selectedZone || zone.key === hoveredZone
              ? 0.78
              : 0.6;

      for (const nodeName of zone.meshNodes) {
        setObjectEmissive(scene.getObjectByName(nodeName), zoneColor, intensity);
      }
    }
  }, [
    activeProductSet,
    correctionFlash,
    hoveredZone,
    postureState,
    scene,
    selectedZone,
    tensionAssist,
  ]);

  useFrame((_state, delta) => {
    if (groupRef.current && rotationSpeed !== 0) {
      groupRef.current.rotation.y += delta * rotationSpeed;
    }

    if (!enableCameraFocus) return;

    const requestedFocusZone =
      selectedZone ??
      hoveredZone ??
      (cameraPreset === "overview" ? null : cameraPreset);
    const focusZone = assetContractReady ? requestedFocusZone : null;

    const focus = getZoneFocusPosition(nodePositions, focusZone) ?? new THREE.Vector3(0, 0.05, 0);
    const distance = sceneMode === "companion" ? 3.15 : sceneMode === "story" ? 2.55 : 2.8;
    const vertical = sceneMode === "companion" ? 0.1 : 0.24;
    const side = focusZone === "shoulder-straps" ? 0.18 : focusZone === "front-stabilization" ? -0.12 : 0.28;
    const targetPosition = new THREE.Vector3(focus.x + side, focus.y + vertical, focus.z + distance);
    camera.position.lerp(targetPosition, 1 - Math.exp(-delta * 3.2));
    camera.lookAt(focus);
    camera.updateProjectionMatrix();
  });

  return (
    <group ref={groupRef} scale={scale} rotation={[0, yawOffset, 0]}>
      <primitive object={scene} />

      {!assetContractReady && showAssetContractWarning ? (
        <AssetContractError missingNodes={missingNodes} />
      ) : null}

      {assetContractReady &&
        showHapticZones &&
        HAPTIC_ZONES.map((zone) => {
          const position = nodePositions.get(zone.hotspotNode);
          if (!position) return null;
          return (
            <HapticIndicator
              key={zone.key}
              position={position}
              active={activeHapticSet.has(zone.key)}
              postureState={postureState}
            />
          );
        })}

      {assetContractReady ? (
        <TensionAssistEffect
          position={nodePositions.get(PRODUCT_ZONE_BY_KEY["adaptive-support"].hotspotNode) ?? null}
          active={tensionAssist}
        />
      ) : null}

      {showHotspots &&
        PRODUCT_ZONES.map((zone) => {
          const position = nodePositions.get(zone.hotspotNode);
          if (!position) return null;
          const active = selectedZone === zone.key || hoveredZone === zone.key || activeProductSet.has(zone.key);
          return (
            <ProductHotspot
              key={zone.key}
              zone={zone.key}
              position={position}
              active={active}
              label={getZoneLabel?.(zone.key) ?? zone.key}
              showLabel={showHotspotLabels}
              onSelect={onZoneSelect}
              onHover={onZoneHover}
            />
          );
        })}
    </group>
  );
}

useGLTF.preload(MODEL_PATH);
