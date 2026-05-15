import { Suspense, useState } from "react";
import { ArrowRight, Cpu, Move3d, RotateCcw, Zap } from "lucide-react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { motion } from "framer-motion";
import { useLanguage } from "@/components/shared/language-provider";
import {
  CyberButton,
  CyberCard,
  CyberShell,
} from "@/components/cyber/cyber-ui";
import { WearableModel } from "@/components/wearable/wearable-model";
import {
  PRODUCT_ZONES,
  PRODUCT_ZONE_BY_KEY,
  type ProductZoneKey,
} from "@/components/wearable/wearable-scene";
import type { ThemeMode } from "@/types/posture";

interface WearablePageProps {
  theme: ThemeMode;
  resolvedTheme: Exclude<ThemeMode, "system">;
  onThemeCycle: () => void;
}

type ZoneKey = ProductZoneKey | null;

const FEATURE_ICONS = [Zap, Move3d, RotateCcw, Cpu];

function SceneLights() {
  return (
    <>
      <ambientLight intensity={0.68} />
      <directionalLight position={[3, 5, 3]} intensity={1.38} />
      <directionalLight position={[-3, 2, -3]} intensity={0.46} color="#8b9ab5" />
      <pointLight position={[0, -2, 2]} intensity={0.32} color="#00d4ff" />
    </>
  );
}

function SceneBloom({ active }: { active: boolean }) {
  return (
    <EffectComposer multisampling={0}>
      <Bloom
        intensity={active ? 0.95 : 0.42}
        luminanceThreshold={0.07}
        luminanceSmoothing={0.42}
      />
    </EffectComposer>
  );
}

