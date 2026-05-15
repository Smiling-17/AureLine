import { useEffect, useMemo, useRef, useState } from "react";
import {
  Award,
  CameraOff,
  CheckCircle2,
  Coffee,
  Pause,
  Play,
  ScanSearch,
  Settings2,
  Square,
  Target,
  TrendingUp,
  Video,
} from "lucide-react";
import { Area, AreaChart, Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useLanguage } from "@/components/shared/language-provider";
import {
  CyberButton,
  CyberCard,
  CyberShell,
  CyberTabs,
  MetricTile,
  ScoreRing,
  SparkBar,
  formatCompactDate,
  percent,
  stateTone,
} from "@/components/cyber/cyber-ui";
import { WearableCompanionPanel } from "@/components/wearable/wearable-companion";
import { formatHourRange } from "@/runtime/display";
import { usePostureRuntime } from "@/runtime/posture-runtime-provider";
import { getCompletedRecoverySecondsForDay } from "@/runtime/recovery";
import type {
  DailySummary,
  DistanceMode,
  DistanceSuppressionReason,
  IssueFamily,
  LandmarkSample,
  PostureEventRecord,
  RuntimeCue,
  TrackingLostReason,
} from "@/runtime/types";
import type { PostureState, ThemeMode } from "@/types/posture";

interface DashboardPageProps {
  theme: ThemeMode;
  resolvedTheme: Exclude<ThemeMode, "system">;
  onThemeCycle: () => void;
}

type DashboardTab = "overview" | "analytics" | "achievements";
type Point = { x: number; y: number } | null;

function point(landmark: LandmarkSample[keyof LandmarkSample]): Point {
  return landmark ? { x: landmark.x * 100, y: landmark.y * 100 } : null;
}

function issueLabel(issue: string | null | undefined, language: "en" | "vi") {
  const labels = {
    "forward-head": language === "vi" ? "Cổ đầu đưa trước" : "Forward head",
    "torso-lean": language === "vi" ? "Thân người nghiêng" : "Torso lean",
    "shoulder-tilt": language === "vi" ? "Lệch vai" : "Shoulder tilt",
  } as Record<string, string>;
  return issue ? labels[issue] ?? issue : language === "vi" ? "Ổn định" : "Stable";
}

function eventTitle(event: PostureEventRecord, language: "en" | "vi") {
  if (event.kind === "session-start") return language === "vi" ? "Bắt đầu phiên" : "Session started";
  if (event.kind === "session-stop") return language === "vi" ? "Kết thúc phiên" : "Session stopped";
  if (event.kind === "feedback") return language === "vi" ? "Cue tư thế" : "Posture cue";
  if (event.kind === "break-reminder") return language === "vi" ? "Nhắc nghỉ ngắn" : "Break reminder";
  if (event.kind === "distance-warning") return language === "vi" ? "Cảnh báo khoảng cách" : "Screen distance";
  if (event.kind === "correction-success") return language === "vi" ? "Đã chỉnh lại tư thế" : "Correction held";
  if (event.kind === "overlay-snooze") return language === "vi" ? "Tạm hoãn overlay" : "Overlay snoozed";
  return language === "vi" ? "Thay đổi trạng thái" : "State changed";
}

function trackingLostLabel(reason: TrackingLostReason | null, language: "en" | "vi") {
  if (!reason) return language === "vi" ? "Đang chờ landmark ổn định" : "Waiting for stable landmarks";
  const labels: Record<TrackingLostReason, { en: string; vi: string }> = {
    "no-pose": { en: "No body detected", vi: "Chưa thấy người" },
    "low-confidence-face": { en: "Face landmarks are weak", vi: "Landmark mặt yếu" },
    "low-confidence-shoulders": { en: "Shoulder landmarks are weak", vi: "Landmark vai yếu" },
    "low-confidence-hips": { en: "Hip landmarks are weak", vi: "Landmark hông yếu" },
    "head-reference-missing": { en: "Need eyes or ears", vi: "Cần mắt hoặc tai" },
  };
  return labels[reason][language];
}

