import { useRef } from "react";
import { ArrowRight, BarChart2, Camera, Cpu, Lock, ShieldCheck, Sparkles, CheckCircle2 } from "lucide-react";
import { motion, useInView } from "framer-motion";
import {
  CyberButton,
  CyberCard,
  CyberShell,
  MetricTile,
  PostureBadge,
  ScoreRing,
  SparkBar,
} from "@/components/cyber/cyber-ui";
import { WearableStoryCanvas } from "@/components/wearable/wearable-companion";
import type { WearableSceneState } from "@/components/wearable/wearable-scene";
import { useLanguage } from "@/components/shared/language-provider";
import type { LocaleMessages } from "@/locales/schema";
import type { ThemeMode } from "@/types/posture";

interface LandingPageProps {
  theme: ThemeMode;
  resolvedTheme: Exclude<ThemeMode, "system">;
  onThemeCycle: () => void;
}

const LANDING_WEARABLE_STATE = {
  postureState: "idle",
  activeHapticZones: [],
  activeProductZones: [],
  correctionFlash: false,
  tensionAssist: false,
  cameraPreset: "overview",
} satisfies WearableSceneState;

const LANDING_WEARABLE_ICONS = [Cpu, Camera, ShieldCheck];

function WearableStorySection({ wearable }: { wearable: LocaleMessages["wearable"] }) {
  const sectionRef = useRef<HTMLElement>(null);
  const storyInView = useInView(sectionRef, { once: true, margin: "0px 0px -120px 0px" });

  return (
    <section
      ref={sectionRef}
      className="grid items-center gap-6 py-8 lg:grid-cols-[1.05fr_0.95fr]"
      id="wearable"
    >
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={storyInView ? { opacity: 1, y: 0 } : undefined}
        transition={{ duration: 0.55, ease: "easeOut" }}
      >
        <CyberCard tone="cyan" className="relative overflow-hidden p-0">
          <div className="h-[460px] w-full lg:h-[520px]">
            {storyInView && <WearableStoryCanvas sceneState={LANDING_WEARABLE_STATE} />}
          </div>
          <div className="pointer-events-none absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-[var(--border-strong)] bg-[var(--surface-strong)] px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--cyan)] backdrop-blur">
            <Cpu size={14} />
            {wearable.landing.eyebrow}
          </div>
        </CyberCard>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={storyInView ? { opacity: 1, y: 0 } : undefined}
        transition={{ duration: 0.55, delay: 0.08, ease: "easeOut" }}
      >
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[var(--border-strong)] bg-[var(--surface-strong)] px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--cyan)]">
          <Sparkles size={14} />
          {wearable.landing.badge}
        </div>
        <h2 className="t-heading-xl">
          {wearable.landing.title}{" "}
          <span className="text-[var(--cyan)]">{wearable.landing.titleHighlight}</span>
        </h2>
        <p className="mt-5 max-w-xl text-base leading-8 text-[var(--muted-strong)]">
          {wearable.landing.description}
        </p>

        <div className="mt-7 grid gap-3">
          {wearable.landing.keyPoints.map((point, index) => {
            const Icon = LANDING_WEARABLE_ICONS[index] ?? Sparkles;
            return (
              <div
                key={point.title}
                className="flex gap-3 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-4"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--cyan)]/25 bg-[var(--cyan)]/10 text-[var(--cyan)]">
                  <Icon size={17} />
                </div>
                <div>
                  <h3 className="t-heading-sm">{point.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{point.description}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-7 flex flex-wrap gap-3">
          <CyberButton to="/wearable">
            {wearable.landing.cta}
            <ArrowRight size={15} />
          </CyberButton>
          <CyberButton variant="secondary" to="/dashboard">
            {wearable.landing.secondaryCta}
          </CyberButton>
        </div>
      </motion.div>
    </section>
  );
}

export function LandingPage({ resolvedTheme, onThemeCycle }: LandingPageProps) {
  const { messages } = useLanguage();
  const hero = messages.landing.hero;
  const wearable = messages.wearable;

  return (
    <CyberShell resolvedTheme={resolvedTheme} onThemeCycle={onThemeCycle} landing>
      <section className="grid min-h-[calc(100vh-120px)] gap-6 py-8 lg:grid-cols-[1fr_0.92fr] lg:items-center">
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[var(--border-strong)] bg-[var(--surface-strong)] px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--cyan)]">
            <Sparkles size={14} />
            {hero.badge}
          </div>
          <h1 className="cyber-page-title max-w-4xl">
            {hero.title} <span className="text-[var(--cyan)]">{hero.titleHighlight}</span> {hero.titleSuffix}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-[var(--muted-strong)]">{hero.description}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <CyberButton to="/dashboard">
              {hero.primaryCta}
              <ArrowRight size={16} />
            </CyberButton>
            <CyberButton variant="secondary" to="/report">
              {hero.secondaryCta}
            </CyberButton>
          </div>
          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            {hero.stats.map((item, index) => (
              <MetricTile
                key={item.label}
                label={item.label}
                value={item.value}
                detail={item.caption}
                tone={index === 0 ? "cyan" : index === 1 ? "amber" : "mint"}
              />
            ))}
          </div>
        </div>

        <CyberCard tone="cyan" className="relative overflow-hidden p-4">
          <div className="camera-surface cyber-tone-cyan min-h-[420px]">
            <div className="camera-layer camera-grid opacity-80" />
            <div className="camera-layer" style={{ background: "radial-gradient(ellipse at 50% 36%, rgba(0,245,192,0.14), transparent 70%)" }} />
            <svg className="camera-layer" viewBox="0 0 100 140">
              <circle cx="50" cy="31" r="10" fill="none" stroke="#00F5C0" strokeWidth="1.4" />
              <line x1="50" y1="41" x2="50" y2="113" stroke="#00F5C0" strokeWidth="1.6" />
              <line x1="28" y1="58" x2="72" y2="58" stroke="#00D4FF" strokeWidth="1.2" />
              <line x1="38" y1="113" x2="62" y2="113" stroke="#00D4FF" strokeWidth="1.2" />
              {[31, 58, 83, 113].map((y) => <circle key={y} cx="50" cy={y} r="2.2" fill="#00F5C0" />)}
            </svg>
            <div className="absolute left-4 top-4">
              <PostureBadge state="good" label={hero.preview.cameraOn} />
            </div>
            <div
              className="mx-auto grid h-16 w-16 place-items-center rounded-2xl cyber-panel-red absolute inset-x-4 bottom-4 border border-[var(--border-strong)] p-4 backdrop-blur"
              style={{ background: "var(--surface-strong)" }}
            >
              <p className="cyber-eyebrow">{hero.preview.coachingBadge}</p>
              <h2 className="mt-2 t-heading-md">{hero.preview.encouragementTitle}</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--muted-strong)]">{hero.preview.encouragementDetail}</p>
            </div>
          </div>
        </CyberCard>
      </section>

      <section className="grid gap-4 py-8 lg:grid-cols-3" id="features">
        {messages.landing.howItWorks.steps.map((step, index) => (
          <CyberCard key={step.title} className="p-5" tone={index === 0 ? "cyan" : index === 1 ? "violet" : "mint"}>
            <p className="cyber-eyebrow">{step.accent}</p>
            <h2 className="mt-3 t-heading-lg">{step.title}</h2>
            <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{step.description}</p>
          </CyberCard>
        ))}
      </section>

      <WearableStorySection wearable={wearable} />

      <section className="grid gap-4 py-8 lg:grid-cols-[0.86fr_1.14fr]" id="progress">
        <CyberCard tone="violet" className="p-5">
          <p className="cyber-eyebrow">{messages.landing.progress.eyebrow}</p>
          <h2 className="mt-2 t-heading-xl">{messages.landing.progress.title}</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{messages.landing.progress.description}</p>
          <div className="mt-6 flex items-center gap-5">
            <ScoreRing score={92} label={messages.landing.progress.ringLabel} />
            <div className="grid flex-1 gap-3">
              <MetricTile label={messages.landing.progress.streakBadge} value={messages.landing.progress.streakValue} detail={messages.landing.progress.streakDescription} tone="amber" />
              <MetricTile label={messages.landing.progress.trendBadge} value={messages.landing.progress.trendValue} detail={messages.landing.progress.trendDescription} tone="mint" />
            </div>
          </div>
        </CyberCard>

        <CyberCard className="p-5">
          <p className="cyber-eyebrow">{messages.landing.features.eyebrow}</p>
          <h2 className="mt-2 t-heading-xl">{messages.landing.features.title}</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {messages.landing.features.cards.slice(0, 4).map((feature, index) => (
              <div key={feature.title} className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-4">
                <div className="mb-3 text-[var(--cyan)]">
                  {index === 0 ? <Camera size={18} /> : index === 1 ? <BarChart2 size={18} /> : index === 2 ? <Sparkles size={18} /> : <ShieldCheck size={18} />}
                </div>
                <p className="cyber-eyebrow">{feature.eyebrow}</p>
                <h3 className="mt-2 t-heading-sm">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{feature.description}</p>
              </div>
            ))}
          </div>
        </CyberCard>
      </section>

      <section className="grid gap-4 py-8 lg:grid-cols-[1.1fr_0.9fr]" id="privacy">
        <CyberCard tone="mint" className="p-5">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="mx-auto text-[var(--mint)]" size={46} />
            <p className="cyber-eyebrow">{messages.landing.privacy.badge}</p>
          </div>
          <h2 className="mt-3 t-heading-xl">{messages.landing.privacy.title}</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{messages.landing.privacy.description}</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {messages.landing.privacy.pillars.map((pillar) => (
              <div key={pillar.title} className="rounded-2xl cyber-panel-mint p-4">
                <Lock className="mb-3" size={20} />
                <strong className="t-heading-sm">{pillar.title}</strong>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{pillar.description}</p>
              </div>
            ))}
          </div>
        </CyberCard>

        <CyberCard className="p-5">
          <p className="cyber-eyebrow">{messages.landing.finalCta.eyebrow}</p>
          <h2 className="mt-2 t-heading-xl">{messages.landing.finalCta.title}</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{messages.landing.finalCta.description}</p>
          <div className="mt-6 space-y-4">
            {messages.landing.progress.achievements.map((achievement) => (
              <div key={achievement.title}>
                <div className="mb-2 flex justify-between text-xs font-semibold">
                  <span>{achievement.title}</span>
                  <span className="text-[var(--cyan)]">{achievement.progress}%</span>
                </div>
                <SparkBar value={achievement.progress} tone={achievement.unlocked ? "mint" : "violet"} />
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <CyberButton to="/dashboard">{messages.landing.finalCta.primaryCta}</CyberButton>
            <CyberButton variant="secondary" to="/settings">{messages.landing.finalCta.secondaryCta}</CyberButton>
          </div>
        </CyberCard>
      </section>
    </CyberShell>
  );
}
