import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock, Dumbbell, Pause, Play, RotateCcw, Sparkles, X, Zap } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { type RecoveryFilter } from "@/locales";
import { useLanguage } from "@/components/shared/language-provider";
import {
  CyberButton,
  CyberCard,
  CyberShell,
  CyberTabs,
  ScoreRing,
} from "@/components/cyber/cyber-ui";
import { formatDurationClock } from "@/runtime/display";
import { parseRecoverySource, selectRecoveryRecommendation } from "@/runtime/recovery";
import { usePostureRuntime } from "@/runtime/posture-runtime-provider";
import type { RecoveryActivitySource } from "@/runtime/types";
import type { ExerciseCard, ThemeMode } from "@/types/posture";

interface ExercisesPageProps {
  theme: ThemeMode;
  resolvedTheme: Exclude<ThemeMode, "system">;
  onThemeCycle: () => void;
}

function cardId(card: ExerciseCard) {
  return card.id ?? card.title;
}

function areaTone(area: ExerciseCard["targetArea"]) {
  if (area === "neck") return "cyan";
  if (area === "shoulders") return "violet";
  if (area === "hips") return "amber";
  return "mint";
}

function RecoveryOverlay({
  card,
  source,
  onClose,
  onComplete,
}: {
  card: ExerciseCard;
  source: RecoveryActivitySource;
  onClose: () => void;
  onComplete: (activity: {
    flowId: string;
    targetArea: ExerciseCard["targetArea"];
    source: RecoveryActivitySource;
    startedAt: number;
    completedAt: number | null;
    completedSeconds: number;
  }) => Promise<void>;
}) {
  const { messages, language } = useLanguage();
  const steps = useMemo(
    () => card.steps?.length
      ? card.steps
      : [{ title: card.title, instruction: card.description, durationSeconds: card.durationSeconds ?? 60 }],
    [card],
  );
  const totalSeconds = card.durationSeconds ?? steps.reduce((sum, step) => sum + step.durationSeconds, 0);
  const [stepIndex, setStepIndex] = useState(0);
  const [remaining, setRemaining] = useState(steps[0]?.durationSeconds ?? totalSeconds);
  const [paused, setPaused] = useState(false);
  const [startedAt] = useState(() => Date.now());
  const [complete, setComplete] = useState(false);
  const step = steps[stepIndex] ?? steps[0];
  const elapsed = totalSeconds - steps.slice(stepIndex + 1).reduce((sum, item) => sum + item.durationSeconds, 0) - remaining;
  const progress = totalSeconds > 0 ? Math.round((Math.max(0, elapsed) / totalSeconds) * 100) : 0;

  useEffect(() => {
    setRemaining(step?.durationSeconds ?? 0);
  }, [step?.durationSeconds, stepIndex]);

  useEffect(() => {
    if (paused || complete || !step) return;
    const timer = window.setInterval(() => {
      setRemaining((current) => {
        if (current > 1) return current - 1;
        if (stepIndex < steps.length - 1) {
          setStepIndex((index) => index + 1);
          return steps[stepIndex + 1]?.durationSeconds ?? 0;
        }
        window.clearInterval(timer);
        setComplete(true);
        void onComplete({
          flowId: cardId(card),
          targetArea: card.targetArea,
          source,
          startedAt,
          completedAt: Date.now(),
          completedSeconds: totalSeconds,
        });
        return 0;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [card, complete, onComplete, paused, source, startedAt, step, stepIndex, steps, totalSeconds]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/82 p-4 backdrop-blur-xl">
      <CyberCard tone={areaTone(card.targetArea)} className="w-full max-w-lg p-6 text-center">
        <button type="button" className="cyber-icon-button absolute right-5 top-5" onClick={onClose} aria-label={messages.recovery.flow.cancelCta}>
          <X size={16} />
        </button>
        {complete ? (
          <>
            <CheckCircle2 className="mx-auto text-[var(--mint)]" size={46} />
            <h2 className="mt-4 t-heading-xl">{messages.recovery.flow.completedTitle}</h2>
            <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{messages.recovery.flow.completedDetail}</p>
            <CyberButton className="mt-6" onClick={onClose}>{messages.recovery.flow.cancelCta}</CyberButton>
          </>
        ) : (
          <>
            <p className="cyber-eyebrow">{messages.recovery.flow.recommendedEyebrow}</p>
            <h2 className="mt-2 t-heading-lg">{card.title}</h2>
            <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{card.safetyNote}</p>
            <div className="mt-6">
              <ScoreRing score={progress} size={140} label={messages.recovery.flow.remainingLabel} />
            </div>
            <div className="mt-5 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-4">
              <p className="cyber-eyebrow">
                {messages.recovery.flow.stepLabel} {stepIndex + 1} / {steps.length}
              </p>
              <h3 className="mt-2 t-heading-md">{step?.title}</h3>
              <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{step?.instruction}</p>
              <p className="mt-3 t-heading-lg text-[var(--accent)]">{formatDurationClock(remaining * 1000)}</p>
            </div>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <CyberButton variant="ghost" disabled={stepIndex === 0} onClick={() => setStepIndex((index) => Math.max(0, index - 1))}>
                {messages.recovery.flow.previousCta}
              </CyberButton>
              <CyberButton variant="secondary" onClick={() => setPaused((value) => !value)}>
                {paused ? <Play size={16} /> : <Pause size={16} />}
                {paused ? messages.recovery.flow.resumeCta : messages.recovery.flow.pauseCta}
              </CyberButton>
              <CyberButton
                onClick={() => {
                  if (stepIndex < steps.length - 1) setStepIndex((index) => index + 1);
                  else {
                    setComplete(true);
                    void onComplete({
                      flowId: cardId(card),
                      targetArea: card.targetArea,
                      source,
                      startedAt,
                      completedAt: Date.now(),
                      completedSeconds: totalSeconds,
                    });
                  }
                }}
              >
                {stepIndex < steps.length - 1 ? messages.recovery.flow.nextCta : messages.recovery.flow.completeCta}
              </CyberButton>
            </div>
            <p className="mt-4 text-xs text-[var(--muted)]">
              {language === "vi" ? "Du lieu hoan thanh duoc luu cuc bo." : "Completion is recorded locally."}
            </p>
          </>
        )}
      </CyberCard>
    </div>
  );
}

export function ExercisesPage({ resolvedTheme, onThemeCycle }: ExercisesPageProps) {
  const [filter, setFilter] = useState<RecoveryFilter>("all");
  const [searchParams, setSearchParams] = useSearchParams();
  const { messages, language } = useLanguage();
  const {
    monitoringStatus,
    currentCue,
    currentIssue,
    distanceStatus,
    effectiveTask,
    loadSource,
    recoveryActivities,
    recordRecoveryActivity,
    summaries,
    todaySummary,
  } = usePostureRuntime();
  const isMonitoring = monitoringStatus !== "idle" && monitoringStatus !== "error";
  const summary = todaySummary ?? summaries.at(-1) ?? null;
  const recommendationIssue = isMonitoring ? currentIssue : currentIssue ?? summary?.dominantIssue ?? null;
  const recommendation = useMemo(
    () => selectRecoveryRecommendation({
      cards: messages.recovery.cards,
      dominantIssue: recommendationIssue,
      distanceStatus,
      latestCueKind: currentCue?.kind ?? null,
      recentCompletions: recoveryActivities.slice(0, 5),
      effectiveTask,
      loadSource: currentCue?.loadSource ?? loadSource,
    }),
    [currentCue?.kind, currentCue?.loadSource, distanceStatus, effectiveTask, loadSource, messages.recovery.cards, recommendationIssue, recoveryActivities],
  );
  const selectedFlowId = searchParams.get("flow");
  const selectedFlow = selectedFlowId
    ? messages.recovery.cards.find((card) => cardId(card) === selectedFlowId) ?? null
    : null;
  const flowSource = parseRecoverySource(searchParams.get("source"));
  const filteredCards = filter === "all"
    ? messages.recovery.cards
    : messages.recovery.cards.filter((card) => card.targetArea === filter);

  useEffect(() => {
    const area = searchParams.get("area");
    if (area === "neck" || area === "shoulders" || area === "back" || area === "hips") {
      setFilter(area);
    }
  }, [searchParams]);

  function openFlow(flowId: string, source: RecoveryActivitySource = "recovery") {
    const next = new URLSearchParams(searchParams);
    next.set("flow", flowId);
    next.set("source", source);
    setSearchParams(next);
  }

  function closeFlow() {
    const next = new URLSearchParams(searchParams);
    next.delete("flow");
    next.delete("source");
    setSearchParams(next);
  }

  const tabs = messages.recovery.filters.map((item) => ({ value: item.value, label: item.label }));
  const recommendedCard = messages.recovery.cards.find((card) => cardId(card) === recommendation.flowId) ?? messages.recovery.cards[0];

  return (
    <CyberShell resolvedTheme={resolvedTheme} onThemeCycle={onThemeCycle}>
      <section className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr] xl:items-end">
        <div>
          <p className="cyber-eyebrow">{messages.recovery.page.badge}</p>
          <h1 className="t-display mt-2">{messages.recovery.page.title}</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--muted)]">{messages.recovery.page.description}</p>
        </div>
        <CyberCard tone={areaTone(recommendedCard.targetArea)} className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <Sparkles size={18} className="text-[var(--cyan)]" />
            <p className="cyber-eyebrow">{messages.recovery.page.unwindEyebrow}</p>
          </div>
          <h2 className="t-heading-lg">{recommendedCard.title}</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{recommendedCard.description}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <CyberButton onClick={() => openFlow(recommendation.flowId, recommendation.reason === "distance" ? "distance-advisory" : "recovery")}>
              {messages.recovery.page.primaryCta}
            </CyberButton>
            <CyberButton variant="secondary" onClick={() => openFlow("shoulder-opener-sequence", "recovery")}>
              {messages.recovery.page.secondaryCta}
            </CyberButton>
          </div>
        </CyberCard>
      </section>

      <section className="mt-4">
        <CyberTabs tabs={tabs} value={filter} onChange={setFilter} />
      </section>

      <section className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredCards.map((card) => (
          <CyberCard key={cardId(card)} tone={areaTone(card.targetArea)} className="p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="cyber-eyebrow">{messages.common.bodyAreaLabels[card.targetArea]}</p>
                <h2 className="mt-2 t-heading-md">{card.title}</h2>
              </div>
              <CyberButton onClick={() => openFlow(cardId(card), "recovery")}>
                {messages.recovery.previewFlowCta}
              </CyberButton>
            </div>
            <p className="text-sm leading-7 text-[var(--muted)]">{card.description}</p>
            <div className="mt-5 grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-3">
                <Clock size={14} className="mb-2 text-[var(--cyan)]" />
                <span className="text-xs text-[var(--muted)]">{card.duration}</span>
              </div>
              <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-3">
                <RotateCcw size={14} className="mb-2 text-[var(--violet)]" />
                <span className="text-xs text-[var(--muted)]">{card.steps?.length ?? 1} {language === "vi" ? "bước" : "steps"}</span>
              </div>
              <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-3">
                <Zap size={14} className="mb-2 text-[var(--amber)]" />
                <span className="text-xs text-[var(--muted)]">{messages.common.difficultyLabels[card.difficulty]}</span>
              </div>
            </div>
          </CyberCard>
        ))}
      </section>

      {selectedFlow ? (
        <RecoveryOverlay
          card={selectedFlow}
          source={flowSource}
          onClose={closeFlow}
          onComplete={recordRecoveryActivity}
        />
      ) : null}

      <div className="mt-6 flex items-center justify-center gap-2 text-xs text-[var(--muted)]">
        <Dumbbell size={14} />
        {messages.recovery.afterWarningLabel}
      </div>
    </CyberShell>
  );
}