function distanceModeLabel(mode: DistanceMode, language: "en" | "vi") {
  const labels: Record<DistanceMode, { en: string; vi: string }> = {
    active: { en: "Active", vi: "Đang theo dõi" },
    soft: { en: "Soft monitoring", vi: "Theo dõi nhẹ" },
    "suppressed-task": { en: "Not screen-based", vi: "Không phải tác vụ màn hình" },
    "suppressed-reliability": { en: "Low reliability", vi: "Tín hiệu yếu" },
  };

  return labels[mode][language];
}

function distanceReasonLabel(reason: DistanceSuppressionReason | null, language: "en" | "vi") {
  if (!reason) return null;
  const labels: Record<DistanceSuppressionReason, { en: string; vi: string }> = {
    "non-screen-task": {
      en: "Waiting for screen-like work",
      vi: "Đang chờ tác vụ màn hình rõ hơn",
    },
    "minimal-reliability": {
      en: "Need steadier tracking first",
      vi: "Cần tracking ổn định hơn",
    },
    "side-view-distance-unreliable": {
      en: "Far-distance check paused from side view",
      vi: "Tạm bỏ đo xa vì góc camera bên hông",
    },
  };

  return labels[reason][language];
}

function liveCoachCopy(input: {
  isMonitoring: boolean;
  liveScore: number;
  liveScoreReliable: boolean;
  postureState: PostureState;
  currentIssue: IssueFamily | null;
  language: "en" | "vi";
  waitingTitle: string;
  waitingDescription: string;
  goodTitle: string;
  goodDetail: string;
}) {
  if (!input.isMonitoring) {
    return { title: input.waitingTitle, detail: input.waitingDescription };
  }

  if (!input.liveScoreReliable) {
    return {
      title: input.language === "vi" ? "Đang chờ tracking ổn định" : "Waiting for stable tracking",
      detail: input.language === "vi"
        ? "Giữ mặt và vai trong khung hình thêm vài giây để coach đọc posture chắc hơn."
        : "Keep your face and shoulders in frame for a few seconds so the coach can read posture reliably.",
    };
  }

  if (input.liveScore < 60 || input.postureState === "bad") {
    return {
      title: input.language === "vi" ? "Cần chỉnh lại tư thế ngay" : "Reset your posture now",
      detail: input.language === "vi"
        ? input.currentIssue
          ? `${issueLabel(input.currentIssue, input.language)} đang kéo điểm live xuống. Ngồi cao hơn, đưa cổ về sau và thả vai trước khi tiếp tục.`
          : "Tải tư thế đang kéo điểm live xuống. Đổi tư thế nhẹ, thở ra và ngồi cao hơn trước khi tiếp tục."
        : input.currentIssue
          ? `${issueLabel(input.currentIssue, input.language)} is pulling the live score down. Sit taller, bring the neck back, and relax the shoulders before continuing.`
          : "Postural load is pulling the live score down. Shift lightly, exhale, and sit taller before continuing.",
    };
  }

  if (input.liveScore < 75 || input.postureState === "warning") {
    return {
      title: input.language === "vi" ? "Đang có dấu hiệu lệch tư thế" : "Posture is starting to drift",
      detail: input.language === "vi"
        ? input.currentIssue
          ? `${issueLabel(input.currentIssue, input.language)} đang tăng nhẹ. Chỉnh sớm lúc này sẽ ít mỏi hơn nhiều.`
          : "Tải giữ lâu đang tăng nhẹ. Đổi góc ngồi sớm lúc này sẽ ít mỏi hơn nhiều."
        : input.currentIssue
          ? `${issueLabel(input.currentIssue, input.language)} is building up. A small correction now prevents fatigue later.`
          : "Static load is building up. A small position change now prevents fatigue later.",
    };
  }

  return { title: input.goodTitle, detail: input.goodDetail };
}

function selectPrimaryCoachCue(cue: RuntimeCue | null, postureState: PostureState, currentIssue: IssueFamily | null) {
  if (!cue) return null;
  if (cue.kind !== "distance") return cue;
  return postureState === "good" && !currentIssue ? cue : null;
}