function ZoneButton({
  zoneKey,
  name,
  badge,
  selected,
  hovered,
  onClick,
  onHover,
}: {
  zoneKey: ProductZoneKey;
  name: string;
  badge: string;
  selected: boolean;
  hovered: boolean;
  onClick: () => void;
  onHover: (zone: ProductZoneKey | null) => void;
}) {
  const tone = `cyber-tone-${PRODUCT_ZONE_BY_KEY[zoneKey].tone}`;
  return (
    <button
      type="button"
      onClick={onClick}
      onPointerEnter={() => onHover(zoneKey)}
      onPointerLeave={() => onHover(null)}
      className={`rounded-2xl border p-3 text-left transition-all ${
        selected || hovered
          ? `${tone} border-current/35 bg-current/10`
          : "border-[var(--border-soft)] bg-[var(--surface)] hover:border-[var(--border-strong)]"
      }`}
    >
      <span
        className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
          selected || hovered ? tone : "text-[var(--muted)]"
        }`}
      >
        {badge}
      </span>
      <p className="mt-1 text-sm font-semibold">{name}</p>
    </button>
  );
}

export function WearablePage({ resolvedTheme, onThemeCycle }: WearablePageProps) {
  const { messages, language } = useLanguage();
  const w = messages.wearable;
  const [selectedZone, setSelectedZone] = useState<ZoneKey>(null);
  const [hoveredZone, setHoveredZone] = useState<ZoneKey>(null);

  const handleZoneClick = (key: ProductZoneKey) => {
    setSelectedZone((prev) => (prev === key ? null : key));
  };

  const selectedZoneData = selectedZone
    ? {
        ...w.productZones[PRODUCT_ZONE_BY_KEY[selectedZone].messageKey],
        tone: `cyber-tone-${PRODUCT_ZONE_BY_KEY[selectedZone].tone}`,
      }
    : null;

  return (
    <CyberShell resolvedTheme={resolvedTheme} onThemeCycle={onThemeCycle}>
      <section className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--border-strong)] bg-[var(--surface-strong)] px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--cyan)]">
            <Cpu size={13} />
            {w.page.badge}
          </div>
          <h1 className="cyber-page-title">
            {w.page.title}{" "}
            <span className="text-[var(--cyan)]">{w.page.titleHighlight}</span>
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--muted-strong)]">
            {w.page.description}
          </p>
        </div>
        <CyberButton to="/dashboard">
          {w.page.ctaDashboard}
          <ArrowRight size={15} />
        </CyberButton>
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[1.4fr_0.6fr]">
        <CyberCard tone="cyan" className="overflow-hidden p-0">
          <div className="relative h-[480px] w-full">
            <Canvas
              dpr={[1, 2]}
              gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
              camera={{ position: [0, 0.5, 2.8], fov: 48 }}
              style={{ background: "transparent" }}
            >
              <SceneLights />
              <Suspense fallback={null}>
                <WearableModel
                  sceneMode="product"
                  postureState={selectedZone ? "warning" : "idle"}
                  rotationSpeed={selectedZone ? 0 : 0.15}
                  scale={1}
                  showHapticZones
                  showHotspots
                  selectedZone={selectedZone}
                  hoveredZone={hoveredZone}
                  activeProductZones={selectedZone ? [selectedZone] : []}
                  cameraPreset={selectedZone ?? hoveredZone ?? "overview"}
                  enableCameraFocus={false}
                  onZoneSelect={handleZoneClick}
                  onZoneHover={setHoveredZone}
                  getZoneLabel={(zone) => w.productZones[PRODUCT_ZONE_BY_KEY[zone].messageKey].name}
                />
              </Suspense>
              <SceneBloom active={Boolean(selectedZone || hoveredZone)} />
              <OrbitControls
                enableDamping
                dampingFactor={0.08}
                enableZoom
                minDistance={1.5}
                maxDistance={5}
                enablePan={false}
                autoRotate={false}
              />
            </Canvas>

            <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-white/10 bg-black/40 px-4 py-1.5 text-xs text-white/50 backdrop-blur">
              {w.page.rotateTip}
            </div>
          </div>
        </CyberCard>

        <div className="flex flex-col gap-4">
          <CyberCard className="p-4">
            <p className="cyber-eyebrow">{w.page.zoneSelectLabel}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {PRODUCT_ZONES.map((zone) => {
                const zoneData = w.productZones[zone.messageKey];
                return (
                  <ZoneButton
                    key={zone.key}
                    zoneKey={zone.key}
                    name={zoneData.name}
                    badge={zoneData.badge}
                    selected={selectedZone === zone.key}
                    hovered={hoveredZone === zone.key}
                    onClick={() => handleZoneClick(zone.key)}
                    onHover={setHoveredZone}
                  />
                );
              })}
            </div>
          </CyberCard>

          {selectedZoneData ? (
            <motion.div
              key={selectedZone}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22 }}
            >
              <CyberCard className={`p-4 ${selectedZoneData.tone}`}>
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${selectedZoneData.tone}`}
                >
                  {selectedZoneData.badge}
                </span>
                <h3 className="mt-2 t-heading-lg">
                  {selectedZoneData.name}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[var(--muted-strong)]">
                  {selectedZoneData.description}
                </p>
                <div className="mt-4 rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                    {language === "vi" ? "Kích hoạt bởi" : "Activates for"}
                  </p>
                  <p className="mt-1 text-sm font-semibold">{selectedZoneData.activatesFor}</p>
                </div>
                <p className="mt-3 text-xs leading-5 text-[var(--muted)]">
                  {selectedZoneData.detail}
                </p>
              </CyberCard>
            </motion.div>
          ) : (
            <CyberCard className="p-4">
              <p className="text-sm leading-6 text-[var(--muted)]">
                {language === "vi"
                  ? "Chọn một vùng bên trên để xem chi tiết phần cứng."
                  : "Select a zone above to inspect the hardware."}
              </p>
            </CyberCard>
          )}
        </div>
      </section>

      <section className="mt-6">
        <div className="mb-4">
          <p className="cyber-eyebrow">{w.features.eyebrow}</p>
          <h2 className="mt-2 t-heading-xl">
            {w.features.title}
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-7 text-[var(--muted)]">
            {w.features.description}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {w.features.items.map((item, index) => {
            const Icon = FEATURE_ICONS[index] ?? Zap;
            const tones = ["cyan", "mint", "violet", "amber"] as const;
            return (
              <CyberCard
                key={item.title}
                tone={tones[index % tones.length]}
                className="p-4"
              >
                <div className="mb-3 flex items-center gap-2">
                  <Icon size={16} className="text-current opacity-80" />
                  <span className="text-xs font-bold uppercase tracking-wider opacity-70">
                    {item.badge}
                  </span>
                </div>
                <h3 className="t-heading-md">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  {item.description}
                </p>
              </CyberCard>
            );
          })}
        </div>
      </section>

      <section className="mt-6">
        <CyberCard tone="cyan" className="p-6 text-center">
          <p className="cyber-eyebrow">
            {language === "vi" ? "Bắt đầu ngay" : "Ready to start?"}
          </p>
          <h2 className="mt-2 t-heading-xl">
            {language === "vi"
              ? "Kết hợp coaching AI với dây đai"
              : "Pair AI coaching with the harness"}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-[var(--muted)]">
            {language === "vi"
              ? "Mở dashboard để bắt đầu phiên coaching và xem dữ liệu tư thế kích hoạt từng vùng haptic trong thời gian thực."
              : "Open the dashboard to start a coaching session and see how live posture data activates each haptic zone in real time."}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <CyberButton to="/dashboard">
              {w.page.ctaDashboard}
              <ArrowRight size={15} />
            </CyberButton>
            <CyberButton variant="secondary" to="/">
              {language === "vi" ? "Trang chủ" : "Back to home"}
            </CyberButton>
          </div>
        </CyberCard>
      </section>
    </CyberShell>
  );
}