function distanceIssueLabel(language: "en" | "vi") {
  return language === "vi" ? "Khoảng cách màn hình" : "Screen distance";
}

function SkeletonOverlay({ landmarks, state }: { landmarks: LandmarkSample | null; state: PostureState }) {
  const points = useMemo(() => {
    if (!landmarks) return null;
    return {
      nose: point(landmarks.nose),
      leftShoulder: point(landmarks.leftShoulder),
      rightShoulder: point(landmarks.rightShoulder),
      leftHip: point(landmarks.leftHip),
      rightHip: point(landmarks.rightHip),
    };
  }, [landmarks]);

  if (!points) return null;

  const stroke = state === "good" ? "#00F5C0" : state === "warning" ? "#F59E0B" : "#EF4444";
  const segments: Array<[Point, Point]> = [
    [points.nose, points.leftShoulder],
    [points.nose, points.rightShoulder],
    [points.leftShoulder, points.rightShoulder],
    [points.leftShoulder, points.leftHip],
    [points.rightShoulder, points.rightHip],
    [points.leftHip, points.rightHip],
  ];

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none">
      {segments.map(([start, end], index) =>
        start && end ? (
          <line key={index} x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke={stroke} strokeWidth="1.1" />
        ) : null,
      )}
      {Object.values(points).map((item, index) =>
        item ? <circle key={index} cx={item.x} cy={item.y} r="1.35" fill={stroke} /> : null,
      )}
    </svg>
  );
}

function CameraPanel() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const { messages, language } = useLanguage();
  const {
    cameraMode,
    monitoringStatus,
    postureState,
    liveScore,
    liveScoreReliable,
    liveMetrics,
    liveLandmarks,
    currentIssue,
    currentCue,
    stream,
    calibrationProgress,
    runtimeDiagnostics,
    selectedCameraLabel,
    runtimeError,
  } = usePostureRuntime();

  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.srcObject = stream;
    if (stream) {
      void videoRef.current.play().catch(() => undefined);
    }
  }, [stream]);

  const tone =
    cameraMode === "off"
      ? "muted"
      : liveScoreReliable && liveScore < 60
        ? "red"
        : liveScoreReliable && liveScore < 75
          ? "amber"
          : stateTone[postureState];
  const tracking = liveMetrics ? `${Math.round((1 - liveMetrics.deviationRatio * 0.6) * 100)}%` : "--";
  const torsoAvailable = runtimeDiagnostics.metricAvailability.torsoLean;
  const workerError = runtimeDiagnostics.lastWorkerError
    ? `[${runtimeDiagnostics.lastWorkerError.code}] ${runtimeDiagnostics.lastWorkerError.message}`
    : runtimeError;
  const primaryCue = selectPrimaryCoachCue(currentCue, postureState, currentIssue);
  const cameraCoachFallback = liveCoachCopy({
    isMonitoring: cameraMode !== "off",
    liveScore,
    liveScoreReliable,
    postureState,
    currentIssue,
    language,
    waitingTitle: messages.dashboard.monitor.cameraOffTitle,
    waitingDescription: messages.demoStates.camera.off.description,
    goodTitle: messages.demoStates.posture.good.headline,
    goodDetail: messages.demoStates.posture.good.detail,
  });

  return (
    <CyberCard tone={tone} className="p-4">
      <div className="mb-4">
        <p className="cyber-eyebrow">{messages.dashboard.monitor.eyebrow}</p>
        <h2 className="mt-1 t-heading-lg">{messages.dashboard.monitor.title}</h2>
      </div>

      <div className={`camera-surface cyber-tone-${tone}`}>
        <video ref={videoRef} muted playsInline style={{ opacity: stream ? 1 : 0 }} />
        <div className="camera-layer" style={{ background: "linear-gradient(180deg, rgba(6,10,20,0.1), rgba(6,10,20,0.58))" }} />
        <div className="camera-layer camera-grid" />
        <div className="camera-layer" style={{ background: `radial-gradient(ellipse at 50% 42%, color-mix(in srgb, currentColor 18%, transparent), transparent 68%)` }} />
        {stream ? <SkeletonOverlay landmarks={liveLandmarks} state={postureState} /> : null}

        <div className="absolute left-3 top-3 z-10 flex items-center gap-2 rounded-lg bg-black/45 px-3 py-1.5 text-xs font-semibold text-white/70">
          {cameraMode === "off" ? <CameraOff size={14} /> : <Video size={14} />}
          <span>{cameraMode === "off" ? messages.demoStates.camera.off.label : "LIVE"}</span>
        </div>

        {cameraMode === "off" && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center px-6 text-center">
            <CameraOff size={34} className="text-white/25" />
            <h3 className="mt-4 t-heading-lg">{workerError ?? messages.dashboard.monitor.cameraOffTitle}</h3>
            <p className="mt-2 max-w-md text-sm leading-6 text-white/42">{workerError ?? messages.demoStates.camera.off.description}</p>
          </div>
        )}

        {(monitoringStatus === "calibrating" || monitoringStatus === "calibration-retry") && (
          <div
            className="absolute inset-x-4 bottom-4 z-10 rounded-2xl border border-[var(--border-strong)] p-4 backdrop-blur"
            style={{ background: "var(--surface-strong)" }}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="cyber-eyebrow">{messages.dashboard.monitor.coachingEyebrow}</p>
                <h3 className="mt-2 t-heading-md">
                  {monitoringStatus === "calibration-retry"
                    ? language === "vi" ? "Cần landmark rõ hơn" : "Calibration needs clearer landmarks"
                    : messages.dashboard.demo.title}
                </h3>
                <p className="mt-1 text-sm leading-6 text-[var(--muted-strong)]">
                  {selectedCameraLabel ?? (language === "vi" ? "Camera mặc định" : "Default camera")} -{" "}
                  {trackingLostLabel(runtimeDiagnostics.lastTrackingLostReason, language)}
                </p>
              </div>
              <div className="sm:text-right">
                <p className="cyber-eyebrow">Calibration</p>
                <strong className="block t-display text-4xl">{Math.round(calibrationProgress * 100)}%</strong>
                <span className="t-caption">
                  {Math.round(runtimeDiagnostics.calibrationValidMs / 1000)}s / {Math.round(runtimeDiagnostics.calibrationElapsedMs / 1000)}s
                </span>
              </div>
            </div>
          </div>
        )}

        {monitoringStatus === "analyzing" && (
          <div className="absolute inset-x-4 bottom-4 z-10 inline-flex w-fit items-center gap-2 rounded-full border border-[var(--cyan)]/25 bg-[var(--cyan)]/8 px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-[var(--cyan)]">
            <ScanSearch size={14} />
            {messages.dashboard.monitor.analyzingCallout}
          </div>
        )}

        {cameraMode !== "off" && monitoringStatus !== "calibrating" && monitoringStatus !== "calibration-retry" && (
          <div
            className="absolute inset-x-4 bottom-4 z-10 rounded-2xl border border-[var(--border-strong)] p-4 backdrop-blur"
            style={{ background: "var(--surface-strong)" }}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="cyber-eyebrow">{messages.dashboard.monitor.coachingEyebrow}</p>
                <h3 className="mt-2 t-heading-md">
                  {primaryCue?.title ?? cameraCoachFallback.title}
                </h3>
                <p className="mt-1 text-sm leading-6 text-[var(--muted-strong)]">
                  {primaryCue?.detail ?? cameraCoachFallback.detail}
                </p>
              </div>
              <div className="sm:min-w-36 sm:text-right">
                <p className="cyber-eyebrow">{messages.dashboard.monitor.trackingConfidenceLabel}</p>
                <strong className="block t-display text-4xl">{tracking}</strong>
                <span className="t-caption">
                  {liveMetrics
                    ? `${Math.round(liveMetrics.headForward * 100) / 100} / ${torsoAvailable ? `${Math.round(liveMetrics.torsoLean)}deg` : "--"} / ${Math.round(liveMetrics.shoulderTilt)}deg`
                    : issueLabel(null, language)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </CyberCard>
  );
}

function SummaryBreakdown({ summary }: { summary: DailySummary | null }) {
  const { messages } = useLanguage();
  const tracked = summary?.trackedMs ?? 0;
  const rows = [
    { label: messages.report.overview.ratio[0]?.name ?? "Good", value: summary?.goodMs ?? 0, tone: "mint" as const },
    { label: messages.report.overview.ratio[1]?.name ?? "Warning", value: summary?.warningMs ?? 0, tone: "amber" as const },
    { label: messages.report.overview.ratio[2]?.name ?? "Bad", value: summary?.badMs ?? 0, tone: "red" as const },
  ];

  return (
    <CyberCard className="p-4">
      <p className="cyber-eyebrow">{messages.report.overview.sittingEyebrow}</p>
      <h3 className="mt-1 t-heading-md">{messages.report.overview.sittingTitle}</h3>
      <div className="mt-4 grid gap-3">
        {rows.map((row) => (
          <div key={row.label}>
            <div className="mb-1 flex justify-between text-xs font-semibold">
              <span className="text-[var(--muted)]">{row.label}</span>
              <span className={`cyber-tone-${row.tone}`}>{percent(row.value, tracked)}%</span>
            </div>
            <SparkBar value={row.value} max={tracked || 1} tone={row.tone} />
          </div>
        ))}
      </div>
    </CyberCard>
  );
}

function FeedbackLog({ events }: { events: PostureEventRecord[] }) {
  const { language, messages } = useLanguage();
  const recent = events.slice(0, 5);

  return (
    <CyberCard className="p-4">
      <p className="cyber-eyebrow">{messages.dashboard.feedbackHistory.eyebrow}</p>
      <h3 className="mt-1 t-heading-md">{messages.dashboard.feedbackHistory.title}</h3>
      <div className="mt-4 grid gap-2">
        {recent.length ? recent.map((event) => {
          const state = event.postureState ?? (event.kind === "correction-success" ? "good" : event.kind === "feedback" ? "warning" : "good");
          return (
            <div key={`${event.timestamp}-${event.kind}`} className="flex items-start gap-3 rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-3">
              <span className={`mt-1 h-2 w-2 shrink-0 rounded-full bg-current cyber-tone-${stateTone[state]}`} />
              <div className="min-w-0 flex-1">
                <div className="flex justify-between gap-3">
                  <strong className="text-sm">{eventTitle(event, language)}</strong>
                  <span className="text-xs text-[var(--muted)]">{new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(event.timestamp)}</span>
                </div>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{event.detail ?? issueLabel(event.issue, language)}</p>
              </div>
            </div>
          );
        }) : (
          <p className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-4 text-sm text-[var(--muted)]">
            {language === "vi" ? "Chưa có sự kiện coaching nào trong phiên này." : "No coaching events yet in this session."}
          </p>
        )}
      </div>
    </CyberCard>
  );
}

export function DashboardPage({ resolvedTheme, onThemeCycle }: DashboardPageProps) {
  const { messages, language } = useLanguage();
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");
  const {
    monitoringStatus,
    postureState,
    sessionScore,
    liveScore,
    liveScoreReliable,
    todaySummary,
    summaries,
    usingDemoHistory,
    feedbackHistory,
    recoveryActivities,
    achievements,
    streak,
    identity,
    currentCue,
    currentIssue,
    distanceStatus,
    distanceMode,
    distanceSuppressionReason,
    startMonitoring,
    stopMonitoring,
    pauseMonitoring,
    resumeMonitoring,
  } = usePostureRuntime();

  const isMonitoring = monitoringStatus !== "idle" && monitoringStatus !== "error";
  const isPaused = monitoringStatus === "paused";
  const sessionScoreDisplay = Math.round(isMonitoring ? sessionScore : todaySummary?.score ?? 0);
  const score = Math.round(isMonitoring ? liveScore : sessionScoreDisplay);
  const distanceReason = distanceReasonLabel(distanceSuppressionReason, language);
  const latestSummary = todaySummary ?? summaries.at(-1) ?? null;
  const weekly = summaries.slice(-7).map((summary) => ({
    day: formatCompactDate(summary.dayKey),
    score: Math.round(summary.score),
    focus: Math.round(summary.longestFocusBlockMs / 60000),
  }));
  const timeline = latestSummary?.hourlyTrend ?? [];
  const recoveryMinutes = latestSummary ? Math.round(getCompletedRecoverySecondsForDay(recoveryActivities, latestSummary.dayKey) / 60) : 0;
  const displayIssue = isMonitoring ? currentIssue : currentIssue ?? latestSummary?.dominantIssue ?? null;
  const hasDistanceIssue = isMonitoring && !displayIssue && distanceStatus !== "ok";
  const issueTileValue = hasDistanceIssue ? distanceIssueLabel(language) : issueLabel(displayIssue, language);
  const issueTileTone = displayIssue || hasDistanceIssue ? "amber" : "cyan";
  const primaryCue = selectPrimaryCoachCue(currentCue, postureState, currentIssue);
  const coachFallback = liveCoachCopy({
    isMonitoring,
    liveScore: score,
    liveScoreReliable,
    postureState,
    currentIssue,
    language,
    waitingTitle: messages.dashboard.coach.waitingTitle,
    waitingDescription: messages.dashboard.coach.waitingDescription,
    goodTitle: messages.demoStates.posture.good.headline,
    goodDetail: messages.demoStates.posture.good.detail,
  });
  const tabs = [
    { value: "overview" as const, label: language === "vi" ? "Tổng quan" : "Overview" },
    { value: "analytics" as const, label: messages.dashboard.analytics.weeklyEyebrow },
    { value: "achievements" as const, label: messages.dashboard.rewards.rewardsEyebrow },
  ];

  return (
    <CyberShell resolvedTheme={resolvedTheme} onThemeCycle={onThemeCycle}>
      <section className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="cyber-eyebrow">{messages.dashboard.hero.badge}</p>
          <h1 className="cyber-page-title mt-2">{messages.dashboard.monitor.title}</h1>
          {usingDemoHistory && !isMonitoring && (
            <p className="mt-3 text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
              {language === "vi" ? "Đang hiện dữ liệu mẫu" : "Showing sample history"}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 lg:justify-end">
          {!isMonitoring ? (
            <CyberButton onClick={() => void startMonitoring()}>
              <Play size={16} />
              {language === "vi" ? "Bắt đầu theo dõi" : "Start monitoring"}
            </CyberButton>
          ) : isPaused ? (
            <CyberButton onClick={resumeMonitoring}>
              <Play size={16} />
              {language === "vi" ? "Tiếp tục" : "Resume"}
            </CyberButton>
          ) : (
            <CyberButton variant="secondary" onClick={pauseMonitoring}>
              <Pause size={16} />
              {language === "vi" ? "Tạm dừng" : "Pause"}
            </CyberButton>
          )}
          {isMonitoring && (
            <CyberButton variant="ghost" onClick={() => void stopMonitoring()}>
              <Square size={16} />
              {language === "vi" ? "Dừng" : "Stop"}
            </CyberButton>
          )}
          <CyberButton variant="ghost" to="/settings">
            <Settings2 size={16} />
            {messages.dashboard.hero.settingsCta}
          </CyberButton>
        </div>
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <CameraPanel />
        <div className="grid gap-4">
          <CyberCard tone={score >= 75 ? "mint" : score >= 50 ? "amber" : "red"} className="p-4">
            <div className="flex items-center justify-between gap-4">
              <ScoreRing score={score} size={108} label={isMonitoring ? "Live score" : "Session score"} />
              <div className="min-w-0 flex-1">
                <p className="cyber-eyebrow">{messages.dashboard.coach.coachTipLabel}</p>
                <h2 className="mt-2 t-heading-lg">
                  {primaryCue?.title ?? coachFallback.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  {primaryCue?.detail ?? coachFallback.detail}
                </p>
                <div className="mt-4 flex flex-wrap gap-3 text-xs text-[var(--muted)]">
                  <span>
                    {language === "vi" ? "Trung bình phiên" : "Session average"}: <strong className="text-[var(--foreground)]">{sessionScoreDisplay}</strong>
                  </span>
                  <span>
                    {language === "vi" ? "Live score" : "Live score"}:{" "}
                    <strong className="text-[var(--foreground)]">{score}</strong>
                    {isMonitoring && !liveScoreReliable ? ` (${language === "vi" ? "đang chờ tracking ổn định" : "waiting for stable tracking"})` : ""}
                  </span>
                  <span>
                    {language === "vi" ? "Distance" : "Distance"}: <strong className="text-[var(--foreground)]">{distanceModeLabel(distanceMode, language)}</strong>
                    {distanceReason ? ` - ${distanceReason}` : ""}
                  </span>
                </div>
              </div>
            </div>
            {currentCue?.kind === "break" && (
              <div className="mt-4 rounded-2xl cyber-panel-amber p-4">
                <div className="flex items-start gap-4">
                  <Coffee className="mt-1" size={18} />
                  <div>
                    <strong>{messages.dashboard.coach.breakReminderBadge}</strong>
                    <p className="mt-1 text-sm text-[var(--muted)]">{currentCue.detail}</p>
                    <CyberButton className="mt-3" variant="secondary" to="/recovery?flow=desk-reset&source=break-cue">
                      {messages.recovery.previewFlowCta}
                    </CyberButton>
                  </div>
                </div>
              </div>
            )}
            {currentCue?.kind === "reward" && (
              <div className="mt-4 rounded-2xl cyber-panel-mint p-4">
                <div className="flex items-start gap-4">
                  <Award className="mt-1" size={18} />
                  <div>
                    <strong>{messages.dashboard.coach.achievementBadge}</strong>
                    <p className="mt-1 text-sm text-[var(--muted)]">{currentCue.detail}</p>
                  </div>
                </div>
              </div>
            )}
          </CyberCard>

          <div className="grid grid-cols-2 gap-3">
            <MetricTile label={messages.dashboard.hero.streakLabel} value={streak} detail={language === "vi" ? "ngày" : "days"} tone="amber" />
            <MetricTile label={messages.report.overview.bestWindowLabel} value={formatHourRange(latestSummary?.bestHour ?? null)} tone="mint" />
            <MetricTile label={messages.report.overview.recoveryMinutesLabel} value={recoveryMinutes} detail="min" tone="violet" />
            <MetricTile label={language === "vi" ? "Vấn đề chính" : "Main issue"} value={issueTileValue} tone={issueTileTone} />
          </div>
        </div>
      </section>

      <section className="mt-4">
        <CyberTabs tabs={tabs} value={activeTab} onChange={setActiveTab} />
      </section>

      {activeTab === "overview" && (
        <section className="mt-4 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="grid gap-4">
            <SummaryBreakdown summary={latestSummary} />
            <CyberCard className="p-4">
              <p className="cyber-eyebrow">{messages.dashboard.analytics.timelineEyebrow}</p>
              <h3 className="mt-1 t-heading-md">{messages.dashboard.analytics.timelineTitle}</h3>
              <div className="mt-5">
                {timeline.length ? (
                  <div className="grid gap-2">
                    <div className="flex h-28 items-end gap-2 border-b border-[var(--border-soft)]/80 pb-1">
                      {timeline.map((hour) => (
                        <div key={hour.hour} className="flex h-full flex-1 items-end">
                          <div
                            className={`w-full rounded-t-md bg-current shadow-[0_0_18px_currentColor] cyber-tone-${stateTone[hour.state]}`}
                            style={{ height: `${Math.max(12, hour.postureScore)}%`, opacity: 0.82 }}
                            title={`${hour.hour}:00 - ${hour.postureScore}`}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      {timeline.map((hour) => (
                        <span key={hour.hour} className="flex-1 text-center text-[10px] text-[var(--muted)]">
                          {hour.hour}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-4 text-sm text-[var(--muted)]">
                    {language === "vi" ? "Timeline se hien thi sau phien dau tien." : "Timeline appears after your first session."}
                  </p>
                )}
              </div>
            </CyberCard>
          </div>
          <div className="grid gap-4">
            <WearableCompanionPanel />
            <FeedbackLog events={feedbackHistory} />
          </div>
        </section>
      )}

      {activeTab === "analytics" && (
        <section className="mt-4 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <CyberCard className="p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="cyber-eyebrow">{messages.dashboard.analytics.weeklyEyebrow}</p>
                <h3 className="mt-1 t-heading-md">{messages.dashboard.analytics.weeklyTitle}</h3>
              </div>
              <TrendingUp size={18} className="text-[var(--mint)]" />
            </div>
            {weekly.length ? (
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={weekly} margin={{ top: 8, right: 10, left: -24, bottom: 0 }}>
                  <defs>
                    <linearGradient id="dashScore" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00D4FF" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#00D4FF" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" tick={{ fill: "rgba(255,255,255,0.42)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: "rgba(255,255,255,0.24)", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "#111827", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10 }} />
                  <Area type="monotone" dataKey="score" stroke="#00D4FF" strokeWidth={2} fill="url(#dashScore)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-4 text-sm text-[var(--muted)]">
                {language === "vi" ? "Cần thêm dữ liệu để vẽ biểu đồ tuần." : "Weekly charts appear after enough tracked days."}
              </p>
            )}
          </CyberCard>

          <CyberCard tone="violet" className="p-4">
            <p className="cyber-eyebrow">{messages.dashboard.rewards.identityEyebrow}</p>
            <h3 className="mt-1 t-heading-lg">{identity.level}</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{identity.vibe}</p>
            <div className="mt-5">
              <div className="mb-2 flex justify-between text-xs font-semibold">
                <span>{messages.dashboard.rewards.specialtyLabel}</span>
                <span className="text-[var(--violet)]">{identity.progressValue}%</span>
              </div>
              <SparkBar value={identity.progressValue} tone="violet" />
              <p className="mt-3 text-sm text-[var(--muted)]">{identity.specialty}</p>
            </div>
          </CyberCard>
        </section>
      )}

      {activeTab === "achievements" && (
        <section className="mt-4 grid gap-4 xl:grid-cols-[1fr_0.8fr]">
          <CyberCard className="p-4">
            <p className="cyber-eyebrow">{messages.dashboard.rewards.rewardsEyebrow}</p>
            <h3 className="mt-1 t-heading-md">{messages.dashboard.rewards.rewardsTitle}</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {achievements.map((achievement) => (
                <div key={achievement.id} className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-4">
                  <div className="mb-3 flex items-center justify-between">
                    {achievement.unlocked ? <CheckCircle2 className="text-[var(--mint)]" size={18} /> : <Target className="text-[var(--muted)]" size={18} />}
                    <span className="text-xs font-bold text-[var(--muted)]">{achievement.progress}%</span>
                  </div>
                  <strong className="block text-sm font-semibold">{achievement.title}</strong>
                  <p className="mt-2 min-h-12 text-xs leading-5 text-[var(--muted)]">{achievement.description}</p>
                  <SparkBar value={achievement.progress} tone={achievement.unlocked ? "mint" : "violet"} />
                </div>
              ))}
            </div>
          </CyberCard>

          <CyberCard className="p-4">
            <p className="cyber-eyebrow">{language === "vi" ? "Tiến trình tháng" : "Monthly progress"}</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={weekly} margin={{ top: 12, right: 4, left: -24, bottom: 0 }}>
                <XAxis dataKey="day" tick={{ fill: "rgba(255,255,255,0.36)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "#111827", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10 }} />
                <Bar dataKey="score" radius={[6, 6, 0, 0]}>
                  {weekly.map((_, index) => <Cell key={index} fill={index === weekly.length - 1 ? "#00D4FF" : "rgba(0,212,255,0.32)"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CyberCard>
        </section>
      )}
    </CyberShell>
  );
}
